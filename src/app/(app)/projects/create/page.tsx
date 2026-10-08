import { PageHeader } from "@/components/ui";
import ProjectForm from "../ProjectForm";
import { createProject } from "../actions";

export const metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const { customerId } = await searchParams;
  return (
    <>
      <PageHeader title="New project" back={{ href: "/projects", label: "Projects" }} />
      <ProjectForm action={createProject} cancelHref="/projects" withMembers initial={{ customerId: customerId ? Number(customerId) : undefined }} />
    </>
  );
}
