"use server";
import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { bool, flash, optInt, optStr, str } from "@/lib/utils";

const StaffSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Enter a valid email."),
  phoneNumber: z.string().nullable(),
  role: z.enum(["admin", "staff"]),
  departmentId: z.number().int().nullable(),
  active: z.boolean(),
});

const read = (fd: FormData) =>
  StaffSchema.safeParse({
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    email: str(fd, "email").toLowerCase(),
    phoneNumber: optStr(fd, "phoneNumber"),
    role: str(fd, "role") === "admin" ? "admin" : "staff",
    departmentId: optInt(fd, "departmentId"),
    active: bool(fd, "active"),
  });

export async function createStaff(fd: FormData) {
  await requireAdmin();
  const p = read(fd);
  if (!p.success) redirect(flash("/staff/create", "error", p.error.issues[0].message));
  const password = str(fd, "password");
  if (password.length < 8) redirect(flash("/staff/create", "error", "Password must be at least 8 characters."));
  const exists = await db.query.staff.findFirst({ where: eq(staff.email, p.data.email) });
  if (exists) redirect(flash("/staff/create", "error", "A staff member with that email already exists."));
  await db.insert(staff).values({ ...p.data, passwordHash: await hashPassword(password) });
  redirect(flash("/staff", "success", "Staff member created."));
}

export async function updateStaff(id: number, fd: FormData) {
  const me = await requireAdmin();
  const p = read(fd);
  if (!p.success) redirect(flash(`/staff/${id}/edit`, "error", p.error.issues[0].message));
  if (id === me.staffId && (p.data.role !== "admin" || !p.data.active)) redirect(flash(`/staff/${id}/edit`, "error", "You cannot demote or deactivate your own account."));
  const clash = await db.query.staff.findFirst({ where: and(eq(staff.email, p.data.email), ne(staff.id, id)) });
  if (clash) redirect(flash(`/staff/${id}/edit`, "error", "Another staff member uses that email."));
  const password = str(fd, "password");
  if (password && password.length < 8) redirect(flash(`/staff/${id}/edit`, "error", "New password must be at least 8 characters."));
  await db.update(staff).set({ ...p.data, ...(password ? { passwordHash: await hashPassword(password) } : {}) }).where(eq(staff.id, id));
  redirect(flash("/staff", "success", "Staff member updated."));
}

export async function toggleStaffActive(id: number) {
  const me = await requireAdmin();
  if (id === me.staffId) redirect(flash("/staff", "error", "You cannot deactivate yourself."));
  const row = await db.query.staff.findFirst({ where: eq(staff.id, id) });
  if (row) await db.update(staff).set({ active: !row.active }).where(eq(staff.id, id));
  redirect(flash("/staff", "success", row?.active ? "Account deactivated." : "Account reactivated."));
}

export async function deleteStaff(id: number) {
  const me = await requireAdmin();
  if (id === me.staffId) redirect(flash("/staff", "error", "You cannot delete yourself."));
  try {
    await db.delete(staff).where(eq(staff.id, id));
  } catch {
    redirect(flash("/staff", "error", "This person has history (notes, comments, replies, timers). Deactivate the account instead."));
  }
  redirect(flash("/staff", "success", "Staff member deleted."));
}
