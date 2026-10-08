import { PageHeader } from "@/components/ui";
import InvoiceForm from "../InvoiceForm";
import { createInvoice } from "../actions";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customerId?: string; projectId?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="New invoice" back={{ href: "/invoices", label: "Invoices" }} />
      <InvoiceForm action={createInvoice} cancelHref="/invoices" initial={{ customerId: sp.customerId ? Number(sp.customerId) : undefined, projectId: sp.projectId ? Number(sp.projectId) : undefined }} />
    </>
  );
}
