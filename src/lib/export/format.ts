import type { Col, ReportResult } from "@/lib/reports/types";

export interface ExportMeta { company: string; generatedBy: string; generatedAt: string; filters: string[] }

/** Human-readable cell text (CSV / Word / screen). Numbers stay unformatted in Excel. */
export function cellText(col: Col, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  switch (col.type) {
    case "money": return Number(v).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "hours": return Number(v).toFixed(2);
    case "percent": return `${Number(v).toLocaleString("en-KE", { maximumFractionDigits: 1 })}%`;
    case "number": return Number(v).toLocaleString("en-KE");
    case "date": {
      const s = String(v);
      if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
      return new Date(`${s.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
    default: return String(v);
  }
}
export const isNumeric = (c: Col) => c.type === "money" || c.type === "number" || c.type === "hours" || c.type === "percent";
export const headerLabel = (c: Col, r: ReportResult) => (c.type === "money" ? `${c.label} (${r.currency})` : c.label);
export const fileBase = (r: ReportResult) => `${r.title.replace(/[^\w\s-]+/g, "").trim().replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;
