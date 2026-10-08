"use client";
/**
 * Lightweight SVG charts (no chart library). Vertical "bar" and horizontal "hbar",
 * up to 3 series in fixed palette order, hover tooltips, legend for ≥2 series,
 * and a table view. Palette validated with the dataviz validator (light surface).
 */
import { useMemo, useState } from "react";
import type { ChartSpec } from "@/lib/reports/types";

const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"]; // categorical slots 1-3
const GRID = "#e5e7eb", AXIS_TEXT = "#64748b", INK = "#0f172a";

function compact(v: number, format: ChartSpec["format"]) {
  if (format === "percent") return `${Math.round(v)}%`;
  if (format === "hours") return `${Math.round(v * 10) / 10}h`;
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v * 100) / 100);
}
function full(v: number, format: ChartSpec["format"], currency?: string) {
  if (format === "money") return `${currency ? currency + " " : ""}${v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (format === "percent") return `${v.toFixed(1)}%`;
  if (format === "hours") return `${v.toFixed(2)} h`;
  return v.toLocaleString("en-KE");
}
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
/** Bar path with a 4px rounded data-end and a square baseline. */
function barPath(x: number, y: number, w: number, h: number, horizontal: boolean) {
  const r = Math.min(4, horizontal ? h / 2 : w / 2, horizontal ? w : h);
  if (w <= 0 || h <= 0) return "";
  if (horizontal) return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export default function Chart({ spec, currency }: { spec: ChartSpec; currency?: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  const [table, setTable] = useState(false);
  const series = spec.series.slice(0, 3);
  const max = useMemo(() => niceMax(Math.max(0, ...series.flatMap((s) => s.values))), [series]);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const horizontal = spec.type === "hbar";
  const n = spec.categories.length;
  const hasData = series.some((s) => s.values.some((v) => v > 0));

  const legend = series.length > 1 && (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
      {series.map((s, i) => <span key={s.name} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} />{s.name}</span>)}
    </div>
  );

  let svg: React.ReactNode = null;
  if (hasData && !horizontal) {
    const W = 620, H = 250, L = 52, R = 10, T = 12, B = 40;
    const band = (W - L - R) / Math.max(1, n), barW = Math.min(24, (band * 0.7 - 2 * (series.length - 1)) / series.length);
    const groupW = barW * series.length + 2 * (series.length - 1);
    const y = (v: number) => T + (H - T - B) * (1 - v / max);
    const skip = n > 10 ? Math.ceil(n / 8) : 1;
    svg = (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={spec.title} onMouseLeave={() => setTip(null)}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={AXIS_TEXT}>{compact(t, spec.format)}</text></g>)}
        {spec.categories.map((c, ci) => {
          const gx = L + band * ci + (band - groupW) / 2;
          return (
            <g key={c}>
              {series.map((s, si) => { const v = s.values[ci] ?? 0, h = y(0) - y(v); return <path key={s.name} d={barPath(gx + si * (barW + 2), y(v), barW, h, false)} fill={SERIES[si]} />; })}
              <rect x={L + band * ci} y={T} width={band} height={H - T - B} fill="transparent"
                onMouseMove={(e) => { const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ x: e.clientX - box.left, y: e.clientY - box.top, title: c, lines: series.map((s) => `${s.name}: ${full(s.values[ci] ?? 0, spec.format, currency)}`) }); }} />
              {ci % skip === 0 && <text x={L + band * ci + band / 2} y={H - B + 18} textAnchor="middle" fontSize={12} fill={AXIS_TEXT}>{c.length > 12 ? `${c.slice(0, 11)}…` : c}</text>}
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth={1} />
      </svg>
    );
  } else if (hasData) {
    const rowH = series.length > 1 ? 32 : 26, L = 150, R = 56, T = 8, W = 620;
    const H = T + n * rowH + 24, plotW = W - L - R, barH = Math.min(24, (rowH - 8 - 2 * (series.length - 1)) / series.length);
    const x = (v: number) => (plotW * v) / max;
    svg = (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={spec.title} onMouseLeave={() => setTip(null)}>
        {ticks.map((t) => <g key={t}><line x1={L + x(t)} x2={L + x(t)} y1={T} y2={H - 20} stroke={GRID} strokeWidth={1} /><text x={L + x(t)} y={H - 6} textAnchor="middle" fontSize={12} fill={AXIS_TEXT}>{compact(t, spec.format)}</text></g>)}
        {spec.categories.map((c, ci) => {
          const gy = T + ci * rowH + (rowH - (barH * series.length + 2 * (series.length - 1))) / 2;
          const lastVal = series[0].values[ci] ?? 0;
          return (
            <g key={c}>
              <text x={L - 8} y={T + ci * rowH + rowH / 2 + 4} textAnchor="end" fontSize={13} fill={INK}>{c.length > 21 ? `${c.slice(0, 20)}…` : c}</text>
              {series.map((s, si) => <path key={s.name} d={barPath(L, gy + si * (barH + 2), x(s.values[ci] ?? 0), barH, true)} fill={SERIES[si]} />)}
              {series.length === 1 && <text x={L + x(lastVal) + 6} y={gy + barH / 2 + 4} fontSize={12} fill={AXIS_TEXT}>{compact(lastVal, spec.format)}</text>}
              <rect x={0} y={T + ci * rowH} width={W} height={rowH} fill="transparent"
                onMouseMove={(e) => { const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ x: e.clientX - box.left, y: e.clientY - box.top, title: c, lines: series.map((s) => `${s.name}: ${full(s.values[ci] ?? 0, spec.format, currency)}`) }); }} />
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <figure className="card">
      <div className="mb-2 flex items-start justify-between gap-2">
        <figcaption className="text-sm font-semibold text-slate-900">{spec.title}</figcaption>
        <button type="button" className="btn-ghost btn-sm no-print" onClick={() => setTable((t) => !t)}>{table ? "Chart" : "Table"}</button>
      </div>
      {legend}
      {!hasData ? <div className="py-10 text-center text-sm text-slate-500">No data for this period.</div> : table ? (
        <div className="max-h-72 overflow-auto">
          <table className="table">
            <thead><tr><th />{series.map((s) => <th key={s.name} className="text-right">{s.name}</th>)}</tr></thead>
            <tbody>{spec.categories.map((c, i) => <tr key={c}><td>{c}</td>{series.map((s) => <td key={s.name} className="text-right tabular-nums">{full(s.values[i] ?? 0, spec.format, currency)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {svg}
          {tip && (
            <div className="pointer-events-none absolute z-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg" style={{ left: Math.max(0, Math.min(tip.x + 12, tip.x > 300 ? tip.x - 200 : tip.x + 12)), top: Math.max(0, tip.y - 10) }}>
              <div className="mb-0.5 font-semibold text-slate-900">{tip.title}</div>
              {tip.lines.map((l, i) => <div key={l} className="flex items-center gap-1.5 text-slate-700">{series.length > 1 && <span className="inline-block h-2 w-2 rounded-sm" style={{ background: SERIES[i] }} />}{l}</div>)}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
