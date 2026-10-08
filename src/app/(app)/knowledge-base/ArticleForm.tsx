import Link from "next/link";
import { db } from "@/db";
import type { kbArticles } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Field } from "@/components/ui";

export default async function ArticleForm({ action, initial, cancelHref }: { action: (fd: FormData) => Promise<void>; initial?: Partial<typeof kbArticles.$inferSelect>; cancelHref: string }) {
  const groups = await db.query.kbGroups.findMany();
  const v = initial ?? {};
  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Subject *" className="sm:col-span-3"><input name="subject" required className="field-input" defaultValue={v.subject ?? ""} /></Field>
        <Field label="Group">
          <select name="groupId" className="field-input" defaultValue={v.groupId ?? ""}>
            <option value="">— Ungrouped —</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Visibility">
          <select name="visibility" className="field-input" defaultValue={v.visibility ?? "everyone"}>
            <option value="everyone">Everyone</option><option value="staff">Staff only</option><option value="customers">Customers only</option>
          </select>
        </Field>
        {initial && <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={v.active ?? true} /> Published</label>}
        <Field label="Article body" className="sm:col-span-3"><textarea name="description" rows={16} className="field-input" defaultValue={v.description ?? ""} /></Field>
      </div>
      <div className="flex gap-2"><SubmitButton>Save article</SubmitButton><Link href={cancelHref} className="btn-secondary">Cancel</Link></div>
    </form>
  );
}
