"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { contacts, customers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { bool, flash, optInt, optStr, str } from "@/lib/utils";

const CustomerSchema = z.object({
  company: z.string().min(1, "Company name is required."),
  vatNumber: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  website: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  groupId: z.number().int().nullable(),
  currencyId: z.number().int().nullable(),
  active: z.boolean(),
});

function readCustomer(fd: FormData) {
  return CustomerSchema.safeParse({
    company: str(fd, "company"),
    vatNumber: optStr(fd, "vatNumber"),
    phoneNumber: optStr(fd, "phoneNumber"),
    website: optStr(fd, "website"),
    address: optStr(fd, "address"),
    city: optStr(fd, "city"),
    country: optStr(fd, "country"),
    groupId: optInt(fd, "groupId"),
    currencyId: optInt(fd, "currencyId"),
    active: bool(fd, "active"),
  });
}

export async function createCustomer(fd: FormData) {
  await requireUser();
  const parsed = readCustomer(fd);
  if (!parsed.success) redirect(flash("/customers/create", "error", parsed.error.issues[0].message));
  const [row] = await db.insert(customers).values(parsed.data).returning();

  // Optional primary contact captured on the create form.
  const firstName = str(fd, "contactFirstName");
  if (firstName) {
    await db.insert(contacts).values({
      customerId: row.id,
      firstName,
      lastName: str(fd, "contactLastName"),
      email: optStr(fd, "contactEmail"),
      phoneNumber: optStr(fd, "contactPhone"),
      isPrimary: true,
      isCustomerAdmin: true,
    });
  }
  redirect(flash(`/customers/${row.id}`, "success", "Customer created."));
}

export async function updateCustomer(id: number, fd: FormData) {
  await requireUser();
  const parsed = readCustomer(fd);
  if (!parsed.success) redirect(flash(`/customers/${id}/edit`, "error", parsed.error.issues[0].message));
  await db.update(customers).set(parsed.data).where(eq(customers.id, id));
  redirect(flash(`/customers/${id}`, "success", "Customer updated."));
}

export async function deleteCustomer(id: number) {
  await requireUser();
  try {
    await db.delete(customers).where(eq(customers.id, id));
  } catch {
    redirect(flash(`/customers/${id}`, "error", "This customer has invoices, estimates or contracts. Delete those first, or mark the customer inactive."));
  }
  redirect(flash("/customers", "success", "Customer deleted."));
}

const ContactSchema = z.object({
  firstName: z.string().min(1, "Contact first name is required."),
  lastName: z.string(),
  email: z.string().email("Enter a valid contact email.").nullable(),
  phoneNumber: z.string().nullable(),
  title: z.string().nullable(),
  isPrimary: z.boolean(),
  isCustomerAdmin: z.boolean(),
});

export async function addContact(customerId: number, fd: FormData) {
  await requireUser();
  const parsed = ContactSchema.safeParse({
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    email: optStr(fd, "email"),
    phoneNumber: optStr(fd, "phoneNumber"),
    title: optStr(fd, "title"),
    isPrimary: bool(fd, "isPrimary"),
    isCustomerAdmin: bool(fd, "isCustomerAdmin"),
  });
  if (!parsed.success) redirect(flash(`/customers/${customerId}`, "error", parsed.error.issues[0].message));
  const [c] = await db.insert(contacts).values({ ...parsed.data, customerId }).returning();
  if (c.isPrimary) {
    await db.update(contacts).set({ isPrimary: false }).where(and(eq(contacts.customerId, customerId), ne(contacts.id, c.id)));
  }
  revalidatePath(`/customers/${customerId}`);
  redirect(flash(`/customers/${customerId}`, "success", "Contact added."));
}

export async function setPrimaryContact(customerId: number, contactId: number) {
  await requireUser();
  await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.customerId, customerId));
  await db.update(contacts).set({ isPrimary: true }).where(eq(contacts.id, contactId));
  redirect(flash(`/customers/${customerId}`, "success", "Primary contact updated."));
}

export async function deleteContact(customerId: number, contactId: number) {
  await requireUser();
  await db.delete(contacts).where(and(eq(contacts.id, contactId), eq(contacts.customerId, customerId)));
  redirect(flash(`/customers/${customerId}`, "success", "Contact removed."));
}
