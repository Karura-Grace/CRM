import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { kbArticles } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import ArticleForm from "../../ArticleForm";
import { updateArticle } from "../../actions";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const a = await db.query.kbArticles.findFirst({ where: eq(kbArticles.id, id) });
  if (!a) notFound();
  return (<><PageHeader title="Edit article" back={{ href: `/knowledge-base/${id}`, label: a.subject }} /><ArticleForm action={updateArticle.bind(null, id)} initial={a} cancelHref={`/knowledge-base/${id}`} /></>);
}
