import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, type contracts } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Field } from "@/components/ui";
import { addInterval, today } from "@/lib/utils";

export default async function ContractForm({ action, initial, cancelHref }: { action: (fd: FormData) => Promise<void>; initial?: Partial<typeof contracts.$inferSelect>; cancelHref: string }) {
  const [custs, types] = await Promise.all([
    db.query.customers.findMany({ where: eq(customers.active, true), orderBy: asc(customers.company) }),
    db.query.contractTypes.findMany(),
  ]);
  const v = initial ?? {};
  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Subject *" className="sm:col-span-2"><input name="subject" required className="field-input" defaultValue={v.subject ?? ""} /></Field>
        <Field label="Customer *">
          <select name="customerId" required className="field-input" defaultValue={v.customerId ?? ""}>
            <option value="">— Select —</option>
            {custs.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>
        </Field>
        <Field label="Contract type">
          <select name="typeId" className="field-input" defaultValue={v.typeId ?? ""}>
            <option value="">—</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Start date"><input type="date" name="dateStart" className="field-input" defaultValue={v.dateStart ?? today()} /></Field>
        <Field label="End date"><input type="date" name="dateEnd" className="field-input" defaultValue={v.dateEnd ?? addInterval(today(), "year", 1)} /></Field>
        <Field label="Contract value"><input type="number" step="any" min="0" name="value" className="field-input" defaultValue={v.value ?? 0} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="isExpiryNotify" defaultChecked={v.isExpiryNotify ?? true} /> Notify before expiry</label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="signed" defaultChecked={v.signed ?? false} /> Signed</label>
        <Field label="Short description" className="sm:col-span-3"><input name="description" className="field-input" defaultValue={v.description ?? ""} /></Field>
        <Field label="Contract content / terms" className="sm:col-span-3"><textarea name="content" rows={12} className="field-input font-mono text-xs" defaultValue={v.content ?? ""} /></Field>
      </div>
      <div className="flex gap-2"><SubmitButton>Save contract</SubmitButton><Link href={cancelHref} className="btn-secondary">Cancel</Link></div>
    </form>
  );
}
