import { PageHeader } from "@/components/ui";
import TaskForm from "../TaskForm";
import { createTask } from "../actions";

export const metadata = { title: "New task" };
export default function NewTaskPage() {
  return (<><PageHeader title="New task" back={{ href: "/tasks", label: "Tasks" }} /><TaskForm action={createTask} cancelHref="/tasks" withAssignees /></>);
}
