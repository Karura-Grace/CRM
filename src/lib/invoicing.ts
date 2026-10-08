import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { estimates, invoices, payments } from "@/db/schema";
import { getSettings } from "./settings";
import { formatNumber, round2, today } from "./utils";

type InvoiceStatus = (typeof invoices.$inferSelect)["status"];

/** Next sequential number based on the highest id so far, e.g. INV-000012. */
export async function nextInvoiceNumber(): Promise<string> {
  const s = await getSettings();
  const last = await db.select({ id: invoices.id }).from(invoices).orderBy(desc(invoices.id)).limit(1);
  return formatNumber(s.invoice_prefix || "INV", (last[0]?.id ?? 0) + 1);
}

export async function nextEstimateNumber(): Promise<string> {
  const s = await getSettings();
  const last = await db.select({ id: estimates.id }).from(estimates).orderBy(desc(estimates.id)).limit(1);
  return formatNumber(s.estimate_prefix || "EST", (last[0]?.id ?? 0) + 1);
}

/** Derive status from totals + due date. Draft/cancelled are sticky (manual). */
export function deriveInvoiceStatus(inv: { status: InvoiceStatus; total: number; totalPaid: number; dueDate: string | null }): InvoiceStatus {
  if (inv.status === "draft" || inv.status === "cancelled") return inv.status;
  if (inv.total > 0 && inv.totalPaid >= inv.total - 0.005) return "paid";
  if (inv.dueDate && inv.dueDate < today()) return "overdue";
  if (inv.totalPaid > 0) return "partial";
  return "unpaid";
}

/** Recompute totalPaid from payments and refresh status. Call after any payment/total change. */
export async function recalcInvoice(invoiceId: number) {
  const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
  if (!inv) return;
  const [{ paid }] = await db
    .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));
  const totalPaid = round2(paid);
  const status = deriveInvoiceStatus({ ...inv, totalPaid });
  await db.update(invoices).set({ totalPaid, status }).where(eq(invoices.id, invoiceId));
}
