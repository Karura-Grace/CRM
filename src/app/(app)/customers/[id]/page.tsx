import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { contracts, customers, estimates, invoices, projects, tickets } from "@/db/schema";
import { Badge, ColorBadge, DL, Empty, Field, PageHeader } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { getDefaultCurrency } from "@/lib/settings";
import { fmtDate, fmtDateTime, money } from "@/lib/utils";
import { customerTimeline } from "@/lib/timeline";
import { InteractionForm, RemindersPanel, TagEditor } from "@/components/crm";
import ExportButtons from "@/components/ExportButtons";
import { addContact, deleteContact, deleteCustomer, setPrimaryContact } from "../actions";

export default async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tl?: string }> }) {
  const id = Number((await params).id);
  const { tl } = await searchParams;
  const c = await db.query.customers.findFirst({
    where: eq(customers.id, id),
    with: {
      group: true,
      currency: true,
      contacts: true,
      estimates: { orderBy: desc(estimates.id) },
      invoices: { orderBy: desc(invoices.id) },
      projects: { orderBy: desc(projects.id) },
      tickets: { orderBy: desc(tickets.id), with: { status: true } },
      contracts: { orderBy: desc(contracts.id), with: { type: true } },
    },
  });
  if (!c) notFound();
  const sym = c.currency?.symbol ?? (await getDefaultCurrency()).symbol;
  const invoiced = c.invoices.reduce((a, i) => a + i.total, 0);
  const paid = c.invoices.reduce((a, i) => a + i.totalPaid, 0);

  const allEvents = await customerTimeline(id);
  const events = tl ? allEvents.filter((e) => e.kind === tl) : allEvents;
  const del = async () => { "use server"; await deleteCustomer(id); };
  const add = async (fd: FormData) => { "use server"; await addContact(id, fd); };

  return (
    <>
      <PageHeader
        title={c.company}
        subtitle={<span className="flex items-center gap-2"><Badge status={c.active ? "active" : "inactive"} />{c.group && <span>{c.group.name}</span>}</span>}
        back={{ href: "/customers", label: "Customers" }}
        actions={
          <>
            <Link href={`/proposals/create?customerId=${id}`} className="btn-secondary">New proposal</Link>
            <Link href={`/projects/create?customerId=${id}`} className="btn-secondary">New project</Link>
            <Link href={`/invoices/create?customerId=${id}`} className="btn-secondary">New invoice</Link>
            <Link href={`/estimates/create?customerId=${id}`} className="btn-secondary">New estimate</Link>
            <Link href={`/customers/${id}/edit`} className="btn-secondary">Edit</Link>
            <form action={del}><SubmitButton className="btn-danger" confirm="Delete this customer and all its contacts?">Delete</SubmitButton></form>
          </>
        }
      />
      <div className="-mt-3 mb-5"><TagEditor relType="customer" relId={id} back={`/customers/${id}`} /></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-4">Profile</h2>
          <DL rows={[
            ["VAT / KRA PIN", c.vatNumber], ["Phone", c.phoneNumber],
            ["Website", c.website ? <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer">{c.website}</a> : null],
            ["Address", [c.address, c.city, c.country].filter(Boolean).join(", ") || null],
            ["Currency", c.currency ? `${c.currency.name}` : "System default"], ["Customer since", fmtDate(c.createdAt)],
          ]} />
        </section>
        <section className="card space-y-2">
          <h2>Account</h2>
          <div className="flex justify-between text-sm"><span className="muted">Invoiced</span><span className="tabular-nums">{money(invoiced, sym)}</span></div>
          <div className="flex justify-between text-sm"><span className="muted">Paid</span><span className="tabular-nums">{money(paid, sym)}</span></div>
          <div className="flex justify-between border-t pt-2 text-sm font-semibold"><span>Outstanding</span><span className="tabular-nums">{money(invoiced - paid, sym)}</span></div>
          <div className="border-t pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Statement of account</div>
            <div className="flex flex-wrap gap-2"><Link href={`/reports/customer-statement?customerId=${id}`} className="btn-secondary btn-sm">View</Link><ExportButtons report="customer-statement" params={{ customerId: id }} compact /></div>
          </div>
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="mb-4">Contacts</h2>
        {c.contacts.length === 0 ? <Empty>No contacts yet — add one below.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Name</th><th>Title</th><th>Email</th><th>Phone</th><th>Flags</th><th /></tr></thead>
              <tbody>
                {c.contacts.map((ct) => {
                  const rm = async () => { "use server"; await deleteContact(id, ct.id); };
                  const primary = async () => { "use server"; await setPrimaryContact(id, ct.id); };
                  return (
                    <tr key={ct.id}>
                      <td className="font-medium">{ct.firstName} {ct.lastName}</td>
                      <td>{ct.title ?? "—"}</td>
                      <td>{ct.email ? <a href={`mailto:${ct.email}`}>{ct.email}</a> : "—"}</td>
                      <td>{ct.phoneNumber ?? "—"}</td>
                      <td className="space-x-1">{ct.isPrimary && <span className="badge bg-brand-100 text-brand-800">Primary</span>}{ct.isCustomerAdmin && <span className="badge bg-slate-100">Admin</span>}</td>
                      <td className="whitespace-nowrap text-right">
                        {!ct.isPrimary && <form action={primary} className="inline"><button className="btn-ghost btn-sm">Make primary</button></form>}
                        <form action={rm} className="inline"><SubmitButton className="btn-ghost btn-sm text-rose-600" confirm="Remove this contact?">Remove</SubmitButton></form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <form action={add} className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="First name *"><input name="firstName" required className="field-input" /></Field>
          <Field label="Last name"><input name="lastName" className="field-input" /></Field>
          <Field label="Email"><input name="email" type="email" className="field-input" /></Field>
          <Field label="Phone"><input name="phoneNumber" className="field-input" /></Field>
          <Field label="Title"><input name="title" className="field-input" /></Field>
          <div className="flex flex-col justify-end gap-1 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="isPrimary" /> Primary</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isCustomerAdmin" /> Customer admin</label>
          </div>
          <div className="sm:col-span-3 lg:col-span-6"><SubmitButton className="btn-primary btn-sm">Add contact</SubmitButton></div>
        </form>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2" id="timeline">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2>Customer 360 timeline</h2>
            <div className="flex flex-wrap gap-1 text-sm">
              {[["", "All"], ["relationship", "Relationship"], ["sales", "Sales"], ["finance", "Finance"], ["delivery", "Delivery"], ["support", "Support"]].map(([k, l]) => (
                <Link key={k} href={`/customers/${id}${k ? `?tl=${k}` : ""}#timeline`} className={`btn btn-sm ${(tl ?? "") === k ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`}>{l}</Link>
              ))}
            </div>
          </div>
          <div className="mb-4 rounded-md bg-slate-50 p-3"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Log an interaction</div><InteractionForm relType="customer" relId={id} back={`/customers/${id}#timeline`} /></div>
          {events.length === 0 ? <p className="muted">Nothing yet.</p> : (
            <ol className="relative space-y-3 border-l border-slate-200 pl-5" data-testid="timeline">
              {events.slice(0, 150).map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[29px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] text-slate-600">{e.icon}</span>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm font-medium text-slate-900">{e.href ? <Link href={e.href}>{e.title}</Link> : e.title}</span>
                    <span className="text-xs text-slate-500">{fmtDateTime(e.at)}{e.who ? ` · ${e.who}` : ""}</span>
                  </div>
                  {e.detail && <div className="text-sm text-slate-600">{e.detail}</div>}
                </li>
              ))}
            </ol>
          )}
        </section>
        <div className="space-y-6">
          <RemindersPanel relType="customer" relId={id} back={`/customers/${id}`} title="Follow-ups" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Linked title="Invoices" empty="No invoices." items={c.invoices.map((i) => ({ href: `/invoices/${i.id}`, label: i.number, meta: money(i.total, sym), badge: <Badge status={i.status} /> }))} />
        <Linked title="Estimates" empty="No estimates." items={c.estimates.map((e) => ({ href: `/estimates/${e.id}`, label: e.number, meta: money(e.total, sym), badge: <Badge status={e.status} /> }))} />
        <Linked title="Projects" empty="No projects." items={c.projects.map((p) => ({ href: `/projects/${p.id}`, label: p.name, meta: `${p.progress}%`, badge: <Badge status={p.status} /> }))} />
        <Linked title="Tickets" empty="No tickets." items={c.tickets.map((t) => ({ href: `/tickets/${t.id}`, label: `#${t.id} ${t.subject}`, meta: fmtDate(t.createdAt), badge: <ColorBadge color={t.status?.color} label={t.status?.name} /> }))} />
        <Linked title="Contracts" empty="No contracts." items={c.contracts.map((k) => ({ href: `/contracts/${k.id}`, label: k.subject, meta: `${fmtDate(k.dateStart)} → ${fmtDate(k.dateEnd)}`, badge: k.type ? <span className="badge bg-slate-100">{k.type.name}</span> : null }))} />
      </div>
    </>
  );
}

function Linked({ title, items, empty }: { title: string; empty: string; items: { href: string; label: string; meta: string; badge: React.ReactNode }[] }) {
  return (
    <section className="card">
      <h2 className="mb-3">{title}</h2>
      {items.length === 0 ? <p className="muted">{empty}</p> : (
        <ul className="divide-y divide-slate-100 text-sm">
          {items.map((it) => (
            <li key={it.href} className="flex items-center justify-between gap-2 py-2">
              <Link href={it.href} className="min-w-0 truncate">{it.label}</Link>
              <span className="flex items-center gap-2 whitespace-nowrap"><span className="muted tabular-nums">{it.meta}</span>{it.badge}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
