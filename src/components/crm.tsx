/** Reusable CRM panels: tags, reminders, interaction log. Server components. */
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reminders, staff, taggings } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { addInterval, fmtDate, today } from "@/lib/utils";
import { addReminder, addTag, deleteReminder, logInteraction, removeTag, setReminderDone } from "@/app/(app)/crm/actions";
import { getSession } from "@/lib/auth";

export function TagChip({ name, color }: { name: string; color: string }) {
  return <span className="badge" style={{ background: `${color}1a`, color, border: `1px solid ${color}55` }}>{name}</span>;
}

export async function TagEditor({ relType, relId, back }: { relType: "customer" | "lead"; relId: number; back: string }) {
  const [mine, all] = await Promise.all([
    db.query.taggings.findMany({ where: and(eq(taggings.relType, relType), eq(taggings.relId, relId)), with: { tag: true } }),
    db.query.tags.findMany(),
  ]);
  const add = addTag.bind(null, relType, relId);
  const have = new Set(mine.map((m) => m.tagId));
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="tag-editor">
      {mine.map((m) => {
        const rm = async () => { "use server"; await removeTag(relType, relId, m.tagId, back); };
        return (
          <form key={m.tagId} action={rm} className="inline-flex">
            <span className="badge gap-1" style={{ background: `${m.tag.color}1a`, color: m.tag.color, border: `1px solid ${m.tag.color}55` }}>
              {m.tag.name}<button className="opacity-60 hover:opacity-100" aria-label={`Remove tag ${m.tag.name}`}>×</button>
            </span>
          </form>
        );
      })}
      <form action={add} className="inline-flex items-center gap-1">
        <input type="hidden" name="back" value={back} />
        <select name="tagId" className="field-input h-7 w-auto py-0 text-xs" defaultValue="">
          <option value="">+ tag…</option>
          {all.filter((t) => !have.has(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input name="newTag" placeholder="or new tag" className="field-input h-7 w-28 py-0 text-xs" />
        <button className="btn-ghost btn-sm">Add</button>
      </form>
    </div>
  );
}

export async function RemindersPanel({ relType, relId, back, title = "Reminders" }: { relType: string; relId: number; back: string; title?: string }) {
  const session = await getSession();
  const [rows, people] = await Promise.all([
    db.query.reminders.findMany({ where: and(eq(reminders.relType, relType), eq(reminders.relId, relId)), with: { staff: true }, orderBy: asc(reminders.remindAt) }),
    db.query.staff.findMany({ where: eq(staff.active, true) }),
  ]);
  const add = addReminder.bind(null, relType, relId);
  const t0 = today();
  return (
    <section className="card" data-testid="reminders-panel">
      <h2 className="mb-3">{title}</h2>
      {rows.length === 0 ? <p className="muted mb-3">No follow-ups scheduled.</p> : (
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {rows.map((r) => {
            const toggle = async () => { "use server"; await setReminderDone(r.id, !r.isDone, back); };
            const del = async () => { "use server"; await deleteReminder(r.id, back); };
            const state = r.isDone ? "text-slate-400 line-through" : r.remindAt < t0 ? "text-rose-700" : "";
            return (
              <li key={r.id} className="flex items-start justify-between gap-2 py-2">
                <div className={state}>
                  <div>{r.description}</div>
                  <div className="text-xs text-slate-500">{fmtDate(r.remindAt)} · {r.staff.firstName}{!r.isDone && r.remindAt < t0 ? " · overdue" : ""}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <form action={toggle}><button className="btn-ghost btn-sm">{r.isDone ? "Re-open" : "Done"}</button></form>
                  <form action={del}><button className="btn-ghost btn-sm text-rose-600" aria-label="Delete reminder">✕</button></form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form action={add} className="grid grid-cols-2 gap-2">
        <input type="hidden" name="back" value={back} />
        <input name="description" required placeholder="Follow up on…" className="field-input col-span-2" />
        <input type="date" name="remindAt" defaultValue={addInterval(t0, "day", 3)} className="field-input" />
        {session?.role === "admin" ? (
          <select name="staffId" defaultValue={session.staffId} className="field-input">{people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select>
        ) : <span />}
        <div className="col-span-2"><SubmitButton className="btn-secondary btn-sm">Add reminder</SubmitButton></div>
      </form>
    </section>
  );
}

export function InteractionForm({ relType, relId, back }: { relType: "customer" | "lead"; relId: number; back: string }) {
  const act = logInteraction.bind(null, relType, relId);
  return (
    <form action={act} className="grid grid-cols-2 gap-2 sm:grid-cols-[7.5rem_10.5rem_1fr_5.5rem]" data-testid="interaction-form">
      <input type="hidden" name="back" value={back} />
      <select name="kind" className="field-input" defaultValue="call"><option value="call">Call</option><option value="meeting">Meeting</option><option value="email">Email</option><option value="note">Note</option></select>
      <input type="date" name="date" defaultValue={today()} className="field-input" />
      <input name="description" required placeholder="What was discussed / agreed" className="field-input col-span-2 sm:col-span-1" />
      <SubmitButton className="btn-primary">Log</SubmitButton>
    </form>
  );
}
