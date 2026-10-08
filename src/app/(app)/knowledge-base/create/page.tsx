import { PageHeader } from "@/components/ui";
import ArticleForm from "../ArticleForm";
import { createArticle } from "../actions";

export const metadata = { title: "New article" };
export default function NewArticlePage() {
  return (<><PageHeader title="New article" back={{ href: "/knowledge-base", label: "Knowledge Base" }} /><ArticleForm action={createArticle} cancelHref="/knowledge-base" /></>);
}
