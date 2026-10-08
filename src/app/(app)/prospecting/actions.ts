"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { leadActivityLog, leads, leadSources, leadStatuses, prospects, reminders, taggings, tags } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { aiConfigured, startRun, type RunMode } from "@/lib/prospecting";
import { addInterval, flash, str, today } from "@/lib/utils";

export async function runProspecting(fd: FormData) {
  const s = await requireUser();
  if (!aiConfigured()) redirect(flash("/prospecting", "error", "AI is not configured: set ANTHROPIC_API_KEY on the server (see README)."));
  const running = await db.query.prospectRuns.findFirst({ where: (r, { eq }) => eq(r.status, "running") });
  if (running) redirect(flash("/prospecting", "error", "A run is already in progress — wait for it to finish."));
  const mode = (["search", "sources", "both"].includes(str(fd, "mode")) ? str(fd, "mode") : "both") as RunMode;
  await startRun({ mode, focus: str(fd, "focus") || null, staffId: s.staffId });
  redirect(flash("/prospecting", "success", "Agent started. Results appear here when it finishes (usually 1–3 minutes)."));
}

export async function setProspectStatus(id: number, status: "new" | "reviewing" | "dismissed") {
  await requireUser();
  await db.update(prospects).set({ status }).where(eq(prospects.id, id));
  redirect(flash("/prospecting", "success", status === "dismissed" ? "Prospect dismissed." : status === "reviewing" ? "Marked as reviewing." : "Prospect restored."));
}

/** Prospect → Lead: creates the lead (source "AI prospecting"), tags it, logs the link, and sets a deadline reminder. */
export async function convertProspect(id: number) {
  const s = await requireUser();
  const p = await db.query.prospects.findFirst({ where: eq(prospects.id, id) });
  if (!p) redirect("/prospecting");
  if (p.leadId) redirect(flash(`/leads/${p.leadId}`, "error", "Already converted."));
  let source = await db.query.leadSources.findFirst({ where: eq(leadSources.name, "AI prospecting") });
  if (!source) [source] = await db.insert(leadSources).values({ name: "AI prospecting" }).returning();
  const status = (await db.query.leadStatuses.findFirst({ where: eq(leadStatuses.isDefault, true) })) ?? (await db.query.leadStatuses.findFirst());
  const [lead] = await db.insert(leads).values({
    name: p.organisation || p.title.slice(0, 120), company: p.organisation, email: p.contactEmail, website: p.url, country: p.location,
    description: [p.title, p.summary, p.services ? `Services: ${p.services}` : "", p.deadline ? `Deadline: ${p.deadline}` : "", `Source: ${p.url}`].filter(Boolean).join("\n\n"),
    sourceId: source.id, statusId: status?.id ?? null, assignedId: s.staffId, value: 0, expectedClose: p.deadline,
  }).returning();
  await db.insert(leadActivityLog).values({ leadId: lead.id, staffId: s.staffId, description: `Created from AI prospect (fit ${p.fitScore}/100): ${p.fitReason ?? ""}` });
  if (p.kind === "opportunity") {
    let tag = await db.query.tags.findFirst({ where: eq(tags.name, "Tender") });
    if (!tag) [tag] = await db.insert(tags).values({ name: "Tender", color: "#2a78d6" }).returning();
    await db.insert(taggings).values({ tagId: tag.id, relType: "lead", relId: lead.id }).onConflictDoNothing();
  }
  const remindAt = p.deadline ? (addInterval(p.deadline, "day", -5) > today() ? addInterval(p.deadline, "day", -5) : today()) : addInterval(today(), "day", 2);
  await db.insert(reminders).values({ relType: "lead", relId: lead.id, staffId: s.staffId, remindAt, description: p.deadline ? `Submission due ${p.deadline}: prepare response` : "Review AI prospect and decide whether to pursue", createdBy: s.staffId });
  await db.update(prospects).set({ status: "converted", leadId: lead.id }).where(eq(prospects.id, id));
  revalidatePath("/", "layout");
  redirect(flash(`/leads/${lead.id}`, "success", "Lead created from prospect, with a follow-up reminder."));
}
