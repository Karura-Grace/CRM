import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import TaskForm from "../../TaskForm";
import { updateTask } from "../../actions";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const t = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!t) notFound();
  return (<><PageHeader title={`Edit task`} back={{ href: `/tasks/${id}`, label: t.name }} /><TaskForm action={updateTask.bind(null, id)} initial={t} cancelHref={`/tasks/${id}`} /></>);
}
