import { PageHeader } from "@/components/ui";
import ContractForm from "../ContractForm";
import { createContract } from "../actions";

export const metadata = { title: "New contract" };
export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const { customerId } = await searchParams;
  return (<><PageHeader title="New contract" back={{ href: "/contracts", label: "Contracts" }} /><ContractForm action={createContract} cancelHref="/contracts" initial={{ customerId: customerId ? Number(customerId) : undefined }} /></>);
}
