import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Badge, PageHeader, TableWrap } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/utils";
import { deleteStaff, toggleStaffActive } from "./actions";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const me = await requireAdmin();
  const rows = await db.query.staff.findMany({ with: { department: true }, orderBy: asc(staff.firstName) });
  return (
    <>
      <PageHeader title="Staff" actions={<Link href="/staff/create" className="btn-primary">+ New staff member</Link>} />
      <TableWrap>
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Last login</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((s) => {
              const toggle = async () => { "use server"; await toggleStaffActive(s.id); };
              const del = async () => { "use server"; await deleteStaff(s.id); };
              return (
                <tr key={s.id}>
                  <td><Link href={`/staff/${s.id}/edit`} className="font-medium">{s.firstName} {s.lastName}</Link>{s.id === me.staffId && <span className="muted"> (you)</span>}</td>
                  <td>{s.email}</td>
                  <td>{s.department?.name ?? "—"}</td>
                  <td><Badge status={s.role} /></td>
                  <td>{fmtDateTime(s.lastLogin)}</td>
                  <td><Badge status={s.active ? "active" : "inactive"} /></td>
                  <td className="whitespace-nowrap text-right">
                    {s.id !== me.staffId && (
                      <>
                        <form action={toggle} className="inline"><button className="btn-ghost btn-sm">{s.active ? "Deactivate" : "Activate"}</button></form>
                        <form action={del} className="inline"><SubmitButton className="btn-ghost btn-sm text-rose-600" confirm="Permanently delete this staff member?">Delete</SubmitButton></form>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </>
  );
}
