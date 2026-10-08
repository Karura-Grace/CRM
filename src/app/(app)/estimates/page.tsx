import ExportButtons from "@/components/ExportButtons";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { estimates } from "@/db/schema";
import { Badge, Empty, PageHeader, TableWrap } from "@/components/ui";
import { getDefaultCurrency } from "@/lib/settings";
import { fmtDate, money } from "@/lib/utils";

export const metadata = { title: "Estimates" };
const STATUSES = ["draft", "sent", "accepted", "declined", "expired"] as const;

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const st = STATUSES.find((s) => s === status);
  const rows = await db.query.estimates.findMany({ where: st ? eq(estimates.status, st) : undefined, with: { customer: true, currency: true }, orderBy: desc(estimates.id) });
  const def = await getDefaultCurrency();
  return (
    <>
      <PageHeader title="Estimates" actions={<Link href="/estimates/create" className="btn-primary">+ New estimate</Link>} />
      <div className="-mt-3 mb-4 flex justify-end"><ExportButtons report="proposals-estimates" params={{}} compact /></div>
      <div className="mb-4 flex flex-wrap gap-1">
        <Link href="/estimates" className={`btn btn-sm ${!st ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`}>All</Link>
        {STATUSES.map((s) => <Link key={s} href={`/estimates?status=${s}`} className={`btn btn-sm capitalize ${st === s ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`}>{s}</Link>)}
      </div>
      {rows.length === 0 ? <Empty>No estimates.</Empty> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Number</th><th>Customer</th><th>Date</th><th>Expiry</th><th className="text-right">Total</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td><Link href={`/estimates/${e.id}`} className="font-medium">{e.number}</Link></td>
                  <td><Link href={`/customers/${e.customerId}`}>{e.customer.company}</Link></td>
                  <td>{fmtDate(e.date)}</td>
                  <td>{fmtDate(e.expiryDate)}</td>
                  <td className="text-right tabular-nums">{money(e.total, e.currency?.symbol ?? def.symbol)}</td>
                  <td><Badge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
