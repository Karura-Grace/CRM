import Link from "next/link";
import { and, count, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { contracts, customers, expenses, invoices, leads, projects, tasks, ticketStatuses, tickets } from "@/db/schema";
import { Badge, ColorBadge, Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDefaultCurrency } from "@/lib/settings";
import { addInterval, fmtDate, money, today } from "@/lib/utils";
import { relLabel } from "@/lib/relLinks";
import { sumHours } from "@/lib/timesheets";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireUser();
  const cur = await getDefaultCurrency();

  const [[{ c: customerCount }], [{ c: activeLeads }], [{ c: activeProjects }]] = await Promise.all([
    db.select({ c: count() }).from(customers).where(eq(customers.active, true)),
    db.select({ c: count() }).from(leads).where(and(eq(leads.lost, false), eq(leads.junk, false), sql`${leads.convertedCustomerId} is null`)),
    db.select({ c: count() }).from(projects).where(inArray(projects.status, ["not_started", "in_progress", "on_hold"])),
  ]);

  const closedStatusIds = (await db.select({ id: ticketStatuses.id }).from(ticketStatuses).where(inArray(ticketStatuses.name, ["Closed", "Resolved"]))).map((r) => r.id);
  const [{ c: openTickets }] = await db
    .select({ c: count() })
    .from(tickets)
    .where(closedStatusIds.length ? sql`${tickets.statusId} is null or ${tickets.statusId} not in (${sql.join(closedStatusIds.map((i) => sql`${i}`), sql`, `)})` : undefined);

  const [fin] = await db
    .select({
      invoiced: sql<number>`coalesce(sum(${invoices.total}), 0)`,
      paid: sql<number>`coalesce(sum(${invoices.totalPaid}), 0)`,
    })
    .from(invoices)
    .where(and(ne(invoices.status, "cancelled"), ne(invoices.status, "draft")));
  const [exp] = await db.select({ total: sql<number>`coalesce(sum(${expenses.amount} + ${expenses.tax}), 0)` }).from(expenses);

  const [recentInvoices, recentLeads, recentTickets, myTasks, expiring] = await Promise.all([
    db.query.invoices.findMany({ with: { customer: true }, orderBy: desc(invoices.id), limit: 8 }),
    db.query.leads.findMany({ with: { status: true }, orderBy: desc(leads.id), limit: 8 }),
    db.query.tickets.findMany({ with: { status: true, priority: true, customer: true }, orderBy: desc(tickets.id), limit: 8 }),
    db.query.taskAssignees.findMany({
      where: (ta, { eq }) => eq(ta.staffId, session.staffId),
      with: { task: { with: { project: true } } },
    }),
    db.query.contracts.findMany({
      where: and(sql`${contracts.dateEnd} is not null`, lte(contracts.dateEnd, sql`date('now', '+30 day')`), sql`${contracts.dateEnd} >= date('now')`),
      with: { customer: true },
      limit: 5,
    }),
  ]);
  const weekStart = (() => { const dt = new Date(); const dow = (dt.getDay() + 6) % 7; dt.setDate(dt.getDate() - dow); dt.setHours(0, 0, 0, 0); return dt.toISOString(); })();
  const myWeek = await db.query.taskTimers.findMany({ where: (tt, { and, eq, gte }) => and(eq(tt.staffId, session.staffId), gte(tt.startTime, weekStart)) });
  const myWeekHours = sumHours(myWeek);
  const myReminders = (await db.query.reminders.findMany({ where: (r, { and, eq, lte }) => and(eq(r.staffId, session.staffId), eq(r.isDone, false), lte(r.remindAt, addInterval(today(), "day", 7))) }))
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt)).slice(0, 8);
  const remLinks = await Promise.all(myReminders.map((r) => relLabel(r.relType, r.relId)));
  const openMyTasks = myTasks.map((t) => t.task).filter((t) => t.status !== "finished").slice(0, 8);

  const stats = [
    { label: "Active customers", value: customerCount, href: "/customers" },
    { label: "Active leads", value: activeLeads, href: "/leads" },
    { label: "Active projects", value: activeProjects, href: "/projects" },
    { label: "Open tickets", value: openTickets, href: "/tickets" },
  ];
  const finance = [
    { label: "Invoiced", value: money(fin.invoiced, cur.symbol) },
    { label: "Paid", value: money(fin.paid, cur.symbol) },
    { label: "Outstanding", value: money(fin.invoiced - fin.paid, cur.symbol) },
    { label: "Expenses", value: money(exp.total, cur.symbol) },
  ];

  return (
    <>
      <PageHeader title={`Welcome, ${session.name.split(" ")[0]}`} subtitle={`Today is ${fmtDate(today())}`} actions={<><Link href="/analytics" className="btn-secondary">Analytics</Link><Link href="/reports" className="btn-secondary">Reports</Link></>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="stat hover:border-brand-300">
            <span className="stat-label">{s.label}</span>
            <span className="stat-value">{s.value}</span>
          </Link>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {finance.map((s) => (
          <div key={s.label} className="stat">
            <span className="stat-label">{s.label}</span>
            <span className="text-lg font-semibold tabular-nums text-slate-900">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2>Latest invoices</h2>
            <Link href="/invoices" className="text-sm">All →</Link>
          </div>
          {recentInvoices.length === 0 ? <Empty>No invoices yet.</Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {recentInvoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/invoices/${i.id}`} className="min-w-0 truncate">{i.number} · {i.customer.company}</Link>
                  <Badge status={i.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2>Latest leads</h2>
            <Link href="/leads" className="text-sm">Board →</Link>
          </div>
          {recentLeads.length === 0 ? <Empty>No leads yet.</Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {recentLeads.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/leads/${l.id}`} className="min-w-0 truncate">{l.name}{l.company ? ` · ${l.company}` : ""}</Link>
                  <ColorBadge color={l.status?.color} label={l.status?.name} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2>Latest tickets</h2>
            <Link href="/tickets" className="text-sm">All →</Link>
          </div>
          {recentTickets.length === 0 ? <Empty>No tickets yet.</Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {recentTickets.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/tickets/${t.id}`} className="min-w-0 truncate">#{t.id} {t.subject}</Link>
                  <ColorBadge color={t.status?.color} label={t.status?.name} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2>My open tasks <span className="muted ml-2 font-normal">· {myWeekHours.toFixed(2)} h logged this week · <Link href={`/timesheets?staffId=${session.staffId}`}>My timesheet →</Link></span></h2>
            <Link href="/tasks" className="text-sm">Task board →</Link>
          </div>
          {openMyTasks.length === 0 ? <Empty>Nothing assigned to you right now.</Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {openMyTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/tasks/${t.id}`} className="min-w-0 truncate">{t.name}{t.project ? <span className="muted"> · {t.project.name}</span> : null}</Link>
                  <span className="flex gap-2"><Badge status={t.priority} /><span className="muted">{fmtDate(t.dueDate)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" data-testid="dash-reminders">
          <div className="mb-3 flex items-center justify-between"><h2>My follow-ups</h2><Link href="/reminders" className="text-sm">All →</Link></div>
          {myReminders.length === 0 ? <Empty>No follow-ups due this week.</Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {myReminders.map((r, i) => (
                <li key={r.id} className="py-2">
                  <div className={r.remindAt < today() ? "font-medium text-rose-700" : "text-slate-900"}>{r.description}</div>
                  <div className="text-xs text-slate-500">{fmtDate(r.remindAt)} · <Link href={remLinks[i].href}>{remLinks[i].label}</Link></div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="mb-3">Contracts expiring (30 days)</h2>
          {expiring.length === 0 ? <Empty>None expiring soon.</Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {expiring.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/contracts/${c.id}`} className="min-w-0 truncate">{c.subject} · {c.customer.company}</Link>
                  <span className="muted">{fmtDate(c.dateEnd)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
