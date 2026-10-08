import ExcelJS from "exceljs";
import type { ReportResult } from "@/lib/reports/types";
import { type ExportMeta, headerLabel } from "./format";
import { CELL_FILL, ganttGrid, MILESTONE_COLOR } from "./timeline";

const BRAND = "FF183AB3";

/** Excel workbook: a formatted data sheet (frozen header, filters, number formats, totals) + a summary sheet. */
export async function toXlsx(r: ReportResult, meta: ExportMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.company; wb.created = new Date();
  const ws = wb.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 5 }] });

  ws.mergeCells(1, 1, 1, Math.max(1, r.columns.length));
  ws.getCell(1, 1).value = r.title;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: BRAND } };
  ws.getCell(2, 1).value = [meta.company, r.subtitle].filter(Boolean).join(" · ");
  ws.getCell(3, 1).value = `Generated ${meta.generatedAt} by ${meta.generatedBy}${meta.filters.length ? ` · Filters: ${meta.filters.join("; ")}` : ""}`;
  ws.getCell(2, 1).font = ws.getCell(3, 1).font = { color: { argb: "FF64748B" }, size: 9 };

  const headerRow = ws.getRow(5);
  r.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = headerLabel(c, r);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle", wrapText: true };
    const col = ws.getColumn(i + 1);
    col.width = c.width ?? (c.type === "date" ? 13 : c.type && c.type !== "text" ? 15 : 18);
    if (c.type === "money") col.numFmt = "#,##0.00";
    else if (c.type === "hours") col.numFmt = "0.00";
    else if (c.type === "percent") col.numFmt = "0.0%";
    else if (c.type === "number") col.numFmt = "#,##0";
    else if (c.type === "date") col.numFmt = "dd-mmm-yyyy";
  });
  headerRow.height = 22;

  const value = (type: string | undefined, v: unknown) => {
    if (v === null || v === undefined || v === "") return null;
    if (type === "money" || type === "number" || type === "hours") return Number(v);
    if (type === "percent") return Number(v) / 100;
    if (type === "date" && /^\d{4}-\d{2}-\d{2}/.test(String(v))) return new Date(`${String(v).slice(0, 10)}T00:00:00Z`);
    if (typeof v === "string" && /^https?:\/\//.test(v)) return { text: v, hyperlink: v };
    return String(v);
  };
  for (const row of r.rows) ws.addRow(r.columns.map((c) => value(c.type, row[c.key])));
  if (r.rows.length) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + r.rows.length, column: r.columns.length } };
  if (r.totals) {
    const t = ws.addRow(r.columns.map((c) => value(c.type, r.totals![c.key])));
    t.font = { bold: true };
    t.eachCell((cell) => { cell.border = { top: { style: "thin", color: { argb: "FF94A3B8" } } }; });
  }

  if (r.summary?.length || r.notes?.length || r.charts?.length) {
    const s = wb.addWorksheet("Summary");
    s.getColumn(1).width = 34; s.getColumn(2).width = 24;
    s.addRow([r.title]).font = { bold: true, size: 13, color: { argb: BRAND } };
    s.addRow([r.subtitle ?? ""]);
    s.addRow([]);
    for (const x of r.summary ?? []) s.addRow([x.label, x.value]);
    for (const c of r.charts ?? []) {
      s.addRow([]);
      s.addRow([c.title]).font = { bold: true };
      s.addRow(["", ...c.series.map((x) => x.name)]).font = { bold: true };
      c.categories.forEach((cat, i) => s.addRow([cat, ...c.series.map((x) => x.values[i])]));
    }
    for (const n of r.notes ?? []) { s.addRow([]); s.addRow([n]).font = { italic: true, color: { argb: "FF64748B" } }; }
  }
  if (r.timeline?.items.length) {
    // Gantt sheet: one row per item, one column per week (or month), shaded cells.
    const g = ganttGrid(r.timeline.items, r.timeline.today, 104);
    const gs = wb.addWorksheet("Gantt", { views: [{ state: "frozen", xSplit: 3, ySplit: 4 }] });
    gs.getCell(1, 1).value = /gantt/i.test(r.title) ? r.title : `${r.title} — Gantt`;
    gs.getCell(1, 1).font = { bold: true, size: 13, color: { argb: BRAND } };
    gs.getCell(2, 1).value = r.timeline.items.some((i) => i.logged)
      ? `One column per ${g.unit}. Light blue = planned window, dark blue = time logged (hours shown). Bordered column = today.`
      : `One column per ${g.unit}. Light blue = planned, dark blue = complete, red = overdue, ◆ = milestone. Bordered column = today.`;
    gs.getCell(2, 1).font = { color: { argb: "FF64748B" }, size: 9 };
    gs.getColumn(1).width = 42; gs.getColumn(2).width = 12; gs.getColumn(3).width = 12;
    const head = gs.getRow(4);
    ["Item", "Start", "End"].forEach((h, i) => { const c = head.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } }; });
    g.buckets.forEach((b, i) => {
      const c = head.getCell(i + 4);
      c.value = b.label; c.alignment = { textRotation: 90, horizontal: "center" };
      c.font = { bold: b.today, size: 8, color: { argb: b.today ? "FFFFFFFF" : "FF334155" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: b.today ? "FF0F172A" : "FFF1F5F9" } };
      gs.getColumn(i + 4).width = r.timeline!.items.some((x) => x.logged) ? 4.2 : 3.2;
    });
    head.height = 44;
    g.rows.forEach(({ item, cells }, ri) => {
      const row = gs.getRow(5 + ri);
      row.getCell(1).value = `${item.level === 1 ? "    " : ""}${item.label}${item.overdue ? "  (overdue)" : ""}`;
      if (item.level !== 1) row.getCell(1).font = { bold: true };
      const dt = (s?: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);
      row.getCell(2).value = dt(item.start ?? item.end); row.getCell(3).value = dt(item.end ?? item.start);
      row.getCell(2).numFmt = row.getCell(3).numFmt = "dd-mmm-yy";
      cells.forEach((c, ci) => {
        const cell = row.getCell(ci + 4);
        if (c.state) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${CELL_FILL[c.state]}` } };
        if (c.hours) { cell.value = c.hours; cell.font = { size: 7, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center" }; }
        if (c.milestone) { cell.value = "◆"; cell.font = { bold: true, color: { argb: `FF${MILESTONE_COLOR}` } }; cell.alignment = { horizontal: "center" }; cell.note = c.milestone; }
        if (g.buckets[ci].today) cell.border = { left: { style: "thin", color: { argb: "FF0F172A" } }, right: { style: "thin", color: { argb: "FF0F172A" } } };
      });
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
