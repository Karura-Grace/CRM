import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import LeadForm from "../../LeadForm";
import { updateLead } from "../../actions";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, id) });
  if (!lead) notFound();
  return (
    <>
      <PageHeader title={`Edit ${lead.name}`} back={{ href: `/leads/${id}`, label: lead.name }} />
      <LeadForm action={updateLead.bind(null, id)} initial={lead} cancelHref={`/leads/${id}`} />
    </>
  );
}
