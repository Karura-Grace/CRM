/**
 * AI prospecting agent.
 *
 * Uses the Claude API with Anthropic's server-side tools:
 *   - web_search  → find advertised consulting opportunities (RFPs, EOIs, tenders, ToRs)
 *   - web_fetch   → read the tender/job-board pages listed in Settings (the "crawl")
 * Claude then returns structured JSON which we validate, de-duplicate by URL and store
 * as prospects. Staff review prospects and convert good ones into Leads.
 *
 * Requires ANTHROPIC_API_KEY in the environment (never stored in the database).
 * AI_MOCK=1 makes runs return labelled sample data (for demos and automated tests).
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { prospectRuns, prospects } from "@/db/schema";
import { getSettings } from "./settings";
import { today } from "./utils";

const API_URL = `${(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`;
const MAX_TURNS = 8;

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === "1";
export type RunMode = "search" | "sources" | "both";

const Item = z.object({
  kind: z.enum(["opportunity", "organisation"]).catch("opportunity"),
  title: z.string().min(3).max(300),
  organisation: z.string().max(200).nullish(),
  url: z.string().url(),
  source: z.string().max(120).nullish(),
  location: z.string().max(120).nullish(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().catch(null),
  services: z.union([z.array(z.string()), z.string()]).nullish(),
  summary: z.string().max(1500).nullish(),
  fit_score: z.coerce.number().min(0).max(100).catch(50),
  fit_reason: z.string().max(800).nullish(),
  contact_email: z.string().email().nullish().catch(null),
});
type Item = z.infer<typeof Item>;

export function normaliseUrl(u: string) {
  try {
    const x = new URL(u.trim());
    x.hash = "";
    for (const k of [...x.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/.test(k)) x.searchParams.delete(k);
    return x.toString().replace(/\/$/, "");
  } catch { return u.trim(); }
}

function buildPrompt(profile: string, sources: string[], focus: string | null, mode: RunMode, maxResults: number) {
  return [
    `Today is ${today()}. You are a business-development research agent for a management consultancy.`,
    "",
    "## Our profile",
    profile,
    "",
    "## Task",
    mode !== "sources" ? "1. Use web_search to find CURRENTLY OPEN, publicly advertised consulting opportunities that fit our profile: requests for proposals, expressions of interest, tenders, terms of reference and consultancy adverts. Prefer items published in the last 60 days with a submission deadline in the future. Also note organisations showing a strong trigger for our services (e.g. a new strategic plan, restructuring, board changes, rapid expansion) — mark those kind \"organisation\"." : "",
    mode !== "search" && sources.length ? `${mode === "both" ? "2" : "1"}. Use web_fetch to read each of these listing pages and pick out relevant adverts (follow a link to the advert itself when useful):\n${sources.map((s) => `   - ${s}`).join("\n")}` : "",
    focus ? `\nFocus for this run: ${focus}` : "",
    "",
    "## Rules",
    "- Only report items you actually saw in search results or fetched pages. Never invent organisations, deadlines or URLs.",
    "- The url must be the direct link to the advert or source page you read.",
    "- Skip anything outside our services (IT systems, construction, audit-only, supply of goods) and individual job vacancies.",
    `- Return at most ${maxResults} items, best fit first.`,
    "",
    "## Output",
    "Finish with ONLY a JSON array inside <results></results> tags. Each item:",
    '{"kind":"opportunity|organisation","title":"…","organisation":"…","url":"https://…","source":"site name","location":"country/city","deadline":"YYYY-MM-DD or null","services":["which of our services fit"],"summary":"2-3 sentences","fit_score":0-100,"fit_reason":"one sentence","contact_email":"if published, else null"}',
    "If nothing suitable is found, return <results>[]</results>.",
  ].filter((l) => l !== "").join("\n");
}

type Block = { type: string; [k: string]: unknown };
type ApiResponse = { content: Block[]; stop_reason: string; usage?: { server_tool_use?: { web_search_requests?: number; web_fetch_requests?: number } }; error?: { message?: string } };

async function callClaude(apiKey: string, body: unknown): Promise<ApiResponse> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });
  const json = (await res.json().catch(() => ({}))) as ApiResponse;
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${json.error?.message ?? res.statusText}`);
  return json;
}

/** Collect every URL the tools actually returned, so we can reject invented links. */
function seenUrls(blocks: Block[]) {
  const out = new Set<string>();
  for (const b of blocks) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const r of b.content as { url?: string }[]) if (r.url) out.add(normaliseUrl(r.url));
    if (b.type === "web_fetch_tool_result" && b.content && typeof b.content === "object") { const u = (b.content as { url?: string }).url; if (u) out.add(normaliseUrl(u)); }
  }
  return out;
}

function parseResults(text: string): Item[] {
  const m = text.match(/<results>([\s\S]*?)<\/results>/) ?? text.match(/```json\s*([\s\S]*?)```/);
  if (!m) return [];
  let arr: unknown;
  try { arr = JSON.parse(m[1].trim()); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => Item.safeParse(x)).filter((r) => r.success).map((r) => r.data!);
}

function sampleItems(focus: string | null): Item[] {
  const stamp = Date.now();
  return [
    { kind: "opportunity", title: `[SAMPLE] Request for proposals: HR policy manual review${focus ? ` (${focus})` : ""}`, organisation: "A Nairobi-based NGO", url: `https://example.org/sample/hr-policy-rfp-${stamp}`, source: "Sample", location: "Nairobi, Kenya", deadline: null, services: ["HR policy development"], summary: "Sample result produced in AI_MOCK mode.", fit_score: 88, fit_reason: "Matches PAC's policy development practice.", contact_email: null },
    { kind: "opportunity", title: "[SAMPLE] EOI: Strategic plan development 2027–2031", organisation: "A county government agency", url: `https://example.org/sample/strategic-plan-eoi-${stamp}`, source: "Sample", location: "Kenya", deadline: null, services: ["Strategy"], summary: "Sample result produced in AI_MOCK mode.", fit_score: 81, fit_reason: "Strategic planning for a public body.", contact_email: null },
  ];
}

