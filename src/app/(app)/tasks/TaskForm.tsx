import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { milestones, projects, staff, type tasks } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Field } from "@/components/ui";
import { today } from "@/lib/utils";

export default async function TaskForm({ action, initial, cancelHref, withAssignees = false, back }: { action: (fd: FormData) => Promise<void>; initial?: Partial<typeof tasks.$inferSelect>; cancelHref: string; withAssignees?: boolean; back?: string }) {
  const v = initial ?? {};
  const [projs, people, ms] = await Promise.all([
    db.query.projects.findMany({ orderBy: desc(projects.id), columns: { id: true, name: true } }),
    db.query.staff.findMany({ where: eq(staff.active, true) }),
    v.projectId ? db.query.milestones.findMany({ where: eq(milestones.projectId, v.projectId), orderBy: asc(milestones.dueDate) }) : Promise.resolve([]),
  ]);
  return (
    <form action={action} className="card space-y-4">
      {back && <input type="hidden" name="back" value={back} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Task name *" className="sm:col-span-3"><input name="name" required className="field-input" defaultValue={v.name ?? ""} /></Field>
        <Field label="Project">
          <select name="projectId" className="field-input" defaultValue={v.projectId ?? ""}>
            <option value="">— Internal (no project) —</option>
            {projs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Milestone">
          <select name="milestoneId" className="field-input" defaultValue={v.milestoneId ?? ""}>
            <option value="">—</option>
            {ms.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select name="priority" className="field-input" defaultValue={v.priority ?? "medium"}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select>
        </Field>
        <Field label="Status">
          <select name="status" className="field-input" defaultValue={v.status ?? "not_started"}>
            <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="testing">Testing</option><option value="awaiting_feedback">Awaiting feedback</option><option value="finished">Finished</option>
          </select>
        </Field>
        <Field label="Start date"><input type="date" name="startDate" className="field-input" defaultValue={v.startDate ?? today()} /></Field>
        <Field label="Due date"><input type="date" name="dueDate" className="field-input" defaultValue={v.dueDate ?? ""} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="billable" defaultChecked={v.billable ?? false} /> Billable</label>
        <Field label="Hourly rate (if billable)"><input type="number" step="any" min="0" name="hourlyRate" className="field-input" defaultValue={v.hourlyRate ?? 0} /></Field>
        {withAssignees && (
          <Field label="Assignees">
            <select name="assignees" multiple className="field-input h-24">
              {people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </Field>
        )}
        <Field label="Description" className="sm:col-span-3"><textarea name="description" rows={4} className="field-input" defaultValue={v.description ?? ""} /></Field>
      </div>
      <div className="flex gap-2"><SubmitButton>Save task</SubmitButton><Link href={cancelHref} className="btn-secondary">Cancel</Link></div>
    </form>
  );
}
