import type { GanttMode, GanttRow } from "@/lib/gantt-types";
/**
 * Report contract. Every report returns the same shape, so one set of exporters
 * (CSV / Excel / Word) and one screen renderer serve them all.
 */
export type ColType = "text" | "money" | "number" | "hours" | "percent" | "date" | "datetime";
export interface Col { key: string; label: string; type?: ColType; width?: number }
export type Row = Record<string, string | number | null | undefined>;
export type ChartFormat = "money" | "number" | "hours" | "percent";
export interface ChartSpec {
  type: "bar" | "hbar";
  title: string;
  categories: string[];
  series: { name: string; values: number[] }[];
  format: ChartFormat;
}
/** Optional schedule rendered as a Gantt sheet (Excel) / Gantt table (Word). */
export interface TimelineItem {
  label: string; level?: 0 | 1; start?: string | null; end?: string | null; progress?: number | null;
  finished?: boolean; overdue?: boolean; milestones?: { date: string; label: string }[];
  /** Days with logged time (time Gantt): shaded dark with the hours written in. */
  logged?: { date: string; hours: number }[];
}
export interface ReportResult {
  title: string;
  subtitle?: string;
  columns: Col[];
  rows: Row[];
  totals?: Row;
  summary?: { label: string; value: string }[];
  charts?: ChartSpec[];
  notes?: string[];
  currency: string;
  timeline?: { today: string; items: TimelineItem[] };
  /** On-screen Gantt (same rows the timeline was built from). */
  gantt?: { mode: GanttMode; rows: GanttRow[]; from?: string; to?: string };
}
export type FilterKey = "dateRange" | "asOf" | "customer" | "customerRequired" | "staff" | "project" | "invoiceStatus" | "leadStatus" | "tag" | "segment" | "prospectStatus" | "reminderStatus";
export type Params = Record<string, string | undefined>;
export interface ReportDef {
  key: string;
  title: string;
  description: string;
  category: "Sales & finance" | "Pipeline" | "Delivery" | "Operations" | "Lists & exports";
  filters: FilterKey[];
  /** Default date range when the report takes one. */
  defaultRange?: "12m" | "ytd" | "90d" | "30d";
  run(p: Params): Promise<ReportResult>;
}
