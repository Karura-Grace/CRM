import { db } from "@/db";
import { entryHours, isBillable, rateFor } from "@/lib/timesheets";
import { daysBetween } from "@/lib/utils";
import { defaultSymbol, inRange, money, monthLabel, monthsIn, num, pct, range, rangeLabel, round2, sum, today } from "./helpers";
import type { ReportDef } from "./types";
import { projectGanttRows, taskGanttRows, timesheetGanttRows } from "@/lib/gantt";

const fullName = (s: { firstName: string; lastName: string } | null | undefined) => (s ? `${s.firstName} ${s.lastName}` : "");
const localDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: process.env.APP_TIMEZONE || "Africa/Nairobi" });

export const pipelineReports: ReportDef[] = [
  {
    key: "pipeline-forecast",
    title: "Pipeline & weighted forecast",
    description: "Open leads with value × stage probability, grouped by expected close month.",
    category: "Pipeline",
    filters: ["staff", "tag"],
    async run(p) {
      const sym = await defaultSymbol(), staffId = num(p.staffId), tag = num(p.tag);
      const tagged = tag ? new Set((await db.query.taggings.findMany({ where: (t, { and, eq }) => and(eq(t.tagId, tag), eq(t.relType, "lead")) })).map((t) => t.relId)) : null;
      const leads = (await db.query.leads.findMany({ with: { status: true, source: true, assigned: true } }))
        .filter((l) => !l.lost && !l.junk && !l.convertedCustomerId && (!staffId || l.assignedId === staffId) && (!tagged || tagged.has(l.id)));
      const rows = leads.map((l) => {
        const prob = l.status?.probability ?? 0;
        return { lead: l.name, company: l.company ?? "", stage: l.status?.name ?? "No status", probability: prob, value: l.value, weighted: round2((l.value * prob) / 100), expectedClose: l.expectedClose ?? "", assigned: fullName(l.assigned), source: l.source?.name ?? "", ageDays: daysBetween(l.createdAt.slice(0, 10), today()) };
      }).sort((a, b) => (a.expectedClose || "9").localeCompare(b.expectedClose || "9"));
      const stages = [...new Set(rows.map((r) => r.stage))];
      const months = [...new Set(rows.map((r) => (r.expectedClose ? r.expectedClose.slice(0, 7) : "")).filter(Boolean))].sort();
      const noDate = sum(rows.filter((r) => !r.expectedClose), (r) => r.weighted);
      return {
        title: "Pipeline & weighted forecast", subtitle: `Open leads as of ${today()}`, currency: sym,
        columns: [{ key: "lead", label: "Lead", width: 22 }, { key: "company", label: "Company", width: 24 }, { key: "stage", label: "Stage" }, { key: "probability", label: "Prob. %", type: "number" }, { key: "value", label: "Value", type: "money" }, { key: "weighted", label: "Weighted", type: "money" }, { key: "expectedClose", label: "Expected close", type: "date" }, { key: "assigned", label: "Owner" }, { key: "source", label: "Source" }, { key: "ageDays", label: "Age (days)", type: "number" }],
        rows,
        totals: { lead: "Total", value: sum(rows, (r) => r.value), weighted: sum(rows, (r) => r.weighted) },
        summary: [{ label: "Open leads", value: String(rows.length) }, { label: "Pipeline value", value: money(sum(rows, (r) => r.value), sym) }, { label: "Weighted forecast", value: money(sum(rows, (r) => r.weighted), sym) }, ...(noDate ? [{ label: "Weighted, no close date", value: money(noDate, sym) }] : [])],
        charts: [
          { type: "hbar", title: "Pipeline value by stage", categories: stages, series: [{ name: "Value", values: stages.map((s) => sum(rows.filter((r) => r.stage === s), (r) => r.value)) }, { name: "Weighted", values: stages.map((s) => sum(rows.filter((r) => r.stage === s), (r) => r.weighted)) }], format: "money" },
          ...(months.length ? [{ type: "bar" as const, title: "Weighted forecast by expected close month", categories: months.map(monthLabel), series: [{ name: "Weighted", values: months.map((m) => sum(rows.filter((r) => r.expectedClose.startsWith(m)), (r) => r.weighted)) }], format: "money" as const }] : []),
        ],
        notes: ["Weighted value = lead value × the stage's win probability (set per stage in Settings → Lead statuses)."],
      };
    },
  },
  {
    key: "lead-conversion",
    title: "Lead sources & conversion",
    description: "Leads created per source: converted, lost, open, conversion rate and value won.",
    category: "Pipeline",
    filters: ["dateRange"],
    defaultRange: "12m",
    async run(p) {
      const r = range(p, "12m"), sym = await defaultSymbol();
      const leads = (await db.query.leads.findMany({ with: { source: true } })).filter((l) => inRange(l.createdAt, r));
      const srcs = [...new Set(leads.map((l) => l.source?.name ?? "Unknown"))];
      const rows = srcs.map((s) => {
        const ls = leads.filter((l) => (l.source?.name ?? "Unknown") === s), conv = ls.filter((l) => l.convertedCustomerId);
        return { source: s, leads: ls.length, converted: conv.length, lost: ls.filter((l) => l.lost).length, open: ls.filter((l) => !l.convertedCustomerId && !l.lost && !l.junk).length, conversionRate: pct(conv.length, ls.length), valueWon: sum(conv, (l) => l.value), pipeline: sum(ls.filter((l) => !l.convertedCustomerId && !l.lost && !l.junk), (l) => l.value) };
      }).sort((a, b) => b.leads - a.leads);
      const conv = sum(rows, (x) => x.converted), tot = sum(rows, (x) => x.leads);
      return {
        title: "Lead sources & conversion", subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "source", label: "Source" }, { key: "leads", label: "Leads", type: "number" }, { key: "converted", label: "Converted", type: "number" }, { key: "lost", label: "Lost", type: "number" }, { key: "open", label: "Open", type: "number" }, { key: "conversionRate", label: "Conversion", type: "percent" }, { key: "valueWon", label: "Value won", type: "money" }, { key: "pipeline", label: "Open pipeline", type: "money" }],
        rows,
        totals: { source: "Total", leads: tot, converted: conv, lost: sum(rows, (x) => x.lost), open: sum(rows, (x) => x.open), conversionRate: pct(conv, tot), valueWon: sum(rows, (x) => x.valueWon), pipeline: sum(rows, (x) => x.pipeline) },
        summary: [{ label: "Leads created", value: String(tot) }, { label: "Converted", value: String(conv) }, { label: "Conversion rate", value: `${pct(conv, tot)}%` }],
        charts: rows.length ? [{ type: "hbar", title: "Leads by source", categories: rows.map((x) => x.source), series: [{ name: "Leads", values: rows.map((x) => x.leads) }, { name: "Converted", values: rows.map((x) => x.converted) }], format: "number" }] : [],
      };
    },
  },
  {
    key: "proposals-estimates",
    title: "Proposals & estimates",
    description: "Quotes issued in the period with status, value and acceptance rate.",
    category: "Pipeline",
    filters: ["dateRange", "customer"],
    defaultRange: "12m",
    async run(p) {
      const r = range(p, "12m"), cust = num(p.customerId), sym = await defaultSymbol();
      const props = (await db.query.proposals.findMany({ with: { customer: true, lead: true } })).filter((x) => inRange(x.date, r) && (!cust || x.customerId === cust));
      const ests = (await db.query.estimates.findMany({ with: { customer: true, invoice: true } })).filter((x) => inRange(x.date, r) && (!cust || x.customerId === cust));
      const rows = [
        ...props.map((x) => ({ type: "Proposal", ref: `PRO-${String(x.id).padStart(6, "0")}`, subject: x.subject, client: x.customer?.company ?? (x.lead ? `${x.lead.name} (lead)` : ""), date: x.date, status: x.status, value: x.total, invoiced: "" })),
        ...ests.map((x) => ({ type: "Estimate", ref: x.number, subject: "", client: x.customer.company, date: x.date, status: x.status, value: x.total, invoiced: x.invoice?.number ?? "" })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      const decided = rows.filter((x) => ["accepted", "declined"].includes(x.status)), won = rows.filter((x) => x.status === "accepted");
      return {
        title: "Proposals & estimates", subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "type", label: "Type" }, { key: "ref", label: "Reference" }, { key: "subject", label: "Subject", width: 30 }, { key: "client", label: "Client", width: 26 }, { key: "date", label: "Date", type: "date" }, { key: "status", label: "Status" }, { key: "value", label: "Value", type: "money" }, { key: "invoiced", label: "Invoiced as" }],
        rows,
        totals: { type: "Total", value: sum(rows, (x) => x.value) },
        summary: [{ label: "Quotes issued", value: String(rows.length) }, { label: "Quoted value", value: money(sum(rows, (x) => x.value), sym) }, { label: "Won value", value: money(sum(won, (x) => x.value), sym) }, { label: "Acceptance rate (decided)", value: `${pct(won.length, decided.length)}%` }],
      };
    },
  },
];

