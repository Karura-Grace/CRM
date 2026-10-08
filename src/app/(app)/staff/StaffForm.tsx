import Link from "next/link";
import { db } from "@/db";
import type { staff } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Field } from "@/components/ui";

export default async function StaffForm({ action, initial }: { action: (fd: FormData) => Promise<void>; initial?: Partial<typeof staff.$inferSelect> }) {
  const depts = await db.query.departments.findMany();
  const v = initial ?? {};
  const isEdit = !!initial?.id;
  return (
    <form action={action} className="card max-w-3xl space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name *"><input name="firstName" required className="field-input" defaultValue={v.firstName ?? ""} /></Field>
        <Field label="Last name *"><input name="lastName" required className="field-input" defaultValue={v.lastName ?? ""} /></Field>
        <Field label="Email *"><input name="email" type="email" required className="field-input" defaultValue={v.email ?? ""} /></Field>
        <Field label="Phone"><input name="phoneNumber" className="field-input" defaultValue={v.phoneNumber ?? ""} /></Field>
        <Field label="Role">
          <select name="role" className="field-input" defaultValue={v.role ?? "staff"}>
            <option value="staff">Staff — all operational modules</option>
            <option value="admin">Administrator — plus Staff &amp; Settings</option>
          </select>
        </Field>
        <Field label="Department">
          <select name="departmentId" className="field-input" defaultValue={v.departmentId ?? ""}>
            <option value="">—</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label={isEdit ? "New password (leave blank to keep)" : "Password * (min 8 chars)"}>
          <input name="password" type="password" minLength={8} required={!isEdit} autoComplete="new-password" className="field-input" />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={v.active ?? true} /> Active (can sign in)</label>
      </div>
      <div className="flex gap-2"><SubmitButton>Save</SubmitButton><Link href="/staff" className="btn-secondary">Cancel</Link></div>
    </form>
  );
}
