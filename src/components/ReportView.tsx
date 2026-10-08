import Chart from "@/components/Chart";
import Gantt from "@/components/Gantt";
import { today } from "@/lib/utils";
import { cellText, isNumeric } from "@/lib/export/format";
import type { ReportResult } from "@/lib/reports/types";

const SCREEN_ROWS = 500;

/** On-screen rendering of a ReportResult: summary tiles, charts, table. */
export default function ReportView({ result }: { result: ReportResult }) {
  return (
    <div className="space-y-6">
      {result.summary && result.summary.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {result.summary.map((s) => <div key={s.label} className="stat"><span className="stat-label">{s.label}</span><span className="text-lg font-semibold tabular-nums text-slate-900">{s.value}</span></div>)}
        </div>
      )}
      {result.charts && result.charts.length > 0 && (
        <div className={`grid grid-cols-1 gap-6 ${result.charts.length > 1 ? "xl:grid-cols-2" : ""}`}>
          {result.charts.map((c) => <Chart key={c.title} spec={c} currency={result.currency} />)}
        </div>
      )}
      {result.gantt && <Gantt rows={result.gantt.rows} mode={result.gantt.mode} from={result.gantt.from} to={result.gantt.to} today={today()} title={`${result.title} · chart`} testId="gantt-report" emptyText="Nothing to chart for these filters." />}
      <div className="card overflow-x-auto p-0">
        <table className="table" data-testid="report-table">
          <thead><tr>{result.columns.map((c) => <th key={c.key} className={isNumeric(c) ? "text-right" : ""}>{c.label}{c.type === "money" ? ` (${result.currency})` : ""}</th>)}</tr></thead>
          <tbody>
            {result.rows.length === 0 && <tr><td colSpan={result.columns.length} className="py-8 text-center text-slate-500">No rows for these filters.</td></tr>}
            {result.rows.slice(0, SCREEN_ROWS).map((r, i) => (
              <tr key={i}>{result.columns.map((c) => {
                const v = r[c.key];
                return <td key={c.key} className={isNumeric(c) ? "text-right tabular-nums" : ""}>{typeof v === "string" && /^https?:\/\//.test(v) ? <a href={v} target="_blank" rel="noreferrer noopener" className="break-all">{v.replace(/^https?:\/\//, "").slice(0, 50)}</a> : cellText(c, v)}</td>;
              })}</tr>
            ))}
          </tbody>
          {result.totals && <tfoot><tr className="bg-slate-50 font-semibold">{result.columns.map((c) => <td key={c.key} className={isNumeric(c) ? "text-right tabular-nums" : ""}>{cellText(c, result.totals![c.key])}</td>)}</tr></tfoot>}
        </table>
      </div>
      {result.rows.length > SCREEN_ROWS && <p className="muted">Showing {SCREEN_ROWS} of {result.rows.length} rows on screen — the exports contain everything.</p>}
      {result.notes?.map((n) => <p key={n} className="muted">{n}</p>)}
    </div>
  );
}
