import Link from "next/link";
import { db } from "@/db";
import Chart from "@/components/Chart";
import { PageHeader } from "@/components/ui";
import { getReport } from "@/lib/reports";
import type { ChartSpec } from "@/lib/reports/types";
import { entryHours, isBillable } from "@/lib/timesheets";
import { addInterval, money, round2, today } from "@/lib/utils";

export const metadata = { title: "Analytics" };

/** Monday of the week containing d. */
const monday = (d: string) => addInterval(d, "day", -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));

export default async function AnalyticsPage() {
  const run = async (k: string, p: Record<string, string> = {}) => getReport(k)!.run(p);
  const [sales, pipeline, aged, conversion, util, expenses, customers, tickets] = await Promise.all([
    run("sales-summary"), run("pipeline-forecast"), run("aged-receivables"), run("lead-conversion"),
    run("staff-utilisation", { from: addInterval(today(), "day", -89) }), run("expenses-summary"), run("customer-revenue"), run("ticket-summary"),
  ]);
  const sym = sales.currency;
  const tot = (r: typeof sales, k: string) => Number(r.totals?.[k] ?? 0);

  // Weekly hours (last 12 weeks), billable vs other.
  const entries = await db.query.taskTimers.findMany({ with: { task: { with: { project: true } } } });
  const start = monday(addInterval(today(), "day", -7 * 11));
  const weeks = Array.from({ length: 12 }, (_, i) => addInterval(start, "day", 7 * i));
  const wk = (iso: string) => monday(new Date(iso).toLocaleDateString("en-CA", { timeZone: process.env.APP_TIMEZONE || "Africa/Nairobi" }));
  const hoursChart: ChartSpec = {
    type: "bar", title: "Hours logged per week (last 12 weeks)", format: "hours",
    categories: weeks.map((w) => new Date(`${w}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })),
    series: [
      { name: "Billable", values: weeks.map((w) => round2(entries.filter((e) => e.endTime && wk(e.startTime) === w && isBillable(e.task, e.task.project)).reduce((a, e) => a + entryHours(e), 0))) },
      { name: "Non-billable", values: weeks.map((w) => round2(entries.filter((e) => e.endTime && wk(e.startTime) === w && !isBillable(e.task, e.task.project)).reduce((a, e) => a + entryHours(e), 0))) },
    ],
  };

  const kpis = [
    { label: "Invoiced, last 12 months", value: money(tot(sales, "invoiced"), sym), href: "/reports/sales-summary" },
    { label: "Collected, last 12 months", value: money(tot(sales, "collected"), sym), href: "/reports/payments-received" },
    { label: "Receivables", value: money(Number(aged.totals?.total ?? 0), sym), href: "/reports/aged-receivables" },
    { label: "Overdue receivables", value: money(Number(aged.totals?.total ?? 0) - Number(aged.totals?.current ?? 0), sym), href: "/reports/aged-receivables" },
    { label: "Weighted pipeline", value: money(Number(pipeline.totals?.weighted ?? 0), sym), href: "/reports/pipeline-forecast" },
    { label: "Lead conversion rate", value: `${conversion.totals?.conversionRate ?? 0}%`, href: "/reports/lead-conversion" },
    { label: "Billable share (90 days)", value: `${util.totals?.utilisation ?? 0}%`, href: "/reports/staff-utilisation" },
    { label: "Avg first response (tickets)", value: tickets.summary?.find((s) => s.label === "Avg first response")?.value ?? "—", href: "/reports/ticket-summary" },
  ];
  const charts: { spec: ChartSpec; href: string }[] = [
    ...(sales.charts ?? []).map((spec) => ({ spec, href: "/reports/sales-summary" })),
    ...(pipeline.charts ?? []).slice(0, 2).map((spec) => ({ spec, href: "/reports/pipeline-forecast" })),
    ...(aged.charts ?? []).map((spec) => ({ spec, href: "/reports/aged-receivables" })),
    { spec: hoursChart, href: "/reports/timesheet-detail" },
    ...(customers.charts ?? []).map((spec) => ({ spec, href: "/reports/customer-revenue" })),
    ...(expenses.charts ?? []).slice(1).map((spec) => ({ spec, href: "/reports/expenses-summary" })),
  ];

  return (
    <>
      <PageHeader title="Analytics" subtitle="Live figures across sales, pipeline, delivery and support. Click any tile or chart to open the full report and export it." actions={<Link href="/reports" className="btn-secondary">All reports</Link>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => <Link key={k.label} href={k.href} className="stat hover:border-brand-300"><span className="stat-label">{k.label}</span><span className="text-lg font-semibold tabular-nums text-slate-900">{k.value}</span></Link>)}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {charts.map((c) => (
          <div key={c.spec.title}>
            <Chart spec={c.spec} currency={sym} />
            <Link href={c.href} className="no-print mt-1 inline-block text-xs">Open report →</Link>
          </div>
        ))}
      </div>
      {(sales.notes ?? []).map((n) => <p key={n} className="muted mt-4">{n}</p>)}
    </>
  );
}
