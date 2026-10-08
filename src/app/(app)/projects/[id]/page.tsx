import { RemindersPanel } from "@/components/crm";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { invoices, milestones, projects, staff, tasks } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Badge, DL, Empty, Field, PageHeader } from "@/components/ui";
import { getDefaultCurrency } from "@/lib/settings";
import { addInterval, fmtDate, fmtDateTime, humanize, money, round2, today } from "@/lib/utils";
import { requireUser } from "@/lib/auth";
import { entryHours, fmtHours, isBillable, rateFor } from "@/lib/timesheets";
import LogTimeForm from "@/components/LogTimeForm";
import Gantt from "@/components/Gantt";
import ExportButtons from "@/components/ExportButtons";
import { projectGanttRows, timesheetGanttRows } from "@/lib/gantt";
import { invoiceProjectTime } from "../../timesheets/actions";
import { addMilestone, addProjectMember, deleteMilestone, deleteProject, removeProjectMember, updateProjectProgress } from "../actions";

export default async function ProjectShowPage({ params }: { params: Promise<{ id: string }> }) {
  const projectId = Number((await params).id);
  const p = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      customer: true,
      members: { with: { staff: true } },
      milestones: { orderBy: asc(milestones.dueDate) },
      tasks: { orderBy: desc(tasks.id), with: { assignees: { with: { staff: true } }, milestone: true, timers: { with: { staff: true, invoice: true } } } },
      invoices: { orderBy: desc(invoices.id) },
      expenses: { with: { category: true } },
      tickets: { with: { status: true } },
    },
  });
  if (!p) notFound();
  const people = await db.query.staff.findMany({ where: eq(staff.active, true) });
  const { symbol } = await getDefaultCurrency();
  const memberIds = new Set(p.members.map((m) => m.staffId));
  const session = await requireUser();
  const scheduleRows = await projectGanttRows({ projectId, withTasks: true });
  const tsTo = today(), tsFrom = addInterval(tsTo, "day", -41);
  const timeRows = await timesheetGanttRows({ from: tsFrom, to: tsTo, projectId });
  // Timesheet roll-up: every entry on every task in this project.
  const entries = p.tasks.flatMap((t) => t.timers.filter((e) => e.endTime).map((e) => ({ ...e, task: t })));
  const hours = round2(entries.reduce((a, e) => a + entryHours(e), 0));
  const billableEntries = entries.filter((e) => isBillable(e.task, p));
  const billableHours = round2(billableEntries.reduce((a, e) => a + entryHours(e), 0));
  const unbilledEntries = billableEntries.filter((e) => !e.invoiceId);
  const unbilledHours = round2(unbilledEntries.reduce((a, e) => a + entryHours(e), 0));
  const unbilledValue = round2(unbilledEntries.reduce((a, e) => a + entryHours(e) * rateFor(e.task, p), 0));
  const perMember = [...entries.reduce((m, e) => m.set(`${e.staff.firstName} ${e.staff.lastName}`, (m.get(`${e.staff.firstName} ${e.staff.lastName}`) ?? 0) + entryHours(e)), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const recent = [...entries].sort((a, b) => b.startTime.localeCompare(a.startTime)).slice(0, 8);
  const billTime = async () => { "use server"; await invoiceProjectTime(projectId); };
  const expenseTotal = p.expenses.reduce((a, e) => a + e.amount + e.tax, 0);
  const invoiced = p.invoices.reduce((a, i) => a + i.total, 0);

  const progress = async (fd: FormData) => { "use server"; await updateProjectProgress(projectId, fd); };
  const addMember = async (fd: FormData) => { "use server"; await addProjectMember(projectId, fd); };
  const addMs = async (fd: FormData) => { "use server"; await addMilestone(projectId, fd); };
  const del = async () => { "use server"; await deleteProject(projectId); };

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={<span className="flex items-center gap-2"><Badge status={p.status} />{p.customer && <Link href={`/customers/${p.customer.id}`}>{p.customer.company}</Link>}</span>}
        back={{ href: "/projects", label: "Projects" }}
        actions={
          <>
            <Link href={`/projects/${projectId}/tasks/create`} className="btn-primary">+ New task</Link>
            {p.customer && <Link href={`/invoices/create?customerId=${p.customer.id}&projectId=${projectId}`} className="btn-secondary">Invoice project</Link>}
            <Link href={`/projects/${projectId}/edit`} className="btn-secondary">Edit</Link>
            <form action={del}><SubmitButton className="btn-danger" confirm="Delete this project, its tasks and milestones?">Delete</SubmitButton></form>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-4">Overview</h2>
          <DL rows={[
            ["Start date", fmtDate(p.startDate)], ["Deadline", fmtDate(p.deadline)],
            ["Billing type", humanize(p.billingType)],
            ["Project cost", p.billingType === "fixed_rate" ? money(p.projectCost, symbol) : `${money(p.ratePerHour, symbol)} / hour`],
            ["Logged hours", <a key="lh" href="#timesheet">{fmtHours(hours)}</a>], ["Invoiced", money(invoiced, symbol)], ["Expenses", money(expenseTotal, symbol)],
            ["Tasks done", `${p.tasks.filter((t) => t.status === "finished").length} / ${p.tasks.length}`],
          ]} />
          {p.description && <div className="mt-4 border-t pt-4"><p className="prose-pre">{p.description}</p></div>}
        </section>
        <section className="card space-y-3">
          <h2>Progress</h2>
          <div className="h-3 rounded bg-slate-200"><div className="h-3 rounded bg-brand-500" style={{ width: `${p.progress}%` }} /></div>
          <form action={progress} className="space-y-3">
            <Field label="Progress %"><input type="range" name="progress" min="0" max="100" step="5" defaultValue={p.progress} className="w-full" /></Field>
            <Field label="Status">
              <select name="status" className="field-input" defaultValue={p.status}>
                <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="on_hold">On hold</option><option value="finished">Finished</option><option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <SubmitButton className="btn-primary btn-sm">Update</SubmitButton>
          </form>
        </section>
      </div>

      <section className="mt-6" id="schedule">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2>Schedule</h2>
          <ExportButtons report="project-schedule" params={{ projectId: String(projectId), tasks: "1" }} compact />
        </div>
        <Gantt rows={scheduleRows} today={today()} testId="gantt-project" title="Project Gantt · project, milestones and tasks" emptyText="Add tasks with start and due dates to build the schedule." />
      </section>

      <section className="card mt-6">
        <div className="mb-3 flex items-center justify-between"><h2>Tasks</h2><Link href={`/projects/${projectId}/tasks/create`} className="text-sm">+ Add task</Link></div>
        {p.tasks.length === 0 ? <Empty>No tasks yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Task</th><th>Milestone</th><th>Assignees</th><th>Priority</th><th>Due</th><th className="text-right">Hours</th><th>Status</th></tr></thead>
              <tbody>
                {p.tasks.map((t) => (
                  <tr key={t.id}>
                    <td><Link href={`/tasks/${t.id}`}>{t.name}</Link></td>
                    <td>{t.milestone?.name ?? "—"}</td>
                    <td>{t.assignees.map((a) => a.staff.firstName).join(", ") || "—"}</td>
                    <td><Badge status={t.priority} /></td>
                    <td>{fmtDate(t.dueDate)}</td>
                    <td className="text-right tabular-nums">{round2(t.timers.reduce((a, e) => a + entryHours(e), 0)).toFixed(2)}</td>
                    <td><Badge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 max-w-xl"><RemindersPanel relType="project" relId={projectId} back={`/projects/${projectId}`} /></div>
      <section className="card mt-6" id="timesheet">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2>Timesheet</h2>
          <div className="flex flex-wrap gap-2">
            <Link href={`/timesheets?projectId=${projectId}`} className="btn-secondary btn-sm">All entries →</Link>
            {unbilledHours > 0 && p.customer && (
              <form action={billTime}><SubmitButton className="btn-primary btn-sm" confirm={`Create a draft invoice for ${unbilledHours} unbilled hours (${money(unbilledValue, symbol)})?`}>Invoice unbilled time</SubmitButton></form>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-md bg-slate-50 p-3"><div className="stat-label">Logged</div><div className="text-lg font-semibold tabular-nums">{fmtHours(hours)}</div></div>
          <div className="rounded-md bg-slate-50 p-3"><div className="stat-label">Billable</div><div className="text-lg font-semibold tabular-nums">{fmtHours(billableHours)}</div></div>
          <div className="rounded-md bg-slate-50 p-3"><div className="stat-label">Unbilled</div><div className="text-lg font-semibold tabular-nums" data-testid="unbilled-hours">{fmtHours(unbilledHours)}</div></div>
          <div className="rounded-md bg-slate-50 p-3"><div className="stat-label">Unbilled value</div><div className="text-lg font-semibold tabular-nums">{money(unbilledValue, symbol)}</div></div>
        </div>
        {p.billingType === "fixed_rate" && <p className="muted mt-2">Fixed-rate project: only time on tasks marked billable with their own hourly rate is invoiceable. Switch billing to “project hours” to bill all time at the project rate.</p>}
        {p.tasks.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold">Log time on this project</h3>
            <LogTimeForm
              back={`/projects/${projectId}#timesheet`}
              currentStaffId={session.staffId}
              tasks={p.tasks.map((t) => ({ id: t.id, name: t.name, projectName: p.name }))}
              staff={session.role === "admin" ? people.map((x) => ({ id: x.id, name: `${x.firstName} ${x.lastName}` })) : undefined}
            />
          </div>
        )}
        <div className="mt-4">
          <Gantt rows={timeRows} mode="time" from={tsFrom} to={tsTo} today={today()} testId="gantt-project-time" title="Time Gantt · last 6 weeks" emptyText="No time logged on this project in the last 6 weeks." />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-semibold">By member</h3>
            {perMember.length === 0 ? <p className="muted">No time logged yet.</p> : <ul className="divide-y divide-slate-100 text-sm">{perMember.map(([n, h]) => <li key={n} className="flex justify-between py-1.5"><span>{n}</span><span className="tabular-nums">{fmtHours(h)}</span></li>)}</ul>}
          </div>
          <div className="lg:col-span-2">
            <h3 className="mb-2 text-sm font-semibold">Latest entries</h3>
            {recent.length === 0 ? <p className="muted">No time logged yet.</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {recent.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-1.5">
                    <span className="min-w-0"><Link href={`/tasks/${e.taskId}`}>{e.task.name}</Link> <span className="muted">· {e.staff.firstName} · {fmtDateTime(e.startTime)}</span>{e.note && <div className="muted truncate">{e.note}</div>}</span>
                    <span className="flex shrink-0 items-center gap-2"><span className="tabular-nums">{entryHours(e).toFixed(2)} h</span>{e.invoice ? <Link href={`/invoices/${e.invoice.id}`} className="text-xs">{e.invoice.number}</Link> : isBillable(e.task, p) ? <span className="badge bg-amber-100 text-amber-800">unbilled</span> : null}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3">Members</h2>
          <ul className="mb-4 divide-y divide-slate-100 text-sm">
            {p.members.map((m) => {
              const rm = async () => { "use server"; await removeProjectMember(projectId, m.staffId); };
              return (
                <li key={m.staffId} className="flex items-center justify-between py-2">
                  <span>{m.staff.firstName} {m.staff.lastName}</span>
                  <form action={rm}><button className="btn-ghost btn-sm text-rose-600">Remove</button></form>
                </li>
              );
            })}
          </ul>
          <form action={addMember} className="flex gap-2">
            <select name="staffId" className="field-input">
              {people.filter((x) => !memberIds.has(x.id)).map((x) => <option key={x.id} value={x.id}>{x.firstName} {x.lastName}</option>)}
            </select>
            <SubmitButton className="btn-secondary">Add</SubmitButton>
          </form>
        </section>
        <section className="card">
          <h2 className="mb-3">Milestones</h2>
          <ul className="mb-4 divide-y divide-slate-100 text-sm">
            {p.milestones.length === 0 && <li className="muted py-2">No milestones.</li>}
            {p.milestones.map((m) => {
              const rm = async () => { "use server"; await deleteMilestone(projectId, m.id); };
              const open = p.tasks.filter((t) => t.milestoneId === m.id);
              return (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <span>{m.name} <span className="muted">· due {fmtDate(m.dueDate)} · {open.filter((t) => t.status === "finished").length}/{open.length} tasks</span></span>
                  <form action={rm}><SubmitButton className="btn-ghost btn-sm text-rose-600" confirm="Remove this milestone?">Remove</SubmitButton></form>
                </li>
              );
            })}
          </ul>
          <form action={addMs} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input name="name" required placeholder="Milestone name" className="field-input sm:col-span-2" />
            <input name="dueDate" type="date" className="field-input" />
            <SubmitButton className="btn-secondary sm:col-span-3">Add milestone</SubmitButton>
          </form>
        </section>
        <section className="card">
          <h2 className="mb-3">Invoices</h2>
          {p.invoices.length === 0 ? <p className="muted">None.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {p.invoices.map((i) => <li key={i.id} className="flex justify-between py-2"><Link href={`/invoices/${i.id}`}>{i.number}</Link><span className="flex gap-2"><span className="tabular-nums">{money(i.total, symbol)}</span><Badge status={i.status} /></span></li>)}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="mb-3">Expenses</h2>
          {p.expenses.length === 0 ? <p className="muted">None.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {p.expenses.map((e) => <li key={e.id} className="flex justify-between py-2"><span>{e.name ?? e.category.name} <span className="muted">· {fmtDate(e.date)}</span></span><span className="tabular-nums">{money(e.amount + e.tax, symbol)}</span></li>)}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
