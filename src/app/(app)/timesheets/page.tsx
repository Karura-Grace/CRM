import ExportButtons from "@/components/ExportButtons";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { staff, taskTimers } from "@/db/schema";
import LogTimeForm from "@/components/LogTimeForm";
import Gantt from "@/components/Gantt";
import { timesheetGanttRows } from "@/lib/gantt";
import SubmitButton from "@/components/SubmitButton";
import { Empty, PageHeader, TableWrap } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDefaultCurrency } from "@/lib/settings";
import { entryHours, fmtHours, isBillable, rateFor } from "@/lib/timesheets";
import { addInterval, fmtDate, fmtDateTime, money, round2, today } from "@/lib/utils";
import { deleteTimeEntry } from "./actions";

export const metadata = { title: "Timesheets" };

type SP = { staffId?: string; projectId?: string; from?: string; to?: string; billed?: string; week?: string };

/** Monday of the week containing `d` (YYYY-MM-DD). */
function mondayOf(d: string) {
  const dt = new Date(`${d}T00:00:00Z`);
  const dow = (dt.getUTCDay() + 6) % 7;
  return addInterval(d, "day", -dow);
}
const localDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: process.env.APP_TIMEZONE || "Africa/Nairobi" });

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const session = await requireUser();
  const { symbol } = await getDefaultCurrency();
  const people = await db.query.staff.findMany({ where: eq(staff.active, true) });
  const allProjects = await db.query.projects.findMany({ columns: { id: true, name: true } });
  const allTasks = await db.query.tasks.findMany({ with: { project: true } });

  const all = await db.query.taskTimers.findMany({
    with: { staff: true, invoice: true, task: { with: { project: true } } },
    orderBy: desc(taskTimers.startTime),
  });

  const staffId = sp.staffId ? Number(sp.staffId) : null;
  const projectId = sp.projectId ? Number(sp.projectId) : null;
  const rows = all.filter((e) => {
    const d = localDate(e.startTime);
    if (staffId && e.staffId !== staffId) return false;
    if (projectId && e.task.projectId !== projectId) return false;
    if (sp.from && d < sp.from) return false;
    if (sp.to && d > sp.to) return false;
    if (sp.billed === "unbilled" && (e.invoiceId || !isBillable(e.task, e.task.project))) return false;
    if (sp.billed === "billed" && !e.invoiceId) return false;
    return true;
  });

  const done = rows.filter((e) => e.endTime);
  const totalH = round2(done.reduce((a, e) => a + entryHours(e), 0));
  const billable = done.filter((e) => isBillable(e.task, e.task.project));
  const billableH = round2(billable.reduce((a, e) => a + entryHours(e), 0));
  const unbilled = billable.filter((e) => !e.invoiceId);
  const unbilledH = round2(unbilled.reduce((a, e) => a + entryHours(e), 0));
  const unbilledValue = unbilled.reduce((a, e) => a + entryHours(e) * rateFor(e.task, e.task.project), 0);

  const byKey = <K extends string | number>(key: (e: (typeof done)[number]) => K) => {
    const m = new Map<K, number>();
    for (const e of done) m.set(key(e), (m.get(key(e)) ?? 0) + entryHours(e));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const byPerson = byKey((e) => `${e.staff.firstName} ${e.staff.lastName}`);
  const byProject = byKey((e) => e.task.project?.name ?? "Internal");

  // Weekly grid for one person (defaults to you).
  const weekStart = mondayOf(sp.week || today());
  const days = Array.from({ length: 7 }, (_, i) => addInterval(weekStart, "day", i));
  const gridStaffId = staffId ?? session.staffId;
  const weekEntries = all.filter((e) => e.staffId === gridStaffId && e.endTime && days.includes(localDate(e.startTime)));
  const gridTasks = [...new Map(weekEntries.map((e) => [e.taskId, e.task])).values()];
  const cell = (taskId: number, day: string) => round2(weekEntries.filter((e) => e.taskId === taskId && localDate(e.startTime) === day).reduce((a, e) => a + entryHours(e), 0));
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/timesheets${p.toString() ? `?${p}` : ""}`;
  };
  const back = qs({});
  // Timesheet Gantt: the filtered date range, or the last four weeks.
  const ganttTo = sp.to || today(), ganttFrom = sp.from || addInterval(ganttTo, "day", -27);
  const ganttRows = await timesheetGanttRows({ from: ganttFrom, to: ganttTo, staffId: staffId ?? undefined, projectId: projectId ?? undefined });
  const gridPerson = people.find((p) => p.id === gridStaffId);

  return (
    <>
      <PageHeader title="Timesheets" subtitle="Time logged against tasks and projects — from the task timer or entered manually" />
      <div className="-mt-3 mb-4 flex justify-end"><ExportButtons report="timesheet-detail" params={{ staffId: sp.staffId, projectId: sp.projectId, from: sp.from, to: sp.to }} compact /></div>

      <section className="card mb-6">
        <h2 className="mb-3">Log time</h2>
        <LogTimeForm
          back={back}
          currentStaffId={session.staffId}
          tasks={allTasks.map((t) => ({ id: t.id, name: t.name, projectName: t.project?.name ?? null }))}
          staff={session.role === "admin" ? people.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` })) : undefined}
        />
      </section>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <select name="staffId" defaultValue={sp.staffId ?? ""} className="field-input w-44"><option value="">Everyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select>
        <select name="projectId" defaultValue={sp.projectId ?? ""} className="field-input w-56"><option value="">All projects</option>{allProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select name="billed" defaultValue={sp.billed ?? ""} className="field-input w-40"><option value="">All time</option><option value="unbilled">Unbilled billable</option><option value="billed">Invoiced</option></select>
        <input type="date" name="from" defaultValue={sp.from ?? ""} className="field-input w-40" aria-label="From" />
        <input type="date" name="to" defaultValue={sp.to ?? ""} className="field-input w-40" aria-label="To" />
        <button className="btn-secondary">Filter</button>
        <Link href="/timesheets" className="btn-ghost">Clear</Link>
      </form>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="stat"><span className="stat-label">Total hours</span><span className="stat-value" data-testid="ts-total">{totalH.toFixed(2)}</span></div>
        <div className="stat"><span className="stat-label">Billable hours</span><span className="stat-value">{billableH.toFixed(2)}</span></div>
        <div className="stat"><span className="stat-label">Unbilled billable</span><span className="stat-value">{unbilledH.toFixed(2)}</span></div>
        <div className="stat"><span className="stat-label">Unbilled value</span><span className="text-lg font-semibold tabular-nums text-slate-900">{money(unbilledValue, symbol)}</span></div>
      </div>

      <section className="card mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2>Week of {fmtDate(weekStart)} · {gridPerson ? `${gridPerson.firstName} ${gridPerson.lastName}` : "—"}</h2>
          <div className="flex gap-1">
            <Link href={qs({ week: addInterval(weekStart, "day", -7) })} className="btn-secondary btn-sm">← Prev</Link>
            <Link href={qs({ week: undefined })} className="btn-secondary btn-sm">This week</Link>
            <Link href={qs({ week: addInterval(weekStart, "day", 7) })} className="btn-secondary btn-sm">Next →</Link>
          </div>
        </div>
        {gridTasks.length === 0 ? <Empty>No time logged this week{staffId ? "" : " by you"}. Pick a person in the filter to see their week.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Task</th>{days.map((d) => <th key={d} className="text-right">{new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit" })}</th>)}<th className="text-right">Total</th></tr></thead>
              <tbody>
                {gridTasks.map((t) => {
                  const vals = days.map((d) => cell(t.id, d));
                  return (
                    <tr key={t.id}>
                      <td><Link href={`/tasks/${t.id}`}>{t.name}</Link><div className="muted">{t.project ? <Link href={`/projects/${t.project.id}`}>{t.project.name}</Link> : "Internal"}</div></td>
                      {vals.map((v, i) => <td key={i} className="text-right tabular-nums">{v ? v.toFixed(2) : <span className="text-slate-300">–</span>}</td>)}
                      <td className="text-right font-semibold tabular-nums">{round2(vals.reduce((a, b) => a + b, 0)).toFixed(2)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-semibold">
                  <td>Total</td>
                  {days.map((d) => <td key={d} className="text-right tabular-nums">{round2(gridTasks.reduce((a, t) => a + cell(t.id, d), 0)).toFixed(2)}</td>)}
                  <td className="text-right tabular-nums">{round2(weekEntries.reduce((a, e) => a + entryHours(e), 0)).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6" id="gantt">
        <div className="mb-2 flex justify-end"><ExportButtons report="time-gantt" params={{ staffId: sp.staffId, projectId: sp.projectId, from: ganttFrom, to: ganttTo }} compact /></div>
        <Gantt rows={ganttRows} mode="time" from={ganttFrom} to={ganttTo} today={today()} testId="gantt-timesheet"
          title={`Time Gantt · ${fmtDate(ganttFrom)} – ${fmtDate(ganttTo)} · logged hours against each task's planned window`}
          emptyText="No time logged in this range." />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3">Hours by person</h2>
          {byPerson.length === 0 ? <p className="muted">No time in view.</p> : <ul className="divide-y divide-slate-100 text-sm">{byPerson.map(([k, h]) => <li key={k} className="flex justify-between py-2"><span>{k}</span><span className="tabular-nums">{fmtHours(h)}</span></li>)}</ul>}
        </section>
        <section className="card">
          <h2 className="mb-3">Hours by project</h2>
          {byProject.length === 0 ? <p className="muted">No time in view.</p> : <ul className="divide-y divide-slate-100 text-sm">{byProject.map(([k, h]) => <li key={k} className="flex justify-between py-2"><span>{k}</span><span className="tabular-nums">{fmtHours(h)}</span></li>)}</ul>}
        </section>
      </div>

      <h2 className="mb-3 mt-8">Entries ({rows.length})</h2>
      {rows.length === 0 ? <Empty>No time entries match.</Empty> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Date</th><th>Person</th><th>Project</th><th>Task</th><th>Note</th><th className="text-right">Hours</th><th>Billing</th><th /></tr></thead>
            <tbody>
              {rows.map((e) => {
                const del = async () => { "use server"; await deleteTimeEntry(e.id, back); };
                const billableEntry = isBillable(e.task, e.task.project);
                const canDelete = !e.invoiceId && (session.role === "admin" || e.staffId === session.staffId);
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{fmtDateTime(e.startTime)}</td>
                    <td>{e.staff.firstName} {e.staff.lastName}</td>
                    <td>{e.task.project ? <Link href={`/projects/${e.task.project.id}`}>{e.task.project.name}</Link> : <span className="muted">Internal</span>}</td>
                    <td><Link href={`/tasks/${e.taskId}`}>{e.task.name}</Link></td>
                    <td className="max-w-xs">{e.note ?? "—"}</td>
                    <td className="text-right tabular-nums">{e.endTime ? entryHours(e).toFixed(2) : <span className="badge bg-sky-100 text-sky-800">running</span>}</td>
                    <td>
                      {e.invoice ? <Link href={`/invoices/${e.invoice.id}`}>{e.invoice.number}</Link>
                        : billableEntry ? <span className="badge bg-amber-100 text-amber-800">unbilled</span>
                        : <span className="muted">non-billable</span>}
                    </td>
                    <td>{canDelete && <form action={del}><SubmitButton className="btn-ghost btn-sm text-rose-600" confirm="Delete this time entry?">Delete</SubmitButton></form>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
