import ExportButtons from "@/components/ExportButtons";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { Empty, PageHeader, TableWrap } from "@/components/ui";
import { getDefaultCurrency } from "@/lib/settings";
import { fmtDate, money } from "@/lib/utils";
import { contractState } from "./state";

export const metadata = { title: "Contracts" };

export default async function ContractsPage() {
  const rows = await db.query.contracts.findMany({ with: { customer: true, type: true }, orderBy: desc(contracts.id) });
  const { symbol } = await getDefaultCurrency();
  return (
    <>
      <PageHeader title="Contracts" actions={<Link href="/contracts/create" className="btn-primary">+ New contract</Link>} />
      <div className="-mt-3 mb-4 flex justify-end"><ExportButtons report="contracts-register" params={{}} compact /></div>
      {rows.length === 0 ? <Empty>No contracts.</Empty> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Subject</th><th>Customer</th><th>Type</th><th>Start</th><th>End</th><th className="text-right">Value</th><th>Signed</th><th>State</th></tr></thead>
            <tbody>
              {rows.map((c) => {
                const st = contractState(c.dateEnd);
                return (
                  <tr key={c.id}>
                    <td><Link href={`/contracts/${c.id}`} className="font-medium">{c.subject}</Link></td>
                    <td><Link href={`/customers/${c.customerId}`}>{c.customer.company}</Link></td>
                    <td>{c.type?.name ?? "—"}</td>
                    <td>{fmtDate(c.dateStart)}</td>
                    <td>{fmtDate(c.dateEnd)}</td>
                    <td className="text-right tabular-nums">{money(c.value, symbol)}</td>
                    <td>{c.signed ? "✓" : "—"}</td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
