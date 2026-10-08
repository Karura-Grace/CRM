import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { leadStatuses, staff, type leads } from "@/db/schema";
import { Field } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";

type Lead = typeof leads.$inferSelect;

export default async function LeadForm({ action, initial, cancelHref }: { action: (fd: FormData) => Promise<void>; initial?: Partial<Lead>; cancelHref: string }) {
  const [sources, statuses, people] = await Promise.all([
    db.query.leadSources.findMany(),
    db.query.leadStatuses.findMany({ orderBy: asc(leadStatuses.order) }),
    db.query.staff.findMany({ where: eq(staff.active, true) }),
  ]);
  const v = initial ?? {};
  const defStatus = v.statusId ?? statuses.find((s) => s.isDefault)?.id ?? statuses[0]?.id;
  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Status">
          <select name="statusId" className="field-input" defaultValue={defStatus ?? ""}>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Source">
          <select name="sourceId" className="field-input" defaultValue={v.sourceId ?? ""}>
            <option value="">—</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Assigned to">
          <select name="assignedId" className="field-input" defaultValue={v.assignedId ?? ""}>
            <option value="">— Unassigned —</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
          </select>
        </Field>
        <Field label="Name *"><input name="name" required className="field-input" defaultValue={v.name ?? ""} /></Field>
        <Field label="Position / title"><input name="title" className="field-input" defaultValue={v.title ?? ""} /></Field>
        <Field label="Company"><input name="company" className="field-input" defaultValue={v.company ?? ""} /></Field>
        <Field label="Email"><input name="email" type="email" className="field-input" defaultValue={v.email ?? ""} /></Field>
        <Field label="Phone"><input name="phoneNumber" className="field-input" defaultValue={v.phoneNumber ?? ""} /></Field>
        <Field label="Website"><input name="website" className="field-input" defaultValue={v.website ?? ""} /></Field>
        <Field label="Address"><input name="address" className="field-input" defaultValue={v.address ?? ""} /></Field>
        <Field label="City"><input name="city" className="field-input" defaultValue={v.city ?? ""} /></Field>
        <Field label="Country"><input name="country" className="field-input" defaultValue={v.country ?? "Kenya"} /></Field>
        <Field label="Estimated value"><input name="value" type="number" step="any" min="0" className="field-input" defaultValue={v.value ?? 0} /></Field>
        <Field label="Expected close date"><input name="expectedClose" type="date" className="field-input" defaultValue={v.expectedClose ?? ""} /></Field>
        <Field label="Description" className="sm:col-span-3"><textarea name="description" rows={4} className="field-input" defaultValue={v.description ?? ""} /></Field>
      </div>
      <div className="flex gap-2">
        <SubmitButton>Save lead</SubmitButton>
        <Link href={cancelHref} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
