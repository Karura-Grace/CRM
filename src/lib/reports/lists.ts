import { db } from "@/db";
import { evaluateSegment, parseFilters, SEGMENT_COLUMNS, type SegmentEntity } from "@/lib/segments";
import { defaultSymbol, money, num, sum, today } from "./helpers";
import type { Col, ReportDef } from "./types";

const segCols = (entity: SegmentEntity): Col[] => SEGMENT_COLUMNS[entity].map(([key, label]) => ({ key, label, type: key === "value" ? "money" : "text", width: ["company", "email", "tags"].includes(key) ? 26 : undefined }));

export const listReports: ReportDef[] = [
  {
    key: "customers-list", title: "Customer list", description: "All customers with primary contact, group and tags. Filter by tag.", category: "Lists & exports", filters: ["tag"],
    async run(p) {
      const r = await evaluateSegment("customers", { tags: num(p.tag) ? [num(p.tag)!] : [] });
      return { title: "Customer list", subtitle: `${r.rows.length} customers`, currency: await defaultSymbol(), columns: segCols("customers"), rows: r.rows };
    },
  },
  {
    key: "contacts-list", title: "Contacts / mailing list", description: "Every active contact with company and email — ready for a mail merge. Filter by customer tag.", category: "Lists & exports", filters: ["tag"],
    async run(p) {
      const r = await evaluateSegment("contacts", { tags: num(p.tag) ? [num(p.tag)!] : [] });
      return { title: "Contacts / mailing list", subtitle: `${r.rows.length} contacts`, currency: await defaultSymbol(), columns: segCols("contacts"), rows: r.rows };
    },
  },
  {
    key: "leads-list", title: "Lead list", description: "Open leads with stage, source, owner and tags. Filter by stage or tag.", category: "Lists & exports", filters: ["leadStatus", "tag", "staff"],
    async run(p) {
      const r = await evaluateSegment("leads", { tags: num(p.tag) ? [num(p.tag)!] : [], statusId: num(p.statusId), assignedId: num(p.staffId) });
      const sym = await defaultSymbol();
      return { title: "Lead list", subtitle: `${r.rows.length} open leads`, currency: sym, columns: segCols("leads"), rows: r.rows, totals: { name: "Total", value: sum(r.rows, (x) => Number(x.value) || 0) } };
    },
  },
  {
    key: "segment", title: "Saved segment", description: "Export any saved segment (customers, contacts or leads).", category: "Lists & exports", filters: ["segment"],
    async run(p) {
      const sym = await defaultSymbol();
      const seg = num(p.segmentId) ? await db.query.savedSegments.findFirst({ where: (s, { eq }) => eq(s.id, num(p.segmentId)!) }) : null;
      if (!seg) return { title: "Saved segment", subtitle: "Choose a segment", currency: sym, columns: [{ key: "info", label: "" }], rows: [{ info: "Pick a saved segment (create them under Segments)." }] };
      const r = await evaluateSegment(seg.entity, parseFilters(seg.filters));
      return { title: `Segment — ${seg.name}`, subtitle: `${r.rows.length} ${seg.entity}`, currency: sym, columns: segCols(seg.entity), rows: r.rows };
    },
  },
  {
    key: "prospects-list", title: "AI prospects", description: "Opportunities found by the AI prospecting agent, with fit score, deadline and source link.", category: "Lists & exports", filters: ["prospectStatus"],
    async run(p) {
      const ps = (await db.query.prospects.findMany({ with: { lead: true } })).filter((x) => !p.status || x.status === p.status).sort((a, b) => b.fitScore - a.fitScore);
      return {
        title: "AI prospects", subtitle: `${ps.length} prospects`, currency: await defaultSymbol(),
        columns: [{ key: "fitScore", label: "Fit", type: "number" }, { key: "title", label: "Opportunity", width: 40 }, { key: "organisation", label: "Organisation", width: 26 }, { key: "kind", label: "Type" }, { key: "location", label: "Location" }, { key: "deadline", label: "Deadline", type: "date" }, { key: "services", label: "PAC services", width: 26 }, { key: "status", label: "Status" }, { key: "lead", label: "Lead" }, { key: "url", label: "Link", width: 40 }, { key: "fitReason", label: "Why it fits", width: 40 }],
        rows: ps.map((x) => ({ fitScore: x.fitScore, title: x.title, organisation: x.organisation ?? "", kind: x.kind, location: x.location ?? "", deadline: x.deadline ?? "", services: x.services ?? "", status: x.status, lead: x.lead?.name ?? "", url: x.url, fitReason: x.fitReason ?? "" })),
      };
    },
  },
  {
    key: "reminders-list", title: "Reminders", description: "Follow-up reminders by owner and due date.", category: "Lists & exports", filters: ["staff", "reminderStatus"],
    async run(p) {
      const sid = num(p.staffId), t0 = today();
      const rs = (await db.query.reminders.findMany({ with: { staff: true } })).filter((r) => (!sid || r.staffId === sid) && (p.status === "done" ? r.isDone : p.status === "all" ? true : !r.isDone)).sort((a, b) => a.remindAt.localeCompare(b.remindAt));
      return {
        title: "Reminders", subtitle: `${rs.length} reminders`, currency: await defaultSymbol(),
        columns: [{ key: "due", label: "Due", type: "date" }, { key: "owner", label: "Owner" }, { key: "description", label: "Reminder", width: 40 }, { key: "about", label: "About" }, { key: "state", label: "State" }],
        rows: rs.map((r) => ({ due: r.remindAt, owner: `${r.staff.firstName} ${r.staff.lastName}`, description: r.description, about: `${r.relType} #${r.relId}`, state: r.isDone ? "Done" : r.remindAt < t0 ? "Overdue" : r.remindAt === t0 ? "Due today" : "Upcoming" })),
      };
    },
  },
];
export { money };
