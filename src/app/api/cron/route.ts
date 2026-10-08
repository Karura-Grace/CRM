/**
 * HTTP trigger for the scheduled job — for hosts without OS cron (e.g. Vercel Cron).
 * Call with header `Authorization: Bearer <CRON_SECRET>`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { runAllJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "change-me-too" || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runAllJobs();
  return NextResponse.json({ ok: true, ...result });
}
