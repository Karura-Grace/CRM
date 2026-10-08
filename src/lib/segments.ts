/**
 * Saved segments: a stored filter over customers, contacts or leads.
 * Used by the Segments screen and by the "segment" export.
 */
import { db } from "@/db";

export type SegmentEntity = "customers" | "contacts" | "leads";
export interface SegmentFilters {
  tags?: number[];          // match ANY of these tags (customer tags for contacts)
  groupId?: number | null;  // customer group
  active?: "1" | "0" | "";  // customers/contacts: active flag
  country?: string;
  city?: string;
  statusId?: number | null; // leads
  sourceId?: number | null; // leads
  assignedId?: number | null; // leads
  primaryOnly?: boolean;    // contacts
  includeClosed?: boolean;  // leads: include lost/junk/converted
}

export function parseFilters(json: string | null | undefined): SegmentFilters {
  try { return JSON.parse(json || "{}") as SegmentFilters; } catch { return {}; }
}

/** Build filters from a form submission (shared by preview + save). */
export function filtersFromForm(fd: FormData | URLSearchParams): SegmentFilters {
  const n = (k: string) => { const v = String(fd.get(k) ?? ""); return v ? Number(v) : null; };
  return {
    tags: fd.getAll("tags").map(Number).filter((x) => x > 0),
    groupId: n("groupId"), active: (String(fd.get("active") ?? "") as SegmentFilters["active"]),
    country: String(fd.get("country") ?? "").trim(), city: String(fd.get("city") ?? "").trim(),
    statusId: n("statusId"), sourceId: n("sourceId"), assignedId: n("assignedId"),
    primaryOnly: fd.get("primaryOnly") === "on" || fd.get("primaryOnly") === "1",
    includeClosed: fd.get("includeClosed") === "on" || fd.get("includeClosed") === "1",
  };
}

const has = (v: string | null | undefined, q?: string) => !q || (v ?? "").toLowerCase().includes(q.toLowerCase());

export async function tagMap(relType: "customer" | "lead") {
  const rows = await db.query.taggings.findMany({ where: (t, { eq }) => eq(t.relType, relType), with: { tag: true } });
  const m = new Map<number, { id: number; name: string; color: string }[]>();
  for (const r of rows) m.set(r.relId, [...(m.get(r.relId) ?? []), r.tag]);
  return m;
}

export type SegmentRow = Record<string, string | number>;
export async function evaluateSegment(entity: SegmentEntity, f: SegmentFilters): Promise<{ entity: SegmentEntity; rows: SegmentRow[] }> {
  const anyTag = (ids: number[] | undefined, tags: { id: number }[] | undefined) => !ids?.length || (tags ?? []).some((t) => ids.includes(t.id));
  if (entity === "leads") {
    const tmap = await tagMap("lead");
    const leads = await db.query.leads.findMany({ with: { status: true, source: true, assigned: true } });
    return {
      entity,
      rows: leads
        .filter((l) => (f.includeClosed || (!l.lost && !l.junk && !l.convertedCustomerId)) && anyTag(f.tags, tmap.get(l.id)) && (!f.statusId || l.statusId === f.statusId) && (!f.sourceId || l.sourceId === f.sourceId) && (!f.assignedId || l.assignedId === f.assignedId) && has(l.country, f.country) && has(l.city, f.city))
        .map((l) => ({ id: l.id, name: l.name, company: l.company ?? "", email: l.email ?? "", phone: l.phoneNumber ?? "", city: l.city ?? "", country: l.country ?? "", stage: l.status?.name ?? "", source: l.source?.name ?? "", owner: l.assigned ? `${l.assigned.firstName} ${l.assigned.lastName}` : "", value: l.value, tags: (tmap.get(l.id) ?? []).map((t) => t.name).join(", ") })),
    };
  }
  const tmap = await tagMap("customer");
  const custs = (await db.query.customers.findMany({ with: { group: true, contacts: true } }))
    .filter((c) => anyTag(f.tags, tmap.get(c.id)) && (!f.groupId || c.groupId === f.groupId) && (!f.active || (f.active === "1") === c.active) && has(c.country, f.country) && has(c.city, f.city));
  if (entity === "customers") {
    return { entity, rows: custs.map((c) => { const p = c.contacts.find((x) => x.isPrimary) ?? c.contacts[0]; return { id: c.id, company: c.company, group: c.group?.name ?? "", phone: c.phoneNumber ?? "", city: c.city ?? "", country: c.country ?? "", primaryContact: p ? `${p.firstName} ${p.lastName}` : "", email: p?.email ?? "", tags: (tmap.get(c.id) ?? []).map((t) => t.name).join(", "), active: c.active ? "Yes" : "No" }; }) };
  }
  return {
    entity,
    rows: custs.flatMap((c) => c.contacts.filter((x) => (!f.primaryOnly || x.isPrimary) && x.active).map((x) => ({ id: x.id, firstName: x.firstName, lastName: x.lastName, email: x.email ?? "", phone: x.phoneNumber ?? "", title: x.title ?? "", company: c.company, city: c.city ?? "", country: c.country ?? "", primary: x.isPrimary ? "Yes" : "No", tags: (tmap.get(c.id) ?? []).map((t) => t.name).join(", ") }))),
  };
}

export const SEGMENT_COLUMNS = {
  customers: [["company", "Company"], ["group", "Group"], ["primaryContact", "Primary contact"], ["email", "Email"], ["phone", "Phone"], ["city", "City"], ["country", "Country"], ["tags", "Tags"], ["active", "Active"]],
  contacts: [["firstName", "First name"], ["lastName", "Last name"], ["email", "Email"], ["phone", "Phone"], ["title", "Title"], ["company", "Company"], ["city", "City"], ["country", "Country"], ["primary", "Primary"], ["tags", "Customer tags"]],
  leads: [["name", "Name"], ["company", "Company"], ["email", "Email"], ["phone", "Phone"], ["stage", "Stage"], ["source", "Source"], ["owner", "Owner"], ["value", "Value"], ["city", "City"], ["country", "Country"], ["tags", "Tags"]],
} as const;
