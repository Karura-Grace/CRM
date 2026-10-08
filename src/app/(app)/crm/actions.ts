"use server";
/** Cross-module CRM actions: tags, reminders, logged interactions, saved segments. */
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { activityLog, reminders, savedSegments, taggings, tags } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { filtersFromForm } from "@/lib/segments";
import { flash, optInt, str, today } from "@/lib/utils";

const safeBack = (v: string, fb = "/dashboard") => (v.startsWith("/") && !v.startsWith("//") ? v : fb);
const TAGGABLE = ["customer", "lead"] as const;
type Taggable = (typeof TAGGABLE)[number];

/* ── Tags ── */
export async function addTag(relType: Taggable, relId: number, fd: FormData) {
  await requireUser();
  const back = safeBack(str(fd, "back"));
  if (!TAGGABLE.includes(relType)) redirect(back);
  let tagId = optInt(fd, "tagId");
  const name = str(fd, "newTag");
  if (!tagId && name) {
    const existing = await db.query.tags.findFirst({ where: eq(tags.name, name) });
    tagId = existing?.id ?? (await db.insert(tags).values({ name, color: str(fd, "color") || "#1d5cf1" }).returning())[0].id;
  }
  if (!tagId) redirect(flash(back, "error", "Pick a tag or type a new one."));
  await db.insert(taggings).values({ tagId, relType, relId }).onConflictDoNothing();
  redirect(flash(back, "success", "Tag added."));
}
export async function removeTag(relType: Taggable, relId: number, tagId: number, back: string) {
  await requireUser();
  await db.delete(taggings).where(and(eq(taggings.tagId, tagId), eq(taggings.relType, relType), eq(taggings.relId, relId)));
  redirect(flash(safeBack(back), "success", "Tag removed."));
}

/* ── Reminders ── */
export async function addReminder(relType: string, relId: number, fd: FormData) {
  const s = await requireUser();
  const back = safeBack(str(fd, "back"));
  const description = str(fd, "description");
  const remindAt = str(fd, "remindAt") || today();
  if (!description) redirect(flash(back, "error", "Describe the follow-up."));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(remindAt)) redirect(flash(back, "error", "Pick a valid date."));
  const staffId = s.role === "admin" ? optInt(fd, "staffId") ?? s.staffId : s.staffId;
  await db.insert(reminders).values({ relType, relId, staffId, remindAt, description, createdBy: s.staffId });
  revalidatePath("/", "layout"); // header badge lives in the shared layout
  redirect(flash(back, "success", `Reminder set for ${remindAt}.`));
}
export async function setReminderDone(id: number, done: boolean, back: string) {
  const s = await requireUser();
  const r = await db.query.reminders.findFirst({ where: eq(reminders.id, id) });
  if (r && (s.role === "admin" || r.staffId === s.staffId)) await db.update(reminders).set({ isDone: done }).where(eq(reminders.id, id));
  revalidatePath("/", "layout");
  redirect(flash(safeBack(back), "success", done ? "Reminder completed." : "Reminder re-opened."));
}
export async function deleteReminder(id: number, back: string) {
  const s = await requireUser();
  const r = await db.query.reminders.findFirst({ where: eq(reminders.id, id) });
  if (r && (s.role === "admin" || r.staffId === s.staffId || r.createdBy === s.staffId)) await db.delete(reminders).where(eq(reminders.id, id));
  revalidatePath("/", "layout");
  redirect(flash(safeBack(back), "success", "Reminder deleted."));
}

/* ── Interactions (calls, meetings, emails, notes) ── */
const KINDS = ["call", "meeting", "email", "note"];
export async function logInteraction(relType: "customer" | "lead", relId: number, fd: FormData) {
  const s = await requireUser();
  const back = safeBack(str(fd, "back"));
  const description = str(fd, "description");
  const kind = KINDS.includes(str(fd, "kind")) ? str(fd, "kind") : "note";
  if (!description) redirect(flash(back, "error", "Add a short summary of the interaction."));
  const date = str(fd, "date");
  await db.insert(activityLog).values({ relType, relId, kind, description, staffId: s.staffId, ...(date ? { date: `${date} 12:00:00` } : {}) });
  redirect(flash(back, "success", `${kind[0].toUpperCase() + kind.slice(1)} logged.`));
}

/* ── Saved segments ── */
export async function saveSegment(fd: FormData) {
  const s = await requireUser();
  const name = str(fd, "name");
  const entity = str(fd, "entity") as "customers" | "contacts" | "leads";
  if (!name) redirect(flash("/segments", "error", "Give the segment a name."));
  if (!["customers", "contacts", "leads"].includes(entity)) redirect("/segments");
  const [seg] = await db.insert(savedSegments).values({ name, entity, filters: JSON.stringify(filtersFromForm(fd)), createdBy: s.staffId }).returning();
  redirect(flash(`/segments?id=${seg.id}`, "success", `Segment “${name}” saved.`));
}
export async function deleteSegment(id: number) {
  await requireUser();
  await db.delete(savedSegments).where(eq(savedSegments.id, id));
  redirect(flash("/segments", "success", "Segment deleted."));
}
