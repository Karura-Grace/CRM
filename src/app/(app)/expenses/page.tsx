import ExportButtons from "@/components/ExportButtons";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Empty, PageHeader, TableWrap } from "@/components/ui";
import { getDefaultCurrency } from "@/lib/settings";
import { fmtDate, money } from "@/lib/utils";
import { deleteExpense, invoiceExpense } from "./actions";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ category?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const cats = await db.query.expenseCategories.findMany();
  let rows = await db.query.expenses.findMany({
    where: sp.category ? eq(expenses.categoryId, Number(sp.category)) : undefined,
    with: { category: true, customer: true, project: true, currency: true, invoice: true },
    orderBy: desc(expenses.date),
  });
  if (sp.from) rows = rows.filter((r) => r.date >= sp.from!);
  if (sp.to) rows = rows.filter((r) => r.date <= sp.to!);
  const def = await getDefaultCurrency();
  const total = rows.reduce((a, e) => a + e.amount + e.tax, 0);
  return (
    <>
      <PageHeader title="Expenses" subtitle={<>Total in view: <strong className="text-slate-900">{money(total, def.symbol)}</strong></>} actions={<Link href="/expenses/create" className="btn-primary">+ Record expense</Link>} />
      <div className="-mt-3 mb-4 flex justify-end"><ExportButtons report="expense-register" params={{ from: sp.from, to: sp.to }} compact /></div>
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <select name="category" defaultValue={sp.category ?? ""} className="field-input w-48"><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input type="date" name="from" defaultValue={sp.from ?? ""} className="field-input w-40" />
        <input type="date" name="to" defaultValue={sp.to ?? ""} className="field-input w-40" />
        <button className="btn-secondary">Filter</button>
      </form>
      {rows.length === 0 ? <Empty>No expenses recorded.</Empty> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Date</th><th>Category</th><th>Name</th><th>Customer / project</th><th>Ref</th><th className="text-right">Amount</th><th className="text-right">Tax</th><th>Billing</th><th /></tr></thead>
            <tbody>
              {rows.map((e) => {
                const sym = e.currency?.symbol ?? def.symbol;
                const del = async () => { "use server"; await deleteExpense(e.id); };
                const bill = async () => { "use server"; await invoiceExpense(e.id); };
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td>{e.category.name}{e.isRecurring && <span className="badge ml-1 bg-violet-100 text-violet-800">recurring</span>}</td>
                    <td><Link href={`/expenses/${e.id}/edit`}>{e.name ?? "—"}</Link></td>
                    <td>{e.customer?.company ?? "—"}{e.project && <div className="muted">{e.project.name}</div>}</td>
                    <td>{e.referenceNo ?? "—"}</td>
                    <td className="text-right tabular-nums">{money(e.amount, sym)}</td>
                    <td className="text-right tabular-nums">{money(e.tax, sym)}</td>
                    <td>
                      {e.invoice ? <Link href={`/invoices/${e.invoice.id}`}>{e.invoice.number}</Link>
                        : e.billable ? <form action={bill}><button className="btn-secondary btn-sm">Invoice</button></form>
                        : <span className="muted">—</span>}
                    </td>
                    <td><form action={del}><SubmitButton className="btn-ghost btn-sm text-rose-600" confirm="Delete this expense?">Delete</SubmitButton></form></td>
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