export const deliveryReports: ReportDef[] = [
  {
    key: "project-profitability",
    title: "Project profitability",
    description: "Per project: fee, invoiced, collected, expenses, hours, unbilled time, margin and effective hourly rate.",
    category: "Delivery",
    filters: ["customer"],
    async run(p) {
      const cust = num(p.customerId), sym = await defaultSymbol();
      const projs = (await db.query.projects.findMany({ with: { customer: true, invoices: true, expenses: true, tasks: { with: { timers: true } } } })).filter((x) => !cust || x.customerId === cust);
      const rows = projs.map((x) => {
        const inv = x.invoices.filter((i) => i.status !== "draft" && i.status !== "cancelled");
        const entries = x.tasks.flatMap((t) => t.timers.map((e) => ({ e, t })));
        const hours = round2(entries.reduce((a, { e }) => a + entryHours(e), 0));
        const billable = entries.filter(({ t }) => isBillable(t, x));
        const unbilled = round2(billable.filter(({ e }) => !e.invoiceId).reduce((a, { e, t }) => a + entryHours(e) * rateFor(t, x), 0));
        const invoiced = sum(inv, (i) => i.total - i.totalTax), expenses = sum(x.expenses, (e) => e.amount);
        return { project: x.name, customer: x.customer?.company ?? "Internal", status: x.status.replace(/_/g, " "), billing: x.billingType.replace(/_/g, " "), fee: x.billingType === "fixed_rate" ? x.projectCost : null, invoiced, collected: sum(inv, (i) => Math.min(i.totalPaid, i.total) * (i.total ? (i.total - i.totalTax) / i.total : 1)), expenses, margin: round2(invoiced - expenses), marginPct: pct(invoiced - expenses, invoiced), hours, unbilled, effectiveRate: hours ? round2(invoiced / hours) : null };
      }).sort((a, b) => b.invoiced - a.invoiced);
      const withMoney = rows.filter((x) => x.invoiced || x.expenses);
      return {
        title: "Project profitability", subtitle: `As of ${today()} · amounts exclude tax`, currency: sym,
        columns: [{ key: "project", label: "Project", width: 30 }, { key: "customer", label: "Customer", width: 24 }, { key: "status", label: "Status" }, { key: "billing", label: "Billing" }, { key: "fee", label: "Fixed fee", type: "money" }, { key: "invoiced", label: "Invoiced", type: "money" }, { key: "collected", label: "Collected", type: "money" }, { key: "expenses", label: "Expenses", type: "money" }, { key: "margin", label: "Margin", type: "money" }, { key: "marginPct", label: "Margin %", type: "percent" }, { key: "hours", label: "Hours", type: "hours" }, { key: "unbilled", label: "Unbilled time", type: "money" }, { key: "effectiveRate", label: "Effective rate /h", type: "money" }],
        rows,
        totals: { project: "Total", invoiced: sum(rows, (x) => x.invoiced), collected: sum(rows, (x) => x.collected), expenses: sum(rows, (x) => x.expenses), margin: sum(rows, (x) => x.margin), hours: sum(rows, (x) => x.hours), unbilled: sum(rows, (x) => x.unbilled) },
        summary: [{ label: "Invoiced (ex tax)", value: money(sum(rows, (x) => x.invoiced), sym) }, { label: "Expenses", value: money(sum(rows, (x) => x.expenses), sym) }, { label: "Margin", value: money(sum(rows, (x) => x.margin), sym) }, { label: "Unbilled time", value: money(sum(rows, (x) => x.unbilled), sym) }],
        charts: withMoney.length ? [{ type: "hbar", title: "Invoiced vs expenses by project", categories: withMoney.map((x) => x.project), series: [{ name: "Invoiced", values: withMoney.map((x) => x.invoiced) }, { name: "Expenses", values: withMoney.map((x) => x.expenses) }], format: "money" }] : [],
        notes: ["Margin = invoiced (ex tax) − expenses. Staff time is shown in hours; add staff cost rates if you want a time-cost margin."],
      };
    },
  },
  {
    key: "timesheet-detail",
    title: "Timesheet detail",
    description: "Every time entry with person, project, task, hours, rate and billing state.",
    category: "Delivery",
    filters: ["dateRange", "staff", "project"],
    defaultRange: "30d",
    async run(p) {
      const r = range(p, "30d"), sid = num(p.staffId), pid = num(p.projectId), sym = await defaultSymbol();
      const es = (await db.query.taskTimers.findMany({ with: { staff: true, invoice: true, task: { with: { project: { with: { customer: true } } } } } }))
        .filter((e) => e.endTime && inRange(localDay(e.startTime), r) && (!sid || e.staffId === sid) && (!pid || e.task.projectId === pid))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const rows = es.map((e) => {
        const h = round2(entryHours(e)), b = isBillable(e.task, e.task.project), rate = b ? rateFor(e.task, e.task.project) : 0;
        return { date: localDay(e.startTime), person: fullName(e.staff), customer: e.task.project?.customer?.company ?? "", project: e.task.project?.name ?? "Internal", task: e.task.name, note: e.note ?? "", hours: h, billable: b ? "Yes" : "No", rate: rate || null, value: b ? round2(h * rate) : null, invoice: e.invoice?.number ?? (b ? "Unbilled" : "") };
      });
      return {
        title: "Timesheet detail", subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "date", label: "Date", type: "date" }, { key: "person", label: "Person" }, { key: "customer", label: "Customer", width: 22 }, { key: "project", label: "Project", width: 24 }, { key: "task", label: "Task", width: 26 }, { key: "note", label: "Note", width: 30 }, { key: "hours", label: "Hours", type: "hours" }, { key: "billable", label: "Billable" }, { key: "rate", label: "Rate", type: "money" }, { key: "value", label: "Value", type: "money" }, { key: "invoice", label: "Invoice" }],
        rows,
        totals: { date: "Total", hours: sum(rows, (x) => x.hours), value: sum(rows, (x) => x.value ?? 0) },
        summary: [{ label: "Hours", value: sum(rows, (x) => x.hours).toFixed(2) }, { label: "Billable hours", value: sum(rows.filter((x) => x.billable === "Yes"), (x) => x.hours).toFixed(2) }, { label: "Billable value", value: money(sum(rows, (x) => x.value ?? 0), sym) }, { label: "Unbilled value", value: money(sum(rows.filter((x) => x.invoice === "Unbilled"), (x) => x.value ?? 0), sym) }],
      };
    },
  },
  {
    key: "staff-utilisation",
    title: "Staff utilisation",
    description: "Hours per person, billable share, and weekly hours trend.",
    category: "Delivery",
    filters: ["dateRange"],
    defaultRange: "30d",
    async run(p) {
      const r = range(p, "30d"), sym = await defaultSymbol();
      const people = await db.query.staff.findMany();
      const es = (await db.query.taskTimers.findMany({ with: { task: { with: { project: true } } } })).filter((e) => e.endTime && inRange(localDay(e.startTime), r));
      const rows = people.map((s) => {
        const mine = es.filter((e) => e.staffId === s.id), h = round2(mine.reduce((a, e) => a + entryHours(e), 0));
        const bill = mine.filter((e) => isBillable(e.task, e.task.project)), bh = round2(bill.reduce((a, e) => a + entryHours(e), 0));
        return { person: `${s.firstName} ${s.lastName}`, active: s.active ? "Yes" : "No", hours: h, billableHours: bh, utilisation: pct(bh, h), value: round2(bill.reduce((a, e) => a + entryHours(e) * rateFor(e.task, e.task.project), 0)), tasks: new Set(mine.map((e) => e.taskId)).size, projects: new Set(mine.map((e) => e.task.projectId).filter(Boolean)).size };
      }).filter((x) => x.hours > 0 || x.active === "Yes").sort((a, b) => b.hours - a.hours);
      return {
        title: "Staff utilisation", subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "person", label: "Person" }, { key: "hours", label: "Hours", type: "hours" }, { key: "billableHours", label: "Billable hours", type: "hours" }, { key: "utilisation", label: "Billable share", type: "percent" }, { key: "value", label: "Billable value", type: "money" }, { key: "tasks", label: "Tasks", type: "number" }, { key: "projects", label: "Projects", type: "number" }],
        rows,
        totals: { person: "Total", hours: sum(rows, (x) => x.hours), billableHours: sum(rows, (x) => x.billableHours), utilisation: pct(sum(rows, (x) => x.billableHours), sum(rows, (x) => x.hours)), value: sum(rows, (x) => x.value) },
        summary: [{ label: "Hours logged", value: sum(rows, (x) => x.hours).toFixed(2) }, { label: "Billable share", value: `${pct(sum(rows, (x) => x.billableHours), sum(rows, (x) => x.hours))}%` }, { label: "Billable value", value: money(sum(rows, (x) => x.value), sym) }],
        charts: rows.length ? [{ type: "hbar", title: "Hours by person", categories: rows.map((x) => x.person), series: [{ name: "All hours", values: rows.map((x) => x.hours) }, { name: "Billable", values: rows.map((x) => x.billableHours) }], format: "hours" }] : [],
      };
    },
  },
  {
    key: "task-status",
    title: "Tasks & deadlines",
    description: "All tasks with assignees, status, due date, overdue flag and hours logged.",
    category: "Delivery",
    filters: ["staff", "project"],
    async run(p) {
      const sid = num(p.staffId), pid = num(p.projectId), sym = await defaultSymbol(), t0 = today();
      const ts = (await db.query.tasks.findMany({ with: { project: true, assignees: { with: { staff: true } }, timers: true } }))
        .filter((t) => (!sid || t.assignees.some((a) => a.staffId === sid)) && (!pid || t.projectId === pid));
      const rows = ts.map((t) => ({ task: t.name, project: t.project?.name ?? "Internal", assignees: t.assignees.map((a) => fullName(a.staff)).join(", "), priority: t.priority, status: t.status.replace(/_/g, " "), due: t.dueDate ?? "", overdue: t.dueDate && t.dueDate < t0 && t.status !== "finished" ? "Yes" : "", hours: round2(t.timers.reduce((a, e) => a + entryHours(e), 0)) }))
        .sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
      const statuses = ["not started", "in progress", "testing", "awaiting feedback", "finished"];
      return {
        title: "Tasks & deadlines", subtitle: `As of ${t0}`, currency: sym,
        columns: [{ key: "task", label: "Task", width: 32 }, { key: "project", label: "Project", width: 26 }, { key: "assignees", label: "Assignees", width: 24 }, { key: "priority", label: "Priority" }, { key: "status", label: "Status" }, { key: "due", label: "Due", type: "date" }, { key: "overdue", label: "Overdue" }, { key: "hours", label: "Hours", type: "hours" }],
        rows,
        totals: { task: "Total", hours: sum(rows, (x) => x.hours) },
        summary: [{ label: "Tasks", value: String(rows.length) }, { label: "Open", value: String(rows.filter((x) => x.status !== "finished").length) }, { label: "Overdue", value: String(rows.filter((x) => x.overdue).length) }],
        charts: [{ type: "bar", title: "Tasks by status", categories: statuses.map((s) => s[0].toUpperCase() + s.slice(1)), series: [{ name: "Tasks", values: statuses.map((s) => rows.filter((x) => x.status === s).length) }], format: "number" }],
      };
    },
  },
  {
    key: "project-schedule",
    title: "Project schedule (Gantt)",
    description: "Projects, milestones and tasks with planned dates, progress and overdue flags — Excel and Word exports include a Gantt chart.",
    category: "Delivery",
    filters: ["project", "staff"],
    async run(p) {
      const sym = await defaultSymbol(), t0 = today(), pid = num(p.projectId), sid = num(p.staffId);
      // tasks=0 → projects only; tasks=only or a person filter → tasks only; otherwise projects with their tasks.
      const tasksOnly = p.tasks === "only" || !!sid;
      const items = tasksOnly
        ? await taskGanttRows({ projectId: pid ?? undefined, staffId: sid ?? undefined, open: p.open === "1" })
        : await projectGanttRows({ projectId: pid ?? undefined, status: p.status || undefined, withTasks: p.tasks !== "0" });
      const rows = items.map((r) => {
        const s = r.start ?? r.end, e = r.end ?? r.start;
        return {
          type: r.id.startsWith("p") ? "Project" : "Task", item: r.level === 1 ? `   ${r.label}` : r.label, detail: r.sub ?? "",
          start: s ?? "", end: e ?? "", days: s && e ? daysBetween(s, e) + 1 : null,
          progress: r.progress ?? null, hours: r.hours ?? null, status: r.status,
          overdue: r.overdue && e ? `${daysBetween(e, t0)} days` : "",
          milestones: (r.milestones ?? []).map((m) => `${m.label} (${m.date})`).join("; "),
        };
      });
      const overdue = rows.filter((r) => r.overdue).length;
      const next = items.flatMap((r) => r.milestones ?? []).filter((m) => m.date >= t0).sort((a, b) => a.date.localeCompare(b.date))[0];
      return {
        title: "Project schedule (Gantt)", subtitle: `As of ${t0}`, currency: sym,
        columns: [{ key: "type", label: "Type" }, { key: "item", label: "Item", width: 34 }, { key: "detail", label: "Customer / project · people", width: 30 }, { key: "start", label: "Start", type: "date" }, { key: "end", label: "End", type: "date" }, { key: "days", label: "Days", type: "number" }, { key: "progress", label: "Progress", type: "percent" }, { key: "hours", label: "Hours logged", type: "hours" }, { key: "status", label: "Status" }, { key: "overdue", label: "Overdue by" }, { key: "milestones", label: "Milestones", width: 30 }],
        rows,
        summary: [
          { label: "Projects", value: String(rows.filter((r) => r.type === "Project").length) },
          { label: "Tasks", value: String(rows.filter((r) => r.type === "Task").length) },
          { label: "Overdue items", value: String(overdue) },
          ...(next ? [{ label: "Next milestone", value: `${next.label} · ${next.date}` }] : []),
        ],
        notes: ["Bars run from start to due date (deadline for projects). Tasks without a start date start on their first logged time, or the day they were created.", "The Excel file has a 'Gantt' sheet; the Word file ends with a Gantt page."],
        timeline: { today: t0, items },
        gantt: { mode: "plan", rows: items },
      };
    },
  },
  {
    key: "time-gantt",
    title: "Timesheet Gantt",
    description: "Hours logged per task and person, day by day, against each task's planned window.",
    category: "Delivery",
    filters: ["dateRange", "staff", "project"],
    defaultRange: "30d",
    async run(p) {
      const sym = await defaultSymbol(), r = range(p, "30d");
      const items = await timesheetGanttRows({ from: r.from, to: r.to, staffId: num(p.staffId) ?? undefined, projectId: num(p.projectId) ?? undefined });
      const rows = items.map((x) => ({
        task: x.label, who: x.sub ?? "", plannedStart: x.start ?? "", plannedEnd: x.end ?? "",
        first: x.blocks?.[0]?.date ?? "", last: x.blocks?.at(-1)?.date ?? "", days: x.blocks?.length ?? 0, hours: x.hours ?? 0,
        outside: (x.blocks ?? []).filter((b) => (x.start && b.date < x.start) || (x.end && b.date > x.end)).length, status: x.status,
      }));
      return {
        title: "Timesheet Gantt", subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "task", label: "Task", width: 30 }, { key: "who", label: "Person · project", width: 30 }, { key: "plannedStart", label: "Planned start", type: "date" }, { key: "plannedEnd", label: "Planned end", type: "date" }, { key: "first", label: "First logged", type: "date" }, { key: "last", label: "Last logged", type: "date" }, { key: "days", label: "Days worked", type: "number" }, { key: "hours", label: "Hours", type: "hours" }, { key: "outside", label: "Days outside plan", type: "number" }, { key: "status", label: "Status" }],
        rows,
        totals: { task: "Total", days: sum(rows, (x) => x.days), hours: sum(rows, (x) => x.hours) },
        summary: [{ label: "Task × person rows", value: String(rows.length) }, { label: "Hours logged", value: `${sum(rows, (x) => x.hours).toFixed(2)} h` }, { label: "Days worked outside the plan", value: String(sum(rows, (x) => x.outside)) }],
        notes: ["Days outside plan = days with time logged before the task's start date or after its due date."],
        timeline: { today: today(), items: items.map((x) => ({ label: `${x.label} — ${x.sub}`, start: x.start, end: x.end, finished: x.finished, logged: x.blocks?.map((b) => ({ date: b.date, hours: b.hours })) })) },
        gantt: { mode: "time", rows: items, from: r.from, to: r.to },
      };
    },
  },
];

