/**
 * Builders that turn projects, tasks and timesheet entries into Gantt rows.
 * Used by the Gantt views and by the "project-schedule" / "timesheet-gantt" reports,
 * so the screen and the Excel/Word/CSV exports always show the same schedule.
 */
import { db } from "@/db";
import { entryHours } from "@/lib/timesheets";
import { humanize, round2, today } from "@/lib/utils";
import type { GanttBlock, GanttRow } from "./gantt-types";

export type { GanttRow } from "./gantt-types";

const TZ = process.env.APP_TIMEZONE || "Africa/Nairobi";
const localDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const name = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`;
const min = (xs: (string | null | undefined)[]) => xs.filter(Boolean).sort()[0] as string | undefined;
const max = (xs: (string | null | undefined)[]) => xs.filter(Boolean).sort().at(-1) as string | undefined;

type TaskWith = Awaited<ReturnType<typeof loadTasks>>[number];
async function loadTasks() {
  return db.query.tasks.findMany({ with: { project: { with: { customer: true } }, milestone: true, assignees: { with: { staff: true } }, timers: true } });
}

function taskRow(t: TaskWith, opts: { showProject: boolean }): GanttRow {
  const done = t.status === "finished";
  const logged = t.timers.filter((e) => e.endTime);
  const firstLog = min(logged.map((e) => localDay(e.startTime)));
  const start = t.startDate ?? firstLog ?? t.createdAt.slice(0, 10);
  const end = t.dueDate ?? t.dateFinished ?? start;
  const people = t.assignees.map((a) => name(a.staff)).join(", ");
  const sub = [opts.showProject ? (t.project?.name ?? "Internal") : null, t.milestone?.name, people || "Unassigned"].filter(Boolean).join(" · ");
  return {
    id: `t${t.id}`, label: t.name, sub, href: `/tasks/${t.id}`, level: opts.showProject ? 0 : 1,
    start, end: end < start ? start : end, progress: done ? 100 : null,
    status: humanize(t.status), finished: done,
    overdue: !done && !!t.dueDate && t.dueDate < today(),
    hours: round2(logged.reduce((a, e) => a + entryHours(e), 0)),
  };
}

const byStart = (a: GanttRow, b: GanttRow) => (a.start ?? "9").localeCompare(b.start ?? "9") || (a.end ?? "").localeCompare(b.end ?? "");

/** All projects (optionally filtered by status), each optionally followed by its tasks. */
export async function projectGanttRows(opts: { status?: string; withTasks?: boolean; projectId?: number } = {}) {
  const projects = await db.query.projects.findMany({ with: { customer: true, milestones: true, members: { with: { staff: true } } } });
  const tasks = opts.withTasks ? await loadTasks() : [];
  const rows: GanttRow[] = [];
  const list = projects
    .filter((p) => (!opts.status || p.status === opts.status) && (!opts.projectId || p.id === opts.projectId))
    .map((p) => {
      const pt = tasks.filter((t) => t.projectId === p.id);
      const end = p.deadline ?? max([...pt.map((t) => t.dueDate), ...p.milestones.map((m) => m.dueDate)]) ?? p.startDate;
      const closed = p.status === "finished" || p.status === "cancelled";
      const row: GanttRow = {
        id: `p${p.id}`, label: p.name, href: `/projects/${p.id}`, level: 0,
        sub: [p.customer?.company ?? "Internal", p.members.map((m) => m.staff.firstName).join(", ")].filter(Boolean).join(" · "),
        start: p.startDate, end: end < p.startDate ? p.startDate : end, progress: p.progress,
        status: humanize(p.status), finished: p.status === "finished",
        overdue: !closed && !!p.deadline && p.deadline < today(),
        milestones: p.milestones.filter((m) => m.dueDate).sort((a, b) => a.order - b.order).map((m) => ({ date: m.dueDate!, label: m.name })),
        hours: opts.withTasks ? round2(pt.reduce((a, t) => a + t.timers.filter((e) => e.endTime).reduce((s, e) => s + entryHours(e), 0), 0)) : undefined,
      };
      return { row, children: pt.map((t) => taskRow(t, { showProject: false })).sort(byStart) };
    })
    .sort((a, b) => byStart(a.row, b.row));
  for (const { row, children } of list) rows.push(row, ...children);
  return rows;
}

/** Tasks across projects, filtered by project, assignee and open/all. */
export async function taskGanttRows(opts: { projectId?: number; staffId?: number; open?: boolean } = {}) {
  return (await loadTasks())
    .filter((t) => (!opts.projectId || t.projectId === opts.projectId)
      && (!opts.staffId || t.assignees.some((a) => a.staffId === opts.staffId))
      && (!opts.open || t.status !== "finished"))
    .map((t) => taskRow(t, { showProject: true }))
    .sort(byStart);
}

/**
 * Timesheet Gantt: one row per task × person with time logged in [from, to].
 * The faint band is the task's planned window; blocks are hours logged each day.
 */
export async function timesheetGanttRows(opts: { from: string; to: string; staffId?: number; projectId?: number }) {
  const entries = (await db.query.taskTimers.findMany({ with: { staff: true, task: { with: { project: true } } } }))
    .filter((e) => e.endTime)
    .map((e) => ({ ...e, day: localDay(e.startTime) }))
    .filter((e) => e.day >= opts.from && e.day <= opts.to && (!opts.staffId || e.staffId === opts.staffId) && (!opts.projectId || e.task.projectId === opts.projectId));
  const groups = new Map<string, typeof entries>();
  for (const e of entries) { const k = `${e.taskId}:${e.staffId}`; groups.set(k, [...(groups.get(k) ?? []), e]); }
  const rows: GanttRow[] = [];
  for (const [k, es] of groups) {
    const t = es[0].task;
    const perDay = new Map<string, { hours: number; notes: string[] }>();
    for (const e of es) { const d = perDay.get(e.day) ?? { hours: 0, notes: [] }; d.hours += entryHours(e); if (e.note) d.notes.push(e.note); perDay.set(e.day, d); }
    const blocks: GanttBlock[] = [...perDay.entries()].sort().map(([date, d]) => ({ date, hours: round2(d.hours), note: d.notes.join("; ") || undefined }));
    rows.push({
      id: `ts${k.replace(":", "-")}`, label: t.name, href: `/tasks/${t.id}`,
      sub: `${name(es[0].staff)} · ${t.project?.name ?? "Internal"}`,
      start: t.startDate ?? t.dueDate ?? null, end: t.dueDate ?? t.startDate ?? null,
      status: humanize(t.status), finished: t.status === "finished", blocks,
      hours: round2(blocks.reduce((a, b) => a + b.hours, 0)),
    });
  }
  return rows.sort((a, b) => (a.sub ?? "").localeCompare(b.sub ?? "") || (a.blocks![0].date).localeCompare(b.blocks![0].date));
}
