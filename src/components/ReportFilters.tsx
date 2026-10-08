import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { customers, leadStatuses, projects } from "@/db/schema";
import type { Params, ReportDef } from "@/lib/reports/types";
import { range } from "@/lib/reports/helpers";
import { addInterval, today } from "@/lib/utils";

/** GET form rendering exactly the filters a report declares. */
export default async function ReportFilters({ report, params, action }: { report: ReportDef; params: Params; action: string }) {
  const f = new Set(report.filters);
  const [custs, people, projs, stages, tags, segs] = await Promise.all([
    f.has("customer") || f.has("customerRequired") ? db.query.customers.findMany({ orderBy: asc(customers.company) }) : [],
    f.has("staff") ? db.query.staff.findMany() : [],
    f.has("project") ? db.query.projects.findMany({ orderBy: asc(projects.name) }) : [],
    f.has("leadStatus") ? db.query.leadStatuses.findMany({ orderBy: asc(leadStatuses.order) }) : [],
    f.has("tag") ? db.query.tags.findMany() : [],
    f.has("segment") ? db.query.savedSegments.findMany() : [],
  ]);
  const r = f.has("dateRange") ? range(params, report.defaultRange) : null;
  const t = today();
  const preset = (from: string, to: string, label: string) => {
    const p = new URLSearchParams(Object.entries({ ...params, from, to }).filter(([, v]) => v) as [string, string][]);
    return <Link key={label} href={`${action}?${p}`} className="btn-ghost btn-sm">{label}</Link>;
  };
  const sel = (name: string, label: string, opts: { v: string | number; l: string }[], blank = "All") => (
    <label className="block"><span className="field-label">{label}</span>
      <select name={name} defaultValue={params[name] ?? ""} className="field-input">{blank !== "" && <option value="">{blank}</option>}{opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
    </label>
  );
  return (
    <form action={action} className="card no-print mb-6 space-y-3">
      <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-4 lg:grid-cols-6">
        {r && <>
          <label className="block"><span className="field-label">From</span><input type="date" name="from" defaultValue={r.from} className="field-input" /></label>
          <label className="block"><span className="field-label">To</span><input type="date" name="to" defaultValue={r.to} className="field-input" /></label>
        </>}
        {f.has("asOf") && <label className="block"><span className="field-label">As of</span><input type="date" name="asOf" defaultValue={params.asOf ?? t} className="field-input" /></label>}
        {(f.has("customer") || f.has("customerRequired")) && sel("customerId", f.has("customerRequired") ? "Customer *" : "Customer", custs.map((c) => ({ v: c.id, l: c.company })), f.has("customerRequired") ? "— Select —" : "All")}
        {f.has("staff") && sel("staffId", "Person", people.map((s) => ({ v: s.id, l: `${s.firstName} ${s.lastName}` })), "Everyone")}
        {f.has("project") && sel("projectId", "Project", projs.map((p) => ({ v: p.id, l: p.name })))}
        {f.has("invoiceStatus") && sel("status", "Status", ["draft", "unpaid", "partial", "paid", "overdue", "cancelled"].map((s) => ({ v: s, l: s })))}
        {f.has("leadStatus") && sel("statusId", "Stage", stages.map((s) => ({ v: s.id, l: s.name })))}
        {f.has("tag") && sel("tag", "Tag", tags.map((x) => ({ v: x.id, l: x.name })), "Any")}
        {f.has("segment") && sel("segmentId", "Segment", segs.map((x) => ({ v: x.id, l: `${x.name} (${x.entity})` })), "— Select —")}
        {f.has("prospectStatus") && sel("status", "Status", ["new", "reviewing", "converted", "dismissed"].map((s) => ({ v: s, l: s })))}
        {f.has("reminderStatus") && sel("status", "Show", [{ v: "all", l: "All" }, { v: "done", l: "Done" }], "Open")}
        <div className="flex gap-2"><button className="btn-primary">Run</button><Link href={action} className="btn-ghost">Reset</Link></div>
      </div>
      {r && (
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <span className="text-xs text-slate-500">Quick:</span>
          {preset(addInterval(t, "day", -29), t, "Last 30 days")}
          {preset(addInterval(t, "day", -89), t, "Last 90 days")}
          {preset(`${t.slice(0, 7)}-01`, t, "This month")}
          {preset(`${t.slice(0, 4)}-01-01`, t, "Year to date")}
          {preset(`${addInterval(t, "month", -11).slice(0, 7)}-01`, t, "Last 12 months")}
        </div>
      )}
    </form>
  );
}
