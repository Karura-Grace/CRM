import {
  AlignmentType, BorderStyle, Document, Footer, Header, Packer, PageNumber, PageOrientation, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import type { ReportResult } from "@/lib/reports/types";
import { cellText, type ExportMeta, headerLabel, isNumeric } from "./format";
import { CELL_FILL, ganttGrid, MILESTONE_COLOR } from "./timeline";

const BRAND = "183AB3", MUTED = "64748B", LINE = "E2E8F0";
const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin };
const MAX_ROWS = 2000;

function cell(text: string, o: { bold?: boolean; right?: boolean; fill?: string; color?: string; size?: number } = {}) {
  return new TableCell({
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ alignment: o.right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text, bold: o.bold, color: o.color, size: o.size ?? 16, font: "Calibri" })] })],
  });
}

/** Word report: letterhead header, summary table, data table (landscape when wide), notes, page numbers. */
export async function toDocx(r: ReportResult, meta: ExportMeta): Promise<Buffer> {
  const wide = r.columns.length > 6;
  const fontSize = r.columns.length > 10 ? 14 : 16;
  const rows = r.rows.slice(0, MAX_ROWS);
  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: r.title, bold: true, size: 36, color: BRAND, font: "Calibri" })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: [r.subtitle, `Generated ${meta.generatedAt} by ${meta.generatedBy}`].filter(Boolean).join(" · "), size: 18, color: MUTED, font: "Calibri" })], spacing: { after: meta.filters.length ? 40 : 200 } }),
  ];
  if (meta.filters.length) children.push(new Paragraph({ children: [new TextRun({ text: `Filters: ${meta.filters.join("; ")}`, size: 18, color: MUTED, font: "Calibri" })], spacing: { after: 200 } }));

  if (r.summary?.length) {
    children.push(new Table({
      width: { size: wide ? 50 : 70, type: WidthType.PERCENTAGE }, borders,
      rows: r.summary.map((s) => new TableRow({ children: [cell(s.label, { color: MUTED, size: 18 }), cell(s.value, { bold: true, right: true, size: 18 })] })),
    }));
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
  }

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, borders,
    rows: [
      new TableRow({ tableHeader: true, children: r.columns.map((c) => cell(headerLabel(c, r), { bold: true, fill: BRAND, color: "FFFFFF", right: isNumeric(c), size: fontSize })) }),
      ...rows.map((row, i) => new TableRow({ children: r.columns.map((c) => cell(cellText(c, row[c.key]), { right: isNumeric(c), fill: i % 2 ? "F8FAFC" : undefined, size: fontSize })) })),
      ...(r.totals ? [new TableRow({ children: r.columns.map((c) => cell(cellText(c, r.totals![c.key]), { bold: true, right: isNumeric(c), fill: "EEF2FF", size: fontSize })) })] : []),
    ],
  }));
  if (r.rows.length > MAX_ROWS) children.push(new Paragraph({ children: [new TextRun({ text: `Showing the first ${MAX_ROWS} of ${r.rows.length} rows — export to Excel for the full data.`, italics: true, size: 16, color: MUTED })], spacing: { before: 120 } }));
  for (const n of r.notes ?? []) children.push(new Paragraph({ children: [new TextRun({ text: n, italics: true, size: 16, color: MUTED, font: "Calibri" })], spacing: { before: 160 } }));

  // Gantt: its own landscape section, weeks (or months when the span is long) as columns.
  const ganttChildren: (Paragraph | Table)[] = [];
  if (r.timeline?.items.length) {
    const g = ganttGrid(r.timeline.items.slice(0, 300), r.timeline.today, 26);
    const gc = (o: { text?: string; fill?: string; color?: string; bold?: boolean; size?: number; border?: boolean }) => new TableCell({
      shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
      margins: { top: 20, bottom: 20, left: 30, right: 30 },
      borders: o.border ? { left: { style: BorderStyle.SINGLE, size: 8, color: "0F172A" }, right: { style: BorderStyle.SINGLE, size: 8, color: "0F172A" } } : undefined,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: o.text ?? "", bold: o.bold, color: o.color, size: o.size ?? 12, font: "Calibri" })] })],
    });
    ganttChildren.push(
      new Paragraph({ children: [new TextRun({ text: /gantt/i.test(r.title) ? r.title : `${r.title} — Gantt`, bold: true, size: 28, color: BRAND, font: "Calibri" })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: r.timeline.items.some((i) => i.logged) ? `One column per ${g.unit}. Light blue = planned window · dark blue = time logged (hours shown) · dark header = today.` : `One column per ${g.unit}. Light blue = planned · dark blue = complete · red = overdue · ◆ = milestone · dark header = today.`, size: 16, color: MUTED, font: "Calibri" })], spacing: { after: 160 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders,
        columnWidths: [3000, ...g.buckets.map(() => Math.floor(11000 / g.buckets.length))],
        rows: [
          new TableRow({ tableHeader: true, children: [
            new TableCell({ shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND }, margins: { top: 20, bottom: 20, left: 60, right: 30 }, children: [new Paragraph({ children: [new TextRun({ text: "Item", bold: true, color: "FFFFFF", size: 14 })] })] }),
            ...g.buckets.map((b) => gc({ text: b.label, bold: b.today, size: 10, fill: b.today ? "0F172A" : "F1F5F9", color: b.today ? "FFFFFF" : "334155" })),
          ] }),
          ...g.rows.map(({ item, cells }) => new TableRow({ children: [
            new TableCell({ margins: { top: 20, bottom: 20, left: item.level === 1 ? 240 : 60, right: 30 }, children: [new Paragraph({ children: [
              new TextRun({ text: item.label, bold: item.level !== 1, size: 14, font: "Calibri" }),
              ...(item.overdue ? [new TextRun({ text: "  overdue", size: 12, color: "B91C1C", bold: true })] : []),
            ] })] }),
            ...cells.map((c, i) => gc({ fill: c.state ? CELL_FILL[c.state] : undefined, text: c.milestone ? "◆" : c.hours ? String(c.hours) : "", color: c.milestone ? MILESTONE_COLOR : "FFFFFF", size: c.hours && !c.milestone ? 10 : 12, bold: true, border: g.buckets[i].today })),
          ] })),
        ],
      }),
    );
  }

  const doc = new Document({
    creator: meta.company, title: r.title,
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [{
      properties: { page: { size: wide ? { orientation: PageOrientation.LANDSCAPE } : undefined, margin: { top: 1000, bottom: 1000, left: 900, right: 900 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: meta.company, bold: true, color: BRAND, size: 18 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: `${r.title} · Page `, size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED }),
        new TextRun({ text: " of ", size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUTED }),
      ] })] }) },
      children,
    }, ...(ganttChildren.length ? [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 800, bottom: 800, left: 600, right: 600 } } },
      children: ganttChildren,
    }] : [])],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
