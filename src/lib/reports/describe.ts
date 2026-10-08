import { db } from "@/db";
import type { Params, ReportDef } from "./types";
import { range } from "./helpers";

/** Plain-language description of the filters applied, printed on exported files. */
export async function describeFilters(report: ReportDef, p: Params): Promise<string[]> {
  const out: string[] = [];
  const id = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : null);
  if (report.filters.includes("dateRange")) { const r = range(p, report.defaultRange); out.push(`Period ${r.from} to ${r.to}`); }
  if (p.asOf) out.push(`As of ${p.asOf}`);
  if (id(p.customerId)) out.push(`Customer: ${(await db.query.customers.findFirst({ where: (c, { eq }) => eq(c.id, id(p.customerId)!) }))?.company ?? p.customerId}`);
  if (id(p.staffId)) { const s = await db.query.staff.findFirst({ where: (c, { eq }) => eq(c.id, id(p.staffId)!) }); out.push(`Person: ${s ? `${s.firstName} ${s.lastName}` : p.staffId}`); }
  if (id(p.projectId)) out.push(`Project: ${(await db.query.projects.findFirst({ where: (c, { eq }) => eq(c.id, id(p.projectId)!) }))?.name ?? p.projectId}`);
  if (id(p.tag)) out.push(`Tag: ${(await db.query.tags.findFirst({ where: (c, { eq }) => eq(c.id, id(p.tag)!) }))?.name ?? p.tag}`);
  if (id(p.statusId)) out.push(`Stage: ${(await db.query.leadStatuses.findFirst({ where: (c, { eq }) => eq(c.id, id(p.statusId)!) }))?.name ?? p.statusId}`);
  if (p.status) out.push(`Status: ${p.status}`);
  return out;
}
