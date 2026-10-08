/**
 * Gantt data contract shared by the server builders (src/lib/gantt.ts) and the
 * client renderer (src/components/Gantt.tsx). Dates are YYYY-MM-DD strings.
 */
export interface GanttMilestone { date: string; label: string }
/** One day of logged time drawn on a row (timesheet Gantt). */
export interface GanttBlock { date: string; hours: number; note?: string }
export interface GanttRow {
  id: string;
  label: string;
  /** Secondary line under the label (customer, project, people…). */
  sub?: string;
  href?: string;
  /** 0 = parent (project), 1 = child (task) — children are indented. */
  level?: 0 | 1;
  /** Planned window. Missing start → start = end; missing end → end = start. */
  start?: string | null;
  end?: string | null;
  /** 0–100; drawn as a darker fill inside the planned bar. */
  progress?: number | null;
  status: string;
  finished?: boolean;
  /** Past its end date and not finished → red overrun stub up to today. */
  overdue?: boolean;
  milestones?: GanttMilestone[];
  blocks?: GanttBlock[];
  /** Total logged hours, shown in tooltip and table. */
  hours?: number;
}
export type GanttScale = "day" | "week" | "month";
export type GanttMode = "plan" | "time";
