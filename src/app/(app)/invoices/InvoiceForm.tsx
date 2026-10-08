import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { items, projects, type invoices } from "@/db/schema";
import LineItemsEditor, { type LineInit } from "@/components/LineItemsEditor";
import SalesDocFields from "@/components/SalesDocFields";
import SubmitButton from "@/components/SubmitButton";
import { Field } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { addInterval, today } from "@/lib/utils";

type Invoice = typeof invoices.$inferSelect;

export default async function InvoiceForm({
  action,
  initial,
  lines,
  cancelHref,
  isEdit = false,
}: {
  action: (fd: FormData) => Promise<void>;
  initial?: Partial<Invoice>;
  lines?: LineInit[];
  cancelHref: string;
  isEdit?: boolean;
}) {
  const [catalog, projs, s] = await Promise.all([
    db.query.items.findMany({ orderBy: asc(items.description) }),
    db.query.projects.findMany({ orderBy: desc(projects.id), columns: { id: true, name: true } }),
    getSettings(),
  ]);
  const v = initial ?? {};
  const date = v.date ?? today();
  return (
    <form action={action} className="space-y-6">
      <div className="card space-y-4">
        <SalesDocFields customerId={v.customerId} currencyId={v.currencyId} date={date} secondDate={{ name: "dueDate", label: "Due date", value: v.dueDate ?? addInterval(date, "day", Number(s.invoice_due_days) || 30) }} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="Project (optional)" className="sm:col-span-2">
            <select name="projectId" className="field-input" defaultValue={v.projectId ?? ""}>
              <option value="">—</option>
              {projs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <fieldset className="rounded-md border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold">Recurring</legend>
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-4">
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="isRecurring" defaultChecked={v.isRecurring ?? false} /> Recurring invoice</label>
            <Field label="Every"><input type="number" min="1" name="recurringEvery" className="field-input" defaultValue={v.recurringEvery ?? 1} /></Field>
            <Field label="Interval">
              <select name="recurringType" className="field-input" defaultValue={v.recurringType ?? "month"}>
                <option value="day">Day(s)</option><option value="week">Week(s)</option><option value="month">Month(s)</option><option value="year">Year(s)</option>
              </select>
            </Field>
            <Field label="Next invoice date"><input type="date" name="recurringNextDate" className="field-input" defaultValue={v.recurringNextDate ?? addInterval(date, "month", 1)} /></Field>
          </div>
          <p className="muted mt-2">The daily scheduled job (npm run cron) generates the next invoice on this date.</p>
        </fieldset>
      </div>
      <div className="card"><LineItemsEditor catalog={catalog} initial={lines} /></div>
      <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Client note"><textarea name="clientNote" rows={3} className="field-input" defaultValue={v.clientNote ?? ""} /></Field>
        <Field label="Terms & payment instructions"><textarea name="terms" rows={3} className="field-input" defaultValue={v.terms ?? s.invoice_terms} /></Field>
      </div>
      <div className="flex gap-2">
        {isEdit ? <SubmitButton>Save changes</SubmitButton> : (
          <>
            <SubmitButton name="status" value="draft" className="btn-secondary">Save as draft</SubmitButton>
            <SubmitButton name="status" value="unpaid">Save invoice</SubmitButton>
          </>
        )}
        <Link href={cancelHref} className="btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
