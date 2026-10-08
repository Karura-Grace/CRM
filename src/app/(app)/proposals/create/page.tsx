import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { customers, items, leads } from "@/db/schema";
import LineItemsEditor from "@/components/LineItemsEditor";
import SubmitButton from "@/components/SubmitButton";
import { Field, PageHeader } from "@/components/ui";
import { addInterval, today } from "@/lib/utils";
import { createProposal } from "../actions";

export const metadata = { title: "New proposal" };

export default async function NewProposalPage({ searchParams }: { searchParams: Promise<{ customerId?: string; leadId?: string }> }) {
  const sp = await searchParams;
  const [catalog, custs, openLeads] = await Promise.all([
    db.query.items.findMany({ orderBy: asc(items.description) }),
    db.query.customers.findMany({ where: eq(customers.active, true), orderBy: asc(customers.company) }),
    db.query.leads.findMany({ where: and(isNull(leads.convertedCustomerId), eq(leads.junk, false)), orderBy: asc(leads.name) }),
  ]);
  const relType = sp.leadId ? "lead" : "customer";
  return (
    <>
      <PageHeader title="New proposal" back={{ href: "/proposals", label: "Proposals" }} />
      <form action={createProposal} className="space-y-6">
        <div className="card grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="Subject *" className="sm:col-span-4"><input name="subject" required className="field-input" placeholder="e.g. Organisational culture assessment — proposal" /></Field>
          <Field label="Related to">
            <select name="relType" className="field-input" defaultValue={relType}>
              <option value="customer">Customer</option><option value="lead">Lead</option>
            </select>
          </Field>
          <Field label="Customer (if customer)">
            <select name="customerId" className="field-input" defaultValue={sp.customerId ?? ""}>
              <option value="">—</option>
              {custs.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </Field>
          <Field label="Lead (if lead)">
            <select name="leadId" className="field-input" defaultValue={sp.leadId ?? ""}>
              <option value="">—</option>
              {openLeads.map((l) => <option key={l.id} value={l.id}>{l.name}{l.company ? ` — ${l.company}` : ""}</option>)}
            </select>
          </Field>
          <div />
          <Field label="Proposal to (name)"><input name="proposalTo" className="field-input" /></Field>
          <Field label="Email"><input name="email" type="email" className="field-input" /></Field>
          <Field label="Date"><input name="date" type="date" defaultValue={today()} className="field-input" /></Field>
          <Field label="Open till"><input name="openTill" type="date" defaultValue={addInterval(today(), "day", 30)} className="field-input" /></Field>
        </div>
        <div className="card">
          <Field label="Proposal content (scope of work, approach, timeline)">
            <textarea name="content" rows={10} className="field-input" />
          </Field>
        </div>
        <div className="card"><LineItemsEditor catalog={catalog} withTax={false} /></div>
        <div className="flex gap-2">
          <SubmitButton name="status" value="draft" className="btn-secondary">Save as draft</SubmitButton>
          <SubmitButton name="status" value="sent">Save &amp; mark sent</SubmitButton>
          <Link href="/proposals" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </>
  );
}
