import { RemindersPanel } from "@/components/crm";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { staff, taskComments, tasks, taskTimers } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Badge, DL, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDefaultCurrency } from "@/lib/settings";
import { entryHours, fmtHours, isBillable, rateFor, sumHours } from "@/lib/timesheets";
import LogTimeForm from "@/components/LogTimeForm";
import { deleteTimeEntry } from "../../timesheets/actions";
import { fmtDate, fmtDateTime, humanize, money } from "@/lib/utils";
import { addAssignee, addTaskComment, deleteTask, deleteTaskComment, removeAssignee, setTaskStatus, startTimer, stopTimer } from "../actions";

const STATUSES = ["not_started", "in_progress", "testing", "awaiting_feedback", "finished"] as const;

export default async function TaskShowPage({ params }: { params: Promise<{ id: string }> }) {
  const taskId = Number((await params).id);
  const session = await requireUser();
  const t = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      project: true, milestone: true, creator: true,
      assignees: { with: { staff: true } },
      comments: { with: { staff: true }, orderBy: asc(taskComments.id) },
      timers: { with: { staff: true, invoice: true }, orderBy: desc(taskTimers.startTime) },
    },
  });
  if (!t) notFound();
  const people = await db.query.staff.findMany({ where: eq(staff.active, true) });
  const { symbol } = await getDefaultCurrency();
  const assigned = new Set(t.assignees.map((a) => a.staffId));
  const myRunning = t.timers.find((tm) => tm.staffId === session.staffId && !tm.endTime);
  const hours = sumHours(t.timers);
  const billableHere = isBillable(t, t.project);
  const rate = rateFor(t, t.project);

  const del = async () => { "use server"; await deleteTask(taskId); };
  const comment = async (fd: FormData) => { "use server"; await addTaskComment(taskId, fd); };
  const assign = async (fd: FormData) => { "use server"; await addAssignee(taskId, fd); };
  const start = async () => { "use server"; await startTimer(taskId); };
  const stop = async (fd: FormData) => { "use server"; await stopTimer(taskId, fd); };

  return (
    <>
      <PageHeader
        title={t.name}
        subtitle={<span className="flex items-center gap-2"><Badge status={t.status} /><Badge status={t.priority} />{t.project ? <Link href={`/projects/${t.project.id}`}>{t.project.name}</Link> : <span>Internal task</span>}</span>}
        back={t.project ? { href: `/projects/${t.project.id}`, label: t.project.name } : { href: "/tasks", label: "Tasks" }}
        actions={
          <>
            <Link href={t.project ? `/projects/${t.project.id}#schedule` : `/tasks?view=gantt`} className="btn-secondary">View on Gantt</Link>
            <Link href={`/tasks/${taskId}/edit`} className="btn-secondary">Edit</Link>
            <form action={del}><SubmitButton className="btn-danger" confirm="Delete this task?">Delete</SubmitButton></form>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <DL rows={[
              ["Start date", fmtDate(t.startDate)], ["Due date", fmtDate(t.dueDate)],
              ["Milestone", t.milestone?.name], ["Created by", t.creator ? `${t.creator.firstName} ${t.creator.lastName}` : null],
              ["Billable", billableHere ? `Yes · ${money(rate, symbol)}/h${t.hourlyRate > 0 ? "" : " (project rate)"}` : "No"], ["Logged time", <a key="lt" href="#timesheet">{fmtHours(hours)}{billableHere ? ` · ${money(hours * rate, symbol)}` : ""}</a>],
            ]} />
            {t.description && <div className="mt-4 border-t pt-4"><p className="prose-pre">{t.description}</p></div>}
          </section>
          <section className="card">
            <h2 className="mb-3">Comments</h2>
            <ul className="mb-4 space-y-3">
              {t.comments.length === 0 && <li className="muted">No comments yet.</li>}
              {t.comments.map((c) => {
                const rm = async () => { "use server"; await deleteTaskComment(taskId, c.id); };
                return (
                  <li key={c.id} className="rounded-md bg-slate-50 p-3 text-sm">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>{c.staff ? `${c.staff.firstName} ${c.staff.lastName}` : "—"} · {fmtDateTime(c.createdAt)}</span>
                      {(session.role === "admin" || c.staffId === session.staffId) && <form action={rm}><button className="text-rose-600 hover:underline">delete</button></form>}
                    </div>
                    <div className="prose-pre">{c.content}</div>
                  </li>
                );
              })}
            </ul>
            <form action={comment} className="space-y-2">
              <textarea name="content" rows={3} required className="field-input" placeholder="Progress update, question, hand-off note…" />
              <SubmitButton className="btn-primary btn-sm">Post comment</SubmitButton>
            </form>
          </section>
          <section className="card" id="timesheet">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2>Timesheet</h2>
              <span className="text-sm text-slate-600">
                {fmtHours(hours)} logged{billableHere ? ` · ${money(hours * rate, symbol)} at ${money(rate, symbol)}/h` : " · non-billable"} ·{" "}
                <Link href={`/timesheets?projectId=${t.projectId ?? ""}`}>All timesheets →</Link>
              </span>
            </div>
            <LogTimeForm
              back={`/tasks/${taskId}`}
              taskId={taskId}
              currentStaffId={session.staffId}
              staff={session.role === "admin" ? people.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` })) : undefined}
            />
            {t.timers.length === 0 ? <p className="muted mt-4">No time logged yet.</p> : (
              <div className="mt-4 overflow-x-auto">
                <table className="table">
                  <thead><tr><th>When</th><th>Person</th><th>Note</th><th className="text-right">Hours</th><th>Billing</th><th /></tr></thead>
                  <tbody>
                    {t.timers.map((tm) => {
                      const del = async () => { "use server"; await deleteTimeEntry(tm.id, `/tasks/${taskId}`); };
                      return (
                        <tr key={tm.id}>
                          <td className="whitespace-nowrap">{fmtDateTime(tm.startTime)}</td>
                          <td>{tm.staff.firstName} {tm.staff.lastName}</td>
                          <td>{tm.note ?? "—"}</td>
                          <td className="text-right tabular-nums">{tm.endTime ? entryHours(tm).toFixed(2) : <span className="badge bg-sky-100 text-sky-800">running</span>}</td>
                          <td>{tm.invoice ? <Link href={`/invoices/${tm.invoice.id}`}>{tm.invoice.number}</Link> : billableHere ? <span className="badge bg-amber-100 text-amber-800">unbilled</span> : <span className="muted">—</span>}</td>
                          <td>{!tm.invoiceId && (session.role === "admin" || tm.staffId === session.staffId) && <form action={del}><SubmitButton className="btn-ghost btn-sm text-rose-600" confirm="Delete this time entry?">Delete</SubmitButton></form>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-3">Status</h2>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((st) => {
                const a = async () => { "use server"; await setTaskStatus(taskId, st); };
                return <form key={st} action={a}><button className={`btn btn-sm ${st === t.status ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`}>{humanize(st)}</button></form>;
              })}
            </div>
          </section>
          <section className="card">
            <h2 className="mb-3">Assignees</h2>
            <ul className="mb-3 space-y-1 text-sm">
              {t.assignees.map((a) => {
                const rm = async () => { "use server"; await removeAssignee(taskId, a.staffId); };
                return <li key={a.staffId} className="flex items-center justify-between"><span>{a.staff.firstName} {a.staff.lastName}</span><form action={rm}><button className="btn-ghost btn-sm text-rose-600">✕</button></form></li>;
              })}
            </ul>
            <form action={assign} className="flex gap-2">
              <select name="staffId" className="field-input">{people.filter((p) => !assigned.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select>
              <SubmitButton className="btn-secondary">Add</SubmitButton>
            </form>
          </section>
          <section className="card">
            <h2 className="mb-3">Timer</h2>
            {myRunning ? (
              <form action={stop} className="space-y-2">
                <p className="text-sm">Timer running since {fmtDateTime(myRunning.startTime)}</p>
                <input name="note" className="field-input" placeholder="What did you work on? (optional)" />
                <SubmitButton className="btn-danger">Stop timer</SubmitButton>
              </form>
            ) : (
              <form action={start}><SubmitButton className="btn-primary">Start timer</SubmitButton></form>
            )}
            <p className="muted mt-3">Stopped timers are added to this task&apos;s timesheet. Forgot to start it? Use “Log time” instead.</p>
          </section>
          <RemindersPanel relType="task" relId={taskId} back={`/tasks/${taskId}`} />
        </div>
      </div>
    </>
  );
}
