import ExportButtons from "@/components/ExportButtons";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { Badge, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtDate, humanize, today } from "@/lib/utils";
import Gantt from "@/components/Gantt";
import { taskGanttRows } from "@/lib/gantt";

export const metadata = { title: "Tasks" };
const COLUMNS = ["not_started", "in_progress", "testing", "awaiting_feedback", "finished"] as const;

export default async function TasksBoard({ searchParams }: { searchParams: Promise<{ mine?: string; view?: string; projectId?: string; staffId?: string; open?: string }> }) {
  const sp = await searchParams;
  const { mine } = sp;
  const s = await requireUser();
  const gantt = sp.view === "gantt";
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ mine, view: sp.view, projectId: sp.projectId, staffId: sp.staffId, open: sp.open, ...patch }).filter(([, v]) => v) as [string, string][]).toString();
    return `/tasks${q ? `?${q}` : ""}`;
  };
  let rows = await db.query.tasks.findMany({ with: { project: true, assignees: { with: { staff: true } } }, orderBy: desc(tasks.id) });
  if (mine) rows = rows.filter((t) => t.assignees.some((a) => a.staffId === s.staffId));
  const ganttStaff = mine ? s.staffId : sp.staffId ? Number(sp.staffId) : undefined;
  const ganttRows = gantt ? await taskGanttRows({ projectId: sp.projectId ? Number(sp.projectId) : undefined, staffId: ganttStaff, open: !!sp.open }) : [];
  const projectsList = gantt ? await db.query.projects.findMany({ columns: { id: true, name: true } }) : [];
  const people = gantt ? await db.query.staff.findMany({ where: (t, { eq }) => eq(t.active, true) }) : [];
  const pill = (a: boolean) => `btn btn-sm ${a ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`;
  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={gantt ? "All tasks across projects on a timeline" : "All tasks across projects, grouped by status"}
        actions={
          <>
            <div className="flex" role="group" aria-label="View">
              <Link href={href({ view: undefined })} className={pill(!gantt)}>Board</Link>
              <Link href={href({ view: "gantt" })} className={pill(gantt)} data-testid="tasks-gantt-link">Gantt</Link>
            </div>
            <Link href={href({ mine: mine ? undefined : "1" })} className="btn-secondary">{mine ? "Show all" : "Only mine"}</Link>
            <Link href="/tasks/create" className="btn-primary">+ New task</Link>
          </>
        }
      />
      <div className="-mt-3 mb-4 flex justify-end">{gantt ? <ExportButtons report="project-schedule" params={{ projectId: sp.projectId, staffId: ganttStaff ? String(ganttStaff) : undefined, open: sp.open, tasks: "only" }} compact /> : <ExportButtons report="task-status" params={{}} compact />}</div>
      {gantt ? (
        <>
          <form className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="view" value="gantt" />
            {mine && <input type="hidden" name="mine" value="1" />}
            <select name="projectId" defaultValue={sp.projectId ?? ""} className="field-input w-56" aria-label="Project"><option value="">All projects</option>{projectsList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            {!mine && <select name="staffId" defaultValue={sp.staffId ?? ""} className="field-input w-44" aria-label="Assignee"><option value="">Everyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select>}
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="open" value="1" defaultChecked={!!sp.open} /> Open tasks only</label>
            <button className="btn-secondary">Filter</button>
          </form>
          <Gantt rows={ganttRows} today={today()} testId="gantt-tasks" title={`Task timeline · ${ganttRows.length} task${ganttRows.length === 1 ? "" : "s"}`} emptyText="No tasks match." />
        </>
      ) : (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const items = rows.filter((t) => t.status === col);
          return (
            <div key={col} className="kanban-col">
              <div className="flex items-center justify-between text-sm font-semibold"><span>{humanize(col)}</span><span className="text-xs text-slate-500">{items.length}</span></div>
              {items.map((t) => {
                const late = t.dueDate && t.dueDate < today() && t.status !== "finished";
                return (
                  <Link key={t.id} href={`/tasks/${t.id}`} className="kanban-card">
                    <div className="font-medium text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.project?.name ?? "Internal"}</div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <Badge status={t.priority} />
                      <span className={late ? "font-medium text-rose-700" : "text-slate-500"}>{fmtDate(t.dueDate)}</span>
                    </div>
                    {t.assignees.length > 0 && <div className="mt-1 text-xs text-slate-500">{t.assignees.map((a) => a.staff.firstName).join(", ")}</div>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
      )}
    </>
  );
}
