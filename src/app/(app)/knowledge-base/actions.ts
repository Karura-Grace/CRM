"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { kbArticles, kbGroups } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { bool, flash, optInt, optStr, slugify, str } from "@/lib/utils";

type Visibility = (typeof kbArticles.$inferSelect)["visibility"];
const vis = (v: string): Visibility => (v === "staff" || v === "customers" ? v : "everyone");

export async function createGroup(fd: FormData) {
  await requireUser();
  const name = str(fd, "name");
  if (!name) redirect(flash("/knowledge-base", "error", "Group name is required."));
  await db.insert(kbGroups).values({ name, description: optStr(fd, "description"), color: str(fd, "color") || "#1d5cf1" });
  redirect(flash("/knowledge-base", "success", "Group created."));
}

export async function deleteGroup(id: number) {
  await requireUser();
  await db.delete(kbGroups).where(eq(kbGroups.id, id)); // articles become ungrouped (set null)
  redirect(flash("/knowledge-base", "success", "Group deleted; its articles are now ungrouped."));
}

export async function createArticle(fd: FormData) {
  const s = await requireUser();
  const subject = str(fd, "subject");
  if (!subject) redirect(flash("/knowledge-base/create", "error", "Subject is required."));
  const [a] = await db
    .insert(kbArticles)
    .values({ subject, slug: slugify(subject), groupId: optInt(fd, "groupId"), description: str(fd, "description"), visibility: vis(str(fd, "visibility")), active: true, createdBy: s.staffId })
    .returning();
  redirect(flash(`/knowledge-base/${a.id}`, "success", "Article published."));
}

export async function updateArticle(id: number, fd: FormData) {
  await requireUser();
  const subject = str(fd, "subject");
  if (!subject) redirect(flash(`/knowledge-base/${id}/edit`, "error", "Subject is required."));
  await db
    .update(kbArticles)
    .set({ subject, slug: slugify(subject), groupId: optInt(fd, "groupId"), description: str(fd, "description"), visibility: vis(str(fd, "visibility")), active: bool(fd, "active") })
    .where(eq(kbArticles.id, id));
  redirect(flash(`/knowledge-base/${id}`, "success", "Article updated."));
}

export async function deleteArticle(id: number) {
  await requireUser();
  await db.delete(kbArticles).where(eq(kbArticles.id, id));
  redirect(flash("/knowledge-base", "success", "Article deleted."));
}
