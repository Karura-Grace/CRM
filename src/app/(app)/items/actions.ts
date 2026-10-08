"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { items } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { flash, num, optStr, str } from "@/lib/utils";

const ItemSchema = z.object({
  description: z.string().min(1, "Description is required."),
  longDescription: z.string().nullable(),
  rate: z.number(),
  taxRate: z.number().min(0).max(100),
  unit: z.string().nullable(),
  groupName: z.string().nullable(),
});

const read = (fd: FormData) =>
  ItemSchema.safeParse({
    description: str(fd, "description"),
    longDescription: optStr(fd, "longDescription"),
    rate: num(fd, "rate"),
    taxRate: num(fd, "taxRate"),
    unit: optStr(fd, "unit"),
    groupName: optStr(fd, "groupName"),
  });

export async function createItem(fd: FormData) {
  await requireUser();
  const p = read(fd);
  if (!p.success) redirect(flash("/items/create", "error", p.error.issues[0].message));
  await db.insert(items).values(p.data);
  redirect(flash("/items", "success", "Item added to catalog."));
}

export async function updateItem(id: number, fd: FormData) {
  await requireUser();
  const p = read(fd);
  if (!p.success) redirect(flash(`/items/${id}/edit`, "error", p.error.issues[0].message));
  await db.update(items).set(p.data).where(eq(items.id, id));
  redirect(flash("/items", "success", "Item updated."));
}

export async function deleteItem(id: number) {
  await requireUser();
  await db.delete(items).where(eq(items.id, id));
  redirect(flash("/items", "success", "Item deleted."));
}
