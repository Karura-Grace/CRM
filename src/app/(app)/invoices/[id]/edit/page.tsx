import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { invoiceItems, invoices } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import InvoiceForm from "../../InvoiceForm";
import { updateInvoice } from "../../actions";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, id), with: { items: { orderBy: asc(invoiceItems.order) } } });
  if (!inv) notFound();
  return (
    <>
      <PageHeader title={`Edit ${inv.number}`} back={{ href: `/invoices/${id}`, label: inv.number }} />
      <InvoiceForm action={updateInvoice.bind(null, id)} initial={inv} lines={inv.items} cancelHref={`/invoices/${id}`} isEdit />
    </>
  );
}
