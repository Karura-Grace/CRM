import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { leadSources, leadStatuses, savedSegments } from "@/db/schema";
import ExportButtons from "@/components/ExportButtons";
import SubmitButton from "@/components/SubmitButton";
import { Empty, PageHeader } from "@/components/ui";
import { evaluateSegment, filtersFromForm, parseFilters, SEGMENT_COLUMNS, type SegmentEntity, type SegmentFilters } from "@/lib/segments";
import { deleteSegment, saveSegment } from "../crm/actions";

export const metadata = { title: "Segments" };

/** Turn saved filters back into query params so a segment can be reopened in the builder. */
function toParams(entity: string, f: SegmentFilters) {
  const p = new URLSearchParams({ entity });
  for (const t of f.tags ?? []) p.append("tags", String(t));
  for (const k of ["groupId", "active", "country", "city", "statusId", "sourceId", "assignedId"] as const) if (f[k]) p.set(k, String(f[k]));
  if (f.primaryOnly) p.set("primaryOnly", "1");
  if (f.includeClosed) p.set("includeClosed", "1");
  return p;
}

export default async function SegmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const raw = await searchParams;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) for (const x of Array.isArray(v) ? v : [v]) sp.append(k, x);
  const saved = await db.query.savedSegments.findMany({ orderBy: desc(savedSegments.id), with: { creator: true } });
  const opened = sp.get("id") ? saved.find((s) => s.id === Number(sp.get("id"))) : null;
  const params = opened ? toParams(opened.entity, parseFilters(opened.filters)) : sp;
  const entity = (["customers", "contacts", "leads"].includes(params.get("entity") ?? "") ? params.get("entity") : "contacts") as SegmentEntity;
  const filters = filtersFromForm(params);
  const [tags, groups, stages, sources, people, counts] = await Promise.all([
    db.query.tags.findMany(), db.query.customerGroups.findMany(), db.query.leadStatuses.findMany({ orderBy: asc(leadStatuses.order) }),
    db.query.leadSources.findMany({ orderBy: asc(leadSources.name) }), db.query.staff.findMany(),
    Promise.all(saved.map((s) => evaluateSegment(s.entity, parseFilters(s.filters)).then((r) => r.rows.length))),
  ]);
  const preview = await evaluateSegment(entity, filters);
  const cols = SEGMENT_COLUMNS[entity];
  const hidden = [...params.entries()].filter(([k]) => k !== "id" && k !== "name");
  const v = (k: string) => params.get(k) ?? "";

  return (
    <>
      <PageHeader title="Segments" subtitle="Filter customers, contacts or leads by tags and attributes, save the filter, and export it as a list (e.g. for a mailing)." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <h2 className="mb-3">{opened ? `Segment: ${opened.name}` : "Build a segment"}</h2>
          <form action="/segments" className="space-y-3" data-testid="segment-builder">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <label className="block"><span className="field-label">List of</span>
                <select name="entity" defaultValue={entity} className="field-input"><option value="contacts">Contacts</option><option value="customers">Customers</option><option value="leads">Leads</option></select>
              </label>
              <label className="block"><span className="field-label">Customer group</span>
                <select name="groupId" defaultValue={v("groupId")} className="field-input"><option value="">Any</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              </label>
              <label className="block"><span className="field-label">Country contains</span><input name="country" defaultValue={v("country")} className="field-input" /></label>
              <label className="block"><span className="field-label">City contains</span><input name="city" defaultValue={v("city")} className="field-input" /></label>
              <label className="block"><span className="field-label">Lead stage</span>
                <select name="statusId" defaultValue={v("statusId")} className="field-input"><option value="">Any</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </label>
              <label className="block"><span className="field-label">Lead source</span>
                <select name="sourceId" defaultValue={v("sourceId")} className="field-input"><option value="">Any</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </label>
              <label className="block"><span className="field-label">Lead owner</span>
                <select name="assignedId" defaultValue={v("assignedId")} className="field-input"><option value="">Anyone</option>{people.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}</select>
              </label>
              <label className="block"><span className="field-label">Customer status</span>
                <select name="active" defaultValue={v("active")} className="field-input"><option value="">Any</option><option value="1">Active</option><option value="0">Inactive</option></select>
              </label>
            </div>
            <div>
              <span className="field-label">Tags (match any)</span>
              <div className="flex flex-wrap gap-3 text-sm">{tags.map((t) => <label key={t.id} className="flex items-center gap-1.5"><input type="checkbox" name="tags" value={t.id} defaultChecked={(filters.tags ?? []).includes(t.id)} />{t.name}</label>)}{tags.length === 0 && <span className="muted">No tags yet — add them on customer or lead pages.</span>}</div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-1.5"><input type="checkbox" name="primaryOnly" value="1" defaultChecked={filters.primaryOnly} /> Contacts: primary only</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" name="includeClosed" value="1" defaultChecked={filters.includeClosed} /> Leads: include lost / junk / converted</label>
            </div>
            <div className="flex gap-2"><button className="btn-primary">Preview</button><Link href="/segments" className="btn-ghost">Clear</Link></div>
          </form>

          <form action={saveSegment} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
            {hidden.map(([k, val], i) => <input key={`${k}${i}`} type="hidden" name={k} value={val} />)}
            {!hidden.some(([k]) => k === "entity") && <input type="hidden" name="entity" value={entity} />}
            <label className="block flex-1"><span className="field-label">Save this filter as</span><input name="name" required placeholder="e.g. NGO clients — primary contacts" className="field-input" /></label>
            <SubmitButton className="btn-secondary">Save segment</SubmitButton>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{preview.rows.length} matching {entity}</h3>
            {opened && <ExportButtons report="segment" params={{ segmentId: opened.id }} compact />}
          </div>
          {preview.rows.length === 0 ? <div className="mt-2"><Empty>No matches.</Empty></div> : (
            <div className="mt-2 overflow-x-auto">
              <table className="table" data-testid="segment-preview">
                <thead><tr>{cols.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
                <tbody>{preview.rows.slice(0, 50).map((r, i) => <tr key={i}>{cols.map(([k]) => <td key={k}>{String(r[k] ?? "")}</td>)}</tr>)}</tbody>
              </table>
              {preview.rows.length > 50 && <p className="muted mt-2">Showing 50 of {preview.rows.length}. Save the segment to export all.</p>}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3">Saved segments</h2>
          {saved.length === 0 ? <p className="muted">None yet.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {saved.map((s, i) => {
                const del = async () => { "use server"; await deleteSegment(s.id); };
                return (
                  <li key={s.id} className="space-y-2 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div><Link href={`/segments?id=${s.id}`} className="font-medium">{s.name}</Link><div className="text-xs text-slate-500">{counts[i]} {s.entity}{s.creator ? ` · ${s.creator.firstName}` : ""}</div></div>
                      <form action={del}><SubmitButton className="btn-ghost btn-sm text-rose-600" confirm="Delete this saved segment?">✕</SubmitButton></form>
                    </div>
                    <ExportButtons report="segment" params={{ segmentId: s.id }} compact />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
