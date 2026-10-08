import ExportButtons from "@/components/ExportButtons";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { Badge, Empty, PageHeader, TableWrap } from "@/components/ui";
import { getDefaultCurrency } from "@/lib/settings";
import { fmtDate, money } from "@/lib/utils";

export const metadata = { title: "Proposals" };

export default async function ProposalsPage() {
  const rows = await db.query.proposals.findMany({ with: { customer: true, lead: true }, orderBy: desc(proposals.id) });
  const def = await getDefaultCurrency();
  return (
    <>
      <PageHeader title="Proposals" actions={<Link href="/proposals/create" className="btn-primary">+ New proposal</Link>} />
      <div className="-mt-3 mb-4 flex justify-end"><ExportButtons report="proposals-estimates" params={{}} compact /></div>
      {rows.length === 0 ? <Empty>No proposals yet.</Empty> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Subject</th><th>To</th><th>Date</th><th>Open till</th><th className="text-right">Total</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/proposals/${p.id}`} className="font-medium">{p.subject}</Link></td>
                  <td>
                    {p.customer ? <Link href={`/customers/${p.customer.id}`}>{p.customer.company}</Link> : p.lead ? <Link href={`/leads/${p.lead.id}`}>{p.lead.name} <span className="muted">(lead)</span></Link> : "—"}
                  </td>
                  <td>{fmtDate(p.date)}</td>
                  <td>{fmtDate(p.openTill)}</td>
                  <td className="text-right tabular-nums">{money(p.total, def.symbol)}</td>
                  <td><Badge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
