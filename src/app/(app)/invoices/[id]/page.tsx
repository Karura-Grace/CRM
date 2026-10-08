import { RemindersPanel } from "@/components/crm";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { invoiceItems, invoices, payments } from "@/db/schema";
import DocumentView from "@/components/DocumentView";
import PrintButton from "@/components/PrintButton";
import SubmitButton from "@/components/SubmitButton";
import { Badge, Field, PageHeader } from "@/components/ui";
import { getDefaultCurrency, getSettings } from "@/lib/settings";
import { entryHours, sumHours } from "@/lib/timesheets";
import { fmtDate, humanize, money, round2, today } from "@/lib/utils";
import { deleteInvoice, deletePayment, recordPayment, setInvoiceStatus, stopRecurring } from "../actions";

export default async function InvoiceShowPage({ params }: { params: Promise<{ id: string }> }) {
  const invoiceId = Number((await params).id);
  const inv = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
    with: {
      customer: { with: { contacts: true } },
      currency: true,
      project: true,
      estimates: true,
      items: { orderBy: asc(invoiceItems.order) },
      payments: { orderBy: desc(payments.date), with: { recorder: true } },
      timesheets: { with: { task: true, staff: true } },
    },
  });
  if (!inv) notFound();
  const s = await getSettings();
  const symbol = inv.currency?.symbol ?? (await getDefaultCurrency()).symbol;
  const primary = inv.customer.contacts.find((c) => c.isPrimary);
  const balance = round2(inv.total - inv.totalPaid);

  const pay = async (fd: FormData) => { "use server"; await recordPayment(invoiceId, fd); };
  const del = async () => { "use server"; await deleteInvoice(invoiceId); };
  const publish = async () => { "use server"; await setInvoiceStatus(invoiceId, "unpaid"); };
  const cancel = async () => { "use server"; await setInvoiceStatus(invoiceId, "cancelled"); };
  const toDraft = async () => { "use server"; await setInvoiceStatus(invoiceId, "draft"); };
  const stop = async () => { "use server"; await stopRecurring(invoiceId); };

  return (
    <>
      <PageHeader
        title={inv.number}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge status={inv.status} />
            {inv.isRecurring && <span className="badge bg-violet-100 text-violet-800">Recurring every {inv.recurringEvery} {inv.recurringType}(s) · next {fmtDate(inv.recurringNextDate)}</span>}
            {inv.estimates.map((e) => <Link key={e.id} href={`/estimates/${e.id}`}>from {e.number}</Link>)}
            {inv.project && <Link href={`/projects/${inv.project.id}`}>Project: {inv.project.name}</Link>}
          </span>
        }
        back={{ href: "/invoices", label: "Invoices" }}
        actions={
          <>
            {(inv.status === "draft" || inv.status === "cancelled") && <form action={publish}><button className="btn-primary">{inv.status === "draft" ? "Mark as sent" : "Re-open"}</button></form>}
            {inv.status !== "cancelled" && inv.status !== "paid" && <form action={cancel}><SubmitButton className="btn-secondary" confirm="Cancel this invoice?">Cancel invoice</SubmitButton></form>}
            {inv.status !== "draft" && inv.totalPaid === 0 && <form action={toDraft}><button className="btn-secondary">Back to draft</button></form>}
            {inv.isRecurring && <form action={stop}><button className="btn-secondary">Stop recurring</button></form>}
            <Link href={`/invoices/${invoiceId}/edit`} className="btn-secondary">Edit</Link>
            <PrintButton />
            <form action={del}><SubmitButton className="btn-danger" confirm="Delete this invoice and its payments?">Delete</SubmitButton></form>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DocumentView
            company={{ name: s.company_name, address: s.company_address, email: s.company_email, phone: s.company_phone, vat: s.company_vat }}
            title="Invoice"
            number={inv.number}
            meta={[["Date", fmtDate(inv.date)], ["Due", fmtDate(inv.dueDate)], ["Status", humanize(inv.status)]]}
            billTo={{ name: inv.customer.company, lines: [primary ? `Attn: ${primary.firstName} ${primary.lastName}` : null, inv.customer.address, [inv.customer.city, inv.customer.country].filter(Boolean).join(", "), inv.customer.vatNumber ? `PIN: ${inv.customer.vatNumber}` : null] }}
            lines={inv.items}
            subtotal={inv.subtotal}
            tax={inv.totalTax}
            total={inv.total}
            paid={inv.totalPaid}
            symbol={symbol}
            notes={[{ label: "Note", text: inv.clientNote }, { label: "Terms", text: inv.terms }]}
          />
        </div>
        <div className="no-print space-y-6">
          {balance > 0 && inv.status !== "cancelled" && (
            <section className="card">
              <h2 className="mb-3">Record payment</h2>
              <form action={pay} className="space-y-3">
                <Field label="Amount"><input name="amount" type="number" step="any" min="0.01" required defaultValue={balance} className="field-input" /></Field>
                <Field label="Payment mode">
                  <select name="paymentMode" className="field-input" defaultValue="mpesa">
                    <option value="bank_transfer">Bank transfer</option><option value="mpesa">M-Pesa</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="card">Card</option>
                  </select>
                </Field>
                <Field label="Date"><input name="date" type="date" defaultValue={today()} className="field-input" /></Field>
                <Field label="Transaction ref"><input name="transactionId" className="field-input" placeholder="e.g. M-Pesa code" /></Field>
                <Field label="Note"><input name="note" className="field-input" /></Field>
                <SubmitButton>Record payment</SubmitButton>
              </form>
            </section>
          )}
          {inv.timesheets.length > 0 && (
            <section className="card">
              <h2 className="mb-1">Billed time</h2>
              <p className="muted mb-3">{inv.timesheets.length} timesheet entries · {sumHours(inv.timesheets).toFixed(2)} h. Deleting this invoice returns them to “unbilled”.</p>
              <ul className="divide-y divide-slate-100 text-sm">
                {inv.timesheets.slice(0, 12).map((e) => (
                  <li key={e.id} className="flex justify-between gap-2 py-1.5"><Link href={`/tasks/${e.taskId}`} className="truncate">{e.task.name}</Link><span className="whitespace-nowrap text-slate-500">{e.staff.firstName} · {entryHours(e).toFixed(2)} h</span></li>
                ))}
              </ul>
              {inv.projectId && <Link href={`/timesheets?projectId=${inv.projectId}`} className="mt-2 inline-block text-sm">Project timesheet →</Link>}
            </section>
          )}
          <RemindersPanel relType="invoice" relId={invoiceId} back={`/invoices/${invoiceId}`} title="Follow-ups (e.g. payment chasers)" />
          <section className="card">
            <h2 className="mb-3">Payments</h2>
            {inv.payments.length === 0 ? <p className="muted">No payments recorded.</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {inv.payments.map((p) => {
                  const rm = async () => { "use server"; await deletePayment(invoiceId, p.id); };
                  return (
                    <li key={p.id} className="flex items-start justify-between gap-2 py-2">
                      <div>
                        <div className="font-medium tabular-nums">{money(p.amount, symbol)}</div>
                        <div className="muted">{humanize(p.paymentMode)} · {fmtDate(p.date)}{p.transactionId ? ` · ${p.transactionId}` : ""}</div>
                      </div>
                      <form action={rm}><SubmitButton className="btn-ghost btn-sm text-rose-600" confirm="Remove this payment?">✕</SubmitButton></form>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
