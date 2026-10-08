"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { expenses, invoiceItems, invoices } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { nextInvoiceNumber } from "@/lib/invoicing";
import { getSettings, logActivity } from "@/lib/settings";
import { addInterval, bool, flash, num, optInt, optStr, round2, str, today, type Interval } from "@/lib/utils";

const ExpenseSchema = z.object({
  name: z.string().nullable(),
  categoryId: z.number({ invalid_type_error: "Choose a category." }).int(),
  customerId: z.number().int().nullable(),
  projectId: z.number().int().nullable(),
  currencyId: z.number().int().nullable(),
  amount: z.number().positive("Amount must be greater than zero."),
  tax: z.number().min(0),
  date: z.string().min(1),
  referenceNo: z.string().nullable(),
  paymentMode: z.string().nullable(),
  note: z.string().nullable(),
  billable: z.boolean(),
  isRecurring: z.boolean(),
  recurringType: z.enum(["day", "week", "month", "year"]).nullable(),
  recurringEvery: z.number().int().positive().nullable(),
  recurringNextDate: z.string().nullable(),
});

function read(fd: FormData) {
  const isRecurring = bool(fd, "isRecurring");
  const date = str(fd, "date") || today();
  const rt = (str(fd, "recurringType") || "month") as Interval;
  const every = Math.max(1, optInt(fd, "recurringEvery") ?? 1);
  return ExpenseSchema.safeParse({
    name: optStr(fd, "name"),
    categoryId: optInt(fd, "categoryId") ?? undefined,
    customerId: optInt(fd, "customerId"),
    projectId: optInt(fd, "projectId"),
    currencyId: optInt(fd, "currencyId"),
    amount: num(fd, "amount"),
    tax: num(fd, "tax"),
    date,
    referenceNo: optStr(fd, "referenceNo"),
    paymentMode: optStr(fd, "paymentMode"),
    note: optStr(fd, "note"),
    billable: bool(fd, "billable"),
    isRecurring,
    recurringType: isRecurring ? rt : null,
    recurringEvery: isRecurring ? every : null,
    recurringNextDate: isRecurring ? addInterval(date, rt, every) : null,
  });
}

export async function createExpense(fd: FormData) {
  const s = await requireUser();
  const p = read(fd);
  if (!p.success) redirect(flash("/expenses/create", "error", p.error.issues[0].message));
  await db.insert(expenses).values({ ...p.data, createdBy: s.staffId });
  redirect(flash("/expenses", "success", "Expense recorded."));
}

export async function updateExpense(id: number, fd: FormData) {
  await requireUser();
  const p = read(fd);
  if (!p.success) redirect(flash(`/expenses/${id}/edit`, "error", p.error.issues[0].message));
  await db.update(expenses).set(p.data).where(eq(expenses.id, id));
  redirect(flash("/expenses", "success", "Expense updated."));
}

export async function deleteExpense(id: number) {
  await requireUser();
  await db.delete(expenses).where(eq(expenses.id, id));
  redirect(flash("/expenses", "success", "Expense deleted."));
}

/** Rebill a billable expense: create an invoice for its customer and link the two. */
export async function invoiceExpense(id: number) {
  const s = await requireUser();
  const e = await db.query.expenses.findFirst({ where: eq(expenses.id, id), with: { category: true } });
  if (!e) redirect("/expenses");
  if (!e.customerId) redirect(flash("/expenses", "error", "Set a customer on the expense before invoicing it."));
  if (e.invoiceId) redirect(flash(`/invoices/${e.invoiceId}`, "error", "Expense already invoiced."));
  const settings = await getSettings();
  const date = today();
  const taxRate = e.amount > 0 ? round2((e.tax / e.amount) * 100) : 0;
  const [inv] = await db
    .insert(invoices)
    .values({
      number: await nextInvoiceNumber(),
      customerId: e.customerId,
      currencyId: e.currencyId,
      projectId: e.projectId,
      date,
      dueDate: addInterval(date, "day", Number(settings.invoice_due_days) || 30),
      status: "unpaid",
      subtotal: e.amount,
      totalTax: e.tax,
      total: round2(e.amount + e.tax),
      createdBy: s.staffId,
    })
    .returning();
  await db.insert(invoiceItems).values({ invoiceId: inv.id, description: `${e.category.name}${e.name ? ` — ${e.name}` : ""}${e.note ? `\n${e.note}` : ""}`, qty: 1, rate: e.amount, taxRate });
  await db.update(expenses).set({ invoiceId: inv.id }).where(eq(expenses.id, id));
  await logActivity(`Expense #${id} rebilled on ${inv.number}`, { staffId: s.staffId, relType: "invoice", relId: inv.id });
  redirect(flash(`/invoices/${inv.id}`, "success", `Invoice ${inv.number} created from expense.`));
}
