import Link from "next/link";
import { db } from "@/db";
import { Field } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import type { customers } from "@/db/schema";

type Customer = typeof customers.$inferSelect;

export default async function CustomerForm({
  action,
  initial,
  withContact = false,
  cancelHref,
}: {
  action: (fd: FormData) => Promise<void>;
  initial?: Partial<Customer>;
  withContact?: boolean;
  cancelHref: string;
}) {
  const [groups, currencies] = await Promise.all([db.query.customerGroups.findMany(), db.query.currencies.findMany()]);
  const v = initial ?? {};
  return (
    <form action={action} className="card space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Company *" className="sm:col-span-2">
          <input name="company" required className="field-input" defaultValue={v.company ?? ""} />
        </Field>
        <Field label="VAT / KRA PIN"><input name="vatNumber" className="field-input" defaultValue={v.vatNumber ?? ""} /></Field>
        <Field label="Phone"><input name="phoneNumber" className="field-input" defaultValue={v.phoneNumber ?? ""} /></Field>
        <Field label="Website"><input name="website" className="field-input" defaultValue={v.website ?? ""} /></Field>
        <Field label="Customer group">
          <select name="groupId" className="field-input" defaultValue={v.groupId ?? ""}>
            <option value="">— None —</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Address" className="sm:col-span-2"><input name="address" className="field-input" defaultValue={v.address ?? ""} /></Field>
        <Field label="City"><input name="city" className="field-input" defaultValue={v.city ?? ""} /></Field>
        <Field label="Country"><input name="country" className="field-input" defaultValue={v.country ?? "Kenya"} /></Field>
        <Field label="Currency">
          <select name="currencyId" className="field-input" defaultValue={v.currencyId ?? ""}>
            <option value="">System default</option>
            {currencies.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={v.active ?? true} /> Active
        </label>
      </div>
      {withContact && (
        <fieldset className="rounded-md border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold">Primary contact (optional)</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name"><input name="contactFirstName" className="field-input" /></Field>
            <Field label="Last name"><input name="contactLastName" className="field-input" /></Field>
            <Field label="Email"><input name="contactEmail" type="email" className="field-input" /></Field>
            <Field label="Phone"><input name="contactPhone" className="field-input" /></Field>
          </div>
        </fieldset>
      )}
      <div className="flex gap-2">
        <SubmitButton>Save customer</SubmitButton>
        <Link href={cancelHref} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