export const operationsReports: ReportDef[] = [
  {
    key: "expenses-summary",
    title: "Expenses by category",
    description: "Spend per category with monthly trend, billable share and amounts already rebilled.",
    category: "Operations",
    filters: ["dateRange", "project"],
    defaultRange: "12m",
    async run(p) {
      const r = range(p, "12m"), pid = num(p.projectId), sym = await defaultSymbol();
      const ex = (await db.query.expenses.findMany({ with: { category: true } })).filter((e) => inRange(e.date, r) && (!pid || e.projectId === pid));
      const cats = [...new Set(ex.map((e) => e.category.name))];
      const rows = cats.map((c) => { const es = ex.filter((e) => e.category.name === c); return { category: c, count: es.length, amount: sum(es, (e) => e.amount), tax: sum(es, (e) => e.tax), total: sum(es, (e) => e.amount + e.tax), billable: sum(es.filter((e) => e.billable), (e) => e.amount + e.tax), rebilled: sum(es.filter((e) => e.invoiceId), (e) => e.amount + e.tax) }; }).sort((a, b) => b.total - a.total);
      const months = monthsIn(r);
      return {
        title: "Expenses by category", subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "category", label: "Category", width: 26 }, { key: "count", label: "Entries", type: "number" }, { key: "amount", label: "Amount", type: "money" }, { key: "tax", label: "Tax", type: "money" }, { key: "total", label: "Total", type: "money" }, { key: "billable", label: "Billable", type: "money" }, { key: "rebilled", label: "Rebilled", type: "money" }],
        rows,
        totals: { category: "Total", count: ex.length, amount: sum(rows, (x) => x.amount), tax: sum(rows, (x) => x.tax), total: sum(rows, (x) => x.total), billable: sum(rows, (x) => x.billable), rebilled: sum(rows, (x) => x.rebilled) },
        summary: [{ label: "Total spend", value: money(sum(rows, (x) => x.total), sym) }, { label: "Billable", value: money(sum(rows, (x) => x.billable), sym) }, { label: "Not yet rebilled", value: money(sum(rows, (x) => x.billable - x.rebilled), sym) }],
        charts: [
          { type: "bar", title: "Spend by month", categories: months.map(monthLabel), series: [{ name: "Spend", values: months.map((m) => sum(ex.filter((e) => e.date.startsWith(m)), (e) => e.amount + e.tax)) }], format: "money" },
          ...(rows.length ? [{ type: "hbar" as const, title: "Spend by category", categories: rows.map((x) => x.category), series: [{ name: "Total", values: rows.map((x) => x.total) }], format: "money" as const }] : []),
        ],
      };
    },
  },
  {
    key: "expense-register",
    title: "Expense register",
    description: "Every expense in the period with customer, project and rebilling status.",
    category: "Operations",
    filters: ["dateRange", "customer", "project"],
    defaultRange: "90d",
    async run(p) {
      const r = range(p, "90d"), cust = num(p.customerId), pid = num(p.projectId), sym = await defaultSymbol();
      const ex = (await db.query.expenses.findMany({ with: { category: true, customer: true, project: true, invoice: true, currency: true } }))
        .filter((e) => inRange(e.date, r) && (!cust || e.customerId === cust) && (!pid || e.projectId === pid)).sort((a, b) => a.date.localeCompare(b.date));
      return {
        title: "Expense register", subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "date", label: "Date", type: "date" }, { key: "category", label: "Category" }, { key: "name", label: "Name", width: 26 }, { key: "customer", label: "Customer", width: 24 }, { key: "project", label: "Project", width: 24 }, { key: "ref", label: "Ref" }, { key: "currency", label: "Cur." }, { key: "amount", label: "Amount", type: "money" }, { key: "tax", label: "Tax", type: "money" }, { key: "billable", label: "Billable" }, { key: "invoice", label: "Rebilled on" }],
        rows: ex.map((e) => ({ date: e.date, category: e.category.name, name: e.name ?? "", customer: e.customer?.company ?? "", project: e.project?.name ?? "", ref: e.referenceNo ?? "", currency: e.currency?.name ?? "", amount: e.amount, tax: e.tax, billable: e.billable ? "Yes" : "No", invoice: e.invoice?.number ?? "" })),
        totals: { date: "Total", amount: sum(ex, (e) => e.amount), tax: sum(ex, (e) => e.tax) },
        summary: [{ label: "Expenses", value: String(ex.length) }, { label: "Total", value: money(sum(ex, (e) => e.amount + e.tax), sym) }],
      };
    },
  },
  {
    key: "ticket-summary",
    title: "Support tickets & response times",
    description: "Tickets in the period with status, priority and first-response time.",
    category: "Operations",
    filters: ["dateRange", "customer", "staff"],
    defaultRange: "90d",
    async run(p) {
      const r = range(p, "90d"), cust = num(p.customerId), sid = num(p.staffId), sym = await defaultSymbol();
      const ts = (await db.query.tickets.findMany({ with: { customer: true, status: true, priority: true, department: true, assigned: true, replies: true } }))
        .filter((t) => inRange(t.createdAt, r) && (!cust || t.customerId === cust) && (!sid || t.assignedId === sid));
      const created = (s: string) => new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`).getTime();
      const rows = ts.map((t) => {
        const first = t.replies.filter((x) => x.staffId).map((x) => created(x.createdAt)).sort()[0];
        return { id: t.id, subject: t.subject, customer: t.customer?.company ?? t.name ?? t.email ?? "", department: t.department?.name ?? "", priority: t.priority?.name ?? "", status: t.status?.name ?? "", assigned: fullName(t.assigned), opened: t.createdAt.slice(0, 10), replies: t.replies.length, firstResponseHrs: first ? round2((first - created(t.createdAt)) / 3_600_000) : null };
      }).sort((a, b) => a.id - b.id);
      const responded = rows.filter((x) => x.firstResponseHrs != null);
      const statuses = [...new Set(rows.map((x) => x.status))];
      return {
        title: "Support tickets & response times", subtitle: rangeLabel(r), currency: sym,
        columns: [{ key: "id", label: "#", type: "number" }, { key: "subject", label: "Subject", width: 32 }, { key: "customer", label: "Customer", width: 24 }, { key: "department", label: "Department" }, { key: "priority", label: "Priority" }, { key: "status", label: "Status" }, { key: "assigned", label: "Assigned" }, { key: "opened", label: "Opened", type: "date" }, { key: "replies", label: "Replies", type: "number" }, { key: "firstResponseHrs", label: "First response (h)", type: "hours" }],
        rows,
        summary: [{ label: "Tickets", value: String(rows.length) }, { label: "Awaiting first response", value: String(rows.length - responded.length) }, { label: "Avg first response", value: responded.length ? `${round2(sum(responded, (x) => x.firstResponseHrs ?? 0) / responded.length)} h` : "—" }],
        charts: statuses.length ? [{ type: "hbar", title: "Tickets by status", categories: statuses, series: [{ name: "Tickets", values: statuses.map((s) => rows.filter((x) => x.status === s).length) }], format: "number" }] : [],
      };
    },
  },
  {
    key: "contracts-register",
    title: "Contracts register",
    description: "All contracts with value, dates, days to expiry and signature status.",
    category: "Operations",
    filters: ["customer"],
    async run(p) {
      const cust = num(p.customerId), sym = await defaultSymbol(), t0 = today();
      const cs = (await db.query.contracts.findMany({ with: { customer: true, type: true } })).filter((c) => !cust || c.customerId === cust);
      const rows = cs.map((c) => { const d = c.dateEnd ? daysBetween(t0, c.dateEnd) : null; return { subject: c.subject, customer: c.customer.company, type: c.type?.name ?? "", start: c.dateStart, end: c.dateEnd ?? "", daysToExpiry: d, state: d == null ? "Active" : d < 0 ? "Expired" : d <= 30 ? "Expiring" : "Active", signed: c.signed ? "Yes" : "No", value: c.value }; }).sort((a, b) => (a.end || "9").localeCompare(b.end || "9"));
      return {
        title: "Contracts register", subtitle: `As of ${t0}`, currency: sym,
        columns: [{ key: "subject", label: "Contract", width: 30 }, { key: "customer", label: "Customer", width: 26 }, { key: "type", label: "Type" }, { key: "start", label: "Start", type: "date" }, { key: "end", label: "End", type: "date" }, { key: "daysToExpiry", label: "Days to expiry", type: "number" }, { key: "state", label: "State" }, { key: "signed", label: "Signed" }, { key: "value", label: "Value", type: "money" }],
        rows,
        totals: { subject: "Total", value: sum(rows, (x) => x.value) },
        summary: [{ label: "Contracts", value: String(rows.length) }, { label: "Active value", value: money(sum(rows.filter((x) => x.state !== "Expired"), (x) => x.value), sym) }, { label: "Expiring in 30 days", value: String(rows.filter((x) => x.state === "Expiring").length) }, { label: "Unsigned", value: String(rows.filter((x) => x.signed === "No").length) }],
      };
    },
  },
];
