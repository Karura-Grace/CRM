import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import CustomerForm from "../../CustomerForm";
import { updateCustomer } from "../../actions";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const c = await db.query.customers.findFirst({ where: eq(customers.id, id) });
  if (!c) notFound();
  return (
    <>
      <PageHeader title={`Edit ${c.company}`} back={{ href: `/customers/${id}`, label: c.company }} />
      <CustomerForm action={updateCustomer.bind(null, id)} initial={c} cancelHref={`/customers/${id}`} />
    </>
  );
}
