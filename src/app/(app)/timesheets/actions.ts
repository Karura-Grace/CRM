"use server";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { invoiceItems, invoices, tasks, taskTimers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { nextInvoiceNumber } from "@/lib/invoicing";
import { getSettings, logActivity } from "@/lib/settings";
import { entryHours, isBillable, rateFor } from "@/lib/timesheets";
import { addInterval, flash, optInt, optStr, round2, str, today } from "@/lib/utils";

/** Only allow redirects back into the app. */
const safeBack = (v: string, fallback: string) => (v.startsWith("/") && !v.startsWith("//") ? v : fallback);

const LogSchema = z.object({
  taskId: z.number({ invalid_type_error: "Choose a task." }).int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date."),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Enter a start time like 09:00."),
  hours: z.number().positive("Hours must be greater than zero.").max(24, "An entry can't be longer than 24 hours."),
  note: z.string().nullable(),
});

/** Manual time entry ("log time"). Admins may log for anyone; staff log for themselves. */
export async function logTime(fd: FormData) {
  const s = await requireUser();
  const back = safeBack(str(fd, "back"), "/timesheets");
  const p = LogSchema.safeParse({
    taskId: optInt(fd, "taskId") ?? undefined,
    date: str(fd, "date") || today(),
    start: str(fd, "start") || "09:00",
    hours: Number(str(fd, "hours").replace(",", ".")),
    note: optStr(fd, "note"),
  });
  if (!p.success) redirect(flash(back, "error", p.error.issues[0].message));
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, p.data.taskId) });
  if (!task) redirect(flash(back, "error", "That task no longer exists."));
  const staffId = s.role === "admin" ? optInt(fd, "staffId") ?? s.staffId : s.staffId;
  const start = new Date(`${p.data.date}T${p.data.start}:00`);
  const end = new Date(start.getTime() + p.data.hours * 3_600_000);
  await db.insert(taskTimers).values({ taskId: task.id, staffId, startTime: start.toISOString(), endTime: end.toISOString(), note: p.data.note });
  redirect(flash(back, "success", `${p.data.hours} h logged on “${task.name}”.`));
}

export async function deleteTimeEntry(id: number, back: string) {
  const s = await requireUser();
  const e = await db.query.taskTimers.findFirst({ where: eq(taskTimers.id, id) });
  const target = safeBack(back, "/timesheets");
  if (!e) redirect(target);
  if (e.invoiceId) redirect(flash(target, "error", "This time has already been invoiced. Delete or edit the invoice first."));
  if (s.role !== "admin" && e.staffId !== s.staffId) redirect(flash(target, "error", "You can only delete your own time entries."));
  await db.delete(taskTimers).where(eq(taskTimers.id, id));
  redirect(flash(target, "success", "Time entry deleted."));
}

/**
 * Bill a project's unbilled, billable time: one invoice line per task (hours × rate),
 * then stamp each entry with the invoice id so it can't be billed twice.
 */
export async function invoiceProjectTime(projectId: number) {
  const s = await requireUser();
  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, projectId),
    with: { tasks: { with: { timers: { where: and(isNull(taskTimers.invoiceId), isNotNull(taskTimers.endTime)) } } } },
  });
  if (!project) redirect("/projects");
  if (!project.customerId) redirect(flash(`/projects/${projectId}`, "error", "Link this project to a customer before invoicing time."));

  const settings = await getSettings();
  const taxRate = Number(settings.default_tax_rate) || 0;
  const lines: { description: string; qty: number; rate: number; taxRate: number; order: number }[] = [];
  const billedIds: number[] = [];
  for (const t of project.tasks) {
    if (!isBillable(t, project)) continue;
    const hours = round2(t.timers.reduce((a, e) => a + entryHours(e), 0));
    if (hours <= 0) continue;
    lines.push({ description: `${t.name} — ${hours} h`, qty: hours, rate: rateFor(t, project), taxRate, order: lines.length });
    billedIds.push(...t.timers.map((e) => e.id));
  }
  if (lines.length === 0) redirect(flash(`/projects/${projectId}`, "error", "No unbilled billable time on this project. Mark tasks billable with an hourly rate, or bill the project by hours."));

  let subtotal = 0, tax = 0;
  for (const l of lines) { subtotal += l.qty * l.rate; tax += (l.qty * l.rate * l.taxRate) / 100; }
  subtotal = round2(subtotal); tax = round2(tax);
  const date = today();
  const number = await nextInvoiceNumber();
  const invoiceId = db.transaction((tx) => {
    const inv = tx
      .insert(invoices)
      .values({
        number, customerId: project.customerId!, projectId, date,
        dueDate: addInterval(date, "day", Number(settings.invoice_due_days) || 30),
        status: "draft", subtotal, totalTax: tax, total: round2(subtotal + tax),
        clientNote: `Time billed for project: ${project.name}`, terms: settings.invoice_terms || null, createdBy: s.staffId,
      })
      .returning()
      .get();
    tx.insert(invoiceItems).values(lines.map((l) => ({ ...l, invoiceId: inv.id }))).run();
    tx.update(taskTimers).set({ invoiceId: inv.id }).where(inArray(taskTimers.id, billedIds)).run();
    return inv.id;
  });
  await logActivity(`Invoice ${number} created from ${billedIds.length} time entries on ${project.name}`, { staffId: s.staffId, relType: "invoice", relId: invoiceId });
  redirect(flash(`/invoices/${invoiceId}`, "success", `Draft invoice ${number} created from project time. Review it, then mark it as sent.`));
}
