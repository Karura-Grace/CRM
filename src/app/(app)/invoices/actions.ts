"use server";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { invoiceItems, invoices, payments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { deriveInvoiceStatus, nextInvoiceNumber, recalcInvoice } from "@/lib/invoicing";
import { parseLineItems } from "@/lib/lineItems";
import { logActivity } from "@/lib/settings";
import { bool, flash, num, optInt, optStr, str, today, type Interval } from "@/lib/utils";

type InvoiceStatus = (typeof invoices.$inferSelect)["status"];
const INTERVALS = ["day", "week", "month", "year"] as const;

function readHeader(fd: FormData) {
  const isRecurring = bool(fd, "isRecurring");
  const rt = str(fd, "recurringType");
  const recurringType = (INTERVALS as readonly string[]).includes(rt) ? (rt as Interval) : null;
  const date = str(fd, "date") || today();
  return {
    customerId: optInt(fd, "customerId"),
    currencyId: optInt(fd, "currencyId"),
    projectId: optInt(fd, "projectId"),
    date,
    dueDate: optStr(fd, "dueDate"),
    clientNote: optStr(fd, "clientNote"),
    terms: optStr(fd, "terms"),
    isRecurring: isRecurring && !!recurringType,
    recurringType: isRecurring ? recurringType : null,
    recurringEvery: isRecurring ? Math.max(1, optInt(fd, "recurringEvery") ?? 1) : null,
    recurringNextDate: isRecurring ? optStr(fd, "recurringNextDate") : null,
  };
}

export async function createInvoice(fd: FormData) {
  const s = await requireUser();
  const h = readHeader(fd);
  if (!h.customerId) redirect(flash("/invoices/create", "error", "Choose a customer."));
  const { lines, subtotal, tax, total } = parseLineItems(fd);
  if (lines.length === 0) redirect(flash(`/invoices/create?customerId=${h.customerId}`, "error", "Add at least one line item."));
  if (h.isRecurring && !h.recurringNextDate) redirect(flash("/invoices/create", "error", "Set the next recurring date."));
  const draft = str(fd, "status") === "draft";
  const base = { ...h, customerId: h.customerId, subtotal, totalTax: tax, total, totalPaid: 0 };
  const [inv] = await db
    .insert(invoices)
    .values({
      ...base,
      number: await nextInvoiceNumber(),
      status: deriveInvoiceStatus({ status: draft ? "draft" : "unpaid", total, totalPaid: 0, dueDate: h.dueDate }),
      createdBy: s.staffId,
    })
    .returning();
  await db.insert(invoiceItems).values(lines.map((l) => ({ ...l, invoiceId: inv.id })));
  redirect(flash(`/invoices/${inv.id}`, "success", `Invoice ${inv.number} created.`));
}

export async function updateInvoice(id: number, fd: FormData) {
  await requireUser();
  const h = readHeader(fd);
  if (!h.customerId) redirect(flash(`/invoices/${id}/edit`, "error", "Choose a customer."));
  const { lines, subtotal, tax, total } = parseLineItems(fd);
  if (lines.length === 0) redirect(flash(`/invoices/${id}/edit`, "error", "Add at least one line item."));
  db.transaction((tx) => {
    tx.update(invoices).set({ ...h, customerId: h.customerId!, subtotal, totalTax: tax, total }).where(eq(invoices.id, id)).run();
    tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)).run();
    tx.insert(invoiceItems).values(lines.map((l) => ({ ...l, invoiceId: id }))).run();
  });
  await recalcInvoice(id);
  redirect(flash(`/invoices/${id}`, "success", "Invoice updated."));
}

export async function setInvoiceStatus(id: number, status: InvoiceStatus) {
  await requireUser();
  // "unpaid" here means "publish/re-open": let the derivation pick unpaid/partial/paid/overdue.
  await db.update(invoices).set({ status }).where(eq(invoices.id, id));
  if (status === "unpaid") await recalcInvoice(id);
  redirect(flash(`/invoices/${id}`, "success", "Invoice status updated."));
}

export async function stopRecurring(id: number) {
  await requireUser();
  await db.update(invoices).set({ isRecurring: false, recurringNextDate: null }).where(eq(invoices.id, id));
  redirect(flash(`/invoices/${id}`, "success", "Recurring schedule stopped."));
}

export async function deleteInvoice(id: number) {
  await requireUser();
  await db.delete(invoices).where(eq(invoices.id, id));
  redirect(flash("/invoices", "success", "Invoice deleted."));
}

const PaymentSchema = z.object({
  amount: z.number().positive("Payment amount must be greater than zero."),
  paymentMode: z.enum(["bank_transfer", "mpesa", "cash", "cheque", "card"]),
  date: z.string().min(1),
  transactionId: z.string().nullable(),
  note: z.string().nullable(),
});

export async function recordPayment(invoiceId: number, fd: FormData) {
  const s = await requireUser();
  const p = PaymentSchema.safeParse({
    amount: num(fd, "amount"),
    paymentMode: str(fd, "paymentMode"),
    date: str(fd, "date") || today(),
    transactionId: optStr(fd, "transactionId"),
    note: optStr(fd, "note"),
  });
  if (!p.success) redirect(flash(`/invoices/${invoiceId}`, "error", p.error.issues[0].message));
  const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
  if (!inv) redirect("/invoices");
  if (inv.status === "draft") await db.update(invoices).set({ status: "unpaid" }).where(eq(invoices.id, invoiceId));
  await db.insert(payments).values({ ...p.data, invoiceId, recordedBy: s.staffId });
  await recalcInvoice(invoiceId);
  await logActivity(`Payment of ${p.data.amount} recorded on ${inv.number}`, { staffId: s.staffId, relType: "invoice", relId: invoiceId });
  redirect(flash(`/invoices/${invoiceId}`, "success", "Payment recorded."));
}

export async function deletePayment(invoiceId: number, paymentId: number) {
  await requireUser();
  await db.delete(payments).where(and(eq(payments.id, paymentId), eq(payments.invoiceId, invoiceId)));
  await recalcInvoice(invoiceId);
  redirect(flash(`/invoices/${invoiceId}`, "success", "Payment removed."));
}
