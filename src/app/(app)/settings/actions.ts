"use server";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { currencies, leadStatuses, settings, ticketStatuses } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { SETTING_KEYS } from "@/lib/settings";
import { flash } from "@/lib/utils";
import { isLookupKind, LOOKUPS } from "./lookups";

export async function saveCompanySettings(fd: FormData) {
  await requireAdmin();
  for (const key of SETTING_KEYS) {
    if (!fd.has(key)) continue;
    const value = String(fd.get(key) ?? "").trim();
    await db.insert(settings).values({ name: key, value }).onConflictDoUpdate({ target: settings.name, set: { value } });
  }
  redirect(flash("/settings", "success", "Settings saved."));
}

export async function addLookup(kind: string, fd: FormData) {
  await requireAdmin();
  if (!isLookupKind(kind)) redirect(flash("/settings", "error", "Unknown list."));
  const cfg = LOOKUPS[kind];
  const values: Record<string, string | number> = {};
  for (const f of cfg.fields) {
    const raw = String(fd.get(f.name) ?? "").trim();
    if ("required" in f && f.required && !raw) redirect(flash(`/settings#${kind}`, "error", `${f.label} is required.`));
    if (raw === "") continue;
    values[f.name] = f.type === "number" ? Number(raw) || 0 : raw;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.insert(cfg.table as any).values(values);
  redirect(flash(`/settings#${kind}`, "success", `${cfg.title}: added.`));
}

export async function removeLookup(kind: string, id: number) {
  await requireAdmin();
  if (!isLookupKind(kind)) redirect("/settings");
  const cfg = LOOKUPS[kind];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = cfg.table as any;
    await db.delete(t).where(eq(t.id, id));
  } catch {
    redirect(flash(`/settings#${kind}`, "error", `That entry is still in use and cannot be removed.`));
  }
  redirect(flash(`/settings#${kind}`, "success", `${cfg.title}: removed.`));
}

export async function setDefault(kind: "currencies" | "leadStatuses" | "ticketStatuses", id: number) {
  await requireAdmin();
  const t = kind === "currencies" ? currencies : kind === "leadStatuses" ? leadStatuses : ticketStatuses;
  await db.update(t).set({ isDefault: sql`(${t.id} = ${id})` });
  await db.update(t).set({ isDefault: true }).where(eq(t.id, id));
  redirect(flash(`/settings#${kind}`, "success", "Default updated."));
}
