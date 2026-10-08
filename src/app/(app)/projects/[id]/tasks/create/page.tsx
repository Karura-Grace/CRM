import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import TaskForm from "../../../../tasks/TaskForm";
import { createTask } from "../../../../tasks/actions";

export const metadata = { title: "New task" };

export default async function NewProjectTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const p = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!p) notFound();
  return (
    <>
      <PageHeader title={`New task · ${p.name}`} back={{ href: `/projects/${id}`, label: p.name }} />
      <TaskForm action={createTask} initial={{ projectId: id }} cancelHref={`/projects/${id}`} withAssignees back={`/projects/${id}/tasks/create`} />
    </>
  );
}
