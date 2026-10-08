/**
 * Demo / reference data. Run with `npm run db:seed` (or `npm run db:reset` for a clean slate).
 * Reference lists (currencies, statuses, categories…) are useful in production too;
 * demo staff logins and demo records should be removed before go-live (see README).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import * as t from "./schema";
import { addInterval, today } from "../lib/utils";
const nowIso = () => new Date().toISOString();

const d = (offsetDays: number) => addInterval(today(), "day", offsetDays);

async function main() {
  const existing = await db.select().from(t.staff).limit(1);
  if (existing.length) {
    console.log("Database already seeded — run `npm run db:reset` for a clean slate.");
    return;
  }
  const hash = await bcrypt.hash("password", 10);

  /* ── Settings ── */
  const settingsRows: Record<string, string> = {
    company_name: "Priority Activator Consulting",
    company_email: "info@pac.africa",
    company_phone: "+254 700 000 000",
    company_address: "Nairobi, Kenya",
    company_vat: "",
    invoice_prefix: "INV",
    estimate_prefix: "EST",
    invoice_due_days: "30",
    invoice_terms: "Payment within 30 days.\nBank: [Bank name] · Account: [Account no.] · M-Pesa Paybill: [Number]",
    estimate_terms: "This estimate is valid for 14 days. Fees exclude travel outside Nairobi unless stated.",
  };
  await db.insert(t.settings).values(Object.entries(settingsRows).map(([name, value]) => ({ name, value })));

  /* ── Lookups ── */
  const [deptOps, deptAdvisory] = await db.insert(t.departments).values([
    { name: "Operations", email: "ops@pac.africa" },
    { name: "Advisory", email: "advisory@pac.africa" },
    { name: "Training", email: "training@pac.africa" },
    { name: "Finance", email: "finance@pac.africa" },
  ]).returning();
  const [kes] = await db.insert(t.currencies).values([
    { name: "KES", symbol: "KES", isDefault: true },
    { name: "USD", symbol: "US$" },
    { name: "EUR", symbol: "€" },
    { name: "UGX", symbol: "UGX" },
  ]).returning();
  const [grpCorp, grpNgo, grpPublic] = await db.insert(t.customerGroups).values([
    { name: "Corporate" }, { name: "NGO / Development" }, { name: "Public sector" }, { name: "SME" },
  ]).returning();
  const sources = await db.insert(t.leadSources).values([
    { name: "Referral" }, { name: "Website" }, { name: "LinkedIn" }, { name: "Event / Conference" }, { name: "Tender" }, { name: "Cold outreach" },
  ]).returning();
  const lStatuses = await db.insert(t.leadStatuses).values([
    { name: "New", color: "#64748b", order: 1, isDefault: true, probability: 10 },
    { name: "Contacted", color: "#0ea5e9", order: 2, probability: 20 },
    { name: "Qualified", color: "#8b5cf6", order: 3, probability: 40 },
    { name: "Proposal sent", color: "#f59e0b", order: 4, probability: 60 },
    { name: "Negotiation", color: "#ef4444", order: 5, probability: 80 },
  ]).returning();
  const cTypes = await db.insert(t.contractTypes).values([
    { name: "Retainer" }, { name: "Project-based" }, { name: "NDA" }, { name: "Framework agreement" },
  ]).returning();
  const eCats = await db.insert(t.expenseCategories).values([
    { name: "Travel" }, { name: "Accommodation" }, { name: "Venue & catering" }, { name: "Software & subscriptions" }, { name: "Printing & materials" }, { name: "Office" },
  ]).returning();
  const [pLow, pMed, pHigh] = await db.insert(t.ticketPriorities).values([
    { name: "Low", color: "#64748b" }, { name: "Medium", color: "#0ea5e9" }, { name: "High", color: "#f59e0b" }, { name: "Urgent", color: "#ef4444" },
  ]).returning();
  const [sOpen, sInProg, sAnswered] = await db.insert(t.ticketStatuses).values([
    { name: "Open", color: "#ef4444", order: 1, isDefault: true },
    { name: "In progress", color: "#0ea5e9", order: 2 },
    { name: "Answered", color: "#8b5cf6", order: 3 },
    { name: "On hold", color: "#f59e0b", order: 4 },
    { name: "Closed", color: "#10b981", order: 5 },
  ]).returning();
  const [svcAssess, svcTraining] = await db.insert(t.ticketServices).values([
    { name: "Assessment platform" }, { name: "Training logistics" }, { name: "Reports & deliverables" }, { name: "Billing" },
  ]).returning();
  await db.insert(t.predefinedReplies).values([
    { name: "Acknowledgement", message: "Thank you for reaching out. We have received your request and a consultant will respond within one business day." },
    { name: "Report delivered", message: "Please find your report attached / available on the shared link. Let us know if you would like a walkthrough session." },
    { name: "Closing", message: "We are closing this ticket as resolved. Reply at any time if you need further help." },
  ]);

  /* ── Staff ── */
  const [admin, staffUser, consultant] = await db.insert(t.staff).values([
    { firstName: "Admin", lastName: "User", email: "admin@pac.africa", passwordHash: hash, role: "admin", departmentId: deptOps.id },
    { firstName: "Staff", lastName: "Member", email: "staff@pac.africa", passwordHash: hash, role: "staff", departmentId: deptAdvisory.id },
    { firstName: "Grace", lastName: "Wanjiru", email: "grace@pac.africa", passwordHash: hash, role: "staff", departmentId: deptAdvisory.id },
  ]).returning();

  /* ── Items (service catalog) ── */
  const items = await db.insert(t.items).values([
    { description: "Strategy workshop facilitation", longDescription: "Facilitated strategic planning session, incl. prep and synthesis", rate: 180000, taxRate: 16, unit: "day", groupName: "Strategy" },
    { description: "Board governance evaluation", longDescription: "Board effectiveness review and recommendations report", rate: 450000, taxRate: 16, unit: "engagement", groupName: "Governance" },
    { description: "Job evaluation", longDescription: "Grading of roles using the 4D framework", rate: 15000, taxRate: 16, unit: "role", groupName: "HR" },
    { description: "Organisational culture assessment", longDescription: "Survey, analysis and culture intelligence report", rate: 350000, taxRate: 16, unit: "engagement", groupName: "HR" },
    { description: "HR policy manual review", rate: 220000, taxRate: 16, unit: "engagement", groupName: "Policy" },
    { description: "Leadership training", longDescription: "Leading-edge manager programme", rate: 25000, taxRate: 16, unit: "participant/day", groupName: "Training" },
    { description: "Consulting hours", rate: 12000, taxRate: 16, unit: "hour", groupName: "General" },
  ]).returning();
  const item = (name: string) => items.find((i) => i.description === name)!;

  /* ── Customers & contacts ── */
  const custs = await db.insert(t.customers).values([
    { company: "Savanna Microfinance Ltd", phoneNumber: "+254 711 000 001", city: "Nairobi", country: "Kenya", address: "Upper Hill", groupId: grpCorp.id, currencyId: kes.id, vatNumber: "P051000001A" },
    { company: "Rift Valley Agro Processors", phoneNumber: "+254 722 000 002", city: "Nakuru", country: "Kenya", groupId: grpCorp.id, currencyId: kes.id },
    { company: "Coastline Community Health Trust", phoneNumber: "+254 733 000 003", city: "Mombasa", country: "Kenya", groupId: grpNgo.id, currencyId: kes.id },
    { company: "County Water Services Board", phoneNumber: "+254 744 000 004", city: "Kisumu", country: "Kenya", groupId: grpPublic.id, currencyId: kes.id },
  ]).returning();
  await db.insert(t.contacts).values([
    { customerId: custs[0].id, firstName: "Amina", lastName: "Odhiambo", email: "amina@savannamfi.example", title: "HR Director", isPrimary: true, isCustomerAdmin: true },
    { customerId: custs[0].id, firstName: "Peter", lastName: "Kamau", email: "peter@savannamfi.example", title: "CEO" },
    { customerId: custs[1].id, firstName: "John", lastName: "Kiprono", email: "john@rvagro.example", title: "General Manager", isPrimary: true },
    { customerId: custs[2].id, firstName: "Fatma", lastName: "Said", email: "fatma@coastlinehealth.example", title: "Programme Lead", isPrimary: true },
    { customerId: custs[3].id, firstName: "Otieno", lastName: "Were", email: "owere@cwsb.example", title: "Board Secretary", isPrimary: true },
  ]);

  /* ── Leads ── */
  const leads = await db.insert(t.leads).values([
    { name: "Mary Njeri", company: "Highlands Dairy Co-op", email: "mary@highlands.example", sourceId: sources[0].id, statusId: lStatuses[0].id, assignedId: staffUser.id, value: 600000, expectedClose: d(25), description: "Interested in job evaluation for ~120 roles." },
    { name: "David Mutua", company: "Kilimo Fintech", email: "david@kilimo.example", sourceId: sources[2].id, statusId: lStatuses[1].id, assignedId: consultant.id, value: 350000, expectedClose: d(45) },
    { name: "Sarah Achieng", company: "Lakeside University", email: "sachieng@lakeside.example", sourceId: sources[4].id, statusId: lStatuses[2].id, assignedId: admin.id, value: 1200000, expectedClose: d(60), description: "Tender for governance and strategy review." },
    { name: "Brian Otieno", company: "Nyota Logistics", email: "brian@nyota.example", sourceId: sources[1].id, statusId: lStatuses[3].id, assignedId: staffUser.id, value: 500000, expectedClose: d(15) },
  ]).returning();
  await db.insert(t.leadActivityLog).values([
    { leadId: leads[0].id, staffId: staffUser.id, description: "Intro call held — follow up with job evaluation methodology deck." },
    { leadId: leads[2].id, staffId: admin.id, description: "Tender documents downloaded; submission deadline noted." },
  ]);

  /* ── Estimates, invoices, payments ── */
  const est = await db.insert(t.estimates).values({
    number: "EST-000001", customerId: custs[1].id, currencyId: kes.id, date: d(-10), expiryDate: d(4), status: "sent",
    subtotal: 540000, totalTax: 86400, total: 626400, terms: settingsRows.estimate_terms, createdBy: admin.id,
  }).returning();
  await db.insert(t.estimateItems).values([
    { estimateId: est[0].id, itemId: item("Strategy workshop facilitation").id, description: "Strategy workshop facilitation", qty: 3, rate: 180000, taxRate: 16, order: 0 },
  ]);

  const inv1 = await db.insert(t.invoices).values({
    number: "INV-000001", customerId: custs[0].id, currencyId: kes.id, date: d(-40), dueDate: d(-10), status: "paid",
    subtotal: 350000, totalTax: 56000, total: 406000, totalPaid: 406000, terms: settingsRows.invoice_terms, createdBy: admin.id,
  }).returning();
  await db.insert(t.invoiceItems).values({ invoiceId: inv1[0].id, itemId: item("Organisational culture assessment").id, description: "Organisational culture assessment", qty: 1, rate: 350000, taxRate: 16 });
  await db.insert(t.payments).values({ invoiceId: inv1[0].id, amount: 406000, paymentMode: "bank_transfer", date: d(-15), transactionId: "FT2400123", recordedBy: admin.id });

  const inv2 = await db.insert(t.invoices).values({
    number: "INV-000002", customerId: custs[3].id, currencyId: kes.id, date: d(-20), dueDate: d(10), status: "partial",
    subtotal: 450000, totalTax: 72000, total: 522000, totalPaid: 200000, terms: settingsRows.invoice_terms, createdBy: admin.id,
  }).returning();
  await db.insert(t.invoiceItems).values({ invoiceId: inv2[0].id, itemId: item("Board governance evaluation").id, description: "Board governance evaluation", qty: 1, rate: 450000, taxRate: 16 });
  await db.insert(t.payments).values({ invoiceId: inv2[0].id, amount: 200000, paymentMode: "mpesa", date: d(-5), transactionId: "SJK8XY12AB", recordedBy: staffUser.id });

  // A monthly retainer that the cron job will roll forward.
  const inv3 = await db.insert(t.invoices).values({
    number: "INV-000003", customerId: custs[2].id, currencyId: kes.id, date: d(-30), dueDate: d(0), status: "unpaid",
    subtotal: 120000, totalTax: 19200, total: 139200, totalPaid: 0, terms: settingsRows.invoice_terms,
    isRecurring: true, recurringType: "month", recurringEvery: 1, recurringNextDate: d(0), createdBy: admin.id,
  }).returning();
  await db.insert(t.invoiceItems).values({ invoiceId: inv3[0].id, itemId: item("Consulting hours").id, description: "HR advisory retainer — 10 hours", qty: 10, rate: 12000, taxRate: 16 });

  /* ── Proposal ── */
  const prop = await db.insert(t.proposals).values({
    subject: "Job evaluation & grading structure", relType: "lead", leadId: leads[0].id, proposalTo: "Highlands Dairy Co-op", email: "mary@highlands.example",
    date: d(-2), openTill: d(28), status: "sent", subtotal: 1800000, total: 1800000, createdBy: staffUser.id,
    content: "Background\nHighlands Dairy Co-op seeks a fair, defensible grading structure.\n\nApproach\n1. Job analysis and JD clean-up\n2. Evaluation using the 4D framework\n3. Grading structure and pay-line recommendations\n\nTimeline: 6 weeks from kick-off.",
  }).returning();
  await db.insert(t.proposalItems).values({ proposalId: prop[0].id, itemId: item("Job evaluation").id, description: "Job evaluation", qty: 120, rate: 15000 });

  /* ── Projects & tasks ── */
  const proj = await db.insert(t.projects).values([
    { name: "Board governance evaluation 2026", customerId: custs[3].id, status: "in_progress", startDate: d(-20), deadline: d(25), billingType: "fixed_rate", projectCost: 450000, progress: 40, description: "Board effectiveness review, interviews and final report.", createdBy: admin.id },
    { name: "PAC internal: CRM rollout", status: "not_started", startDate: d(0), deadline: d(45), billingType: "fixed_rate", projectCost: 0, progress: 0, createdBy: admin.id },
    { name: "HR advisory retainer — Q4 support", customerId: custs[2].id, status: "in_progress", startDate: d(-14), deadline: d(80), billingType: "project_hours", projectCost: 0, ratePerHour: 12000, progress: 20, description: "Ad-hoc HR advisory billed by the hour from timesheets.", createdBy: admin.id },
  ]).returning();
  await db.insert(t.projectMembers).values([
    { projectId: proj[0].id, staffId: admin.id }, { projectId: proj[0].id, staffId: consultant.id },
    { projectId: proj[1].id, staffId: admin.id }, { projectId: proj[1].id, staffId: staffUser.id },
  ]);
  const [ms1, ms2] = await db.insert(t.milestones).values([
    { projectId: proj[0].id, name: "Interviews complete", dueDate: d(5), order: 1 },
    { projectId: proj[0].id, name: "Final report", dueDate: d(25), order: 2 },
    { projectId: proj[2].id, name: "Policy pack signed off", dueDate: d(30), order: 1 },
  ]).returning();
  await db.update(t.invoices).set({ projectId: proj[0].id }).where(eq(t.invoices.id, inv2[0].id));
  const tasks = await db.insert(t.tasks).values([
    { name: "Board member interviews", projectId: proj[0].id, milestoneId: ms1.id, priority: "high", status: "in_progress", startDate: d(-10), dueDate: d(5), createdBy: admin.id },
    { name: "Board self-assessment survey analysis", projectId: proj[0].id, priority: "medium", status: "not_started", startDate: d(4), dueDate: d(12), createdBy: admin.id },
    { name: "Draft evaluation report", projectId: proj[0].id, milestoneId: ms2.id, priority: "medium", status: "not_started", startDate: d(10), dueDate: d(20), createdBy: admin.id },
    { name: "Import client list into CRM", projectId: proj[1].id, priority: "low", status: "not_started", startDate: d(1), dueDate: d(7), createdBy: admin.id },
    { name: "Update company profile deck", priority: "low", status: "awaiting_feedback", startDate: d(-12), dueDate: d(-2), createdBy: staffUser.id },
  ]).returning();
  await db.insert(t.taskAssignees).values([
    { taskId: tasks[0].id, staffId: consultant.id }, { taskId: tasks[0].id, staffId: admin.id },
    { taskId: tasks[1].id, staffId: consultant.id }, { taskId: tasks[2].id, staffId: admin.id },
    { taskId: tasks[3].id, staffId: staffUser.id }, { taskId: tasks[4].id, staffId: staffUser.id },
  ]);
  await db.insert(t.taskComments).values({ taskId: tasks[0].id, staffId: consultant.id, content: "5 of 9 interviews done. Chair interview scheduled for Thursday." });
  const start = new Date(Date.now() - 3 * 3600_000).toISOString();
  await db.insert(t.taskTimers).values({ taskId: tasks[0].id, staffId: consultant.id, startTime: start, endTime: new Date(Date.now() - 1 * 3600_000).toISOString(), note: "Interviews — 2 board members" });

  /* ── Timesheets: an hourly-billed project with logged time ── */
  await db.insert(t.projectMembers).values([{ projectId: proj[2].id, staffId: admin.id }, { projectId: proj[2].id, staffId: consultant.id }]);
  const hrTasks = await db.insert(t.tasks).values([
    { name: "Disciplinary policy review", projectId: proj[2].id, priority: "medium", status: "in_progress", startDate: d(-12), dueDate: d(10), createdBy: admin.id },
    { name: "Staff handbook Q&A session", projectId: proj[2].id, priority: "low", status: "finished", startDate: d(-9), dueDate: d(-3), createdBy: admin.id },
  ]).returning();
  await db.insert(t.taskAssignees).values([{ taskId: hrTasks[0].id, staffId: consultant.id }, { taskId: hrTasks[1].id, staffId: admin.id }]);
  const entry = (taskId: number, staffId: number, daysAgo: number, hours: number, note: string) => {
    const s0 = new Date(`${d(-daysAgo)}T09:00:00`);
    return { taskId, staffId, startTime: s0.toISOString(), endTime: new Date(s0.getTime() + hours * 3_600_000).toISOString(), note };
  };
  await db.insert(t.taskTimers).values([
    entry(hrTasks[0].id, consultant.id, 6, 2.5, "Reviewed current policy against Employment Act"),
    entry(hrTasks[0].id, consultant.id, 2, 3, "Drafted revised sections 4–6"),
    entry(hrTasks[1].id, admin.id, 4, 1.5, "Handbook Q&A with line managers"),
    entry(tasks[1].id, consultant.id, 1, 2, "Survey data cleaning"),
    entry(tasks[3].id, staffUser.id, 0, 1, "Exported client list from spreadsheet"),
  ]);

  /* ── Tickets ── */
  const tk = await db.insert(t.tickets).values({
    subject: "Unable to access culture survey link", message: "Several of our staff report the survey link shows an error on mobile.",
    customerId: custs[0].id, name: "Amina Odhiambo", email: "amina@savannamfi.example", departmentId: deptAdvisory.id,
    serviceId: svcAssess.id, priorityId: pHigh.id, statusId: sInProg.id, assignedId: staffUser.id, lastReply: new Date().toISOString(),
  }).returning();
  await db.insert(t.ticketReplies).values({ ticketId: tk[0].id, staffId: staffUser.id, message: "Thanks Amina — we're looking into it and will update you within the day." });
  await db.insert(t.tickets).values({
    subject: "Training venue confirmation", message: "Please confirm the venue and catering numbers for next week's session.",
    customerId: custs[1].id, email: "john@rvagro.example", name: "John Kiprono", serviceId: svcTraining.id, priorityId: pMed.id, statusId: sOpen.id,
  });
  void pLow; void sAnswered;

  /* ── Contracts ── */
  await db.insert(t.contracts).values([
    { subject: "HR advisory retainer", customerId: custs[2].id, typeId: cTypes[0].id, dateStart: d(-335), dateEnd: d(20), value: 1440000, signed: true, content: "Monthly HR advisory retainer of 10 hours…", createdBy: admin.id },
    { subject: "Governance review engagement", customerId: custs[3].id, typeId: cTypes[1].id, dateStart: d(-20), dateEnd: d(60), value: 522000, signed: true, createdBy: admin.id },
    { subject: "Mutual NDA", customerId: custs[1].id, typeId: cTypes[2].id, dateStart: d(-10), dateEnd: d(720), value: 0, createdBy: admin.id },
  ]);

  /* ── Expenses ── */
  await db.insert(t.expenses).values([
    { name: "Flight NBO–KIS", categoryId: eCats[0].id, customerId: custs[3].id, projectId: proj[0].id, currencyId: kes.id, amount: 18500, tax: 0, date: d(-12), billable: true, paymentMode: "card", createdBy: consultant.id },
    { name: "Hotel — 2 nights", categoryId: eCats[1].id, customerId: custs[3].id, projectId: proj[0].id, currencyId: kes.id, amount: 24000, tax: 3840, date: d(-11), billable: true, createdBy: consultant.id },
    { name: "Survey platform subscription", categoryId: eCats[3].id, currencyId: kes.id, amount: 9500, tax: 1520, date: d(-3), isRecurring: true, recurringType: "month", recurringEvery: 1, recurringNextDate: d(27), createdBy: admin.id },
  ]);

  /* ── Knowledge base ── */
  const [g1, g2] = await db.insert(t.kbGroups).values([
    { name: "Methodologies", description: "How PAC delivers its core services", color: "#1d5cf1", order: 1 },
    { name: "Internal procedures", description: "Back-office how-tos", color: "#10b981", order: 2 },
  ]).returning();
  await db.insert(t.kbArticles).values([
    { groupId: g1.id, subject: "Job evaluation: the 4D framework at a glance", slug: "job-evaluation-4d", visibility: "staff", createdBy: admin.id, description: "Overview of the four dimensions used to grade roles, scoring guidance and moderation steps." },
    { groupId: g2.id, subject: "How to raise and send an invoice", slug: "raise-invoice", visibility: "staff", createdBy: admin.id, description: "1. Sales → Invoices → New invoice\n2. Pick the customer and add items from the catalog\n3. Save, then Print / PDF and email it to the client\n4. Record payments against the invoice as they arrive." },
  ]);

  /* ── Survey ── */
  const [sv] = await db.insert(t.surveys).values({ subject: "Post-workshop feedback", description: "Thank you for attending. This takes 2 minutes.", slug: "post-workshop-feedback-demo", createdBy: admin.id }).returning();
  const qs = await db.insert(t.surveyQuestions).values([
    { surveyId: sv.id, question: "How would you rate the workshop overall?", type: "radio", options: "Excellent\nGood\nFair\nPoor", order: 0 },
    { surveyId: sv.id, question: "What was the most valuable part?", type: "textarea", order: 1 },
    { surveyId: sv.id, question: "What should we improve?", type: "textarea", order: 2 },
  ]).returning();
  await db.insert(t.surveyAnswers).values([
    { questionId: qs[0].id, answer: "Excellent", respondentEmail: "participant1@example.com" },
    { questionId: qs[1].id, answer: "The practical case studies.", respondentEmail: "participant1@example.com" },
    { questionId: qs[0].id, answer: "Good" },
  ]);

  /* ── Tags & a saved segment ── */
  const tg = await db.insert(t.tags).values([
    { name: "Board client", color: "#4a3aa7" }, { name: "HR advisory", color: "#1baf7a" }, { name: "Key account", color: "#eb6834" }, { name: "Tender", color: "#2a78d6" },
  ]).returning();
  await db.insert(t.taggings).values([
    { tagId: tg[0].id, relType: "customer", relId: custs[3].id }, { tagId: tg[2].id, relType: "customer", relId: custs[3].id },
    { tagId: tg[1].id, relType: "customer", relId: custs[0].id }, { tagId: tg[1].id, relType: "customer", relId: custs[2].id },
    { tagId: tg[2].id, relType: "customer", relId: custs[0].id }, { tagId: tg[3].id, relType: "lead", relId: leads[2].id },
    { tagId: tg[1].id, relType: "lead", relId: leads[0].id },
  ]);
  await db.insert(t.savedSegments).values({ name: "HR advisory clients — contacts", entity: "contacts", filters: JSON.stringify({ tags: [tg[1].id] }), createdBy: admin.id });

  /* ── Interactions & reminders ── */
  await db.insert(t.activityLog).values([
    { kind: "meeting", relType: "customer", relId: custs[0].id, staffId: admin.id, description: "Quarterly review with Amina — culture survey roll-out to branches discussed." },
    { kind: "call", relType: "customer", relId: custs[3].id, staffId: consultant.id, description: "Call with Board Secretary on interview scheduling." },
    { kind: "email", relType: "lead", relId: leads[2].id, staffId: admin.id, description: "Sent capability statement and clarification questions on the tender." },
  ]);
  await db.insert(t.reminders).values([
    { relType: "invoice", relId: inv2[0].id, staffId: admin.id, remindAt: d(2), description: "Chase balance of INV-000002 with Board Secretary", createdBy: admin.id },
    { relType: "lead", relId: leads[0].id, staffId: staffUser.id, remindAt: d(-1), description: "Follow up on job evaluation methodology deck", createdBy: staffUser.id },
    { relType: "customer", relId: custs[1].id, staffId: admin.id, remindAt: d(7), description: "Check in on strategy workshop estimate", createdBy: admin.id },
    { relType: "contract", relId: 1, staffId: admin.id, remindAt: d(10), description: "Discuss retainer renewal before expiry", createdBy: admin.id },
  ]);

  /* ── AI prospecting: one sample run so the screen isn't empty ── */
  const [run] = await db.insert(t.prospectRuns).values({ mode: "both", status: "done", found: 3, added: 3, searches: 0, fetches: 0, sample: true, startedBy: admin.id, finishedAt: nowIso(), log: "Sample data — configure ANTHROPIC_API_KEY to run the live agent." }).returning();
  await db.insert(t.prospects).values([
    { runId: run.id, kind: "opportunity", title: "[SAMPLE] Consultancy for job evaluation and grading structure review", organisation: "A county water services company", url: "https://example.org/sample/job-evaluation-rfp", source: "Sample", location: "Kenya", deadline: d(21), services: "Job evaluation, Salary structures", summary: "Sample opportunity showing how the agent's findings look. Replace with live results by running the agent.", fitScore: 92, fitReason: "Direct match to PAC's job evaluation practice; Kenyan public-sector client.", status: "new" },
    { runId: run.id, kind: "opportunity", title: "[SAMPLE] Terms of reference: board evaluation and governance audit", organisation: "A regional SACCO", url: "https://example.org/sample/board-evaluation-tor", source: "Sample", location: "Kenya", deadline: d(14), services: "Governance, Board evaluation", summary: "Sample opportunity. Board effectiveness evaluation for a deposit-taking SACCO.", fitScore: 85, fitReason: "Governance & board evaluation is a core PAC service.", status: "new" },
    { runId: run.id, kind: "organisation", title: "[SAMPLE] Fast-growing microfinance group expanding to Uganda", organisation: "An East African microfinance group", url: "https://example.org/sample/mfi-expansion", source: "Sample", location: "Kenya / Uganda", services: "Strategy, HR policy", summary: "Sample organisation-type prospect: expansion usually triggers strategy and HR policy work.", fitScore: 64, fitReason: "Likely need for strategy and HR policy support; no advertised tender.", status: "reviewing" },
  ]);

  console.log("Seed complete.");
  console.log("  admin@pac.africa / password  (administrator)");
  console.log("  staff@pac.africa / password  (staff)");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
