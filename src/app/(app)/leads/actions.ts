"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { contacts, customers, leadActivityLog, leads, leadStatuses } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { flash, num, optInt, optStr, str } from "@/lib/utils";

const LeadSchema = z.object({
  name: z.string().min(1, "Lead name is required."),
  title: z.string().nullable(),
  company: z.string().nullable(),
  email: z.string().email("Enter a valid email.").nullable(),
  phoneNumber: z.string().nullable(),
  website: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  description: z.string().nullable(),
  sourceId: z.number().int().nullable(),
  statusId: z.number().int().nullable(),
  assignedId: z.number().int().nullable(),
  value: z.number().min(0),
  expectedClose: z.string().nullable(),
});

function readLead(fd: FormData) {
  return LeadSchema.safeParse({
    name: str(fd, "name"),
    title: optStr(fd, "title"),
    company: optStr(fd, "company"),
    email: optStr(fd, "email"),
    phoneNumber: optStr(fd, "phoneNumber"),
    website: optStr(fd, "website"),
    address: optStr(fd, "address"),
    city: optStr(fd, "city"),
    country: optStr(fd, "country"),
    description: optStr(fd, "description"),
    sourceId: optInt(fd, "sourceId"),
    statusId: optInt(fd, "statusId"),
    assignedId: optInt(fd, "assignedId"),
    value: num(fd, "value"),
    expectedClose: optStr(fd, "expectedClose"),
  });
}

async function note(leadId: number, staffId: number, description: string) {
  await db.insert(leadActivityLog).values({ leadId, staffId, description });
}

export async function createLead(fd: FormData) {
  const s = await requireUser();
  const parsed = readLead(fd);
  if (!parsed.success) redirect(flash("/leads/create", "error", parsed.error.issues[0].message));
  const [row] = await db.insert(leads).values(parsed.data).returning();
  await note(row.id, s.staffId, `Lead created by ${s.name}`);
  redirect(flash(`/leads/${row.id}`, "success", "Lead created."));
}

export async function updateLead(id: number, fd: FormData) {
  const s = await requireUser();
  const parsed = readLead(fd);
  if (!parsed.success) redirect(flash(`/leads/${id}/edit`, "error", parsed.error.issues[0].message));
  const before = await db.query.leads.findFirst({ where: eq(leads.id, id), with: { status: true } });
  await db.update(leads).set(parsed.data).where(eq(leads.id, id));
  if (before && before.statusId !== parsed.data.statusId) {
    const st = parsed.data.statusId ? await db.query.leadStatuses.findFirst({ where: eq(leadStatuses.id, parsed.data.statusId) }) : null;
    await note(id, s.staffId, `Status changed from "${before.status?.name ?? "none"}" to "${st?.name ?? "none"}"`);
  }
  redirect(flash(`/leads/${id}`, "success", "Lead updated."));
}

export async function setLeadStatus(id: number, statusId: number) {
  const s = await requireUser();
  const st = await db.query.leadStatuses.findFirst({ where: eq(leadStatuses.id, statusId) });
  await db.update(leads).set({ statusId }).where(eq(leads.id, id));
  await note(id, s.staffId, `Status changed to "${st?.name}"`);
  redirect(flash(`/leads/${id}`, "success", "Status updated."));
}

export async function addLeadNote(id: number, fd: FormData) {
  const s = await requireUser();
  const description = str(fd, "description");
  if (!description) redirect(flash(`/leads/${id}`, "error", "Note cannot be empty."));
  await note(id, s.staffId, description);
  await db.update(leads).set({ lastContact: new Date().toISOString() }).where(eq(leads.id, id));
  redirect(flash(`/leads/${id}`, "success", "Note added."));
}

export async function toggleLeadFlag(id: number, flag: "lost" | "junk") {
  const s = await requireUser();
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, id) });
  if (!lead) redirect("/leads");
  const value = !lead[flag];
  await db.update(leads).set({ [flag]: value }).where(eq(leads.id, id));
  await note(id, s.staffId, value ? `Marked as ${flag}` : `Unmarked as ${flag}`);
  redirect(flash(`/leads/${id}`, "success", value ? `Lead marked as ${flag}.` : `Lead restored.`));
}

export async function convertLead(id: number) {
  const s = await requireUser();
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, id) });
  if (!lead) redirect("/leads");
  if (lead.convertedCustomerId) redirect(flash(`/customers/${lead.convertedCustomerId}`, "error", "Lead was already converted."));

  const customerId = db.transaction((tx) => {
    const cust = tx
      .insert(customers)
      .values({
        company: lead.company || lead.name,
        phoneNumber: lead.phoneNumber,
        website: lead.website,
        address: lead.address,
        city: lead.city,
        country: lead.country,
      })
      .returning()
      .get();
    const [first, ...rest] = lead.name.trim().split(/\s+/);
    tx.insert(contacts)
      .values({
        customerId: cust.id,
        firstName: first,
        lastName: rest.join(" "),
        email: lead.email,
        phoneNumber: lead.phoneNumber,
        title: lead.title,
        isPrimary: true,
        isCustomerAdmin: true,
      })
      .run();
    tx.update(leads).set({ convertedCustomerId: cust.id, dateConverted: new Date().toISOString() }).where(eq(leads.id, id)).run();
    tx.insert(leadActivityLog).values({ leadId: id, staffId: s.staffId, description: `Converted to customer #${cust.id}` }).run();
    return cust.id;
  });
  redirect(flash(`/customers/${customerId}`, "success", "Lead converted to customer."));
}

export async function deleteLead(id: number) {
  await requireUser();
  await db.delete(leads).where(eq(leads.id, id));
  redirect(flash("/leads", "success", "Lead deleted."));
}
