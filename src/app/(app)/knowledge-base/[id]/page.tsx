import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { kbArticles } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { PageHeader } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/utils";
import { deleteArticle } from "../actions";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const a = await db.query.kbArticles.findFirst({ where: eq(kbArticles.id, id), with: { group: true, creator: true } });
  if (!a) notFound();
  const del = async () => { "use server"; await deleteArticle(id); };
  return (
    <>
      <PageHeader
        title={a.subject}
        subtitle={`${a.group?.name ?? "Ungrouped"} · Visible to ${humanize(a.visibility)} · ${a.creator ? `${a.creator.firstName} ${a.creator.lastName}, ` : ""}${fmtDate(a.createdAt)}${a.active ? "" : " · Draft"}`}
        back={{ href: "/knowledge-base", label: "Knowledge Base" }}
        actions={<><Link href={`/knowledge-base/${id}/edit`} className="btn-secondary">Edit</Link><form action={del}><SubmitButton className="btn-danger" confirm="Delete this article?">Delete</SubmitButton></form></>}
      />
      <article className="card"><div className="prose-pre text-base">{a.description || <span className="muted">Empty article.</span>}</div></article>
    </>
  );
}
