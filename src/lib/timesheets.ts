/** Timesheet helpers shared by the Timesheets, Task and Project screens. */
import { round2 } from "./utils";

export interface TimeEntryLike { startTime: string; endTime: string | null }

/** Hours for one entry (0 while a timer is still running). */
export function entryHours(e: TimeEntryLike): number {
  if (!e.endTime) return 0;
  const ms = new Date(e.endTime).getTime() - new Date(e.startTime).getTime();
  return ms > 0 ? ms / 3_600_000 : 0;
}

export function sumHours(entries: TimeEntryLike[]): number {
  return round2(entries.reduce((a, e) => a + entryHours(e), 0));
}

/**
 * Hourly rate for an entry: the task's own rate if set, otherwise the project's
 * rate per hour. Fixed-rate projects only bill time on tasks marked billable with a rate.
 */
export function rateFor(task: { billable: boolean; hourlyRate: number }, project?: { billingType: string; ratePerHour: number } | null): number {
  if (task.hourlyRate > 0) return task.hourlyRate;
  if (project && project.billingType !== "fixed_rate" && project.ratePerHour > 0) return project.ratePerHour;
  return 0;
}

/** Billable = task marked billable, or project billed by hours (and a rate is known). */
export function isBillable(task: { billable: boolean; hourlyRate: number }, project?: { billingType: string; ratePerHour: number } | null): boolean {
  const billableTask = task.billable || (project ? project.billingType !== "fixed_rate" : false);
  return billableTask && rateFor(task, project) > 0;
}

export const fmtHours = (h: number) => `${h.toFixed(2)} h`;
