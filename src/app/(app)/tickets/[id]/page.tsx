import { RemindersPanel } from "@/components/crm";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { staff, ticketReplies, tickets, ticketStatuses } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { ColorBadge, DL, Field, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { deleteTicket, replyToTicket, setTicketStatus, updateTicketMeta } from "../actions";
import ReplyBox from "../ReplyBox";

export default async function TicketShowPage({ params }: { params: Promise<{ id: string }> }) {
  const ticketId = Number((await params).id);
  const t = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    with: {
      customer: true, contact: true, department: true, service: true, priority: true, status: true, assigned: true, project: true,
      replies: { with: { staff: true, contact: true }, orderBy: asc(ticketReplies.id) },
    },
  });
  if (!t) notFound();
  const [statuses, priorities, depts, services, people, canned] = await Promise.all([
    db.query.ticketStatuses.findMany({ orderBy: asc(ticketStatuses.order) }),
    db.query.ticketPriorities.findMany(),
    db.query.departments.findMany(),
    db.query.ticketServices.findMany(),
    db.query.staff.findMany({ where: eq(staff.active, true) }),
    db.query.predefinedReplies.findMany(),
  ]);

  const reply = async (fd: FormData) => { "use server"; await replyToTicket(ticketId, fd); };
  const meta = async (fd: FormData) => { "use server"; await updateTicketMeta(ticketId, fd); };
  const del = async () => { "use server"; await deleteTicket(ticketId); };

  return (
    <>
      <PageHeader
        title={`#${t.id} ${t.subject}`}
        subtitle={<span className="flex items-center gap-2"><ColorBadge color={t.status?.color} label={t.status?.name} /><ColorBadge color={t.priority?.color} label={t.priority?.name} /></span>}
        back={{ href: "/tickets", label: "Support" }}
        actions={<form action={del}><SubmitButton className="btn-danger" confirm="Delete this ticket and all replies?">Delete</SubmitButton></form>}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <article className="card">
            <div className="mb-2 text-xs text-slate-500">{t.name ?? t.contact?.firstName ?? t.customer?.company ?? t.email} · {fmtDateTime(t.createdAt)}</div>
            <p className="prose-pre">{t.message}</p>
          </article>
          {t.replies.map((r) => (
            <article key={r.id} className={`card ${r.staff ? "border-l-4 border-l-brand-400" : ""}`}>
              <div className="mb-2 text-xs text-slate-500">{r.staff ? `${r.staff.firstName} ${r.staff.lastName} (staff)` : r.contact ? `${r.contact.firstName} ${r.contact.lastName}` : "Customer"} · {fmtDateTime(r.createdAt)}</div>
              <p className="prose-pre">{r.message}</p>
            </article>
          ))}
          <form action={reply} className="card space-y-3">
            <h2>Reply</h2>
            <ReplyBox replies={canned} />
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Change status to">
                <select name="statusId" className="field-input" defaultValue={statuses.find((s) => s.name === "Answered")?.id ?? ""}>
                  <option value="">— Keep current —</option>
                  {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <SubmitButton>Post reply</SubmitButton>
            </div>
          </form>
        </div>
        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-3">Status</h2>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => {
                const a = async () => { "use server"; await setTicketStatus(ticketId, s.id); };
                return (
                  <form key={s.id} action={a}>
                    <button className="btn btn-sm border" style={s.id === t.statusId ? { background: s.color, color: "white", borderColor: s.color } : { borderColor: s.color, color: s.color }}>{s.name}</button>
                  </form>
                );
              })}
            </div>
          </section>
          <section className="card">
            <h2 className="mb-3">Details</h2>
            <DL rows={[
              ["Customer", t.customer ? <Link href={`/customers/${t.customer.id}`}>{t.customer.company}</Link> : null],
              ["Contact", t.contact ? `${t.contact.firstName} ${t.contact.lastName}` : t.name],
              ["Email", t.email ?? t.contact?.email], ["Project", t.project ? <Link href={`/projects/${t.project.id}`}>{t.project.name}</Link> : null],
              ["Opened", fmtDateTime(t.createdAt)], ["Last reply", fmtDateTime(t.lastReply)],
            ]} />
            <form action={meta} className="mt-4 space-y-3 border-t pt-4">
              <Field label="Assigned to">
                <select name="assignedId" className="field-input" defaultValue={t.assignedId ?? ""}>
                  <option value="">— Unassigned —</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select name="priorityId" className="field-input" defaultValue={t.priorityId ?? ""}>
                  {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Department">
                <select name="departmentId" className="field-input" defaultValue={t.departmentId ?? ""}>
                  <option value="">—</option>
                  {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Service">
                <select name="serviceId" className="field-input" defaultValue={t.serviceId ?? ""}>
                  <option value="">—</option>
                  {services.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <SubmitButton className="btn-secondary btn-sm">Save</SubmitButton>
            </form>
          </section>
          <RemindersPanel relType="ticket" relId={ticketId} back={`/tickets/${ticketId}`} />
        </div>
      </div>
    </>
  );
}
