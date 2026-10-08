import { PageHeader } from "@/components/ui";
import CustomerForm from "../CustomerForm";
import { createCustomer } from "../actions";

export const metadata = { title: "New customer" };

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader title="New customer" back={{ href: "/customers", label: "Customers" }} />
      <CustomerForm action={createCustomer} withContact cancelHref="/customers" />
    </>
  );
}
