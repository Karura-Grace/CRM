import ExportButtons from "@/components/ExportButtons";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { Badge, Empty, PageHeader, TableWrap } from "@/components/ui";
import { getDefaultCurrency } from "@/lib/settings";
import { fmtDate, money } from "@/lib/utils";

export const metadata = { title: "Invoices" };
const STATUSES = ["draft", "unpaid", "partial", "paid", "overdue", "cancelled"] as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; recurring?: string }> }) {
  const { status, recurring } = await searchParams;
  const st = STATUSES.find((s) => s === status);
  const rows = await db.query.invoices.findMany({
    where: recurring ? eq(invoices.isRecurring, true) : st ? eq(invoices.status, st) : undefined,
    with: { customer: true, currency: true },
    orderBy: desc(invoices.id),
  });
  const def = await getDefaultCurrency();
  const due = rows.filter((r) => r.status !== "cancelled" && r.status !== "draft").reduce((a, r) => a + (r.total - r.totalPaid), 0);
  const pill = (active: boolean) => `btn btn-sm capitalize ${active ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`;
  return (
    <>
      <PageHeader title="Invoices" subtitle={`Outstanding in view: ${money(due, def.symbol)}`} actions={<Link href="/invoices/create" className="btn-primary">+ New invoice</Link>} />
      <div className="-mt-3 mb-4 flex justify-end"><ExportButtons report="invoice-register" params={{ status: st }} compact /></div>
      <div className="mb-4 flex flex-wrap gap-1">
        <Link href="/invoices" className={pill(!st && !recurring)}>All</Link>
        {STATUSES.map((s) => <Link key={s} href={`/invoices?status=${s}`} className={pill(st === s)}>{s}</Link>)}
        <Link href="/invoices?recurring=1" className={pill(!!recurring)}>Recurring</Link>
      </div>
      {rows.length === 0 ? <Empty>No invoices.</Empty> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Number</th><th>Customer</th><th>Date</th><th>Due</th><th className="text-right">Total</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((i) => {
                const sym = i.currency?.symbol ?? def.symbol;
                return (
                  <tr key={i.id}>
                    <td><Link href={`/invoices/${i.id}`} className="font-medium">{i.number}</Link>{i.isRecurring && <span className="badge ml-2 bg-violet-100 text-violet-800">recurring</span>}</td>
                    <td><Link href={`/customers/${i.customerId}`}>{i.customer.company}</Link></td>
                    <td>{fmtDate(i.date)}</td>
                    <td>{fmtDate(i.dueDate)}</td>
                    <td className="text-right tabular-nums">{money(i.total, sym)}</td>
                    <td className="text-right tabular-nums">{money(i.total - i.totalPaid, sym)}</td>
                    <td><Badge status={i.status} /></td>
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
