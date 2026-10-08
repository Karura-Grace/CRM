import ExportButtons from "@/components/ExportButtons";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { Empty, PageHeader, TableWrap } from "@/components/ui";
import { getDefaultCurrency } from "@/lib/settings";
import { fmtDate, humanize, money } from "@/lib/utils";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const rows = await db.query.payments.findMany({ with: { invoice: { with: { customer: true, currency: true } }, recorder: true }, orderBy: desc(payments.date), limit: 500 });
  const def = await getDefaultCurrency();
  const total = rows.reduce((a, p) => a + p.amount, 0);
  return (
    <>
      <PageHeader title="Payments" subtitle={`${rows.length} payments · ${money(total, def.symbol)} received`} />
      <div className="-mt-3 mb-4 flex justify-end"><ExportButtons report="payments-received" params={{}} compact /></div>
      {rows.length === 0 ? <Empty>No payments recorded yet. Record payments from an invoice.</Empty> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Mode</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.date)}</td>
                  <td><Link href={`/invoices/${p.invoiceId}`}>{p.invoice.number}</Link></td>
                  <td>{p.invoice.customer.company}</td>
                  <td>{humanize(p.paymentMode)}</td>
                  <td>{p.transactionId ?? "—"}</td>
                  <td className="text-right tabular-nums">{money(p.amount, p.invoice.currency?.symbol ?? def.symbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
