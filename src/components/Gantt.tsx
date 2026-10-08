"use client";
/**
 * Gantt chart (no library). Two modes:
 *  - "plan": planned bar (outlined light fill) with progress fill, milestone diamonds,
 *    a red overrun stub for overdue items and a dashed "today" line.
 *  - "time": the planned window as a faint band with one mini-bar per day of logged
 *    time (height ∝ hours, 8 h = full height) — actual effort against the plan.
 * Day / week / month scales, hover tooltips, legend, and a table view.
 * Colours: categorical slot 1 (#2a78d6) for bars, slot 2 (#eb6834) for milestones,
 * status "critical" (#d03b3b) for overdue — always paired with a text label.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GanttMode, GanttRow, GanttScale } from "@/lib/gantt-types";

const BLUE = "#2a78d6", TRACK = "#dbe8f8", ORANGE = "#eb6834", RED = "#d03b3b", INK = "#0f172a", MUTED = "#64748b", GRID = "#eef2f6", BAND = "#e2e8f0";
const ROW_H = 44, HEAD_H = 44, BAR_H = 14;
const PX: Record<GanttScale, number> = { day: 30, week: 10, month: 3.2 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const diff = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / 86400000);
const fmt = (s?: string | null) => (s ? `${String(D(s).getUTCDate()).padStart(2, "0")} ${MONTHS[D(s).getUTCMonth()]} ${D(s).getUTCFullYear()}` : "—");
const mondayOf = (s: string) => addDays(s, -((D(s).getUTCDay() + 6) % 7));
const monthStart = (s: string) => `${s.slice(0, 7)}-01`;
const nextMonth = (s: string) => { const d = D(monthStart(s)); d.setUTCMonth(d.getUTCMonth() + 1); return iso(d); };

/** Rect with all four corners rounded (radius ≤ 4, clamped to size). */
function pill(x: number, y: number, w: number, h: number, r = 4) {
  if (w <= 0 || h <= 0) return "";
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x + r}Q${x},${y + h} ${x},${y + h - r}V${y + r}Q${x},${y} ${x + r},${y}Z`;
}
/** Vertical mini-bar with a rounded top (data end) and square baseline. */
function colPath(x: number, y: number, w: number, h: number) {
  if (w <= 0 || h <= 0) return "";
  const r = Math.min(3, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function span(r: GanttRow): [string, string] | null {
  const s = r.start ?? r.end, e = r.end ?? r.start;
  if (!s || !e) return null;
  return e < s ? [s, s] : [s, e];
}

export default function Gantt({ rows, mode = "plan", from, to, title, today, defaultScale, testId = "gantt", emptyText = "Nothing scheduled." }: {
  rows: GanttRow[]; mode?: GanttMode; from?: string; to?: string; title: string; today: string; defaultScale?: GanttScale; testId?: string; emptyText?: string;
}) {
  // Domain: everything drawn, plus today in plan mode; or the forced from/to.
  const [lo, hi] = useMemo(() => {
    if (from && to) return [from, to];
    const ds: string[] = mode === "plan" ? [today] : [];
    for (const r of rows) {
      const s = span(r); if (s) ds.push(...s);
      r.milestones?.forEach((m) => ds.push(m.date));
      r.blocks?.forEach((b) => ds.push(b.date));
    }
    ds.sort();
    return [ds[0] ?? today, ds.at(-1) ?? today];
  }, [rows, from, to, mode, today]);
  const auto: GanttScale = diff(lo, hi) <= 45 ? "day" : diff(lo, hi) <= 240 || mode === "time" ? "week" : "month";
  const [scale, setScale] = useState<GanttScale>(defaultScale ?? auto);
  const [table, setTable] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // Snap the domain to whole ticks of the chosen scale, with a little air either side.
  const start = scale === "day" ? addDays(lo, -2) : scale === "week" ? mondayOf(addDays(lo, -3)) : monthStart(lo);
  const endEx = scale === "day" ? addDays(hi, 3) : scale === "week" ? addDays(mondayOf(addDays(hi, 3)), 7) : nextMonth(hi);
  const px = PX[scale], days = diff(start, endEx), W = Math.max(days * px, 320), H = HEAD_H + rows.length * ROW_H;
  const x = (d: string) => diff(start, d) * px;
  const inDomain = today >= start && today < endEx;

  useEffect(() => {
    const el = scroller.current;
    if (el && inDomain && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, x(today) - el.clientWidth / 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  // Header ticks: top tier (months or years) and bottom tier (days, weeks or months).
  const top: { x: number; w: number; label: string }[] = [];
  const bottom: { x: number; label: string; shade?: boolean }[] = [];
  if (scale === "month") {
    for (let m = start; m < endEx; m = nextMonth(m)) bottom.push({ x: x(m), label: MONTHS[D(m).getUTCMonth()] });
    for (let y = Number(start.slice(0, 4)); y <= Number(endEx.slice(0, 4)); y++) {
      const a = `${y}-01-01` < start ? start : `${y}-01-01`, b = `${y + 1}-01-01` > endEx ? endEx : `${y + 1}-01-01`;
      if (a < b) top.push({ x: x(a), w: x(b) - x(a), label: String(y) });
    }
  } else {
    for (let m = monthStart(start); m < endEx; m = nextMonth(m)) {
      const a = m < start ? start : m, b = nextMonth(m) > endEx ? endEx : nextMonth(m);
      top.push({ x: x(a), w: x(b) - x(a), label: `${MONTHS[D(m).getUTCMonth()]} ${m.slice(0, 4)}` });
    }
    if (scale === "day") for (let d = start; d < endEx; d = addDays(d, 1)) { const dow = D(d).getUTCDay(); bottom.push({ x: x(d), label: String(D(d).getUTCDate()), shade: dow === 0 || dow === 6 }); }
    else for (let d = start; d < endEx; d = addDays(d, 7)) bottom.push({ x: x(d), label: `${String(D(d).getUTCDate()).padStart(2, "0")} ${MONTHS[D(d).getUTCMonth()]}` });
  }

  const show = (e: React.MouseEvent, title: string, lines: string[]) => {
    const box = wrap.current!.getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, title, lines });
  };
  const rowLines = (r: GanttRow) => {
    const s = span(r);
    return [
      r.sub ?? "",
      s ? `${fmt(s[0])} → ${fmt(s[1])} (${diff(s[0], s[1]) + 1} days)` : "No dates set",
      `Status: ${r.status}${r.overdue ? " · overdue" : ""}`,
      ...(r.progress != null && !r.finished ? [`Progress: ${r.progress}%`] : []),
      ...(r.hours ? [`Logged: ${r.hours.toFixed(2)} h`] : []),
    ].filter(Boolean);
  };

  const scales: GanttScale[] = mode === "time" ? ["day", "week"] : ["day", "week", "month"];
  const legend = mode === "plan" ? (
    <>
      <Key><span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: TRACK, border: `1px solid ${BLUE}` }} />Planned</Key>
      <Key><span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: BLUE }} />Progress / complete</Key>
      <Key><span className="inline-block h-1.5 w-5 rounded-sm" style={{ background: RED }} />Overdue</Key>
      <Key><span className="inline-block h-2.5 w-2.5 rotate-45" style={{ background: ORANGE }} />Milestone</Key>
      <Key><span className="inline-block h-3 border-l border-dashed" style={{ borderColor: INK }} />Today</Key>
    </>
  ) : (
    <>
      <Key><span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: BAND }} />Planned window</Key>
      <Key><span className="inline-block h-2.5 w-2 rounded-t-sm" style={{ background: BLUE }} />Hours logged per day (full = 8 h)</Key>
      <Key><span className="inline-block h-3 border-l border-dashed" style={{ borderColor: INK }} />Today</Key>
    </>
  );

  return (
    <figure className="card m-0 p-0" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <figcaption className="text-sm font-semibold text-slate-900">{title}</figcaption>
        <div className="flex items-center gap-1 print:hidden">
          {!table && scales.map((s) => (
            <button key={s} type="button" onClick={() => setScale(s)} aria-pressed={scale === s}
              className={`btn btn-sm ${scale === s ? "bg-brand-600 text-white" : "btn-secondary"}`}>{s[0].toUpperCase() + s.slice(1)}</button>
          ))}
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setTable((t) => !t)}>{table ? "Chart" : "Table"}</button>
        </div>
      </div>
      {rows.length === 0 ? <div className="px-4 py-10 text-center text-sm text-slate-500">{emptyText}</div> : table ? (
        <div className="max-h-[480px] overflow-auto">
          <table className="table">
            <thead><tr><th>Item</th><th>Detail</th><th>{mode === "time" ? "Planned start" : "Start"}</th><th>{mode === "time" ? "Planned end" : "End"}</th><th className="text-right">Days</th>{mode === "plan" && <th className="text-right">Progress</th>}<th className="text-right">Hours</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const s = span(r);
                return (
                  <tr key={r.id}>
                    <td className={r.level === 1 ? "pl-8" : "font-medium"}>{r.href ? <Link href={r.href}>{r.label}</Link> : r.label}</td>
                    <td className="text-slate-500">{r.sub}{r.milestones?.length ? ` · ${r.milestones.length} milestone(s)` : ""}</td>
                    <td className="whitespace-nowrap">{fmt(s?.[0])}</td><td className="whitespace-nowrap">{fmt(s?.[1])}</td>
                    <td className="text-right tabular-nums">{mode === "time" ? r.blocks?.length ?? 0 : s ? diff(s[0], s[1]) + 1 : "—"}</td>
                    {mode === "plan" && <td className="text-right tabular-nums">{r.progress != null ? `${r.progress}%` : "—"}</td>}
                    <td className="text-right tabular-nums">{r.hours ? r.hours.toFixed(2) : "—"}</td>
                    <td className={r.overdue ? "font-medium text-rose-700" : ""}>{r.status}{r.overdue ? " · overdue" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 text-xs text-slate-600">{legend}</div>
          <div ref={wrap} className="relative mt-2 flex" onMouseLeave={() => setTip(null)}>
            {/* Label column */}
            <div className="w-40 shrink-0 border-r border-slate-200 sm:w-64">
              <div style={{ height: HEAD_H }} className="border-b border-slate-200 px-3 pt-5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{mode === "time" ? "Task · person" : "Item"}</div>
              {rows.map((r) => (
                <div key={r.id} style={{ height: ROW_H }} className={`flex flex-col justify-center border-b border-slate-100 pr-2 ${r.level === 1 ? "pl-6" : "pl-3"} ${r.level === 0 && rows.some((c) => c.level === 1) ? "bg-slate-50" : ""}`}>
                  <div className="truncate text-[13px] leading-tight">
                    {r.finished && <span className="mr-1 text-emerald-700" title="Finished">✓</span>}
                    {r.href ? <Link href={r.href} className={r.level === 0 ? "font-medium" : ""}>{r.label}</Link> : r.label}
                  </div>
                  <div className="truncate text-[11px] leading-tight text-slate-500">
                    {r.overdue && <span className="mr-1 font-medium text-rose-700">⚠ Overdue ·</span>}
                    {mode === "time" ? `${(r.hours ?? 0).toFixed(1)} h · ${r.sub}` : r.sub}
                  </div>
                </div>
              ))}
            </div>
            {/* Timeline */}
            <div ref={scroller} className="min-w-0 flex-1 overflow-x-auto">
              <svg width={W} height={H} role="img" aria-label={title} style={{ display: "block" }}>
                {bottom.map((b, i) => b.shade && <rect key={`s${i}`} x={b.x} y={HEAD_H} width={px} height={H - HEAD_H} fill="#f8fafc" />)}
                {bottom.map((b, i) => <line key={`g${i}`} x1={b.x} x2={b.x} y1={HEAD_H - 18} y2={H} stroke={GRID} />)}
                {top.map((t, i) => (
                  <g key={`t${i}`}>
                    <line x1={t.x} x2={t.x} y1={0} y2={HEAD_H} stroke={BAND} />
                    <text x={t.x + 6} y={16} fontSize={12} fontWeight={600} fill={INK}>{t.w < 70 ? t.label.slice(0, 3) : t.label}</text>
                  </g>
                ))}
                {bottom.map((b, i) => (scale !== "day" || px >= 20) && <text key={`b${i}`} x={b.x + (scale === "day" ? px / 2 : 4)} y={HEAD_H - 8} fontSize={11} fill={MUTED} textAnchor={scale === "day" ? "middle" : "start"}>{b.label}</text>)}
                <line x1={0} x2={W} y1={HEAD_H} y2={HEAD_H} stroke="#cbd5e1" />
                {rows.map((r, i) => {
                  const y0 = HEAD_H + i * ROW_H, cy = y0 + ROW_H / 2, s = span(r);
                  const parent = r.level === 0 && rows.some((c) => c.level === 1);
                  return (
                    <g key={r.id}>
                      {parent && <rect x={0} y={y0} width={W} height={ROW_H} fill="#f8fafc" opacity={0.7} />}
                      <line x1={0} x2={W} y1={y0 + ROW_H} y2={y0 + ROW_H} stroke={GRID} />
                      <rect x={0} y={y0} width={W} height={ROW_H} fill="transparent" onMouseMove={(e) => show(e, r.label, rowLines(r))} />
                      {mode === "plan" && s && (() => {
                        const bx = x(s[0]), bw = x(addDays(s[1], 1)) - bx, by = cy - BAR_H / 2;
                        const prog = r.finished ? 100 : Math.max(0, Math.min(100, r.progress ?? 0));
                        const late = r.overdue && s[1] < today ? [x(addDays(s[1], 1)), x(addDays(today, 1))] : null;
                        return (
                          <g pointerEvents="none">
                            <path d={pill(bx, by, bw, BAR_H)} fill={TRACK} stroke={BLUE} strokeWidth={1} />
                            {prog > 0 && <path d={pill(bx, by, Math.max(4, (bw * prog) / 100), BAR_H)} fill={BLUE} />}
                            {late && <path d={pill(late[0] + 2, cy - 3, Math.max(4, late[1] - late[0] - 2), 6, 3)} fill={RED} />}
                          </g>
                        );
                      })()}
                      {mode === "time" && s && <rect x={x(s[0])} y={cy - 13} width={x(addDays(s[1], 1)) - x(s[0])} height={26} rx={4} fill={BAND} opacity={0.6} pointerEvents="none" />}
                      {mode === "time" && r.blocks?.map((b) => {
                        const h = Math.max(3, (Math.min(b.hours, 8) / 8) * 24), bx = x(b.date) + 1, bw = Math.max(2, px - 2);
                        return (
                          <g key={b.date}>
                            <path d={colPath(bx, cy + 12 - h, bw, h)} fill={BLUE} pointerEvents="none" />
                            <rect x={x(b.date)} y={y0 + 2} width={px} height={ROW_H - 4} fill="transparent"
                              onMouseMove={(e) => { e.stopPropagation(); show(e, `${r.label} — ${fmt(b.date)}`, [r.sub ?? "", `${b.hours.toFixed(2)} h logged`, ...(b.note ? [b.note] : [])]); }} />
                          </g>
                        );
                      })}
                      {r.milestones?.map((m, mi) => {
                        const mx = x(m.date) + px / 2;
                        return (
                          <g key={mi}>
                            <path d={`M${mx},${cy - 8}L${mx + 8},${cy}L${mx},${cy + 8}L${mx - 8},${cy}Z`} fill={ORANGE} stroke="#fff" strokeWidth={2} pointerEvents="none" />
                            <rect x={mx - 10} y={cy - 10} width={20} height={20} fill="transparent"
                              onMouseMove={(e) => { e.stopPropagation(); show(e, `◆ ${m.label}`, [`Milestone · ${r.label}`, `Due ${fmt(m.date)}`, ...(m.date < today && !r.finished ? ["Date has passed"] : [])]); }} />
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
                {inDomain && (
                  <g pointerEvents="none">
                    <line x1={x(today) + px / 2} x2={x(today) + px / 2} y1={HEAD_H - 4} y2={H} stroke={INK} strokeDasharray="3 3" />
                    <rect x={x(today) + px / 2 - 20} y={HEAD_H - 22} width={40} height={16} rx={8} fill={INK} />
                    <text x={x(today) + px / 2} y={HEAD_H - 10} fontSize={10} fill="#fff" textAnchor="middle" fontWeight={600}>Today</text>
                  </g>
                )}
              </svg>
            </div>
            {tip && (
              <div className="pointer-events-none absolute z-20 max-w-xs rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
                style={{ left: Math.min(tip.x + 14, (wrap.current?.clientWidth ?? 600) - 290), top: tip.y + 14 }}>
                <div className="mb-0.5 font-semibold text-slate-900">{tip.title}</div>
                {tip.lines.map((l, i) => <div key={i} className="text-slate-600">{l}</div>)}
              </div>
            )}
          </div>
        </>
      )}
    </figure>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5">{children}</span>;
}
