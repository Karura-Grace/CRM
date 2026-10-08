import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { leadActivityLog, leadStatuses, leads } from "@/db/schema";
import { Badge, ColorBadge, DL, PageHeader } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { getDefaultCurrency } from "@/lib/settings";
import { InteractionForm, RemindersPanel, TagEditor } from "@/components/crm";
import { fmtDate, fmtDateTime, money } from "@/lib/utils";
import { addLeadNote, convertLead, deleteLead, setLeadStatus, toggleLeadFlag } from "../actions";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, id),
    with: {
      status: true, source: true, assigned: true, convertedCustomer: true,
      notes: { with: { staff: true }, orderBy: desc(leadActivityLog.id) },
      proposals: true,
    },
  });
  if (!lead) notFound();
  const statuses = await db.query.leadStatuses.findMany({ orderBy: asc(leadStatuses.order) });
  const cur = await getDefaultCurrency();

  const convert = async () => { "use server"; await convertLead(id); };
  const lost = async () => { "use server"; await toggleLeadFlag(id, "lost"); };
  const junk = async () => { "use server"; await toggleLeadFlag(id, "junk"); };
  const del = async () => { "use server"; await deleteLead(id); };
  const addNote = async (fd: FormData) => { "use server"; await addLeadNote(id, fd); };
  const interactions = await db.query.activityLog.findMany({ where: (a, { and, eq }) => and(eq(a.relType, "lead"), eq(a.relId, id)), with: { staff: true } });
  const feed = [
    ...lead.notes.map((n) => ({ key: `n${n.id}`, kind: "", description: n.description, who: n.staff ? `${n.staff.firstName} ${n.staff.lastName}` : "System", date: n.date })),
    ...interactions.map((a) => ({ key: `a${a.id}`, kind: a.kind === "system" ? "" : a.kind, description: a.description, who: a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : "System", date: a.date })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHeader
        title={lead.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <ColorBadge color={lead.status?.color} label={lead.status?.name ?? "No status"} />
            {lead.lost && <Badge status="lost" />}
            {lead.junk && <Badge status="junk" />}
            {lead.convertedCustomer && <Link href={`/customers/${lead.convertedCustomer.id}`}><Badge status="converted" label={`Converted → ${lead.convertedCustomer.company}`} /></Link>}
          </span>
        }
        back={{ href: "/leads", label: "Leads" }}
        actions={
          <>
            {!lead.convertedCustomerId && <form action={convert}><SubmitButton className="btn-primary" confirm="Create a customer and primary contact from this lead?">Convert to customer</SubmitButton></form>}
            <Link href={`/proposals/create?leadId=${id}`} className="btn-secondary">New proposal</Link>
            <Link href={`/leads/${id}/edit`} className="btn-secondary">Edit</Link>
            <form action={lost}><button className="btn-secondary">{lead.lost ? "Unmark lost" : "Mark lost"}</button></form>
            <form action={junk}><button className="btn-secondary">{lead.junk ? "Unmark junk" : "Mark junk"}</button></form>
            <form action={del}><SubmitButton className="btn-danger" confirm="Delete this lead and its history?">Delete</SubmitButton></form>
          </>
        }
      />
      <div className="-mt-3 mb-5"><TagEditor relType="lead" relId={id} back={`/leads/${id}`} /></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-4">Details</h2>
          <DL rows={[
            ["Company", lead.company], ["Position", lead.title],
            ["Email", lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : null], ["Phone", lead.phoneNumber],
            ["Website", lead.website], ["Location", [lead.address, lead.city, lead.country].filter(Boolean).join(", ") || null],
            ["Source", lead.source?.name], ["Assigned to", lead.assigned ? `${lead.assigned.firstName} ${lead.assigned.lastName}` : "Unassigned"],
            ["Estimated value", money(lead.value, cur.symbol)], ["Weighted value", `${money((lead.value * (lead.status?.probability ?? 0)) / 100, cur.symbol)} (${lead.status?.probability ?? 0}%)`],
            ["Expected close", fmtDate(lead.expectedClose)], ["Created", fmtDate(lead.createdAt)],
            ["Last contact", fmtDateTime(lead.lastContact)], ["Proposals", lead.proposals.length ? lead.proposals.map((p) => <Link key={p.id} href={`/proposals/${p.id}`} className="mr-2">{p.subject}</Link>) : "—"],
          ]} />
          {lead.description && <div className="mt-4 border-t pt-4"><div className="field-label">Description</div><p className="prose-pre">{lead.description}</p></div>}
        </section>
        <section className="card">
          <h2 className="mb-3">Move to status</h2>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => {
              const set = async () => { "use server"; await setLeadStatus(id, s.id); };
              return (
                <form key={s.id} action={set}>
                  <button className="btn-sm btn border" style={s.id === lead.statusId ? { background: s.color, color: "white", borderColor: s.color } : { borderColor: s.color, color: s.color }}>{s.name}</button>
                </form>
              );
            })}
          </div>
        </section>
        <div className="lg:col-start-3"><RemindersPanel relType="lead" relId={id} back={`/leads/${id}`} title="Follow-ups" /></div>
      </div>
      <section className="card mt-6">
        <h2 className="mb-3">Activity &amp; notes</h2>
        <div className="mb-4 rounded-md bg-slate-50 p-3"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Log a call, meeting or email</div><InteractionForm relType="lead" relId={id} back={`/leads/${id}`} /></div>
        <form action={addNote} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <textarea name="description" rows={2} required placeholder="Call notes, follow-ups, next steps…" className="field-input" />
          <SubmitButton className="btn-primary self-start">Add note</SubmitButton>
        </form>
        <ol className="space-y-3">
          {feed.map((n) => (
            <li key={n.key} className="border-l-2 border-brand-200 pl-3 text-sm">
              {n.kind && <span className="badge mb-1 bg-slate-100 text-slate-700">{n.kind}</span>}
              <div className="prose-pre">{n.description}</div>
              <div className="text-xs text-slate-500">{n.who} · {fmtDateTime(n.date)}</div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
