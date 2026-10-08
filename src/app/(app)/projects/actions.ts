"use server";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { milestones, projectMembers, projects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { flash, ints, num, optInt, optStr, str, today } from "@/lib/utils";

const ProjectSchema = z.object({
  name: z.string().min(1, "Project name is required."),
  customerId: z.number().int().nullable(),
  status: z.enum(["not_started", "in_progress", "on_hold", "finished", "cancelled"]),
  startDate: z.string().min(1),
  deadline: z.string().nullable(),
  description: z.string().nullable(),
  billingType: z.enum(["fixed_rate", "project_hours", "task_hours"]),
  progress: z.number().int().min(0).max(100),
  projectCost: z.number().min(0),
  ratePerHour: z.number().min(0),
});

const read = (fd: FormData) =>
  ProjectSchema.safeParse({
    name: str(fd, "name"),
    customerId: optInt(fd, "customerId"),
    status: str(fd, "status") || "not_started",
    startDate: str(fd, "startDate") || today(),
    deadline: optStr(fd, "deadline"),
    description: optStr(fd, "description"),
    billingType: str(fd, "billingType") || "fixed_rate",
    progress: Math.round(num(fd, "progress")),
    projectCost: num(fd, "projectCost"),
    ratePerHour: num(fd, "ratePerHour"),
  });

export async function createProject(fd: FormData) {
  const s = await requireUser();
  const p = read(fd);
  if (!p.success) redirect(flash("/projects/create", "error", p.error.issues[0].message));
  const [row] = await db.insert(projects).values({ ...p.data, createdBy: s.staffId }).returning();
  const members = new Set([s.staffId, ...ints(fd, "members")]);
  await db.insert(projectMembers).values([...members].map((staffId) => ({ projectId: row.id, staffId })));
  redirect(flash(`/projects/${row.id}`, "success", "Project created."));
}

export async function updateProject(id: number, fd: FormData) {
  await requireUser();
  const p = read(fd);
  if (!p.success) redirect(flash(`/projects/${id}/edit`, "error", p.error.issues[0].message));
  await db.update(projects).set(p.data).where(eq(projects.id, id));
  redirect(flash(`/projects/${id}`, "success", "Project updated."));
}

export async function updateProjectProgress(id: number, fd: FormData) {
  await requireUser();
  const progress = Math.min(100, Math.max(0, Math.round(num(fd, "progress"))));
  const status = str(fd, "status") as (typeof projects.$inferSelect)["status"];
  await db.update(projects).set({ progress, ...(status ? { status } : {}) }).where(eq(projects.id, id));
  redirect(flash(`/projects/${id}`, "success", "Progress updated."));
}

export async function deleteProject(id: number) {
  await requireUser();
  await db.delete(projects).where(eq(projects.id, id));
  redirect(flash("/projects", "success", "Project deleted."));
}

export async function addProjectMember(projectId: number, fd: FormData) {
  await requireUser();
  const staffId = optInt(fd, "staffId");
  if (staffId) await db.insert(projectMembers).values({ projectId, staffId }).onConflictDoNothing();
  redirect(flash(`/projects/${projectId}`, "success", "Member added."));
}

export async function removeProjectMember(projectId: number, staffId: number) {
  await requireUser();
  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.staffId, staffId)));
  redirect(flash(`/projects/${projectId}`, "success", "Member removed."));
}

export async function addMilestone(projectId: number, fd: FormData) {
  await requireUser();
  const name = str(fd, "name");
  if (!name) redirect(flash(`/projects/${projectId}`, "error", "Milestone name is required."));
  await db.insert(milestones).values({ projectId, name, dueDate: optStr(fd, "dueDate"), description: optStr(fd, "description") });
  redirect(flash(`/projects/${projectId}`, "success", "Milestone added."));
}

export async function deleteMilestone(projectId: number, milestoneId: number) {
  await requireUser();
  await db.delete(milestones).where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)));
  redirect(flash(`/projects/${projectId}`, "success", "Milestone removed."));
}
