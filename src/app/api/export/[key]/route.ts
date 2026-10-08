/**
 * Download any report: /api/export/<report-key>?format=csv|xlsx|docx&<filters>
 * Uses the same report definitions as the on-screen Reports pages.
 */
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/export/csv";
import { toDocx } from "@/lib/export/docx";
import { fileBase } from "@/lib/export/format";
import { toXlsx } from "@/lib/export/xlsx";
import { describeFilters } from "@/lib/reports/describe";
import { getReport } from "@/lib/reports";
import { getSettings, logActivity } from "@/lib/settings";

export const dynamic = "force-dynamic";

const TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { key } = await ctx.params;
  const report = getReport(key);
  if (!report) return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  const format = (req.nextUrl.searchParams.get("format") ?? "xlsx") as keyof typeof TYPES;
  if (!(format in TYPES)) return NextResponse.json({ error: "format must be csv, xlsx or docx" }, { status: 400 });

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const result = await report.run(params);
  const settings = await getSettings();
  const meta = {
    company: settings.company_name,
    generatedBy: session.name,
    generatedAt: new Date().toLocaleString("en-GB", { timeZone: process.env.APP_TIMEZONE || "Africa/Nairobi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    filters: await describeFilters(report, params),
  };
  const body = format === "csv" ? toCsv(result) : format === "xlsx" ? await toXlsx(result, meta) : await toDocx(result, meta);
  await logActivity(`Exported "${result.title}" as ${format.toUpperCase()}`, { staffId: session.staffId, relType: "export" });
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": TYPES[format],
      "Content-Disposition": `attachment; filename="${fileBase(result)}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
void db;
