import ExportButtons from "@/components/ExportButtons";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tickets, ticketStatuses } from "@/db/schema";
import { ColorBadge, Empty, PageHeader, TableWrap } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Support" };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const statuses = await db.query.ticketStatuses.findMany({ orderBy: asc(ticketStatuses.order) });
  const sid = status ? Number(status) : null;
  const rows = await db.query.tickets.findMany({
    where: sid ? eq(tickets.statusId, sid) : undefined,
    with: { customer: true, status: true, priority: true, department: true, assigned: true },
    orderBy: desc(tickets.id),
  });
  const pill = (a: boolean) => `btn btn-sm ${a ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`;
  return (
    <>
      <PageHeader title="Support tickets" actions={<Link href="/tickets/create" className="btn-primary">+ Open ticket</Link>} />
      <div className="-mt-3 mb-4 flex justify-end"><ExportButtons report="ticket-summary" params={{}} compact /></div>
      <div className="mb-4 flex flex-wrap gap-1">
        <Link href="/tickets" className={pill(!sid)}>All</Link>
        {statuses.map((s) => <Link key={s.id} href={`/tickets?status=${s.id}`} className={pill(sid === s.id)}>{s.name}</Link>)}
      </div>
      {rows.length === 0 ? <Empty>No tickets.</Empty> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>#</th><th>Subject</th><th>Customer / contact</th><th>Department</th><th>Assigned</th><th>Priority</th><th>Status</th><th>Last reply</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td><Link href={`/tickets/${t.id}`} className="font-medium">{t.subject}</Link></td>
                  <td>{t.customer?.company ?? t.name ?? t.email ?? "—"}</td>
                  <td>{t.department?.name ?? "—"}</td>
                  <td>{t.assigned ? `${t.assigned.firstName} ${t.assigned.lastName}` : "—"}</td>
                  <td><ColorBadge color={t.priority?.color} label={t.priority?.name} /></td>
                  <td><ColorBadge color={t.status?.color} label={t.status?.name} /></td>
                  <td className="whitespace-nowrap">{fmtDateTime(t.lastReply)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
