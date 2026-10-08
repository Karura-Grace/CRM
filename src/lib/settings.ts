import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, currencies, settings } from "@/db/schema";

export const SETTING_KEYS = [
  "company_name",
  "company_email",
  "company_phone",
  "company_address",
  "company_vat",
  "invoice_prefix",
  "estimate_prefix",
  "invoice_due_days",
  "invoice_terms",
  "estimate_terms",
  "default_tax_rate",
  "ai_profile",
  "ai_sources",
  "ai_model",
  "ai_max_searches",
  "ai_auto_daily",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export const SETTING_DEFAULTS: Record<SettingKey, string> = {
  company_name: "PAC CRM",
  company_email: "",
  company_phone: "",
  company_address: "",
  company_vat: "",
  invoice_prefix: "INV",
  estimate_prefix: "EST",
  invoice_due_days: "30",
  invoice_terms: "",
  estimate_terms: "",
  default_tax_rate: "16",
  ai_profile:
    "Priority Activator Consulting (PAC) is a Nairobi-based management consultancy. We advise organisations on: strategy and strategic planning; corporate governance and board evaluation; human resources (job evaluation and grading, salary structures, HR policy development, organisational culture assessment, performance management); policy development; leadership and management training; general business advisory.\nTarget clients: corporates, NGOs and development partners, public-sector bodies, SACCOs and SMEs.\nTarget regions: Kenya first, then the wider East African region (Uganda, Tanzania, Rwanda, Ethiopia).\nLook for: requests for proposals (RFPs), expressions of interest (EOIs), tenders, terms of reference and consultancy job adverts for the services above. Ignore: IT/software, construction/engineering, audit-only, procurement of goods, and individual employment vacancies.",
  ai_sources: "https://www.tenders.go.ke\nhttps://www.ungm.org/Public/Notice\nhttps://www.reliefweb.int/jobs?search=consultancy%20kenya",
  ai_model: "claude-sonnet-5-5",
  ai_max_searches: "8",
  ai_auto_daily: "0",
};

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const rows = await db.select().from(settings);
  const out = { ...SETTING_DEFAULTS };
  for (const r of rows) if ((SETTING_KEYS as readonly string[]).includes(r.name)) out[r.name as SettingKey] = r.value;
  return out;
}

export async function getDefaultCurrency() {
  const cur = await db.query.currencies.findFirst({ where: eq(currencies.isDefault, true) });
  return cur ?? { id: null as number | null, name: "KES", symbol: "KES", isDefault: true };
}

export async function logActivity(description: string, opts: { staffId?: number | null; relType?: string; relId?: number } = {}) {
  await db.insert(activityLog).values({
    description,
    staffId: opts.staffId ?? null,
    relType: opts.relType ?? null,
    relId: opts.relId ?? null,
  });
}
