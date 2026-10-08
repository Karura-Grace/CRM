import Link from "next/link";
import { asc, isNull, like, or } from "drizzle-orm";
import { db } from "@/db";
import { kbArticles, kbGroups } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Empty, PageHeader } from "@/components/ui";
import { createGroup, deleteGroup } from "./actions";

export const metadata = { title: "Knowledge Base" };

export default async function KnowledgeBasePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  if (q) {
    const hits = await db.query.kbArticles.findMany({ where: or(like(kbArticles.subject, `%${q}%`), like(kbArticles.description, `%${q}%`)), with: { group: true } });
    return (
      <>
        <PageHeader title="Knowledge Base" subtitle={`${hits.length} result(s) for “${q}”`} back={{ href: "/knowledge-base", label: "All articles" }} />
        <div className="card"><ul className="divide-y divide-slate-100">{hits.map((a) => <li key={a.id} className="py-2"><Link href={`/knowledge-base/${a.id}`}>{a.subject}</Link> <span className="muted">· {a.group?.name ?? "Ungrouped"}</span></li>)}</ul></div>
      </>
    );
  }
  const groups = await db.query.kbGroups.findMany({ with: { articles: { orderBy: asc(kbArticles.subject) } }, orderBy: [asc(kbGroups.order), asc(kbGroups.name)] });
  const ungrouped = await db.query.kbArticles.findMany({ where: isNull(kbArticles.groupId), orderBy: asc(kbArticles.subject) });
  return (
    <>
      <PageHeader title="Knowledge Base" actions={<Link href="/knowledge-base/create" className="btn-primary">+ New article</Link>} />
      <form className="mb-6 flex max-w-md gap-2"><input name="q" placeholder="Search articles…" className="field-input" /><button className="btn-secondary">Search</button></form>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const del = async () => { "use server"; await deleteGroup(g.id); };
          return (
            <section key={g.id} className="card" style={{ borderTop: `4px solid ${g.color}` }}>
              <div className="mb-2 flex items-start justify-between">
                <div><h2>{g.name}</h2>{g.description && <p className="muted">{g.description}</p>}</div>
                <form action={del}><SubmitButton className="btn-ghost btn-sm text-rose-600" confirm="Delete this group? Articles will be kept but ungrouped.">✕</SubmitButton></form>
              </div>
              {g.articles.length === 0 ? <p className="muted">No articles.</p> : (
                <ul className="space-y-1 text-sm">
                  {g.articles.map((a) => <li key={a.id}><Link href={`/knowledge-base/${a.id}`}>{a.subject}</Link>{!a.active && <span className="muted"> (draft)</span>}</li>)}
                </ul>
              )}
            </section>
          );
        })}
        {ungrouped.length > 0 && (
          <section className="card">
            <h2 className="mb-2">Ungrouped</h2>
            <ul className="space-y-1 text-sm">{ungrouped.map((a) => <li key={a.id}><Link href={`/knowledge-base/${a.id}`}>{a.subject}</Link></li>)}</ul>
          </section>
        )}
        <section className="card border-dashed">
          <h2 className="mb-3">New group</h2>
          <form action={createGroup} className="space-y-2">
            <input name="name" required placeholder="Group name" className="field-input" />
            <input name="description" placeholder="Description (optional)" className="field-input" />
            <div className="flex items-center gap-2"><input type="color" name="color" defaultValue="#1d5cf1" className="h-9 w-12 rounded border" /><SubmitButton className="btn-secondary">Create group</SubmitButton></div>
          </form>
        </section>
      </div>
      {groups.length === 0 && ungrouped.length === 0 && <div className="mt-6"><Empty>No articles yet.</Empty></div>}
    </>
  );
}
