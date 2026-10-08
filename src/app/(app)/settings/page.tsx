import { db } from "@/db";
import SubmitButton from "@/components/SubmitButton";
import { Field, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { addLookup, removeLookup, saveCompanySettings, setDefault } from "./actions";
import { LOOKUPS, type LookupKind } from "./lookups";

export const metadata = { title: "Settings" };
const DEFAULTABLE = new Set<LookupKind>(["currencies", "leadStatuses", "ticketStatuses"]);

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  const kinds = Object.keys(LOOKUPS) as LookupKind[];
  const data = await Promise.all(
    kinds.map(async (k) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (await db.select().from(LOOKUPS[k].table as any)) as Record<string, unknown>[];
      return [k, rows] as const;
    }),
  );

  return (
    <>
      <PageHeader title="Settings" subtitle="Company information and every configurable list used across the CRM" />
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <a href="#company" className="btn-secondary btn-sm">Company</a>
        <a href="#sales" className="btn-secondary btn-sm">Sales</a>
        <a href="#ai" className="btn-secondary btn-sm">AI prospecting</a>
        {kinds.map((k) => <a key={k} href={`#${k}`} className="btn-secondary btn-sm">{LOOKUPS[k].title}</a>)}
      </nav>

      <form action={saveCompanySettings} className="space-y-6">
        <section id="company" className="card">
          <h2 className="mb-4">Company information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company name"><input name="company_name" className="field-input" defaultValue={s.company_name} /></Field>
            <Field label="Email"><input name="company_email" type="email" className="field-input" defaultValue={s.company_email} /></Field>
            <Field label="Phone"><input name="company_phone" className="field-input" defaultValue={s.company_phone} /></Field>
            <Field label="VAT / KRA PIN"><input name="company_vat" className="field-input" defaultValue={s.company_vat} /></Field>
            <Field label="Address (shown on documents)" className="sm:col-span-2"><textarea name="company_address" rows={3} className="field-input" defaultValue={s.company_address} /></Field>
          </div>
        </section>
        <section id="sales" className="card">
          <h2 className="mb-4">Sales documents</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Invoice number prefix"><input name="invoice_prefix" className="field-input" defaultValue={s.invoice_prefix} /></Field>
            <Field label="Estimate number prefix"><input name="estimate_prefix" className="field-input" defaultValue={s.estimate_prefix} /></Field>
            <Field label="Default invoice due (days)"><input name="invoice_due_days" type="number" min="0" className="field-input" defaultValue={s.invoice_due_days} /></Field>
            <Field label="Default tax % (used when invoicing timesheet hours)"><input name="default_tax_rate" type="number" min="0" max="100" step="any" className="field-input" defaultValue={s.default_tax_rate} /></Field>
            <Field label="Default invoice terms / payment details" className="sm:col-span-3"><textarea name="invoice_terms" rows={3} className="field-input" defaultValue={s.invoice_terms} /></Field>
            <Field label="Default estimate terms" className="sm:col-span-3"><textarea name="estimate_terms" rows={3} className="field-input" defaultValue={s.estimate_terms} /></Field>
          </div>
        </section>
        <section id="ai" className="card scroll-mt-6">
          <h2 className="mb-1">AI prospecting</h2>
          <p className="muted mb-4">The agent uses this profile to judge fit, and reads the listed pages on every run. The API key is set on the server (<code>ANTHROPIC_API_KEY</code> in <code>.env</code>), never here.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="PAC profile — services, sectors, regions, what to ignore" className="sm:col-span-3"><textarea name="ai_profile" rows={7} className="field-input" defaultValue={s.ai_profile} /></Field>
            <Field label="Source pages to read on each run (one URL per line: tender portals, job boards, RFP listings)" className="sm:col-span-3"><textarea name="ai_sources" rows={4} className="field-input font-mono text-xs" defaultValue={s.ai_sources} /></Field>
            <Field label="Claude model"><input name="ai_model" className="field-input" defaultValue={s.ai_model} /></Field>
            <Field label="Max web searches per run"><input name="ai_max_searches" type="number" min="1" max="20" className="field-input" defaultValue={s.ai_max_searches} /></Field>
            <Field label="Run automatically with the daily job">
              <select name="ai_auto_daily" defaultValue={s.ai_auto_daily} className="field-input"><option value="0">Off</option><option value="1">On</option></select>
            </Field>
          </div>
        </section>
        <SubmitButton>Save settings</SubmitButton>
      </form>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.map(([kind, rows]) => {
          const cfg = LOOKUPS[kind];
          const add = async (fd: FormData) => { "use server"; await addLookup(kind, fd); };
          return (
            <section key={kind} id={kind} className="card scroll-mt-6">
              <h2 className="mb-3">{cfg.title}</h2>
              <ul className="mb-4 divide-y divide-slate-100 text-sm">
                {rows.length === 0 && <li className="muted py-2">Empty.</li>}
                {rows.map((r) => {
                  const id = Number(r.id);
                  const rm = async () => { "use server"; await removeLookup(kind, id); };
                  const def = async () => { "use server"; await setDefault(kind as "currencies", id); };
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        {typeof r.color === "string" && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />}
                        <span className="truncate">{String(r.name)}</span>
                        {cfg.fields.filter((f) => f.name !== "name" && f.name !== "color").map((f) => r[f.name] != null && r[f.name] !== "" ? <span key={f.name} className="muted truncate">· {String(r[f.name]).slice(0, 60)}</span> : null)}
                        {r.isDefault === true && <span className="badge bg-brand-100 text-brand-800">default</span>}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {DEFAULTABLE.has(kind) && r.isDefault !== true && <form action={def}><button className="btn-ghost btn-sm">Set default</button></form>}
                        <form action={rm}><SubmitButton className="btn-ghost btn-sm text-rose-600" confirm="Remove this entry?">✕</SubmitButton></form>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <form action={add} className="flex flex-wrap items-end gap-2">
                {cfg.fields.map((f) =>
                  f.type === "textarea" ? (
                    <textarea key={f.name} name={f.name} placeholder={f.label} required={"required" in f && f.required} rows={2} className="field-input w-full" />
                  ) : (
                    <input key={f.name} name={f.name} type={f.type} placeholder={f.label} required={"required" in f && f.required} defaultValue={f.type === "color" ? "#1d5cf1" : undefined} className={f.type === "color" ? "h-9 w-12 rounded border" : f.type === "number" ? "field-input w-20" : "field-input min-w-32 flex-1"} />
                  ),
                )}
                <SubmitButton className="btn-secondary">Add</SubmitButton>
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}
