/**
 * Registry of Settings-managed lookup lists. To add a new list: add the table to schema.ts,
 * then add one entry here — the Settings page and its actions pick it up automatically.
 */
import {
  contractTypes, currencies, customerGroups, departments, expenseCategories, leadSources,
  leadStatuses, predefinedReplies, tags, ticketPriorities, ticketServices, ticketStatuses,
} from "@/db/schema";

export type LookupField = { name: string; label: string; type: "text" | "color" | "number" | "textarea" | "email"; required?: boolean };

export const LOOKUPS = {
  departments: { title: "Departments", table: departments, fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "email", label: "Email", type: "email" }] },
  currencies: { title: "Currencies", table: currencies, fields: [{ name: "name", label: "Code (e.g. KES)", type: "text", required: true }, { name: "symbol", label: "Symbol", type: "text", required: true }] },
  customerGroups: { title: "Customer groups", table: customerGroups, fields: [{ name: "name", label: "Name", type: "text", required: true }] },
  leadSources: { title: "Lead sources", table: leadSources, fields: [{ name: "name", label: "Name", type: "text", required: true }] },
  leadStatuses: { title: "Lead statuses (stage · win %)", table: leadStatuses, fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "color", label: "Colour", type: "color" }, { name: "order", label: "Order", type: "number" }, { name: "probability", label: "Win %", type: "number" }] },
  tags: { title: "Tags (customers & leads)", table: tags, fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "color", label: "Colour", type: "color" }] },
  contractTypes: { title: "Contract types", table: contractTypes, fields: [{ name: "name", label: "Name", type: "text", required: true }] },
  expenseCategories: { title: "Expense categories", table: expenseCategories, fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "description", label: "Description", type: "text" }] },
  ticketPriorities: { title: "Ticket priorities", table: ticketPriorities, fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "color", label: "Colour", type: "color" }] },
  ticketStatuses: { title: "Ticket statuses", table: ticketStatuses, fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "color", label: "Colour", type: "color" }, { name: "order", label: "Order", type: "number" }] },
  ticketServices: { title: "Ticket services", table: ticketServices, fields: [{ name: "name", label: "Name", type: "text", required: true }] },
  predefinedReplies: { title: "Predefined ticket replies", table: predefinedReplies, fields: [{ name: "name", label: "Title", type: "text", required: true }, { name: "message", label: "Message", type: "textarea", required: true }] },
} as const satisfies Record<string, { title: string; table: unknown; fields: readonly LookupField[] }>;

export type LookupKind = keyof typeof LOOKUPS;
export const isLookupKind = (k: string): k is LookupKind => k in LOOKUPS;
