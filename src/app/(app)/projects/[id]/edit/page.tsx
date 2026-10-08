import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import ProjectForm from "../../ProjectForm";
import { updateProject } from "../../actions";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const p = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!p) notFound();
  return (
    <>
      <PageHeader title={`Edit ${p.name}`} back={{ href: `/projects/${id}`, label: p.name }} />
      <ProjectForm action={updateProject.bind(null, id)} initial={p} cancelHref={`/projects/${id}`} />
    </>
  );
}
