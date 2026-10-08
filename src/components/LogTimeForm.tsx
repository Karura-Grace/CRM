/** Manual "log time" form, shared by the Timesheets page and the Task page. */
import { Field } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { logTime } from "@/app/(app)/timesheets/actions";
import { today } from "@/lib/utils";

type TaskOpt = { id: number; name: string; projectName: string | null };

export default function LogTimeForm({
  back,
  taskId,
  tasks,
  staff,
  currentStaffId,
}: {
  back: string;
  taskId?: number;
  tasks?: TaskOpt[];
  staff?: { id: number; name: string }[]; // only passed for admins
  currentStaffId: number;
}) {
  const groups = new Map<string, TaskOpt[]>();
  for (const t of tasks ?? []) {
    const k = t.projectName ?? "Internal tasks";
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  return (
    <form action={logTime} className="grid grid-cols-2 gap-3 sm:grid-cols-6" data-testid="log-time-form">
      <input type="hidden" name="back" value={back} />
      {taskId ? (
        <input type="hidden" name="taskId" value={taskId} />
      ) : (
        <Field label="Task *" className="col-span-2">
          <select name="taskId" required className="field-input" defaultValue="">
            <option value="">— Select task —</option>
            {[...groups.entries()].map(([g, ts]) => (
              <optgroup key={g} label={g}>
                {ts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
      )}
      {staff && (
        <Field label="Person">
          <select name="staffId" className="field-input" defaultValue={currentStaffId}>
            {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Date"><input type="date" name="date" defaultValue={today()} className="field-input" /></Field>
      <Field label="Start"><input type="time" name="start" defaultValue="09:00" className="field-input" /></Field>
      <Field label="Hours *"><input name="hours" type="number" step="0.25" min="0.25" max="24" required placeholder="e.g. 1.5" className="field-input" /></Field>
      <Field label="Note" className={taskId ? "col-span-2 sm:col-span-2" : "col-span-2 sm:col-span-4"}><input name="note" className="field-input" placeholder="What was done" /></Field>
      <div className="col-span-2 flex items-end sm:col-span-1"><SubmitButton className="btn-primary w-full">Log time</SubmitButton></div>
    </form>
  );
}
