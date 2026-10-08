import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, staff, type projects } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Field } from "@/components/ui";
import { today } from "@/lib/utils";

export default async function ProjectForm({ action, initial, cancelHref, withMembers = false }: { action: (fd: FormData) => Promise<void>; initial?: Partial<typeof projects.$inferSelect>; cancelHref: string; withMembers?: boolean }) {
  const [custs, people] = await Promise.all([
    db.query.customers.findMany({ where: eq(customers.active, true), orderBy: asc(customers.company) }),
    db.query.staff.findMany({ where: eq(staff.active, true) }),
  ]);
  const v = initial ?? {};
  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Project name *" className="sm:col-span-2"><input name="name" required className="field-input" defaultValue={v.name ?? ""} /></Field>
        <Field label="Customer">
          <select name="customerId" className="field-input" defaultValue={v.customerId ?? ""}>
            <option value="">— Internal —</option>
            {custs.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" className="field-input" defaultValue={v.status ?? "not_started"}>
            <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="on_hold">On hold</option><option value="finished">Finished</option><option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Start date"><input type="date" name="startDate" className="field-input" defaultValue={v.startDate ?? today()} /></Field>
        <Field label="Deadline"><input type="date" name="deadline" className="field-input" defaultValue={v.deadline ?? ""} /></Field>
        <Field label="Billing type">
          <select name="billingType" className="field-input" defaultValue={v.billingType ?? "fixed_rate"}>
            <option value="fixed_rate">Fixed rate</option><option value="project_hours">Project hours</option><option value="task_hours">Task hours</option>
          </select>
        </Field>
        <Field label="Project cost (fixed rate)"><input type="number" step="any" min="0" name="projectCost" className="field-input" defaultValue={v.projectCost ?? 0} /></Field>
        <Field label="Rate per hour (project hours)"><input type="number" step="any" min="0" name="ratePerHour" className="field-input" defaultValue={v.ratePerHour ?? 0} /></Field>
        <Field label="Progress %"><input type="number" min="0" max="100" name="progress" className="field-input" defaultValue={v.progress ?? 0} /></Field>
        <Field label="Description" className="sm:col-span-3"><textarea name="description" rows={4} className="field-input" defaultValue={v.description ?? ""} /></Field>
        {withMembers && (
          <Field label="Members" className="sm:col-span-3">
            <select name="members" multiple className="field-input h-28">
              {people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
            <span className="muted">Hold Ctrl/Cmd to select several. You are added automatically.</span>
          </Field>
        )}
      </div>
      <div className="flex gap-2"><SubmitButton>Save project</SubmitButton><Link href={cancelHref} className="btn-secondary">Cancel</Link></div>
    </form>
  );
}
