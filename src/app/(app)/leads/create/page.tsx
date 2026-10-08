import { PageHeader } from "@/components/ui";
import LeadForm from "../LeadForm";
import { createLead } from "../actions";

export const metadata = { title: "New lead" };

export default function NewLeadPage() {
  return (
    <>
      <PageHeader title="New lead" back={{ href: "/leads", label: "Leads" }} />
      <LeadForm action={createLead} cancelHref="/leads" />
    </>
  );
}
