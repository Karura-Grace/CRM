"use server";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { taskAssignees, taskComments, tasks, taskTimers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { bool, flash, ints, num, optInt, optStr, str } from "@/lib/utils";

type TaskStatus = (typeof tasks.$inferSelect)["status"];

const TaskSchema = z.object({
  name: z.string().min(1, "Task name is required."),
  description: z.string().nullable(),
  projectId: z.number().int().nullable(),
  milestoneId: z.number().int().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["not_started", "in_progress", "testing", "awaiting_feedback", "finished"]),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  billable: z.boolean(),
  hourlyRate: z.number().min(0),
});

const read = (fd: FormData) =>
  TaskSchema.safeParse({
    name: str(fd, "name"),
    description: optStr(fd, "description"),
    projectId: optInt(fd, "projectId"),
    milestoneId: optInt(fd, "milestoneId"),
    priority: str(fd, "priority") || "medium",
    status: str(fd, "status") || "not_started",
    startDate: optStr(fd, "startDate"),
    dueDate: optStr(fd, "dueDate"),
    billable: bool(fd, "billable"),
    hourlyRate: num(fd, "hourlyRate"),
  });

export async function createTask(fd: FormData) {
  const s = await requireUser();
  const back = str(fd, "back") || "/tasks/create";
  const p = read(fd);
  if (!p.success) redirect(flash(back, "error", p.error.issues[0].message));
  const [t] = await db.insert(tasks).values({ ...p.data, createdBy: s.staffId }).returning();
  const assignees = ints(fd, "assignees");
  if (assignees.length) await db.insert(taskAssignees).values(assignees.map((staffId) => ({ taskId: t.id, staffId })));
  redirect(flash(`/tasks/${t.id}`, "success", "Task created."));
}

export async function updateTask(id: number, fd: FormData) {
  await requireUser();
  const p = read(fd);
  if (!p.success) redirect(flash(`/tasks/${id}/edit`, "error", p.error.issues[0].message));
  await db.update(tasks).set({ ...p.data, dateFinished: p.data.status === "finished" ? new Date().toISOString() : null }).where(eq(tasks.id, id));
  redirect(flash(`/tasks/${id}`, "success", "Task updated."));
}

export async function setTaskStatus(id: number, status: TaskStatus, back?: string) {
  await requireUser();
  await db.update(tasks).set({ status, dateFinished: status === "finished" ? new Date().toISOString() : null }).where(eq(tasks.id, id));
  redirect(flash(back ?? `/tasks/${id}`, "success", "Task status updated."));
}

export async function deleteTask(id: number) {
  await requireUser();
  const t = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  await db.delete(tasks).where(eq(tasks.id, id));
  redirect(flash(t?.projectId ? `/projects/${t.projectId}` : "/tasks", "success", "Task deleted."));
}

export async function addAssignee(taskId: number, fd: FormData) {
  await requireUser();
  const staffId = optInt(fd, "staffId");
  if (staffId) await db.insert(taskAssignees).values({ taskId, staffId }).onConflictDoNothing();
  redirect(flash(`/tasks/${taskId}`, "success", "Assignee added."));
}

export async function removeAssignee(taskId: number, staffId: number) {
  await requireUser();
  await db.delete(taskAssignees).where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.staffId, staffId)));
  redirect(flash(`/tasks/${taskId}`, "success", "Assignee removed."));
}

export async function addTaskComment(taskId: number, fd: FormData) {
  const s = await requireUser();
  const content = str(fd, "content");
  if (!content) redirect(flash(`/tasks/${taskId}`, "error", "Comment cannot be empty."));
  await db.insert(taskComments).values({ taskId, staffId: s.staffId, content });
  redirect(flash(`/tasks/${taskId}`, "success", "Comment posted."));
}

export async function deleteTaskComment(taskId: number, commentId: number) {
  const s = await requireUser();
  const where = s.role === "admin" ? eq(taskComments.id, commentId) : and(eq(taskComments.id, commentId), eq(taskComments.staffId, s.staffId));
  await db.delete(taskComments).where(where);
  redirect(flash(`/tasks/${taskId}`, "success", "Comment deleted."));
}

export async function startTimer(taskId: number) {
  const s = await requireUser();
  const running = await db.query.taskTimers.findFirst({ where: and(eq(taskTimers.staffId, s.staffId), isNull(taskTimers.endTime)) });
  if (running) redirect(flash(`/tasks/${taskId}`, "error", "You already have a timer running — stop it first."));
  await db.insert(taskTimers).values({ taskId, staffId: s.staffId, startTime: new Date().toISOString() });
  redirect(flash(`/tasks/${taskId}`, "success", "Timer started."));
}

export async function stopTimer(taskId: number, fd: FormData) {
  const s = await requireUser();
  await db
    .update(taskTimers)
    .set({ endTime: new Date().toISOString(), note: optStr(fd, "note") })
    .where(and(eq(taskTimers.taskId, taskId), eq(taskTimers.staffId, s.staffId), isNull(taskTimers.endTime)));
  redirect(flash(`/tasks/${taskId}`, "success", "Time logged."));
}
