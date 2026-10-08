/**
 * PAC CRM — database schema (single source of truth).
 *
 * Every table is declared with sqliteTable(), followed by its relations() block.
 * RULE: when you add a foreign key, declare BOTH sides of the relation
 * (the `many` on the parent AND the `one` on the child) in the same edit —
 * otherwise db.query.<table>.findMany({ with }) throws
 * "There is not enough information to infer relation". See docs §8.2.
 *
 * Column types are kept portable (integer / text / real) so a later move to
 * Postgres or MySQL is a driver swap rather than a rewrite.
 */
import { relations, sql } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () =>
  text("created_at").notNull().default(sql`(datetime('now'))`);
const bool = (name: string) => integer(name, { mode: "boolean" });

/* ───────────────────────────── Auth & staff ───────────────────────────── */

export const staff = sqliteTable("staff", {
  id: id(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phoneNumber: text("phone_number"),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "staff"] }).notNull().default("staff"),
  departmentId: integer("department_id").references(() => departments.id, { onDelete: "set null" }),
  active: bool("active").notNull().default(true),
  lastLogin: text("last_login"),
  createdAt: createdAt(),
});

/* ─────────────────────────── Settings & lookups ───────────────────────── */

export const settings = sqliteTable("settings", {
  name: text("name").primaryKey(),
  value: text("value").notNull().default(""),
});

export const departments = sqliteTable("departments", {
  id: id(),
  name: text("name").notNull(),
  email: text("email"),
});

export const currencies = sqliteTable("currencies", {
  id: id(),
  name: text("name").notNull(), // ISO code, e.g. KES
  symbol: text("symbol").notNull(),
  isDefault: bool("is_default").notNull().default(false),
});

export const customerGroups = sqliteTable("customer_groups", {
  id: id(),
  name: text("name").notNull(),
});

export const leadSources = sqliteTable("lead_sources", {
  id: id(),
  name: text("name").notNull(),
});

export const leadStatuses = sqliteTable("lead_statuses", {
  id: id(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#64748b"),
  order: integer("sort_order").notNull().default(0),
  isDefault: bool("is_default").notNull().default(false),
  /** Win probability (%) used by the weighted pipeline forecast. */
  probability: integer("probability").notNull().default(10),
});

export const contractTypes = sqliteTable("contract_types", {
  id: id(),
  name: text("name").notNull(),
});

export const expenseCategories = sqliteTable("expense_categories", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
});

