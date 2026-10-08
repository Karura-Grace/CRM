import ExportButtons from "@/components/ExportButtons";
import Link from "next/link";
import { asc, like, or } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { TagChip } from "@/components/crm";
import { Badge, Empty, PageHeader, TableWrap } from "@/components/ui";
import { tagMap } from "@/lib/segments";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string }> }) {
  const { q, tag } = await searchParams;
  const tagId = tag ? Number(tag) : null;
  const [all, tags, tmap] = await Promise.all([
    db.query.customers.findMany({
      where: q ? or(like(customers.company, `%${q}%`), like(customers.city, `%${q}%`), like(customers.phoneNumber, `%${q}%`)) : undefined,
      with: { group: true, contacts: true },
      orderBy: asc(customers.company),
    }),
    db.query.tags.findMany(),
    tagMap("customer"),
  ]);
  const rows = tagId ? all.filter((c) => (tmap.get(c.id) ?? []).some((t) => t.id === tagId)) : all;
  return (
    <>
      <PageHeader title="Customers" subtitle={`${rows.length} customer${rows.length === 1 ? "" : "s"}`} actions={<><Link href="/segments" className="btn-secondary">Segments</Link><Link href="/customers/create" className="btn-primary">+ New customer</Link></>} />
      <div className="-mt-3 mb-4 flex justify-end"><ExportButtons report="customers-list" params={{ tag }} compact /></div>
      <form className="mb-3 flex max-w-xl flex-wrap gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="Search company, city, phone…" className="field-input flex-1" />
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button className="btn-secondary">Search</button>
      </form>
      {tags.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-slate-500">Tags:</span>
          <Link href={q ? `/customers?q=${encodeURIComponent(q)}` : "/customers"} className={`btn btn-sm ${!tagId ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`}>All</Link>
          {tags.map((t) => <Link key={t.id} href={`/customers?tag=${t.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`btn btn-sm ${tagId === t.id ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`}>{t.name}</Link>)}
        </div>
      )}
      {rows.length === 0 ? <Empty>No customers found.</Empty> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Company</th><th>Primary contact</th><th>Phone</th><th>Group</th><th>Tags</th><th>City</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((c) => {
                const primary = c.contacts.find((x) => x.isPrimary) ?? c.contacts[0];
                return (
                  <tr key={c.id}>
                    <td><Link href={`/customers/${c.id}`} className="font-medium">{c.company}</Link></td>
                    <td>{primary ? <>{primary.firstName} {primary.lastName}<div className="muted">{primary.email}</div></> : <span className="muted">—</span>}</td>
                    <td>{c.phoneNumber ?? "—"}</td>
                    <td>{c.group?.name ?? "—"}</td>
                    <td><div className="flex flex-wrap gap-1">{(tmap.get(c.id) ?? []).map((t) => <TagChip key={t.id} name={t.name} color={t.color} />)}</div></td>
                    <td>{c.city ?? "—"}</td>
                    <td><Badge status={c.active ? "active" : "inactive"} /></td>
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
