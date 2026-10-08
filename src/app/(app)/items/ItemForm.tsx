import Link from "next/link";
import { Field } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import type { items } from "@/db/schema";

export default function ItemForm({ action, initial }: { action: (fd: FormData) => Promise<void>; initial?: Partial<typeof items.$inferSelect> }) {
  const v = initial ?? {};
  return (
    <form action={action} className="card max-w-2xl space-y-4">
      <Field label="Description *"><input name="description" required className="field-input" defaultValue={v.description ?? ""} /></Field>
      <Field label="Long description"><textarea name="longDescription" rows={3} className="field-input" defaultValue={v.longDescription ?? ""} /></Field>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Rate"><input name="rate" type="number" step="any" className="field-input" defaultValue={v.rate ?? 0} /></Field>
        <Field label="Tax %"><input name="taxRate" type="number" step="any" min="0" max="100" className="field-input" defaultValue={v.taxRate ?? 16} /></Field>
        <Field label="Unit"><input name="unit" placeholder="day, hour, seat…" className="field-input" defaultValue={v.unit ?? ""} /></Field>
        <Field label="Group"><input name="groupName" className="field-input" defaultValue={v.groupName ?? ""} /></Field>
      </div>
      <div className="flex gap-2"><SubmitButton>Save item</SubmitButton><Link href="/items" className="btn-secondary">Cancel</Link></div>
    </form>
  );
}
