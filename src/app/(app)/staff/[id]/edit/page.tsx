import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import StaffForm from "../../StaffForm";
import { updateStaff } from "../../actions";

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const s = await db.query.staff.findFirst({ where: eq(staff.id, id) });
  if (!s) notFound();
  return (<><PageHeader title={`Edit ${s.firstName} ${s.lastName}`} back={{ href: "/staff", label: "Staff" }} /><StaffForm action={updateStaff.bind(null, id)} initial={s} /></>);
}
