/**
 * Customer 360 timeline: one chronological feed of everything that happened with a
 * customer across modules (leads, proposals, estimates, invoices, payments, projects,
 * tasks, time, tickets, contracts, expenses, interactions, reminders).
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, reminders } from "@/db/schema";
import { entryHours } from "./timesheets";
import { money, round2 } from "./utils";

export type TimelineKind = "sales" | "finance" | "delivery" | "support" | "relationship";
export interface TimelineEvent { at: string; kind: TimelineKind; icon: string; title: string; detail?: string; href?: string; who?: string }

const iso = (d: string | null | undefined) => (!d ? "" : d.length === 10 ? `${d}T09:00:00` : d.includes("T") ? d : `${d.replace(" ", "T")}Z`);

export async function customerTimeline(customerId: number): Promise<TimelineEvent[]> {
  const c = await db.query.customers.findFirst({
    where: (x, { eq }) => eq(x.id, customerId),
    with: {
      currency: true, contacts: true,
      convertedLeads: { with: { notes: { with: { staff: true } } } },
      proposals: true, estimates: true,
      invoices: { with: { payments: true } },
      projects: { with: { tasks: { with: { timers: { with: { staff: true } } } } } },
      tickets: { with: { replies: { with: { staff: true } }, status: true } },
      contracts: true, expenses: { with: { category: true } },
    },
  });
  if (!c) return [];
  const sym = c.currency?.symbol;
  const ev: TimelineEvent[] = [{ at: iso(c.createdAt), kind: "relationship", icon: "◉", title: "Became a customer", href: `/customers/${c.id}` }];
  for (const x of c.contacts) ev.push({ at: iso(x.createdAt), kind: "relationship", icon: "☺", title: `Contact added: ${x.firstName} ${x.lastName}`, detail: [x.title, x.email].filter(Boolean).join(" · ") });
  for (const l of c.convertedLeads) {
    ev.push({ at: iso(l.createdAt), kind: "sales", icon: "◎", title: `Lead created: ${l.name}`, detail: l.company ?? undefined, href: `/leads/${l.id}` });
    for (const n of l.notes) ev.push({ at: iso(n.date), kind: "sales", icon: "✎", title: "Lead note", detail: n.description, who: n.staff ? n.staff.firstName : undefined, href: `/leads/${l.id}` });
    if (l.dateConverted) ev.push({ at: iso(l.dateConverted), kind: "sales", icon: "✓", title: "Lead converted to customer", href: `/leads/${l.id}` });
  }
  const leadIds = c.convertedLeads.map((l) => l.id);
  const leadProposals = leadIds.length ? await db.query.proposals.findMany({ where: (p, { inArray }) => inArray(p.leadId, leadIds) }) : [];
  for (const p of [...c.proposals, ...leadProposals.filter((x) => !c.proposals.some((y) => y.id === x.id))]) ev.push({ at: iso(p.date), kind: "sales", icon: "✎", title: `Proposal: ${p.subject}`, detail: `${p.status} · ${money(p.total, sym)}`, href: `/proposals/${p.id}` });
  for (const e of c.estimates) ev.push({ at: iso(e.date), kind: "sales", icon: "≋", title: `Estimate ${e.number}`, detail: `${e.status} · ${money(e.total, sym)}`, href: `/estimates/${e.id}` });
  for (const i of c.invoices) {
    ev.push({ at: iso(i.date), kind: "finance", icon: "▤", title: `Invoice ${i.number}`, detail: `${i.status} · ${money(i.total, sym)}${i.dueDate ? ` · due ${i.dueDate}` : ""}`, href: `/invoices/${i.id}` });
    for (const x of i.payments) ev.push({ at: iso(x.date), kind: "finance", icon: "◈", title: `Payment received on ${i.number}`, detail: `${money(x.amount, sym)} · ${({ mpesa: "M-Pesa", bank_transfer: "Bank transfer", cash: "Cash", cheque: "Cheque", card: "Card" } as Record<string, string>)[x.paymentMode] ?? x.paymentMode}${x.transactionId ? ` · ${x.transactionId}` : ""}`, href: `/invoices/${i.id}` });
  }
  for (const p of c.projects) {
    ev.push({ at: iso(p.startDate), kind: "delivery", icon: "◫", title: `Project started: ${p.name}`, detail: `${p.status.replace(/_/g, " ")} · ${p.progress}%`, href: `/projects/${p.id}` });
    for (const t of p.tasks) {
      if (t.dateFinished) ev.push({ at: iso(t.dateFinished), kind: "delivery", icon: "☑", title: `Task finished: ${t.name}`, detail: p.name, href: `/tasks/${t.id}` });
    }
    // Time as one weekly roll-up per project, to keep the feed readable.
    const weeks = new Map<string, { h: number; who: Set<string> }>();
    for (const t of p.tasks) for (const e of t.timers) {
      if (!e.endTime) continue;
      const d = new Date(e.startTime), day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day);
      const k = d.toISOString().slice(0, 10);
      const w = weeks.get(k) ?? { h: 0, who: new Set() }; w.h += entryHours(e); w.who.add(e.staff.firstName); weeks.set(k, w);
    }
    for (const [k, w] of weeks) ev.push({ at: iso(k), kind: "delivery", icon: "◷", title: `${round2(w.h)} h logged on ${p.name}`, detail: `Week of ${k} · ${[...w.who].join(", ")}`, href: `/timesheets?projectId=${p.id}` });
  }
  for (const t of c.tickets) {
    ev.push({ at: iso(t.createdAt), kind: "support", icon: "✉", title: `Ticket #${t.id}: ${t.subject}`, detail: t.status?.name, href: `/tickets/${t.id}` });
    for (const r of t.replies) ev.push({ at: iso(r.createdAt), kind: "support", icon: "↩", title: `Reply on ticket #${t.id}`, detail: r.message.slice(0, 140), who: r.staff?.firstName, href: `/tickets/${t.id}` });
  }
  for (const k of c.contracts) {
    ev.push({ at: iso(k.dateStart), kind: "relationship", icon: "§", title: `Contract: ${k.subject}`, detail: `${money(k.value, sym)}${k.dateEnd ? ` · ends ${k.dateEnd}` : ""}${k.signed ? " · signed" : ""}`, href: `/contracts/${k.id}` });
  }
  for (const e of c.expenses) ev.push({ at: iso(e.date), kind: "finance", icon: "−", title: `Expense: ${e.name ?? e.category.name}`, detail: `${money(e.amount + e.tax, sym)}${e.billable ? " · billable" : ""}`, href: `/expenses/${e.id}/edit` });
  const logs = await db.query.activityLog.findMany({ where: and(eq(activityLog.relType, "customer"), eq(activityLog.relId, c.id)), with: { staff: true } });
  const icons: Record<string, string> = { call: "☎", meeting: "◎", email: "@", note: "✎", system: "•" };
  for (const l of logs) ev.push({ at: iso(l.date), kind: "relationship", icon: icons[l.kind] ?? "•", title: l.kind === "system" ? "Activity" : `${l.kind[0].toUpperCase()}${l.kind.slice(1)}`, detail: l.description, who: l.staff?.firstName });
  if (leadIds.length) {
    const leadLogs = await db.query.activityLog.findMany({ where: and(eq(activityLog.relType, "lead"), inArray(activityLog.relId, leadIds)), with: { staff: true } });
    for (const l of leadLogs) ev.push({ at: iso(l.date), kind: "sales", icon: icons[l.kind] ?? "•", title: `${l.kind[0].toUpperCase()}${l.kind.slice(1)} (as lead)`, detail: l.description, who: l.staff?.firstName });
  }
  const rems = await db.query.reminders.findMany({ where: and(eq(reminders.relType, "customer"), eq(reminders.relId, c.id)), with: { staff: true } });
  for (const r of rems) ev.push({ at: iso(r.remindAt), kind: "relationship", icon: r.isDone ? "✓" : "⏰", title: `${r.isDone ? "Follow-up done" : "Follow-up due"}: ${r.description}`, who: r.staff.firstName });
  return ev.filter((e) => e.at).sort((a, b) => b.at.localeCompare(a.at));
}
