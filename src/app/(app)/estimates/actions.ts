"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { estimateItems, estimates, invoiceItems, invoices } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { nextEstimateNumber, nextInvoiceNumber } from "@/lib/invoicing";
import { parseLineItems } from "@/lib/lineItems";
import { getSettings, logActivity } from "@/lib/settings";
import { addInterval, flash, optInt, optStr, str, today } from "@/lib/utils";

type EstimateStatus = (typeof estimates.$inferSelect)["status"];

export async function createEstimate(fd: FormData) {
  const s = await requireUser();
  const customerId = optInt(fd, "customerId");
  if (!customerId) redirect(flash("/estimates/create", "error", "Choose a customer."));
  const { lines, subtotal, tax, total } = parseLineItems(fd);
  if (lines.length === 0) redirect(flash(`/estimates/create?customerId=${customerId}`, "error", "Add at least one line item."));
  const [estimate] = await db
    .insert(estimates)
    .values({
      number: await nextEstimateNumber(),
      customerId,
      currencyId: optInt(fd, "currencyId"),
      date: str(fd, "date") || today(),
      expiryDate: optStr(fd, "expiryDate"),
      status: str(fd, "status") === "sent" ? "sent" : "draft",
      subtotal,
      totalTax: tax,
      total,
      clientNote: optStr(fd, "clientNote"),
      terms: optStr(fd, "terms"),
      createdBy: s.staffId,
    })
    .returning();
  await db.insert(estimateItems).values(lines.map((l) => ({ ...l, estimateId: estimate.id })));
  redirect(flash(`/estimates/${estimate.id}`, "success", "Estimate created."));
}

export async function setEstimateStatus(id: number, status: EstimateStatus) {
  await requireUser();
  await db.update(estimates).set({ status }).where(eq(estimates.id, id));
  redirect(flash(`/estimates/${id}`, "success", `Estimate marked ${status}.`));
}

/** Copy an (accepted) estimate into a new invoice and link both ways. */
export async function convertEstimateToInvoice(id: number) {
  const s = await requireUser();
  const est = await db.query.estimates.findFirst({ where: eq(estimates.id, id), with: { items: true } });
  if (!est) redirect("/estimates");
  if (est.invoiceId) redirect(flash(`/invoices/${est.invoiceId}`, "error", "This estimate was already invoiced."));
  const settings = await getSettings();
  const number = await nextInvoiceNumber();
  const date = today();
  const invoiceId = db.transaction((tx) => {
    const inv = tx
      .insert(invoices)
      .values({
        number,
        customerId: est.customerId,
        currencyId: est.currencyId,
        date,
        dueDate: addInterval(date, "day", Number(settings.invoice_due_days) || 30),
        status: "unpaid",
        subtotal: est.subtotal,
        totalTax: est.totalTax,
        total: est.total,
        clientNote: est.clientNote,
        terms: est.terms,
        createdBy: s.staffId,
      })
      .returning()
      .get();
    if (est.items.length) {
      tx.insert(invoiceItems)
        .values(est.items.map((l) => ({ invoiceId: inv.id, itemId: l.itemId, description: l.description, qty: l.qty, rate: l.rate, taxRate: l.taxRate, order: l.order })))
        .run();
    }
    tx.update(estimates).set({ invoiceId: inv.id, status: "accepted" }).where(eq(estimates.id, id)).run();
    return inv.id;
  });
  await logActivity(`Estimate ${est.number} converted to invoice ${number}`, { staffId: s.staffId, relType: "invoice", relId: invoiceId });
  redirect(flash(`/invoices/${invoiceId}`, "success", `Invoice ${number} created from estimate.`));
}

export async function deleteEstimate(id: number) {
  await requireUser();
  await db.delete(estimates).where(eq(estimates.id, id));
  redirect(flash("/estimates", "success", "Estimate deleted."));
}
