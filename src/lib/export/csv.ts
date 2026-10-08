import type { ReportResult } from "@/lib/reports/types";
import { headerLabel, isNumeric } from "./format";

const q = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection for text cells.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV with a UTF-8 BOM so Excel opens accented names and "–" correctly. Numbers are raw (no thousands separators). */
export function toCsv(r: ReportResult): Buffer {
  const lines = [r.columns.map((c) => q(headerLabel(c, r))).join(",")];
  const rowLine = (row: Record<string, unknown>) => r.columns.map((c) => { const v = row[c.key]; return isNumeric(c) && v !== null && v !== undefined && v !== "" ? String(v) : q(v); }).join(",");
  for (const row of r.rows) lines.push(rowLine(row));
  if (r.totals) lines.push(rowLine(r.totals));
  return Buffer.from("﻿" + lines.join("\r\n") + "\r\n", "utf8");
}
