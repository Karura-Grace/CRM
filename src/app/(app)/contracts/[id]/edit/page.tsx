import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import ContractForm from "../../ContractForm";
import { updateContract } from "../../actions";

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const c = await db.query.contracts.findFirst({ where: eq(contracts.id, id) });
  if (!c) notFound();
  return (<><PageHeader title="Edit contract" back={{ href: `/contracts/${id}`, label: c.subject }} /><ContractForm action={updateContract.bind(null, id)} initial={c} cancelHref={`/contracts/${id}`} /></>);
}
