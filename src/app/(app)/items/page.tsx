import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { items } from "@/db/schema";
import { Empty, PageHeader, TableWrap } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { getDefaultCurrency } from "@/lib/settings";
import { money } from "@/lib/utils";
import { deleteItem } from "./actions";

export const metadata = { title: "Items" };

export default async function ItemsPage() {
  const rows = await db.query.items.findMany({ orderBy: [asc(items.groupName), asc(items.description)] });
  const cur = await getDefaultCurrency();
  return (
    <>
      <PageHeader title="Items" subtitle="Catalog used to auto-fill estimates, proposals and invoices" actions={<Link href="/items/create" className="btn-primary">+ New item</Link>} />
      {rows.length === 0 ? <Empty>No items in the catalog yet.</Empty> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Description</th><th>Group</th><th>Unit</th><th className="text-right">Rate</th><th className="text-right">Tax</th><th /></tr></thead>
            <tbody>
              {rows.map((i) => {
                const del = async () => { "use server"; await deleteItem(i.id); };
                return (
                  <tr key={i.id}>
                    <td><Link href={`/items/${i.id}/edit`} className="font-medium">{i.description}</Link>{i.longDescription && <div className="muted">{i.longDescription}</div>}</td>
                    <td>{i.groupName ?? "—"}</td>
                    <td>{i.unit ?? "—"}</td>
                    <td className="text-right tabular-nums">{money(i.rate, cur.symbol)}</td>
                    <td className="text-right">{i.taxRate}%</td>
                    <td className="text-right"><form action={del}><SubmitButton className="btn-ghost btn-sm text-rose-600" confirm="Delete this item?">Delete</SubmitButton></form></td>
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
