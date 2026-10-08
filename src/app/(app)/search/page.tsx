import Link from "next/link";
import { db } from "@/db";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Search" };

type Hit = { href: string; title: string; meta?: string };

/** Global search across every module. Plain substring match, case-insensitive. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const t = q.toLowerCase();
  const m = (...v: (string | null | undefined)[]) => v.some((x) => (x ?? "").toLowerCase().includes(t));
  const groups: [string, Hit[]][] = [];
  if (q.length >= 2) {
    const [cs, cts, ls, inv, est, pr, pj, tk, tix, con, kb, ex, ps] = await Promise.all([
      db.query.customers.findMany(), db.query.contacts.findMany({ with: { customer: true } }), db.query.leads.findMany(),
      db.query.invoices.findMany({ with: { customer: true } }), db.query.estimates.findMany({ with: { customer: true } }), db.query.proposals.findMany(),
      db.query.projects.findMany({ with: { customer: true } }), db.query.tasks.findMany({ with: { project: true } }), db.query.tickets.findMany(),
      db.query.contracts.findMany({ with: { customer: true } }), db.query.kbArticles.findMany(), db.query.expenses.findMany({ with: { category: true } }), db.query.prospects.findMany(),
    ]);
    groups.push(
      ["Customers", cs.filter((c) => m(c.company, c.city, c.phoneNumber, c.vatNumber, c.website)).map((c) => ({ href: `/customers/${c.id}`, title: c.company, meta: [c.city, c.phoneNumber].filter(Boolean).join(" · ") }))],
      ["Contacts", cts.filter((c) => m(`${c.firstName} ${c.lastName}`, c.email, c.phoneNumber, c.title)).map((c) => ({ href: `/customers/${c.customerId}`, title: `${c.firstName} ${c.lastName}`, meta: [c.customer.company, c.email].filter(Boolean).join(" · ") }))],
      ["Leads", ls.filter((l) => m(l.name, l.company, l.email, l.phoneNumber, l.description)).map((l) => ({ href: `/leads/${l.id}`, title: l.name, meta: l.company ?? undefined }))],
      ["Invoices", inv.filter((i) => m(i.number, i.customer.company, i.clientNote)).map((i) => ({ href: `/invoices/${i.id}`, title: i.number, meta: `${i.customer.company} · ${i.status}` }))],
      ["Estimates", est.filter((e) => m(e.number, e.customer.company)).map((e) => ({ href: `/estimates/${e.id}`, title: e.number, meta: e.customer.company }))],
      ["Proposals", pr.filter((p) => m(p.subject, p.proposalTo, p.content)).map((p) => ({ href: `/proposals/${p.id}`, title: p.subject, meta: p.proposalTo ?? undefined }))],
      ["Projects", pj.filter((p) => m(p.name, p.description, p.customer?.company)).map((p) => ({ href: `/projects/${p.id}`, title: p.name, meta: p.customer?.company }))],
      ["Tasks", tk.filter((x) => m(x.name, x.description)).map((x) => ({ href: `/tasks/${x.id}`, title: x.name, meta: x.project?.name ?? "Internal" }))],
      ["Tickets", tix.filter((x) => m(x.subject, x.message, x.email, x.name, `#${x.id}`)).map((x) => ({ href: `/tickets/${x.id}`, title: `#${x.id} ${x.subject}`, meta: x.email ?? undefined }))],
      ["Contracts", con.filter((x) => m(x.subject, x.content, x.customer.company)).map((x) => ({ href: `/contracts/${x.id}`, title: x.subject, meta: x.customer.company }))],
      ["Knowledge base", kb.filter((x) => m(x.subject, x.description)).map((x) => ({ href: `/knowledge-base/${x.id}`, title: x.subject }))],
      ["Expenses", ex.filter((x) => m(x.name, x.note, x.referenceNo, x.category.name)).map((x) => ({ href: `/expenses/${x.id}/edit`, title: x.name ?? x.category.name, meta: x.date }))],
      ["AI prospects", ps.filter((x) => m(x.title, x.organisation, x.summary)).map((x) => ({ href: `/prospecting?focus=${x.id}`, title: x.title, meta: x.organisation ?? undefined }))],
    );
  }
  const found = groups.filter(([, h]) => h.length);
  const total = found.reduce((a, [, h]) => a + h.length, 0);
  return (
    <>
      <PageHeader title="Search" subtitle={q ? `${total} result${total === 1 ? "" : "s"} for “${q}”` : "Search customers, contacts, leads, invoices, projects, tasks, tickets and more"} />
      <form className="mb-6 flex max-w-xl gap-2"><input name="q" defaultValue={q} autoFocus placeholder="Type at least 2 characters…" className="field-input" /><button className="btn-primary">Search</button></form>
      {q.length >= 2 && found.length === 0 && <Empty>Nothing matched “{q}”.</Empty>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {found.map(([title, hits]) => (
          <section key={title} className="card">
            <h2 className="mb-3">{title} <span className="muted font-normal">({hits.length})</span></h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {hits.slice(0, 15).map((h) => <li key={h.href + h.title} className="flex justify-between gap-3 py-2"><Link href={h.href} className="truncate">{h.title}</Link>{h.meta && <span className="truncate text-slate-500">{h.meta}</span>}</li>)}
            </ul>
            {hits.length > 15 && <p className="muted mt-2">+{hits.length - 15} more — refine your search.</p>}
          </section>
        ))}
      </div>
    </>
  );
}
