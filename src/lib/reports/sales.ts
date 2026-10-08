import { db } from "@/db";
import { deriveInvoiceStatus } from "@/lib/invoicing";
import { addInterval, daysBetween } from "@/lib/utils";
import { currencyNote, defaultSymbol, inRange, money, monthLabel, monthsIn, num, pct, range, rangeLabel, round2, sum, today } from "./helpers";
import type { ReportDef } from "./types";

const liveInvoice = (s: string) => s !== "draft" && s !== "cancelled";

export const salesReports: ReportDef[] = [
  {
    key: "sales-summary",
    title: "Sales summary",
    description: "Invoiced vs collected per month, with outstanding balance and collection rate.",
    category: "Sales & finance",
    filters: ["dateRange", "customer"],
    defaultRange: "12m",
    async run(p) {
      const r = range(p, "12m"), cust = num(p.customerId), sym = await defaultSymbol();
      const invs = (await db.query.invoices.findMany()).filter((i) => liveInvoice(i.status) && (!cust || i.customerId === cust));
      const pays = (await db.query.payments.findMany({ with: { invoice: true } })).filter((x) => !cust || x.invoice.customerId === cust);
      const months = monthsIn(r);
      const rows = months.map((m) => {
        const inv = sum(invs.filter((i) => i.date.startsWith(m)), (i) => i.total);
        const col = sum(pays.filter((x) => x.date.startsWith(m)), (x) => x.amount);
        return { month: monthLabel(m), invoices: invs.filter((i) => i.date.startsWith(m)).length, invoiced: inv, collected: col, collectionRate: pct(col, inv) };
      });
      const inR = invs.filter((i) => inRange(i.date, r));
      const invoiced = sum(inR, (i) => i.total), collected = sum(pays.filter((x) => inRange(x.date, r)), (x) => x.amount);
      const outstanding = sum(invs, (i) => i.total - i.totalPaid);
      return {
        title: "Sales summary", subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "month", label: "Month" }, { key: "invoices", label: "Invoices", type: "number" }, { key: "invoiced", label: "Invoiced", type: "money" }, { key: "collected", label: "Collected", type: "money" }, { key: "collectionRate", label: "Collected / invoiced", type: "percent" }],
        rows,
        totals: { month: "Total", invoices: inR.length, invoiced, collected, collectionRate: pct(collected, invoiced) },
        summary: [{ label: "Invoiced", value: money(invoiced, sym) }, { label: "Collected", value: money(collected, sym) }, { label: "Outstanding (all time)", value: money(outstanding, sym) }, { label: "Invoices raised", value: String(inR.length) }],
        charts: [{ type: "bar", title: "Invoiced vs collected by month", categories: rows.map((x) => x.month), series: [{ name: "Invoiced", values: rows.map((x) => x.invoiced) }, { name: "Collected", values: rows.map((x) => x.collected) }], format: "money" }],
        notes: currencyNote(invs.map((i) => i.currencyId)),
      };
    },
  },
  {
    key: "invoice-register",
    title: "Invoice register",
    description: "Every invoice in the period with totals, payments and balance. Filter by customer or status.",
    category: "Sales & finance",
    filters: ["dateRange", "customer", "invoiceStatus"],
    defaultRange: "12m",
    async run(p) {
      const r = range(p, "12m"), cust = num(p.customerId), sym = await defaultSymbol();
      const rows0 = (await db.query.invoices.findMany({ with: { customer: true, project: true, currency: true } }))
        .map((i) => ({ ...i, live: deriveInvoiceStatus(i) }))
        .filter((i) => inRange(i.date, r) && (!cust || i.customerId === cust) && (!p.status || i.live === p.status))
        .sort((a, b) => a.date.localeCompare(b.date));
      const rows = rows0.map((i) => ({ number: i.number, date: i.date, dueDate: i.dueDate, customer: i.customer.company, project: i.project?.name ?? "", currency: i.currency?.name ?? "", status: i.live, subtotal: i.subtotal, tax: i.totalTax, total: i.total, paid: i.totalPaid, balance: round2(i.total - i.totalPaid) }));
      return {
        title: "Invoice register", subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "number", label: "Invoice" }, { key: "date", label: "Date", type: "date" }, { key: "dueDate", label: "Due", type: "date" }, { key: "customer", label: "Customer", width: 28 }, { key: "project", label: "Project", width: 24 }, { key: "currency", label: "Cur." }, { key: "status", label: "Status" }, { key: "subtotal", label: "Subtotal", type: "money" }, { key: "tax", label: "Tax", type: "money" }, { key: "total", label: "Total", type: "money" }, { key: "paid", label: "Paid", type: "money" }, { key: "balance", label: "Balance", type: "money" }],
        rows,
        totals: { number: "Total", subtotal: sum(rows, (x) => x.subtotal), tax: sum(rows, (x) => x.tax), total: sum(rows, (x) => x.total), paid: sum(rows, (x) => x.paid), balance: sum(rows, (x) => x.balance) },
        summary: [{ label: "Invoices", value: String(rows.length) }, { label: "Total", value: money(sum(rows, (x) => x.total), sym) }, { label: "Balance due", value: money(sum(rows, (x) => x.balance), sym) }],
        notes: currencyNote(rows0.map((i) => i.currencyId)),
      };
    },
  },
  {
    key: "aged-receivables",
    title: "Aged receivables",
    description: "Unpaid balances per customer, bucketed by days past due (current, 1–30, 31–60, 61–90, 90+).",
    category: "Sales & finance",
    filters: ["asOf"],
    async run(p) {
      const asOf = p.asOf || today(), sym = await defaultSymbol();
      const invs = (await db.query.invoices.findMany({ with: { customer: true } })).filter((i) => liveInvoice(i.status) && i.total - i.totalPaid > 0.005 && i.date <= asOf);
      const buckets = ["current", "d30", "d60", "d90", "d90p"] as const;
      const by = new Map<number, Record<string, number | string>>();
      for (const i of invs) {
        const bal = round2(i.total - i.totalPaid), late = i.dueDate ? daysBetween(i.dueDate, asOf) : 0;
        const b = late <= 0 ? "current" : late <= 30 ? "d30" : late <= 60 ? "d60" : late <= 90 ? "d90" : "d90p";
        const row = by.get(i.customerId) ?? { customer: i.customer.company, current: 0, d30: 0, d60: 0, d90: 0, d90p: 0, total: 0, invoices: 0 };
        row[b] = round2((row[b] as number) + bal); row.total = round2((row.total as number) + bal); row.invoices = (row.invoices as number) + 1;
        by.set(i.customerId, row);
      }
      const rows = [...by.values()].sort((a, b) => (b.total as number) - (a.total as number));
      const tot = Object.fromEntries(buckets.map((b) => [b, sum(rows, (x) => x[b] as number)]));
      const labels = { current: "Not yet due", d30: "1–30 days", d60: "31–60 days", d90: "61–90 days", d90p: "Over 90 days" };
      return {
        title: "Aged receivables", subtitle: `As of ${asOf}`, currency: sym,
        columns: [{ key: "customer", label: "Customer", width: 30 }, { key: "invoices", label: "Invoices", type: "number" }, ...buckets.map((b) => ({ key: b, label: labels[b], type: "money" as const })), { key: "total", label: "Total due", type: "money" }],
        rows,
        totals: { customer: "Total", invoices: invs.length, ...tot, total: sum(rows, (x) => x.total as number) },
        summary: [{ label: "Total receivable", value: money(sum(rows, (x) => x.total as number), sym) }, { label: "Overdue", value: money(sum(rows, (x) => (x.total as number) - (x.current as number)), sym) }, { label: "Over 90 days", value: money(tot.d90p, sym) }, { label: "Customers owing", value: String(rows.length) }],
        charts: [{ type: "bar", title: "Receivables by age", categories: buckets.map((b) => labels[b]), series: [{ name: "Amount due", values: buckets.map((b) => tot[b]) }], format: "money" }],
      };
    },
  },
  {
    key: "payments-received",
    title: "Payments received",
    description: "All payments in the period, by payment mode and month.",
    category: "Sales & finance",
    filters: ["dateRange", "customer"],
    defaultRange: "90d",
    async run(p) {
      const r = range(p, "90d"), cust = num(p.customerId), sym = await defaultSymbol();
      const pays = (await db.query.payments.findMany({ with: { invoice: { with: { customer: true } }, recorder: true } }))
        .filter((x) => inRange(x.date, r) && (!cust || x.invoice.customerId === cust)).sort((a, b) => a.date.localeCompare(b.date));
      const modes = [...new Set(pays.map((x) => x.paymentMode))];
      const label = (m: string) => ({ mpesa: "M-Pesa", bank_transfer: "Bank transfer", cash: "Cash", cheque: "Cheque", card: "Card" } as Record<string, string>)[m] ?? m;
      return {
        title: "Payments received", subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "date", label: "Date", type: "date" }, { key: "invoice", label: "Invoice" }, { key: "customer", label: "Customer", width: 30 }, { key: "mode", label: "Mode" }, { key: "ref", label: "Reference" }, { key: "recordedBy", label: "Recorded by" }, { key: "amount", label: "Amount", type: "money" }],
        rows: pays.map((x) => ({ date: x.date, invoice: x.invoice.number, customer: x.invoice.customer.company, mode: label(x.paymentMode), ref: x.transactionId ?? "", recordedBy: x.recorder ? `${x.recorder.firstName} ${x.recorder.lastName}` : "", amount: x.amount })),
        totals: { date: "Total", amount: sum(pays, (x) => x.amount) },
        summary: [{ label: "Received", value: money(sum(pays, (x) => x.amount), sym) }, { label: "Payments", value: String(pays.length) }, ...modes.map((m) => ({ label: label(m), value: money(sum(pays.filter((x) => x.paymentMode === m), (x) => x.amount), sym) }))],
        charts: [{ type: "hbar", title: "Received by payment mode", categories: modes.map(label), series: [{ name: "Amount", values: modes.map((m) => sum(pays.filter((x) => x.paymentMode === m), (x) => x.amount)) }], format: "money" }],
      };
    },
  },
  {
    key: "customer-revenue",
    title: "Customer revenue ranking",
    description: "Invoiced, collected and outstanding per customer, with project and ticket counts.",
    category: "Sales & finance",
    filters: ["dateRange", "tag"],
    defaultRange: "12m",
    async run(p) {
      const r = range(p, "12m"), sym = await defaultSymbol(), tag = num(p.tag);
      const tagged = tag ? new Set((await db.query.taggings.findMany({ where: (t, { and, eq }) => and(eq(t.tagId, tag), eq(t.relType, "customer")) })).map((t) => t.relId)) : null;
      const custs = (await db.query.customers.findMany({ with: { invoices: true, projects: true, tickets: true, group: true } })).filter((c) => !tagged || tagged.has(c.id));
      const rows = custs.map((c) => {
        const inv = c.invoices.filter((i) => liveInvoice(i.status) && inRange(i.date, r));
        const last = c.invoices.map((i) => i.date).sort().pop() ?? "";
        return { customer: c.company, group: c.group?.name ?? "", invoices: inv.length, invoiced: sum(inv, (i) => i.total), collected: sum(inv, (i) => i.totalPaid), outstanding: sum(c.invoices.filter((i) => liveInvoice(i.status)), (i) => i.total - i.totalPaid), projects: c.projects.length, tickets: c.tickets.length, lastInvoice: last };
      }).sort((a, b) => b.invoiced - a.invoiced);
      const top = rows.filter((x) => x.invoiced > 0).slice(0, 10);
      return {
        title: "Customer revenue ranking", subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "customer", label: "Customer", width: 30 }, { key: "group", label: "Group" }, { key: "invoices", label: "Invoices", type: "number" }, { key: "invoiced", label: "Invoiced", type: "money" }, { key: "collected", label: "Collected", type: "money" }, { key: "outstanding", label: "Outstanding (all)", type: "money" }, { key: "projects", label: "Projects", type: "number" }, { key: "tickets", label: "Tickets", type: "number" }, { key: "lastInvoice", label: "Last invoice", type: "date" }],
        rows,
        totals: { customer: "Total", invoices: sum(rows, (x) => x.invoices), invoiced: sum(rows, (x) => x.invoiced), collected: sum(rows, (x) => x.collected), outstanding: sum(rows, (x) => x.outstanding) },
        summary: [{ label: "Customers billed", value: String(rows.filter((x) => x.invoiced > 0).length) }, { label: "Invoiced", value: money(sum(rows, (x) => x.invoiced), sym) }, { label: "Top customer share", value: `${pct(top[0]?.invoiced ?? 0, sum(rows, (x) => x.invoiced))}%` }],
        charts: top.length ? [{ type: "hbar", title: "Top customers by amount invoiced", categories: top.map((x) => x.customer), series: [{ name: "Invoiced", values: top.map((x) => x.invoiced) }], format: "money" }] : [],
      };
    },
  },
  {
    key: "customer-statement",
    title: "Customer statement of account",
    description: "Invoices and payments for one customer with a running balance — ready to send to the client.",
    category: "Sales & finance",
    filters: ["customerRequired", "dateRange"],
    defaultRange: "12m",
    async run(p) {
      const r = range(p, "12m"), cust = num(p.customerId), sym0 = await defaultSymbol();
      const c = cust ? await db.query.customers.findFirst({ where: (x, { eq }) => eq(x.id, cust), with: { currency: true, invoices: { with: { payments: true } } } }) : null;
      if (!c) return { title: "Customer statement of account", subtitle: "Choose a customer", currency: sym0, columns: [{ key: "info", label: "" }], rows: [{ info: "Select a customer to produce a statement." }] };
      const sym = c.currency?.symbol ?? sym0;
      type L = { date: string; type: string; ref: string; description: string; debit: number; credit: number };
      const lines: L[] = [];
      for (const i of c.invoices.filter((x) => liveInvoice(x.status))) {
        lines.push({ date: i.date, type: "Invoice", ref: i.number, description: `Due ${i.dueDate ?? "—"}`, debit: i.total, credit: 0 });
        for (const x of i.payments) lines.push({ date: x.date, type: "Payment", ref: i.number, description: `${({ mpesa: "M-Pesa", bank_transfer: "Bank transfer", cash: "Cash", cheque: "Cheque", card: "Card" } as Record<string, string>)[x.paymentMode] ?? x.paymentMode}${x.transactionId ? ` · ${x.transactionId}` : ""}`, debit: 0, credit: x.amount });
      }
      lines.sort((a, b) => a.date.localeCompare(b.date) || (a.type === "Invoice" ? -1 : 1));
      const opening = round2(lines.filter((l) => l.date < r.from).reduce((a, l) => a + l.debit - l.credit, 0));
      let bal = opening;
      const rows = [{ date: r.from, type: "", ref: "", description: "Opening balance", debit: null, credit: null, balance: opening } as Record<string, string | number | null>,
        ...lines.filter((l) => inRange(l.date, r)).map((l) => { bal = round2(bal + l.debit - l.credit); return { ...l, debit: l.debit || null, credit: l.credit || null, balance: bal }; })];
      const inR = lines.filter((l) => inRange(l.date, r));
      return {
        title: `Statement of account — ${c.company}`, subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "date", label: "Date", type: "date" }, { key: "type", label: "Type" }, { key: "ref", label: "Reference" }, { key: "description", label: "Details", width: 30 }, { key: "debit", label: "Charges", type: "money" }, { key: "credit", label: "Payments", type: "money" }, { key: "balance", label: "Balance", type: "money" }],
        rows,
        totals: { date: "Closing balance", debit: sum(inR, (l) => l.debit), credit: sum(inR, (l) => l.credit), balance: bal },
        summary: [{ label: "Opening balance", value: money(opening, sym) }, { label: "Charges", value: money(sum(inR, (l) => l.debit), sym) }, { label: "Payments", value: money(sum(inR, (l) => l.credit), sym) }, { label: "Balance due", value: money(bal, sym) }],
      };
    },
  },
];

export { addInterval };
