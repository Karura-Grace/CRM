/**
 * Scheduled-job logic (no Next.js imports, so it runs from both scripts/cron.ts and /api/cron).
 * Idempotent: only acts on rows whose date has arrived, and advances/stamps them immediately.
 */
import { and, eq, gte, inArray, isNotNull, isNull, lt, lte } from "drizzle-orm";
import { db } from "@/db";
import { contracts, expenses, invoiceItems, invoices, prospectRuns } from "@/db/schema";
import { aiConfigured, executeRun, sweepStaleRuns } from "./prospecting";
import { deriveInvoiceStatus, nextInvoiceNumber } from "./invoicing";
import { getSettings, logActivity } from "./settings";
import { addInterval, today } from "./utils";

/** Generate due recurring invoices. Returns the numbers generated. */
export async function runRecurringInvoices(asOf = today()): Promise<string[]> {
  const generated: string[] = [];
  const settings = await getSettings();
  const dueDays = Number(settings.invoice_due_days) || 30;
  const due = await db.query.invoices.findMany({
    where: and(eq(invoices.isRecurring, true), isNotNull(invoices.recurringNextDate), lte(invoices.recurringNextDate, asOf)),
    with: { items: true },
  });
  for (const tpl of due) {
    if (!tpl.recurringType || !tpl.recurringEvery || !tpl.recurringNextDate) continue;
    // Catch up if the job missed several cycles, one invoice per cycle.
    let next = tpl.recurringNextDate;
    while (next <= asOf) {
      const date = next;
      const number = await nextInvoiceNumber();
      const advanced = addInterval(next, tpl.recurringType, tpl.recurringEvery);
      db.transaction((tx) => {
        const inv = tx
          .insert(invoices)
          .values({
            number,
            customerId: tpl.customerId,
            currencyId: tpl.currencyId,
            projectId: tpl.projectId,
            date,
            dueDate: addInterval(date, "day", dueDays),
            status: deriveInvoiceStatus({ status: "unpaid", total: tpl.total, totalPaid: 0, dueDate: addInterval(date, "day", dueDays) }),
            subtotal: tpl.subtotal,
            totalTax: tpl.totalTax,
            total: tpl.total,
            clientNote: tpl.clientNote,
            terms: tpl.terms,
            recurringParentId: tpl.id,
            createdBy: tpl.createdBy,
          })
          .returning()
          .get();
        if (tpl.items.length) {
          tx.insert(invoiceItems)
            .values(tpl.items.map((l) => ({ invoiceId: inv.id, itemId: l.itemId, description: l.description, qty: l.qty, rate: l.rate, taxRate: l.taxRate, order: l.order })))
            .run();
        }
        // Advance immediately so a re-run never double-generates.
        tx.update(invoices).set({ recurringNextDate: advanced }).where(eq(invoices.id, tpl.id)).run();
      });
      await logActivity(`Recurring invoice ${number} generated from ${tpl.number}`, { relType: "invoice", relId: tpl.id });
      generated.push(number);
      next = advanced;
    }
  }
  return generated;
}

/** Log upcoming-expiry notices (≤30 days) once per contract. Hand-off point for email. */
export async function runContractExpiryNotices(asOf = today()): Promise<string[]> {
  const horizon = addInterval(asOf, "day", 30);
  const rows = await db.query.contracts.findMany({
    where: and(eq(contracts.isExpiryNotify, true), isNull(contracts.expiryNotifiedAt), isNotNull(contracts.dateEnd), gte(contracts.dateEnd, asOf), lte(contracts.dateEnd, horizon)),
    with: { customer: true },
  });
  const out: string[] = [];
  for (const c of rows) {
    const msg = `Contract "${c.subject}" with ${c.customer.company} expires on ${c.dateEnd}`;
    await logActivity(msg, { relType: "contract", relId: c.id });
    // TODO(email): send notification here (see docs §8.10), e.g. await sendMail({...})
    await db.update(contracts).set({ expiryNotifiedAt: new Date().toISOString() }).where(eq(contracts.id, c.id));
    out.push(msg);
  }
  return out;
}

/** Copy due recurring expenses forward (same pattern as recurring invoices). */
export async function runRecurringExpenses(asOf = today()): Promise<number> {
  let created = 0;
  const due = await db.query.expenses.findMany({
    where: and(eq(expenses.isRecurring, true), isNotNull(expenses.recurringNextDate), lte(expenses.recurringNextDate, asOf)),
  });
  for (const e of due) {
    if (!e.recurringType || !e.recurringEvery || !e.recurringNextDate) continue;
    let next = e.recurringNextDate;
    while (next <= asOf) {
      const advanced = addInterval(next, e.recurringType, e.recurringEvery);
      const { id: _id, createdAt: _c, invoiceId: _i, ...rest } = e;
      db.transaction((tx) => {
        tx.insert(expenses).values({ ...rest, date: next, isRecurring: false, recurringType: null, recurringEvery: null, recurringNextDate: null }).run();
        tx.update(expenses).set({ recurringNextDate: advanced }).where(eq(expenses.id, e.id)).run();
      });
      created++;
      next = advanced;
    }
  }
  if (created) await logActivity(`${created} recurring expense(s) recorded`);
  return created;
}

/** Flip unpaid/partial invoices past their due date to "overdue". */
export async function runOverdueInvoices(asOf = today()): Promise<number> {
  const rows = await db
    .update(invoices)
    .set({ status: "overdue" })
    .where(and(inArray(invoices.status, ["unpaid", "partial"]), isNotNull(invoices.dueDate), lt(invoices.dueDate, asOf)))
    .returning({ id: invoices.id });
  return rows.length;
}

/** Optional daily AI prospecting run (Settings → AI prospecting → run automatically). */
export async function runDailyProspecting(): Promise<string> {
  const s = await getSettings();
  if (s.ai_auto_daily !== "1") return "off";
  if (!aiConfigured()) return "skipped (ANTHROPIC_API_KEY not set)";
  await sweepStaleRuns();
  const [run] = await db.insert(prospectRuns).values({ mode: "both", status: "running", sample: process.env.AI_MOCK === "1" }).returning();
  await executeRun(run.id);
  const done = await db.query.prospectRuns.findFirst({ where: eq(prospectRuns.id, run.id) });
  return done?.status === "done" ? `${done.added} new prospect(s)` : `failed: ${done?.error ?? "unknown"}`;
}

export async function runAllJobs() {
  const overdueMarked = await runOverdueInvoices();
  const invoicesGenerated = await runRecurringInvoices();
  const expiryNotices = await runContractExpiryNotices();
  const expensesCreated = await runRecurringExpenses();
  const prospecting = await runDailyProspecting();
  return { overdueMarked, invoicesGenerated, expiryNotices, expensesCreated, prospecting };
}
