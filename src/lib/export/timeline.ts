/**
 * Turns a report's timeline into a bucketed grid (weeks, or months for long spans)
 * so the Excel and Word exporters can draw a Gantt with shaded cells.
 */
import type { TimelineItem } from "@/lib/reports/types";

export type CellState = "" | "plan" | "done" | "late";
export interface GanttGrid {
  unit: "week" | "month";
  buckets: { start: string; end: string; label: string; today: boolean }[];
  rows: { item: TimelineItem; cells: { state: CellState; milestone: string | null; hours: number }[] }[];
}

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const add = (s: string, n: number) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const diff = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / 86400000);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ganttGrid(items: TimelineItem[], today: string, maxCols: number): GanttGrid {
  const span = (i: TimelineItem): [string, string] | null => {
    const s = i.start ?? i.end, e = i.end ?? i.start;
    return s && e ? (e < s ? [s, s] : [s, e]) : null;
  };
  const ds = [today];
  for (const i of items) { const s = span(i); if (s) ds.push(...s); i.milestones?.forEach((m) => ds.push(m.date)); i.logged?.forEach((l) => ds.push(l.date)); }
  ds.sort();
  const lo = ds[0], hi = ds.at(-1)!;
  const monday = add(lo, -((D(lo).getUTCDay() + 6) % 7));
  const weeks = Math.ceil((diff(monday, hi) + 1) / 7);
  const unit: GanttGrid["unit"] = weeks <= maxCols ? "week" : "month";
  const buckets: GanttGrid["buckets"] = [];
  if (unit === "week") {
    for (let b = monday; b <= hi; b = add(b, 7)) {
      const e = add(b, 6);
      buckets.push({ start: b, end: e, label: `${String(D(b).getUTCDate()).padStart(2, "0")} ${MONTHS[D(b).getUTCMonth()]}`, today: today >= b && today <= e });
    }
  } else {
    for (let b = `${lo.slice(0, 7)}-01`; b <= hi;) {
      const d = D(b); d.setUTCMonth(d.getUTCMonth() + 1); const next = iso(d), e = add(next, -1);
      buckets.push({ start: b, end: e, label: `${MONTHS[D(b).getUTCMonth()]} ${b.slice(2, 4)}`, today: today >= b && today <= e });
      b = next;
    }
  }
  const rows = items.map((item) => {
    const s = span(item);
    const prog = item.finished ? 100 : Math.max(0, Math.min(100, item.progress ?? 0));
    const cut = s ? add(s[0], Math.round(((diff(s[0], s[1]) + 1) * prog) / 100)) : null; // first day not yet done
    return {
      item,
      cells: buckets.map((b) => {
        let state: CellState = "";
        if (s && b.start <= s[1] && b.end >= s[0]) state = !item.logged && prog > 0 && cut && b.start < cut ? "done" : "plan";
        else if (s && item.overdue && b.end > s[1] && b.start <= today) state = "late";
        const m = item.milestones?.find((x) => x.date >= b.start && x.date <= b.end);
        let hours = 0;
        if (item.logged) {
          hours = Math.round(item.logged.filter((l) => l.date >= b.start && l.date <= b.end).reduce((a, l) => a + l.hours, 0) * 10) / 10;
          state = hours > 0 ? "done" : state === "late" ? "" : state;
        }
        return { state, milestone: m ? m.label : null, hours };
      }),
    };
  });
  return { unit, buckets, rows };
}

export const CELL_FILL: Record<Exclude<CellState, "">, string> = { plan: "DBE8F8", done: "2A78D6", late: "D03B3B" };
export const MILESTONE_COLOR = "EB6834";
