import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, projects, type expenses } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Field } from "@/components/ui";
import { today } from "@/lib/utils";

export default async function ExpenseForm({ action, initial }: { action: (fd: FormData) => Promise<void>; initial?: Partial<typeof expenses.$inferSelect> }) {
  const [cats, custs, projs, currencies] = await Promise.all([
    db.query.expenseCategories.findMany(),
    db.query.customers.findMany({ where: eq(customers.active, true), orderBy: asc(customers.company) }),
    db.query.projects.findMany({ orderBy: desc(projects.id), columns: { id: true, name: true } }),
    db.query.currencies.findMany(),
  ]);
  const v = initial ?? {};
  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Category *">
          <select name="categoryId" required className="field-input" defaultValue={v.categoryId ?? ""}>
            <option value="">— Select —</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Name"><input name="name" className="field-input" defaultValue={v.name ?? ""} placeholder="e.g. Flight NBO–KGL" /></Field>
        <Field label="Date"><input type="date" name="date" className="field-input" defaultValue={v.date ?? today()} /></Field>
        <Field label="Amount *"><input type="number" step="any" min="0" name="amount" required className="field-input" defaultValue={v.amount ?? ""} /></Field>
        <Field label="Tax amount"><input type="number" step="any" min="0" name="tax" className="field-input" defaultValue={v.tax ?? 0} /></Field>
        <Field label="Currency">
          <select name="currencyId" className="field-input" defaultValue={v.currencyId ?? currencies.find((c) => c.isDefault)?.id ?? ""}>
            {currencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Customer (to rebill)">
          <select name="customerId" className="field-input" defaultValue={v.customerId ?? ""}>
            <option value="">—</option>
            {custs.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>
        </Field>
        <Field label="Project">
          <select name="projectId" className="field-input" defaultValue={v.projectId ?? ""}>
            <option value="">—</option>
            {projs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Payment mode">
          <select name="paymentMode" className="field-input" defaultValue={v.paymentMode ?? ""}>
            <option value="">—</option><option value="mpesa">M-Pesa</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="cheque">Cheque</option>
          </select>
        </Field>
        <Field label="Reference no."><input name="referenceNo" className="field-input" defaultValue={v.referenceNo ?? ""} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="billable" defaultChecked={v.billable ?? false} /> Billable to customer</label>
        <div />
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="isRecurring" defaultChecked={v.isRecurring ?? false} /> Recurring</label>
        <Field label="Every"><input type="number" min="1" name="recurringEvery" className="field-input" defaultValue={v.recurringEvery ?? 1} /></Field>
        <Field label="Interval">
          <select name="recurringType" className="field-input" defaultValue={v.recurringType ?? "month"}>
            <option value="day">Day(s)</option><option value="week">Week(s)</option><option value="month">Month(s)</option><option value="year">Year(s)</option>
          </select>
        </Field>
        <Field label="Note" className="sm:col-span-3"><textarea name="note" rows={3} className="field-input" defaultValue={v.note ?? ""} /></Field>
      </div>
      <div className="flex gap-2"><SubmitButton>Save expense</SubmitButton><Link href="/expenses" className="btn-secondary">Cancel</Link></div>
    </form>
  );
}
