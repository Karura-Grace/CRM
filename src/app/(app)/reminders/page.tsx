import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { reminders } from "@/db/schema";
import ExportButtons from "@/components/ExportButtons";
import { Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { relLabel } from "@/lib/relLinks";
import { fmtDate, today } from "@/lib/utils";
import { deleteReminder, setReminderDone } from "../crm/actions";

export const metadata = { title: "Reminders" };

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ who?: string; show?: string }> }) {
  const { who, show } = await searchParams;
  const s = await requireUser();
  const everyone = who === "all" && s.role === "admin";
  const rows = (await db.query.reminders.findMany({ with: { staff: true }, orderBy: asc(reminders.remindAt) }))
    .filter((r) => (everyone || r.staffId === s.staffId) && (show === "done" ? r.isDone : !r.isDone));
  const t0 = today();
  const groups = show === "done" ? [["Completed", rows]] as const : ([["Overdue", rows.filter((r) => r.remindAt < t0)], ["Today", rows.filter((r) => r.remindAt === t0)], ["Upcoming", rows.filter((r) => r.remindAt > t0)]] as const);
  const labels = await Promise.all(rows.map((r) => relLabel(r.relType, r.relId)));
  const lab = new Map(rows.map((r, i) => [r.id, labels[i]]));
  const back = `/reminders${who || show ? `?${new URLSearchParams(Object.entries({ who, show }).filter(([, v]) => v) as [string, string][])}` : ""}`;
  const pill = (href: string, on: boolean, l: string) => <Link href={href} className={`btn btn-sm ${on ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`}>{l}</Link>;
  return (
    <>
      <PageHeader title="Reminders" subtitle="Follow-ups set on customers, leads, invoices, projects, tasks, tickets and contracts" actions={<ExportButtons report="reminders-list" params={{ staffId: everyone ? undefined : s.staffId, status: show === "done" ? "done" : undefined }} compact />} />
      <div className="mb-4 flex flex-wrap gap-1">
        {pill(`/reminders${show ? `?show=${show}` : ""}`, !everyone, "Mine")}
        {s.role === "admin" && pill(`/reminders?who=all${show ? `&show=${show}` : ""}`, everyone, "Everyone")}
        <span className="mx-2" />
        {pill(`/reminders${everyone ? "?who=all" : ""}`, show !== "done", "Open")}
        {pill(`/reminders?show=done${everyone ? "&who=all" : ""}`, show === "done", "Done")}
      </div>
      {rows.length === 0 ? <Empty>No reminders here. Add follow-ups from any customer, lead, invoice, project, task, ticket or contract page.</Empty> : (
        <div className="space-y-6">
          {groups.filter(([, rs]) => rs.length).map(([title, rs]) => (
            <section key={title} className="card">
              <h2 className={`mb-3 ${title === "Overdue" ? "text-rose-700" : ""}`}>{title} <span className="muted font-normal">({rs.length})</span></h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {rs.map((r) => {
                  const toggle = async () => { "use server"; await setReminderDone(r.id, !r.isDone, back); };
                  const del = async () => { "use server"; await deleteReminder(r.id, back); };
                  const l = lab.get(r.id)!;
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div><div className="font-medium text-slate-900">{r.description}</div><div className="text-xs text-slate-500">{fmtDate(r.remindAt)} · <Link href={l.href}>{l.label}</Link>{everyone ? ` · ${r.staff.firstName} ${r.staff.lastName}` : ""}</div></div>
                      <div className="flex gap-1"><form action={toggle}><button className="btn-secondary btn-sm">{r.isDone ? "Re-open" : "Mark done"}</button></form><form action={del}><button className="btn-ghost btn-sm text-rose-600">Delete</button></form></div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
