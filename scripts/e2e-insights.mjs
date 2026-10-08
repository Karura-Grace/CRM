/**
 * End-to-end checks for reporting, exports, Customer 360, reminders, tags, segments,
 * search and AI prospecting. Run on a freshly reset DB:
 *   npm run db:reset && npm run build && npm run start
 *   EXPORT_DIR=/tmp/exports node scripts/e2e-insights.mjs
 * AI checks need the server started with ANTHROPIC_API_KEY (+ ANTHROPIC_BASE_URL for a stub) or AI_MOCK=1.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.EXPORT_DIR;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
page.on("dialog", (d) => d.accept());
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
const submit = async (selector) => {
  await page.waitForURL((u) => !/[?&](success|error)=/.test(u.search), { timeout: 5000 }).catch(() => {});
  await Promise.all([page.waitForURL((u) => /[?&](success|error)=/.test(u.search), { timeout: 20000 }), page.click(selector)]);
  await page.waitForLoadState("networkidle");
};
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "admin@pac.africa"); await page.fill('input[name="password"]', "password");
await Promise.all([page.waitForURL(/\/dashboard/), page.click('button[type="submit"]')]);

// Pipeline forecast (fresh seed): 600k×10% + 350k×20% + 1.2M×40% + 500k×60% = 910,000
await page.goto(`${BASE}/reports/pipeline-forecast`);
check("weighted forecast total", (await page.locator("tfoot").innerText()).includes("910,000.00"));

// Analytics & reports render with charts
await page.goto(`${BASE}/analytics`);
check("analytics charts", (await page.locator("figure svg").count()) >= 6, String(await page.locator("figure svg").count()));
await page.goto(`${BASE}/reports/sales-summary`);
check("report table rows", (await page.locator("[data-testid=report-table] tbody tr").count()) >= 12);
await page.waitForLoadState("networkidle"); // charts are interactive only after hydration
await page.locator("figure svg").first().scrollIntoViewIfNeeded();
const box = await page.locator("figure svg").first().boundingBox();
await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2);
await page.waitForTimeout(150);
check("chart tooltip on hover", (await page.locator("figure .shadow-lg").count()) > 0);
await page.click('figure button:has-text("Table")');
check("chart table view", (await page.locator("figure table").count()) > 0);

// Every report: screen + 3 export formats
const keys = await page.request.get(`${BASE}/reports`).then((r) => r.text()).then((h) => [...new Set([...h.matchAll(/href="\/reports\/([a-z-]+)"/g)].map((m) => m[1]))]);
check("report catalog", keys.length >= 20, String(keys.length));
const extra = { "customer-statement": "customerId=1", segment: "segmentId=1" };
let exportsOk = 0;
for (const k of keys) {
  const view = await page.request.get(`${BASE}/reports/${k}${extra[k] ? "?" + extra[k] : ""}`);
  if (view.status() !== 200) { check(`report view ${k}`, false, String(view.status())); continue; }
  for (const f of ["xlsx", "docx", "csv"]) {
    const r = await page.request.get(`${BASE}/api/export/${k}?format=${f}${extra[k] ? "&" + extra[k] : ""}`);
    const ok = r.status() === 200 && (r.headers()["content-disposition"] || "").includes(`.${f}`);
    if (ok) exportsOk++; else check(`export ${k}.${f}`, false, String(r.status()));
    if (ok && OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `${k}.${f}`), await r.body()); }
  }
}
check("all exports downloaded", exportsOk === keys.length * 3, `${exportsOk}/${keys.length * 3}`);
// Export button on a list page triggers a real browser download
await page.goto(`${BASE}/invoices`);
const [dl] = await Promise.all([page.waitForEvent("download"), page.click('[data-testid=export-invoice-register] a:has-text("Excel")')]);
check("list page Excel download", dl.suggestedFilename().endsWith(".xlsx"), dl.suggestedFilename());
const unauth = await (await browser.newContext()).request.get(`${BASE}/api/export/invoice-register?format=csv`, { maxRedirects: 0 });
check("exports require sign-in", unauth.status() !== 200, String(unauth.status()));

// Customer 360 timeline + interaction + tags + reminder
await page.goto(`${BASE}/customers/1`);
check("timeline shows payment", (await page.locator("[data-testid=timeline]", { hasText: "Payment received on INV-000001" }).count()) > 0);
await page.selectOption("[data-testid=interaction-form] select[name=kind]", "meeting");
await page.fill("[data-testid=interaction-form] input[name=description]", "E2E strategy meeting");
await submit("[data-testid=interaction-form] button");
check("interaction in timeline", (await page.locator("[data-testid=timeline]", { hasText: "E2E strategy meeting" }).count()) > 0);
await page.goto(`${BASE}/customers/2`);
await page.fill("[data-testid=tag-editor] input[name=newTag]", "Strategy client");
await submit("[data-testid=tag-editor] button:has-text('Add')");
check("tag added", (await page.locator("[data-testid=tag-editor]", { hasText: "Strategy client" }).count()) > 0);
const badgeCount = async () => ((await page.locator("[data-testid=reminder-badge]").count()) ? Number(await page.locator("[data-testid=reminder-badge]").textContent()) : 0);
const badgeBefore = await badgeCount();
await page.fill("[data-testid=reminders-panel] input[name=description]", "E2E follow up today");
await page.fill("[data-testid=reminders-panel] input[name=remindAt]", new Date().toLocaleDateString("en-CA"));
await submit("[data-testid=reminders-panel] button:has-text('Add reminder')");
const badgeAfter = await badgeCount();
check("reminder badge increments", badgeAfter === badgeBefore + 1, `${badgeBefore}→${badgeAfter}`);
await page.goto(`${BASE}/customers?tag=`); // all
const tagLink = page.locator('a:has-text("Strategy client")').first();
await tagLink.click(); await page.waitForLoadState("networkidle");
check("filter customers by tag", (await page.locator("tbody tr").count()) === 1 && (await page.locator("tbody", { hasText: "Rift Valley" }).count()) === 1);
await page.goto(`${BASE}/reminders`);
check("reminders page lists it", (await page.locator("text=E2E follow up today").count()) > 0);
await submit('li:has-text("E2E follow up today") button:has-text("Mark done")');
check("reminder completed", (await page.locator("text=E2E follow up today").count()) === 0);
await page.goto(`${BASE}/dashboard`);
check("dashboard follow-ups", (await page.locator("[data-testid=dash-reminders] li").count()) >= 1);

// Global search
await page.goto(`${BASE}/search?q=savanna`);
check("search finds customer", (await page.locator("section", { hasText: "Customers" }).locator("a", { hasText: "Savanna Microfinance" }).count()) > 0);
await page.goto(`${BASE}/search?q=INV-000002`);
check("search finds invoice", (await page.locator("a", { hasText: "INV-000002" }).count()) > 0);
await page.fill('header input[name="q"]', "Kisumu"); await Promise.all([page.waitForURL(/\/search\?q=Kisumu/), page.press('header input[name="q"]', "Enter")]);
check("header search box", (await page.locator("text=County Water Services Board").count()) > 0);

// Segments: contacts of customers tagged "HR advisory" (Savanna ×2 + Coastline ×1)
await page.goto(`${BASE}/segments?id=1`);
check("saved segment preview", (await page.locator("[data-testid=segment-preview] tbody tr").count()) === 3, String(await page.locator("[data-testid=segment-preview] tbody tr").count()));
await page.goto(`${BASE}/segments?entity=customers&tags=1`);
await page.fill('input[name="name"]', "Board clients");
await submit('button:has-text("Save segment")');
check("segment saved", (await page.locator("text=Board clients").count()) > 0);

// Lead: expected close + weighted value + tag on board
await page.goto(`${BASE}/leads/3`);
check("lead weighted value", (await page.locator("text=Weighted value").count()) > 0 && (await page.locator("text=480,000.00").count()) > 0);
await page.goto(`${BASE}/leads`);
check("leads board shows weighted", (await page.locator(".kanban-col", { hasText: "weighted" }).count()) > 0);

// AI prospecting
await page.goto(`${BASE}/prospecting`);
if (await page.locator('button:has-text("Run agent")').count()) {
  await page.fill('input[name="focus"]', "job evaluation");
  await submit('button:has-text("Run agent")');
  for (let i = 0; i < 40 && (await page.locator("[data-testid=run-running]").count()); i++) { await page.waitForTimeout(1000); await page.reload(); }
  const list = page.locator("[data-testid=prospects]");
  check("agent run completed", (await page.locator("tbody", { hasText: "done" }).count()) > 0);
  check("verified prospects stored", (await list.locator("text=Consultancy: job evaluation and grading").count()) === 1 && (await list.locator("text=EOI: Strategic plan").count()) === 1);
  check("invented link rejected", (await list.locator("text=Invented tender").count()) === 0);
  await submit('article:has-text("Consultancy: job evaluation and grading") button:has-text("Convert to lead")');
  check("prospect → lead", /\/leads\/\d+/.test(page.url()) && (await page.locator("[data-testid=tag-editor]", { hasText: "Tender" }).count()) > 0);
  check("deadline reminder on lead", (await page.locator("[data-testid=reminders-panel]", { hasText: "Submission due 2026-11-20" }).count()) > 0);
} else {
  check("AI configured for test", false, "server not started with ANTHROPIC_API_KEY or AI_MOCK=1");
}

console.log(`\nclient errors: ${errors.length}`, errors.slice(0, 3));
await browser.close();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