/** Create a run record and start the agent in the background. Returns the run id immediately. */
export async function startRun(opts: { mode: RunMode; focus: string | null; staffId: number | null }) {
  const [run] = await db.insert(prospectRuns).values({ mode: opts.mode, focus: opts.focus, status: "running", startedBy: opts.staffId, sample: process.env.AI_MOCK === "1" }).returning();
  void executeRun(run.id).catch(() => undefined);
  return run.id;
}

/** Run the agent to completion (used directly by the daily scheduled job). */
export async function executeRun(runId: number) {
  const run = await db.query.prospectRuns.findFirst({ where: eq(prospectRuns.id, runId) });
  if (!run) return;
  const log: string[] = [];
  try {
    const s = await getSettings();
    const sources = s.ai_sources.split(/\s+/).map((x) => x.trim()).filter((x) => /^https?:\/\//.test(x));
    const maxSearches = Math.min(20, Math.max(1, Number(s.ai_max_searches) || 8));
    let items: Item[] = [], searches = 0, fetches = 0;
    let seen = new Set<string>();

    if (process.env.AI_MOCK === "1") {
      items = sampleItems(run.focus);
      seen = new Set(items.map((i) => normaliseUrl(i.url)));
      log.push("AI_MOCK=1 — returned sample results without calling the API.");
    } else {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set on the server. Add it to .env and restart.");
      if (run.mode === "sources" && !sources.length) throw new Error("No source URLs configured (Settings → AI prospecting).");
      const tools: unknown[] = [];
      if (run.mode !== "sources") tools.push({ type: "web_search_20250305", name: "web_search", max_uses: maxSearches, user_location: { type: "approximate", city: "Nairobi", country: "KE", timezone: "Africa/Nairobi" } });
      if (run.mode !== "search" && sources.length) tools.push({ type: "web_fetch_20250910", name: "web_fetch", max_uses: sources.length * 3 + 5, max_content_tokens: 25_000 });
      const messages: { role: "user" | "assistant"; content: unknown }[] = [{ role: "user", content: buildPrompt(s.ai_profile, sources, run.focus, run.mode, 15) }];
      const allBlocks: Block[] = [];
      let finalText = "";
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const resp = await callClaude(apiKey, { model: s.ai_model || "claude-sonnet-5-5", max_tokens: 8000, messages, tools });
        allBlocks.push(...resp.content);
        searches += resp.usage?.server_tool_use?.web_search_requests ?? resp.content.filter((b) => b.type === "server_tool_use" && b.name === "web_search").length;
        fetches += resp.usage?.server_tool_use?.web_fetch_requests ?? resp.content.filter((b) => b.type === "server_tool_use" && b.name === "web_fetch").length;
        finalText = resp.content.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("\n");
        log.push(`Turn ${turn + 1}: stop_reason=${resp.stop_reason}`);
        if (resp.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: resp.content }); continue; }
        break;
      }
      seen = seenUrls(allBlocks);
      items = parseResults(finalText);
      if (!items.length) log.push("No structured results returned.");
    }

    // Keep items whose link (or at least its site) was actually seen by the tools.
    const seenHosts = new Set([...seen].map((u) => { try { return new URL(u).host; } catch { return ""; } }));
    let added = 0, rejected = 0;
    for (const it of items) {
      const url = normaliseUrl(it.url);
      let host = "";
      try { host = new URL(url).host; } catch { /* invalid */ }
      if (!seen.has(url) && !seenHosts.has(host)) { rejected++; continue; }
      const services = Array.isArray(it.services) ? it.services.join(", ") : it.services ?? null;
      const res = await db.insert(prospects).values({
        runId, kind: it.kind, title: it.title, organisation: it.organisation ?? null, url, source: it.source ?? host, location: it.location ?? null,
        deadline: it.deadline ?? null, services, summary: it.summary ?? null, fitScore: Math.round(it.fit_score), fitReason: it.fit_reason ?? null, contactEmail: it.contact_email ?? null,
      }).onConflictDoNothing().returning({ id: prospects.id });
      if (res.length) added++;
    }
    if (rejected) log.push(`${rejected} item(s) dropped because their link never appeared in the search/fetch results.`);
    await db.update(prospectRuns).set({ status: "done", found: items.length, added, searches, fetches, log: log.join("\n"), finishedAt: new Date().toISOString() }).where(eq(prospectRuns.id, runId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(prospectRuns).set({ status: "failed", error: msg.slice(0, 500), log: log.join("\n"), finishedAt: new Date().toISOString() }).where(eq(prospectRuns.id, runId));
  }
}

/** Mark runs stuck in "running" (e.g. server restarted mid-run) as failed. */
export async function sweepStaleRuns() {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString().replace("T", " ").slice(0, 19);
  const stale = await db.query.prospectRuns.findMany({ where: (r, { and, eq, lt }) => and(eq(r.status, "running"), lt(r.startedAt, cutoff)) });
  for (const r of stale) await db.update(prospectRuns).set({ status: "failed", error: "Run did not finish (server restarted or timed out).", finishedAt: new Date().toISOString() }).where(eq(prospectRuns.id, r.id));
}