export const ticketPriorities = sqliteTable("ticket_priorities", {
  id: id(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#64748b"),
});

export const ticketStatuses = sqliteTable("ticket_statuses", {
  id: id(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#64748b"),
  order: integer("sort_order").notNull().default(0),
  isDefault: bool("is_default").notNull().default(false),
});

export const ticketServices = sqliteTable("ticket_services", {
  id: id(),
  name: text("name").notNull(),
});

/* ─────────────────────────────── Customers ────────────────────────────── */

export const customers = sqliteTable("customers", {
  id: id(),
  company: text("company").notNull(),
  vatNumber: text("vat_number"),
  phoneNumber: text("phone_number"),
  website: text("website"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  groupId: integer("group_id").references(() => customerGroups.id, { onDelete: "set null" }),
  currencyId: integer("currency_id").references(() => currencies.id, { onDelete: "set null" }),
  active: bool("active").notNull().default(true),
  createdAt: createdAt(),
});

export const contacts = sqliteTable("contacts", {
  id: id(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  isPrimary: bool("is_primary").notNull().default(false),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull().default(""),
  email: text("email"),
  phoneNumber: text("phone_number"),
  title: text("title"),
  isCustomerAdmin: bool("is_customer_admin").notNull().default(false),
  active: bool("active").notNull().default(true),
  createdAt: createdAt(),
});

/* ───────────────────────────────── Leads ──────────────────────────────── */

export const leads = sqliteTable("leads", {
  id: id(),
  name: text("name").notNull(),
  title: text("title"),
  company: text("company"),
  email: text("email"),
  phoneNumber: text("phone_number"),
  website: text("website"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  description: text("description"),
  sourceId: integer("source_id").references(() => leadSources.id, { onDelete: "set null" }),
  statusId: integer("status_id").references(() => leadStatuses.id, { onDelete: "set null" }),
  assignedId: integer("assigned_id").references(() => staff.id, { onDelete: "set null" }),
  value: real("lead_value").notNull().default(0),
  convertedCustomerId: integer("converted_customer_id").references(() => customers.id, { onDelete: "set null" }),
  dateConverted: text("date_converted"),
  lost: bool("lost").notNull().default(false),
  junk: bool("junk").notNull().default(false),
  lastContact: text("last_contact"),
  /** Expected close date, used by the pipeline forecast. */
  expectedClose: text("expected_close"),
  createdAt: createdAt(),
});

export const leadActivityLog = sqliteTable("lead_activity_log", {
  id: id(),
  leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  staffId: integer("staff_id").references(() => staff.id),
  description: text("description").notNull(),
  date: createdAt(),
});

/* ───────────────────────────────── Sales ──────────────────────────────── */

export const items = sqliteTable("items", {
  id: id(),
  description: text("description").notNull(),
  longDescription: text("long_description"),
  rate: real("rate").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0), // percent
  unit: text("unit"),
  groupName: text("group_name"),
});

export const estimates = sqliteTable("estimates", {
  id: id(),
  number: text("number").notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  currencyId: integer("currency_id").references(() => currencies.id, { onDelete: "set null" }),
  date: text("date").notNull(),
  expiryDate: text("expiry_date"),
  status: text("status", { enum: ["draft", "sent", "accepted", "declined", "expired"] })
    .notNull()
    .default("draft"),
  subtotal: real("subtotal").notNull().default(0),
  totalTax: real("total_tax").notNull().default(0),
  total: real("total").notNull().default(0),
  clientNote: text("client_note"),
  terms: text("terms"),
  invoiceId: integer("invoice_id"),
  createdBy: integer("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const estimateItems = sqliteTable("estimate_items", {
  id: id(),
  estimateId: integer("estimate_id").notNull().references(() => estimates.id, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => items.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  qty: real("qty").notNull().default(1),
  rate: real("rate").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0),
  order: integer("sort_order").notNull().default(0),
});

export const proposals = sqliteTable("proposals", {
  id: id(),
  subject: text("subject").notNull(),
  relType: text("rel_type", { enum: ["customer", "lead"] }).notNull(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
  proposalTo: text("proposal_to"),
  email: text("email"),
  date: text("date").notNull(),
  openTill: text("open_till"),
  status: text("status", { enum: ["draft", "sent", "open", "revised", "accepted", "declined"] })
    .notNull()
    .default("draft"),
  content: text("content"),
  subtotal: real("subtotal").notNull().default(0),
  total: real("total").notNull().default(0),
  createdBy: integer("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const proposalItems = sqliteTable("proposal_items", {
  id: id(),
  proposalId: integer("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => items.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  qty: real("qty").notNull().default(1),
  rate: real("rate").notNull().default(0),
  order: integer("sort_order").notNull().default(0),
});

export const invoices = sqliteTable("invoices", {
  id: id(),
  number: text("number").notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  currencyId: integer("currency_id").references(() => currencies.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  date: text("date").notNull(),
  dueDate: text("due_date"),
  status: text("status", { enum: ["draft", "unpaid", "partial", "paid", "overdue", "cancelled"] })
    .notNull()
    .default("unpaid"),
  subtotal: real("subtotal").notNull().default(0),
  totalTax: real("total_tax").notNull().default(0),
  total: real("total").notNull().default(0),
  totalPaid: real("total_paid").notNull().default(0),
  clientNote: text("client_note"),
  terms: text("terms"),
  isRecurring: bool("is_recurring").notNull().default(false),
  recurringType: text("recurring_type", { enum: ["day", "week", "month", "year"] }),
  recurringEvery: integer("recurring_every"),
  recurringNextDate: text("recurring_next_date"),
  recurringParentId: integer("recurring_parent_id"),
  createdBy: integer("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const invoiceItems = sqliteTable("invoice_items", {
  id: id(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => items.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  qty: real("qty").notNull().default(1),
  rate: real("rate").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0),
  order: integer("sort_order").notNull().default(0),
});

export const payments = sqliteTable("payments", {
  id: id(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  paymentMode: text("payment_mode", { enum: ["bank_transfer", "mpesa", "cash", "cheque", "card"] })
    .notNull()
    .default("bank_transfer"),
  date: text("date").notNull(),
  transactionId: text("transaction_id"),
  note: text("note"),
  recordedBy: integer("recorded_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/* ─────────────────────────── Projects & tasks ─────────────────────────── */

export const projects = sqliteTable("projects", {
  id: id(),
  name: text("name").notNull(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  status: text("status", { enum: ["not_started", "in_progress", "on_hold", "finished", "cancelled"] })
    .notNull()
    .default("not_started"),
  startDate: text("start_date").notNull(),
  deadline: text("deadline"),
  description: text("description"),
  billingType: text("billing_type", { enum: ["fixed_rate", "project_hours", "task_hours"] })
    .notNull()
    .default("fixed_rate"),
  progress: integer("progress").notNull().default(0),
  projectCost: real("project_cost").notNull().default(0),
  ratePerHour: real("rate_per_hour").notNull().default(0),
  createdBy: integer("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const projectMembers = sqliteTable(
  "project_members",
  {
    projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    staffId: integer("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.staffId] })],
);

export const milestones = sqliteTable("milestones", {
  id: id(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  order: integer("sort_order").notNull().default(0),
});

export const tasks = sqliteTable("tasks", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  milestoneId: integer("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  status: text("status", {
    enum: ["not_started", "in_progress", "testing", "awaiting_feedback", "finished"],
  })
    .notNull()
    .default("not_started"),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  billable: bool("billable").notNull().default(false),
  hourlyRate: real("hourly_rate").notNull().default(0),
  createdBy: integer("created_by").references(() => staff.id, { onDelete: "set null" }),
  dateFinished: text("date_finished"),
  createdAt: createdAt(),
});

export const taskAssignees = sqliteTable(
  "task_assignees",
  {
    taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    staffId: integer("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.staffId] })],
);

/**
 * Timesheet entries. Each row is time a staff member spent on a task, either from the
 * start/stop timer or logged manually (start + hours → end). Hours = end − start.
 * `invoiceId` is set once the entry has been billed, so time is never invoiced twice.
 */
export const taskTimers = sqliteTable("task_timers", {
  id: id(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  note: text("note"),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
});

export const taskComments = sqliteTable("task_comments", {
  id: id(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  staffId: integer("staff_id").references(() => staff.id),
  content: text("content").notNull(),
  createdAt: createdAt(),
});

/* ──────────────────────────────── Support ─────────────────────────────── */

export const tickets = sqliteTable("tickets", {
  id: id(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  name: text("name"),
  email: text("email"),
  departmentId: integer("department_id").references(() => departments.id, { onDelete: "set null" }),
  serviceId: integer("service_id").references(() => ticketServices.id, { onDelete: "set null" }),
  priorityId: integer("priority_id").references(() => ticketPriorities.id, { onDelete: "set null" }),
  statusId: integer("status_id").references(() => ticketStatuses.id, { onDelete: "set null" }),
  assignedId: integer("assigned_id").references(() => staff.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  lastReply: text("last_reply"),
  createdAt: createdAt(),
});

export const ticketReplies = sqliteTable("ticket_replies", {
  id: id(),
  ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  staffId: integer("staff_id").references(() => staff.id),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  createdAt: createdAt(),
});

export const predefinedReplies = sqliteTable("predefined_replies", {
  id: id(),
  name: text("name").notNull(),
  message: text("message").notNull(),
});

/* ────────────────────────── Contracts & expenses ──────────────────────── */

export const contracts = sqliteTable("contracts", {
  id: id(),
  subject: text("subject").notNull(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  typeId: integer("type_id").references(() => contractTypes.id, { onDelete: "set null" }),
  dateStart: text("date_start").notNull(),
  dateEnd: text("date_end"),
  value: real("contract_value").notNull().default(0),
  description: text("description"),
  content: text("content"),
  isExpiryNotify: bool("is_expiry_notify").notNull().default(true),
  expiryNotifiedAt: text("expiry_notified_at"),
  signed: bool("signed").notNull().default(false),
  createdBy: integer("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const expenses = sqliteTable("expenses", {
  id: id(),
  name: text("name"),
  categoryId: integer("category_id").notNull().references(() => expenseCategories.id),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  currencyId: integer("currency_id").references(() => currencies.id, { onDelete: "set null" }),
  amount: real("amount").notNull(),
  tax: real("tax").notNull().default(0),
  date: text("date").notNull(),
  referenceNo: text("reference_no"),
  paymentMode: text("payment_mode"),
  note: text("note"),
  billable: bool("billable").notNull().default(false),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  isRecurring: bool("is_recurring").notNull().default(false),
  recurringType: text("recurring_type", { enum: ["day", "week", "month", "year"] }),
  recurringEvery: integer("recurring_every"),
  recurringNextDate: text("recurring_next_date"),
  createdBy: integer("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/* ──────────────────────────────── Knowledge base ──────────────────────── */

export const kbGroups = sqliteTable("kb_groups", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#1d5cf1"),
  order: integer("sort_order").notNull().default(0),
});

export const kbArticles = sqliteTable("kb_articles", {
  id: id(),
  // Not cascaded: deleting a group leaves its articles ungrouped (intended).
  groupId: integer("group_id").references(() => kbGroups.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull().default(""),
  visibility: text("visibility", { enum: ["everyone", "staff", "customers"] }).notNull().default("everyone"),
  active: bool("active").notNull().default(true),
  createdBy: integer("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/* ──────────────────────────────── Surveys ─────────────────────────────── */

export const surveys = sqliteTable("surveys", {
  id: id(),
  subject: text("subject").notNull(),
  description: text("description"),
  slug: text("slug").notNull(),
  active: bool("active").notNull().default(true),
  createdBy: integer("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const surveyQuestions = sqliteTable("survey_questions", {
  id: id(),
  surveyId: integer("survey_id").notNull().references(() => surveys.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  type: text("type", { enum: ["text", "textarea", "radio", "checkbox"] }).notNull().default("textarea"),
  options: text("options"), // newline-separated for radio/checkbox
  order: integer("sort_order").notNull().default(0),
});

export const surveyAnswers = sqliteTable("survey_answers", {
  id: id(),
  questionId: integer("question_id").notNull().references(() => surveyQuestions.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  respondentEmail: text("respondent_email"),
  answer: text("answer").notNull(),
  createdAt: createdAt(),
});

/* ───────────────────────────────── Audit ──────────────────────────────── */

/**
 * Activity log: system events (kind = "system") and logged interactions with
 * customers/leads (call, meeting, email, note). Feeds the Customer 360 timeline.
 */
export const activityLog = sqliteTable("activity_log", {
  id: id(),
  description: text("description").notNull(),
  staffId: integer("staff_id").references(() => staff.id, { onDelete: "set null" }),
  relType: text("rel_type"),
  relId: integer("rel_id"),
  kind: text("kind").notNull().default("system"),
  date: createdAt(),
});

/* ─────────────────────── Tags, segments, reminders ─────────────────────── */

export const tags = sqliteTable("tags", {
  id: id(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#1d5cf1"),
});

/** Polymorphic tag assignment: relType is "customer" or "lead". */
export const taggings = sqliteTable(
  "taggings",
  {
    tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
    relType: text("rel_type", { enum: ["customer", "lead"] }).notNull(),
    relId: integer("rel_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tagId, t.relType, t.relId] })],
);

/** A saved filter over customers, contacts or leads (filters stored as JSON). */
export const savedSegments = sqliteTable("saved_segments", {
  id: id(),
  name: text("name").notNull(),
  entity: text("entity", { enum: ["customers", "contacts", "leads"] }).notNull(),
  filters: text("filters").notNull().default("{}"),
  createdBy: integer("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** Follow-up reminder on any record (relType + relId), owned by a staff member. */
export const reminders = sqliteTable("reminders", {
  id: id(),
  relType: text("rel_type").notNull(),
  relId: integer("rel_id").notNull(),
  staffId: integer("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  remindAt: text("remind_at").notNull(), // YYYY-MM-DD
  description: text("description").notNull(),
  isDone: bool("is_done").notNull().default(false),
  createdBy: integer("created_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/* ───────────────────────────── AI prospecting ──────────────────────────── */

export const prospectRuns = sqliteTable("prospect_runs", {
  id: id(),
  mode: text("mode", { enum: ["search", "sources", "both"] }).notNull().default("both"),
  focus: text("focus"),
  status: text("status", { enum: ["running", "done", "failed"] }).notNull().default("running"),
  found: integer("found").notNull().default(0),
  added: integer("added").notNull().default(0),
  searches: integer("searches").notNull().default(0),
  fetches: integer("fetches").notNull().default(0),
  error: text("error"),
  log: text("log"),
  sample: bool("sample").notNull().default(false),
  startedBy: integer("started_by").references(() => staff.id, { onDelete: "set null" }),
  startedAt: createdAt(),
  finishedAt: text("finished_at"),
});

/** An opportunity found by the AI agent (advertised consulting work or a likely-fit organisation). */
export const prospects = sqliteTable("prospects", {
  id: id(),
  runId: integer("run_id").references(() => prospectRuns.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["opportunity", "organisation"] }).notNull().default("opportunity"),
  title: text("title").notNull(),
  organisation: text("organisation"),
  url: text("url").notNull().unique(),
  source: text("source"),
  location: text("location"),
  deadline: text("deadline"),
  services: text("services"), // comma-separated PAC service lines matched
  summary: text("summary"),
  fitScore: integer("fit_score").notNull().default(0), // 0-100
  fitReason: text("fit_reason"),
  contactEmail: text("contact_email"),
  status: text("status", { enum: ["new", "reviewing", "converted", "dismissed"] }).notNull().default("new"),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/* ═══════════════════════════════ Relations ════════════════════════════════
 * Both sides of every relationship are declared. Named relations are used
 * where one table references another more than once (e.g. leads → staff).
 */

export const staffRelations = relations(staff, ({ one, many }) => ({
  department: one(departments, { fields: [staff.departmentId], references: [departments.id] }),
  assignedLeads: many(leads),
  projectMemberships: many(projectMembers),
  taskAssignments: many(taskAssignees),
  taskComments: many(taskComments),
  ticketReplies: many(ticketReplies),
  leadNotes: many(leadActivityLog),
  timesheets: many(taskTimers),
  reminders: many(reminders),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  staff: many(staff),
  tickets: many(tickets),
}));

export const currenciesRelations = relations(currencies, ({ many }) => ({
  customers: many(customers),
  invoices: many(invoices),
  estimates: many(estimates),
}));

export const customerGroupsRelations = relations(customerGroups, ({ many }) => ({
  customers: many(customers),
}));

export const leadSourcesRelations = relations(leadSources, ({ many }) => ({ leads: many(leads) }));
export const leadStatusesRelations = relations(leadStatuses, ({ many }) => ({ leads: many(leads) }));
export const contractTypesRelations = relations(contractTypes, ({ many }) => ({ contracts: many(contracts) }));
export const expenseCategoriesRelations = relations(expenseCategories, ({ many }) => ({ expenses: many(expenses) }));
export const ticketPrioritiesRelations = relations(ticketPriorities, ({ many }) => ({ tickets: many(tickets) }));
export const ticketStatusesRelations = relations(ticketStatuses, ({ many }) => ({ tickets: many(tickets) }));
export const ticketServicesRelations = relations(ticketServices, ({ many }) => ({ tickets: many(tickets) }));

export const customersRelations = relations(customers, ({ one, many }) => ({
  group: one(customerGroups, { fields: [customers.groupId], references: [customerGroups.id] }),
  currency: one(currencies, { fields: [customers.currencyId], references: [currencies.id] }),
  contacts: many(contacts),
  estimates: many(estimates),
  invoices: many(invoices),
  proposals: many(proposals),
  projects: many(projects),
  tickets: many(tickets),
  contracts: many(contracts),
  expenses: many(expenses),
  convertedLeads: many(leads),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  customer: one(customers, { fields: [contacts.customerId], references: [customers.id] }),
  tickets: many(tickets),
  ticketReplies: many(ticketReplies),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  source: one(leadSources, { fields: [leads.sourceId], references: [leadSources.id] }),
  status: one(leadStatuses, { fields: [leads.statusId], references: [leadStatuses.id] }),
  assigned: one(staff, { fields: [leads.assignedId], references: [staff.id] }),
  convertedCustomer: one(customers, { fields: [leads.convertedCustomerId], references: [customers.id] }),
  notes: many(leadActivityLog),
  proposals: many(proposals),
  prospects: many(prospects),
}));

export const leadActivityLogRelations = relations(leadActivityLog, ({ one }) => ({
  lead: one(leads, { fields: [leadActivityLog.leadId], references: [leads.id] }),
  staff: one(staff, { fields: [leadActivityLog.staffId], references: [staff.id] }),
}));

export const itemsRelations = relations(items, ({ many }) => ({
  estimateItems: many(estimateItems),
  invoiceItems: many(invoiceItems),
  proposalItems: many(proposalItems),
}));

export const estimatesRelations = relations(estimates, ({ one, many }) => ({
  customer: one(customers, { fields: [estimates.customerId], references: [customers.id] }),
  currency: one(currencies, { fields: [estimates.currencyId], references: [currencies.id] }),
  invoice: one(invoices, { fields: [estimates.invoiceId], references: [invoices.id] }),
  creator: one(staff, { fields: [estimates.createdBy], references: [staff.id] }),
  items: many(estimateItems),
}));

export const estimateItemsRelations = relations(estimateItems, ({ one }) => ({
  estimate: one(estimates, { fields: [estimateItems.estimateId], references: [estimates.id] }),
  item: one(items, { fields: [estimateItems.itemId], references: [items.id] }),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  customer: one(customers, { fields: [proposals.customerId], references: [customers.id] }),
  lead: one(leads, { fields: [proposals.leadId], references: [leads.id] }),
  creator: one(staff, { fields: [proposals.createdBy], references: [staff.id] }),
  items: many(proposalItems),
}));

export const proposalItemsRelations = relations(proposalItems, ({ one }) => ({
  proposal: one(proposals, { fields: [proposalItems.proposalId], references: [proposals.id] }),
  item: one(items, { fields: [proposalItems.itemId], references: [items.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  currency: one(currencies, { fields: [invoices.currencyId], references: [currencies.id] }),
  project: one(projects, { fields: [invoices.projectId], references: [projects.id] }),
  creator: one(staff, { fields: [invoices.createdBy], references: [staff.id] }),
  items: many(invoiceItems),
  payments: many(payments),
  estimates: many(estimates),
  expenses: many(expenses),
  timesheets: many(taskTimers),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
  item: one(items, { fields: [invoiceItems.itemId], references: [items.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
  recorder: one(staff, { fields: [payments.recordedBy], references: [staff.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  customer: one(customers, { fields: [projects.customerId], references: [customers.id] }),
  creator: one(staff, { fields: [projects.createdBy], references: [staff.id] }),
  members: many(projectMembers),
  milestones: many(milestones),
  tasks: many(tasks),
  invoices: many(invoices),
  tickets: many(tickets),
  expenses: many(expenses),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  staff: one(staff, { fields: [projectMembers.staffId], references: [staff.id] }),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  milestone: one(milestones, { fields: [tasks.milestoneId], references: [milestones.id] }),
  creator: one(staff, { fields: [tasks.createdBy], references: [staff.id] }),
  assignees: many(taskAssignees),
  timers: many(taskTimers),
  comments: many(taskComments),
}));

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, { fields: [taskAssignees.taskId], references: [tasks.id] }),
  staff: one(staff, { fields: [taskAssignees.staffId], references: [staff.id] }),
}));

export const taskTimersRelations = relations(taskTimers, ({ one }) => ({
  task: one(tasks, { fields: [taskTimers.taskId], references: [tasks.id] }),
  staff: one(staff, { fields: [taskTimers.staffId], references: [staff.id] }),
  invoice: one(invoices, { fields: [taskTimers.invoiceId], references: [invoices.id] }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, { fields: [taskComments.taskId], references: [tasks.id] }),
  staff: one(staff, { fields: [taskComments.staffId], references: [staff.id] }),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  customer: one(customers, { fields: [tickets.customerId], references: [customers.id] }),
  contact: one(contacts, { fields: [tickets.contactId], references: [contacts.id] }),
  department: one(departments, { fields: [tickets.departmentId], references: [departments.id] }),
  service: one(ticketServices, { fields: [tickets.serviceId], references: [ticketServices.id] }),
  priority: one(ticketPriorities, { fields: [tickets.priorityId], references: [ticketPriorities.id] }),
  status: one(ticketStatuses, { fields: [tickets.statusId], references: [ticketStatuses.id] }),
  assigned: one(staff, { fields: [tickets.assignedId], references: [staff.id] }),
  project: one(projects, { fields: [tickets.projectId], references: [projects.id] }),
  replies: many(ticketReplies),
}));

export const ticketRepliesRelations = relations(ticketReplies, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketReplies.ticketId], references: [tickets.id] }),
  staff: one(staff, { fields: [ticketReplies.staffId], references: [staff.id] }),
  contact: one(contacts, { fields: [ticketReplies.contactId], references: [contacts.id] }),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  customer: one(customers, { fields: [contracts.customerId], references: [customers.id] }),
  type: one(contractTypes, { fields: [contracts.typeId], references: [contractTypes.id] }),
  creator: one(staff, { fields: [contracts.createdBy], references: [staff.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  category: one(expenseCategories, { fields: [expenses.categoryId], references: [expenseCategories.id] }),
  customer: one(customers, { fields: [expenses.customerId], references: [customers.id] }),
  project: one(projects, { fields: [expenses.projectId], references: [projects.id] }),
  currency: one(currencies, { fields: [expenses.currencyId], references: [currencies.id] }),
  invoice: one(invoices, { fields: [expenses.invoiceId], references: [invoices.id] }),
}));

export const kbGroupsRelations = relations(kbGroups, ({ many }) => ({ articles: many(kbArticles) }));

export const kbArticlesRelations = relations(kbArticles, ({ one }) => ({
  group: one(kbGroups, { fields: [kbArticles.groupId], references: [kbGroups.id] }),
  creator: one(staff, { fields: [kbArticles.createdBy], references: [staff.id] }),
}));

export const surveysRelations = relations(surveys, ({ many }) => ({ questions: many(surveyQuestions) }));

export const surveyQuestionsRelations = relations(surveyQuestions, ({ one, many }) => ({
  survey: one(surveys, { fields: [surveyQuestions.surveyId], references: [surveys.id] }),
  answers: many(surveyAnswers),
}));

export const surveyAnswersRelations = relations(surveyAnswers, ({ one }) => ({
  question: one(surveyQuestions, { fields: [surveyAnswers.questionId], references: [surveyQuestions.id] }),
  customer: one(customers, { fields: [surveyAnswers.customerId], references: [customers.id] }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  staff: one(staff, { fields: [activityLog.staffId], references: [staff.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({ taggings: many(taggings) }));
export const taggingsRelations = relations(taggings, ({ one }) => ({
  tag: one(tags, { fields: [taggings.tagId], references: [tags.id] }),
}));
export const savedSegmentsRelations = relations(savedSegments, ({ one }) => ({
  creator: one(staff, { fields: [savedSegments.createdBy], references: [staff.id] }),
}));
export const remindersRelations = relations(reminders, ({ one }) => ({
  staff: one(staff, { fields: [reminders.staffId], references: [staff.id] }),
}));
export const prospectRunsRelations = relations(prospectRuns, ({ one, many }) => ({
  starter: one(staff, { fields: [prospectRuns.startedBy], references: [staff.id] }),
  prospects: many(prospects),
}));
export const prospectsRelations = relations(prospects, ({ one }) => ({
  run: one(prospectRuns, { fields: [prospects.runId], references: [prospectRuns.id] }),
  lead: one(leads, { fields: [prospects.leadId], references: [leads.id] }),
}));
