import ExportButtons from "@/components/ExportButtons";
import Link from "next/link";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { leadStatuses, leads } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { getDefaultCurrency } from "@/lib/settings";
import { fmtDate, money } from "@/lib/utils";
import { TagChip } from "@/components/crm";
import { tagMap } from "@/lib/segments";

export const metadata = { title: "Leads" };

export default async function LeadsBoard({ searchParams }: { searchParams: Promise<{ show?: string; tag?: string }> }) {
  const { show, tag } = await searchParams;
  const tagId = tag ? Number(tag) : null;
  const [tmap, allTags] = await Promise.all([tagMap("lead"), db.query.tags.findMany()]);
  const cur = await getDefaultCurrency();
  const statuses = await db.query.leadStatuses.findMany({ orderBy: asc(leadStatuses.order) });
  const filter =
    show === "lost" ? eq(leads.lost, true)
    : show === "junk" ? eq(leads.junk, true)
    : show === "converted" ? undefined
    : and(eq(leads.lost, false), eq(leads.junk, false), isNull(leads.convertedCustomerId));
  let rows = await db.query.leads.findMany({ where: filter, with: { assigned: true, source: true }, orderBy: desc(leads.id) });
  if (show === "converted") rows = rows.filter((r) => r.convertedCustomerId);
  if (tagId) rows = rows.filter((r) => (tmap.get(r.id) ?? []).some((t) => t.id === tagId));

  const columns = [...statuses.map((s) => ({ id: s.id as number | null, name: s.name, color: s.color })), { id: null, name: "No status", color: "#94a3b8" }];
  const tabs = [
    { key: undefined, label: "Active" },
    { key: "converted", label: "Converted" },
    { key: "lost", label: "Lost" },
    { key: "junk", label: "Junk" },
  ];

  return (
    <>
      <PageHeader title="Leads" subtitle="Pipeline grouped by lead status" actions={<Link href="/leads/create" className="btn-primary">+ New lead</Link>} />
      <div className="-mt-3 mb-4 flex justify-end"><ExportButtons report="leads-list" params={{}} compact /></div>
      {allTags.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-slate-500">Tag:</span>
          <Link href={show ? `/leads?show=${show}` : "/leads"} className={`btn btn-sm ${!tagId ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`}>Any</Link>
          {allTags.map((t) => <Link key={t.id} href={`/leads?tag=${t.id}${show ? `&show=${show}` : ""}`} className={`btn btn-sm ${tagId === t.id ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`}>{t.name}</Link>)}
          <Link href="/reports/pipeline-forecast" className="ml-auto text-sm">Weighted forecast →</Link>
        </div>
      )}
      <div className="mb-4 flex gap-1">
        {tabs.map((t) => (
          <Link key={t.label} href={t.key ? `/leads?show=${t.key}` : "/leads"} className={`btn-sm btn ${show === t.key ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const items = rows.filter((r) => r.statusId === col.id);
          if (col.id === null && items.length === 0) return null;
          const value = items.reduce((a, r) => a + r.value, 0);
          const prob = statuses.find((x) => x.id === col.id)?.probability ?? 0;
          return (
            <div key={col.name} className="kanban-col" data-testid="kanban-col">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />{col.name}</span>
                <span className="text-xs text-slate-500">{items.length}</span>
              </div>
              {value > 0 && <div className="text-xs text-slate-500">{money(value, cur.symbol)}{col.id !== null && ` · weighted ${money((value * prob) / 100, cur.symbol)} (${prob}%)`}</div>}
              {items.map((l) => (
                <Link key={l.id} href={`/leads/${l.id}`} className="kanban-card">
                  <div className="font-medium text-slate-900">{l.name}</div>
                  {l.company && <div className="text-slate-500">{l.company}</div>}
                  {(tmap.get(l.id) ?? []).length > 0 && <div className="mt-1 flex flex-wrap gap-1">{(tmap.get(l.id) ?? []).map((t) => <TagChip key={t.id} name={t.name} color={t.color} />)}</div>}
                  {l.expectedClose && <div className="mt-1 text-xs text-slate-500">Close {fmtDate(l.expectedClose)}</div>}
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{l.source?.name ?? ""}</span>
                    <span>{l.assigned ? `${l.assigned.firstName} ${l.assigned.lastName[0] ?? ""}.` : "Unassigned"}</span>
                  </div>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
