import ExportButtons from "@/components/ExportButtons";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { Badge, Empty, PageHeader, TableWrap } from "@/components/ui";
import { fmtDate, humanize, today } from "@/lib/utils";
import Gantt from "@/components/Gantt";
import { projectGanttRows } from "@/lib/gantt";

export const metadata = { title: "Projects" };
const STATUSES = ["not_started", "in_progress", "on_hold", "finished", "cancelled"] as const;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string; tasks?: string }> }) {
  const { status, view, tasks: showTasks } = await searchParams;
  const gantt = view === "gantt";
  const st = STATUSES.find((s) => s === status);
  const rows = await db.query.projects.findMany({ where: st ? eq(projects.status, st) : undefined, with: { customer: true, members: { with: { staff: true } }, tasks: true }, orderBy: desc(projects.id) });
  const pill = (a: boolean) => `btn btn-sm ${a ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`;
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ status: st, view, tasks: showTasks, ...patch }).filter(([, v]) => v) as [string, string][]).toString();
    return `/projects${q ? `?${q}` : ""}`;
  };
  const ganttRows = gantt ? await projectGanttRows({ status: st, withTasks: !!showTasks }) : [];
  return (
    <>
      <PageHeader title="Projects" actions={<>
        <div className="flex rounded-md" role="group" aria-label="View">
          <Link href={href({ view: undefined, tasks: undefined })} className={pill(!gantt)}>List</Link>
          <Link href={href({ view: "gantt" })} className={pill(gantt)} data-testid="projects-gantt-link">Gantt</Link>
        </div>
        <Link href="/projects/create" className="btn-primary">+ New project</Link></>} />
      <div className="-mt-3 mb-4 flex justify-end">{gantt ? <ExportButtons report="project-schedule" params={{ status: st, tasks: showTasks ? "1" : "0" }} compact /> : <ExportButtons report="project-profitability" params={{}} compact />}</div>
      <div className="mb-4 flex flex-wrap gap-1">
        <Link href={href({ status: undefined })} className={pill(!st)}>All</Link>
        {STATUSES.map((s) => <Link key={s} href={href({ status: s })} className={pill(st === s)}>{humanize(s)}</Link>)}
        {gantt && <Link href={href({ tasks: showTasks ? undefined : "1" })} className={`${pill(!!showTasks)} ml-auto`}>{showTasks ? "✓ " : ""}Show tasks</Link>}
      </div>
      {gantt ? <Gantt rows={ganttRows} today={today()} testId="gantt-projects" title={`Project timeline${st ? ` · ${humanize(st)}` : ""}${showTasks ? " with tasks" : ""}`} emptyText="No projects to schedule." /> : rows.length === 0 ? <Empty>No projects.</Empty> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Project</th><th>Customer</th><th>Members</th><th>Tasks</th><th>Deadline</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const done = p.tasks.filter((t) => t.status === "finished").length;
                const late = p.deadline && p.deadline < today() && p.status !== "finished" && p.status !== "cancelled";
                return (
                  <tr key={p.id}>
                    <td><Link href={`/projects/${p.id}`} className="font-medium">{p.name}</Link></td>
                    <td>{p.customer?.company ?? <span className="muted">Internal</span>}</td>
                    <td>{p.members.map((m) => `${m.staff.firstName}`).join(", ") || "—"}</td>
                    <td>{done}/{p.tasks.length}</td>
                    <td className={late ? "font-medium text-rose-700" : ""}>{fmtDate(p.deadline)}</td>
                    <td className="w-40"><div className="h-2 rounded bg-slate-200"><div className="h-2 rounded bg-brand-500" style={{ width: `${p.progress}%` }} /></div><span className="text-xs text-slate-500">{p.progress}%</span></td>
                    <td><Badge status={p.status} /></td>
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
