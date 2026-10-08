/** Resolve a (relType, relId) pair to a readable label + link, for reminders and activity. */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, customers, estimates, invoices, leads, projects, proposals, tasks, tickets } from "@/db/schema";

export async function relLabel(relType: string, relId: number): Promise<{ label: string; href: string }> {
  const gone = (what: string) => ({ label: `${what} (deleted)`, href: "/dashboard" });
  switch (relType) {
    case "customer": { const r = await db.query.customers.findFirst({ where: eq(customers.id, relId) }); return r ? { label: `Customer · ${r.company}`, href: `/customers/${relId}` } : gone("Customer"); }
    case "lead": { const r = await db.query.leads.findFirst({ where: eq(leads.id, relId) }); return r ? { label: `Lead · ${r.name}`, href: `/leads/${relId}` } : gone("Lead"); }
    case "invoice": { const r = await db.query.invoices.findFirst({ where: eq(invoices.id, relId) }); return r ? { label: `Invoice · ${r.number}`, href: `/invoices/${relId}` } : gone("Invoice"); }
    case "estimate": { const r = await db.query.estimates.findFirst({ where: eq(estimates.id, relId) }); return r ? { label: `Estimate · ${r.number}`, href: `/estimates/${relId}` } : gone("Estimate"); }
    case "proposal": { const r = await db.query.proposals.findFirst({ where: eq(proposals.id, relId) }); return r ? { label: `Proposal · ${r.subject}`, href: `/proposals/${relId}` } : gone("Proposal"); }
    case "project": { const r = await db.query.projects.findFirst({ where: eq(projects.id, relId) }); return r ? { label: `Project · ${r.name}`, href: `/projects/${relId}` } : gone("Project"); }
    case "task": { const r = await db.query.tasks.findFirst({ where: eq(tasks.id, relId) }); return r ? { label: `Task · ${r.name}`, href: `/tasks/${relId}` } : gone("Task"); }
    case "ticket": { const r = await db.query.tickets.findFirst({ where: eq(tickets.id, relId) }); return r ? { label: `Ticket #${relId} · ${r.subject}`, href: `/tickets/${relId}` } : gone("Ticket"); }
    case "contract": { const r = await db.query.contracts.findFirst({ where: eq(contracts.id, relId) }); return r ? { label: `Contract · ${r.subject}`, href: `/contracts/${relId}` } : gone("Contract"); }
    default: return { label: `${relType} #${relId}`, href: "/dashboard" };
  }
}
