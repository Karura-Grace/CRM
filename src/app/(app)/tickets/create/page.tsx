import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, customers, projects, staff, ticketStatuses } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Field, PageHeader } from "@/components/ui";
import { createTicket } from "../actions";

export const metadata = { title: "Open ticket" };

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const sp = await searchParams;
  const [custs, cts, depts, services, priorities, statuses, people, projs] = await Promise.all([
    db.query.customers.findMany({ where: eq(customers.active, true), orderBy: asc(customers.company) }),
    db.query.contacts.findMany({ with: { customer: true }, orderBy: asc(contacts.firstName) }),
    db.query.departments.findMany(),
    db.query.ticketServices.findMany(),
    db.query.ticketPriorities.findMany(),
    db.query.ticketStatuses.findMany({ orderBy: asc(ticketStatuses.order) }),
    db.query.staff.findMany({ where: eq(staff.active, true) }),
    db.query.projects.findMany({ orderBy: desc(projects.id), columns: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Open support ticket" back={{ href: "/tickets", label: "Support" }} />
      <form action={createTicket} className="card space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Subject *" className="sm:col-span-3"><input name="subject" required className="field-input" /></Field>
          <Field label="Customer">
            <select name="customerId" className="field-input" defaultValue={sp.customerId ?? ""}>
              <option value="">— None —</option>
              {custs.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </Field>
          <Field label="Contact">
            <select name="contactId" className="field-input" defaultValue="">
              <option value="">— None —</option>
              {cts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.customer.company})</option>)}
            </select>
          </Field>
          <Field label="Project">
            <select name="projectId" className="field-input" defaultValue="">
              <option value="">—</option>
              {projs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Name (if no contact)"><input name="name" className="field-input" /></Field>
          <Field label="Email (if no contact)"><input name="email" type="email" className="field-input" /></Field>
          <Field label="Department">
            <select name="departmentId" className="field-input">
              <option value="">—</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Service">
            <select name="serviceId" className="field-input">
              <option value="">—</option>
              {services.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select name="priorityId" className="field-input" defaultValue={priorities.find((p) => p.name === "Medium")?.id ?? ""}>
              {priorities.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select name="statusId" className="field-input" defaultValue={statuses.find((s) => s.isDefault)?.id ?? ""}>
              {statuses.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Assign to">
            <select name="assignedId" className="field-input">
              <option value="">— Unassigned —</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </Field>
          <Field label="Message *" className="sm:col-span-3"><textarea name="message" rows={6} required className="field-input" /></Field>
        </div>
        <div className="flex gap-2"><SubmitButton>Open ticket</SubmitButton><Link href="/tickets" className="btn-secondary">Cancel</Link></div>
      </form>
    </>
  );
}
