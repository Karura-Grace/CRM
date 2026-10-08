"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { bool, flash, num, optInt, optStr, str, today } from "@/lib/utils";

const ContractSchema = z
  .object({
    subject: z.string().min(1, "Subject is required."),
    customerId: z.number({ invalid_type_error: "Choose a customer." }).int(),
    typeId: z.number().int().nullable(),
    dateStart: z.string().min(1),
    dateEnd: z.string().nullable(),
    value: z.number().min(0),
    description: z.string().nullable(),
    content: z.string().nullable(),
    isExpiryNotify: z.boolean(),
    signed: z.boolean(),
  })
  .refine((c) => !c.dateEnd || c.dateEnd >= c.dateStart, { message: "End date must be after start date." });

const read = (fd: FormData) =>
  ContractSchema.safeParse({
    subject: str(fd, "subject"),
    customerId: optInt(fd, "customerId") ?? undefined,
    typeId: optInt(fd, "typeId"),
    dateStart: str(fd, "dateStart") || today(),
    dateEnd: optStr(fd, "dateEnd"),
    value: num(fd, "value"),
    description: optStr(fd, "description"),
    content: optStr(fd, "content"),
    isExpiryNotify: bool(fd, "isExpiryNotify"),
    signed: bool(fd, "signed"),
  });

export async function createContract(fd: FormData) {
  const s = await requireUser();
  const p = read(fd);
  if (!p.success) redirect(flash("/contracts/create", "error", p.error.issues[0].message));
  const [c] = await db.insert(contracts).values({ ...p.data, createdBy: s.staffId }).returning();
  redirect(flash(`/contracts/${c.id}`, "success", "Contract created."));
}

export async function updateContract(id: number, fd: FormData) {
  await requireUser();
  const p = read(fd);
  if (!p.success) redirect(flash(`/contracts/${id}/edit`, "error", p.error.issues[0].message));
  // Changing dates re-arms the expiry notice.
  await db.update(contracts).set({ ...p.data, expiryNotifiedAt: null }).where(eq(contracts.id, id));
  redirect(flash(`/contracts/${id}`, "success", "Contract updated."));
}

export async function toggleSigned(id: number) {
  await requireUser();
  const c = await db.query.contracts.findFirst({ where: eq(contracts.id, id) });
  if (c) await db.update(contracts).set({ signed: !c.signed }).where(eq(contracts.id, id));
  redirect(flash(`/contracts/${id}`, "success", c?.signed ? "Marked as not signed." : "Marked as signed."));
}

export async function deleteContract(id: number) {
  await requireUser();
  await db.delete(contracts).where(eq(contracts.id, id));
  redirect(flash("/contracts", "success", "Contract deleted."));
}
