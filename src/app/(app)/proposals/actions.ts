"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { estimateItems, estimates, leads, proposalItems, proposals } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { nextEstimateNumber } from "@/lib/invoicing";
import { parseLineItems } from "@/lib/lineItems";
import { flash, optInt, optStr, str, today } from "@/lib/utils";

type ProposalStatus = (typeof proposals.$inferSelect)["status"];

export async function createProposal(fd: FormData) {
  const s = await requireUser();
  const subject = str(fd, "subject");
  const relType = str(fd, "relType") === "lead" ? "lead" : "customer";
  const customerId = relType === "customer" ? optInt(fd, "customerId") : null;
  const leadId = relType === "lead" ? optInt(fd, "leadId") : null;
  if (!subject) redirect(flash("/proposals/create", "error", "Subject is required."));
  if (!customerId && !leadId) redirect(flash("/proposals/create", "error", `Choose a ${relType}.`));
  const { lines, subtotal } = parseLineItems(fd, false);

  let proposalTo = optStr(fd, "proposalTo");
  let email = optStr(fd, "email");
  if (leadId && (!proposalTo || !email)) {
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
    proposalTo ??= lead?.company || lead?.name || null;
    email ??= lead?.email ?? null;
  }

  const [p] = await db
    .insert(proposals)
    .values({
      subject, relType, customerId, leadId, proposalTo, email,
      date: str(fd, "date") || today(),
      openTill: optStr(fd, "openTill"),
      status: str(fd, "status") === "sent" ? "sent" : "draft",
      content: optStr(fd, "content"),
      subtotal, total: subtotal,
      createdBy: s.staffId,
    })
    .returning();
  if (lines.length) await db.insert(proposalItems).values(lines.map(({ taxRate: _t, ...l }) => ({ ...l, proposalId: p.id })));
  redirect(flash(`/proposals/${p.id}`, "success", "Proposal created."));
}

export async function setProposalStatus(id: number, status: ProposalStatus) {
  await requireUser();
  await db.update(proposals).set({ status }).where(eq(proposals.id, id));
  redirect(flash(`/proposals/${id}`, "success", `Proposal marked ${status}.`));
}

/** Turn a customer proposal into a draft estimate (tax can then be applied per line). */
export async function convertProposalToEstimate(id: number) {
  const s = await requireUser();
  const p = await db.query.proposals.findFirst({ where: eq(proposals.id, id), with: { items: true, lead: true } });
  if (!p) redirect("/proposals");
  const customerId = p.customerId ?? p.lead?.convertedCustomerId ?? null;
  if (!customerId) redirect(flash(`/proposals/${id}`, "error", "Convert the lead to a customer first."));
  const [e] = await db
    .insert(estimates)
    .values({
      number: await nextEstimateNumber(),
      customerId,
      date: today(),
      status: "draft",
      subtotal: p.subtotal,
      totalTax: 0,
      total: p.total,
      clientNote: `Based on proposal: ${p.subject}`,
      createdBy: s.staffId,
    })
    .returning();
  if (p.items.length) await db.insert(estimateItems).values(p.items.map((l) => ({ estimateId: e.id, itemId: l.itemId, description: l.description, qty: l.qty, rate: l.rate, taxRate: 0, order: l.order })));
  redirect(flash(`/estimates/${e.id}`, "success", `Estimate ${e.number} created from proposal.`));
}

export async function deleteProposal(id: number) {
  await requireUser();
  await db.delete(proposals).where(eq(proposals.id, id));
  redirect(flash("/proposals", "success", "Proposal deleted."));
}
