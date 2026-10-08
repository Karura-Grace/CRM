import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import StaffForm from "../StaffForm";
import { createStaff } from "../actions";

export const metadata = { title: "New staff member" };
export default async function NewStaffPage() {
  await requireAdmin();
  return (<><PageHeader title="New staff member" back={{ href: "/staff", label: "Staff" }} /><StaffForm action={createStaff} /></>);
}
