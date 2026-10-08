"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { contacts, ticketReplies, tickets, ticketStatuses } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { flash, optInt, optStr, str } from "@/lib/utils";

const TicketSchema = z.object({
  subject: z.string().min(1, "Subject is required."),
  message: z.string().min(1, "Message is required."),
  customerId: z.number().int().nullable(),
  contactId: z.number().int().nullable(),
  name: z.string().nullable(),
  email: z.string().email("Enter a valid email.").nullable(),
  departmentId: z.number().int().nullable(),
  serviceId: z.number().int().nullable(),
  priorityId: z.number().int().nullable(),
  statusId: z.number().int().nullable(),
  assignedId: z.number().int().nullable(),
  projectId: z.number().int().nullable(),
});

export async function createTicket(fd: FormData) {
  await requireUser();
  let statusId = optInt(fd, "statusId");
  if (!statusId) {
    const def = (await db.query.ticketStatuses.findFirst({ where: eq(ticketStatuses.isDefault, true) })) ?? (await db.query.ticketStatuses.findFirst());
    statusId = def?.id ?? null;
  }
  const p = TicketSchema.safeParse({
    subject: str(fd, "subject"),
    message: str(fd, "message"),
    customerId: optInt(fd, "customerId"),
    contactId: optInt(fd, "contactId"),
    name: optStr(fd, "name"),
    email: optStr(fd, "email"),
    departmentId: optInt(fd, "departmentId"),
    serviceId: optInt(fd, "serviceId"),
    priorityId: optInt(fd, "priorityId"),
    statusId,
    assignedId: optInt(fd, "assignedId"),
    projectId: optInt(fd, "projectId"),
  });
  if (!p.success) redirect(flash("/tickets/create", "error", p.error.issues[0].message));
  const data = { ...p.data };
  // Fill name/email from the chosen contact when not typed in.
  if (data.contactId && (!data.email || !data.name)) {
    const c = await db.query.contacts.findFirst({ where: eq(contacts.id, data.contactId) });
    if (c) {
      data.email ??= c.email;
      data.name ??= `${c.firstName} ${c.lastName}`.trim();
      data.customerId ??= c.customerId;
    }
  }
  if (!data.customerId && !data.email) redirect(flash("/tickets/create", "error", "Link a customer or enter a contact email."));
  const [t] = await db.insert(tickets).values({ ...data, lastReply: null }).returning();
  redirect(flash(`/tickets/${t.id}`, "success", `Ticket #${t.id} opened.`));
}

export async function replyToTicket(ticketId: number, fd: FormData) {
  const s = await requireUser();
  const message = str(fd, "message");
  if (!message) redirect(flash(`/tickets/${ticketId}`, "error", "Reply cannot be empty."));
  await db.insert(ticketReplies).values({ ticketId, staffId: s.staffId, message });
  const statusId = optInt(fd, "statusId");
  await db.update(tickets).set({ lastReply: new Date().toISOString(), ...(statusId ? { statusId } : {}) }).where(eq(tickets.id, ticketId));
  redirect(flash(`/tickets/${ticketId}`, "success", "Reply posted."));
}

export async function setTicketStatus(ticketId: number, statusId: number) {
  await requireUser();
  await db.update(tickets).set({ statusId }).where(eq(tickets.id, ticketId));
  redirect(flash(`/tickets/${ticketId}`, "success", "Status updated."));
}

export async function updateTicketMeta(ticketId: number, fd: FormData) {
  await requireUser();
  await db
    .update(tickets)
    .set({ assignedId: optInt(fd, "assignedId"), priorityId: optInt(fd, "priorityId"), departmentId: optInt(fd, "departmentId"), serviceId: optInt(fd, "serviceId") })
    .where(eq(tickets.id, ticketId));
  redirect(flash(`/tickets/${ticketId}`, "success", "Ticket updated."));
}

export async function deleteTicket(ticketId: number) {
  await requireUser();
  await db.delete(tickets).where(eq(tickets.id, ticketId));
  redirect(flash("/tickets", "success", "Ticket deleted."));
}
