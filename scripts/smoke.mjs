/**
 * Playwright smoke test: signs in as the seeded admin and requests each path, printing status codes.
 *   node scripts/smoke.mjs "/dashboard,/customers,/leads,/invoices/1"
 * Env: BASE_URL (default http://localhost:3000), SMOKE_EMAIL, SMOKE_PASSWORD.
 * With no argument, every list/create page is checked. Exits non-zero on any failure.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DEFAULT_PATHS = [
  "/dashboard", "/customers", "/customers/create", "/customers/1", "/customers/1/edit",
  "/leads", "/leads/create", "/leads/1", "/leads/1/edit",
  "/items", "/items/create", "/estimates", "/estimates/create", "/estimates/1",
  "/proposals", "/proposals/create", "/proposals/1", "/invoices", "/invoices/create", "/invoices/1", "/invoices/1/edit", "/payments",
  "/projects", "/projects/create", "/projects/1", "/projects/1/edit", "/projects/1/tasks/create",
  "/tasks", "/tasks/create", "/tasks/1", "/tasks/1/edit", "/timesheets", "/timesheets?projectId=3&billed=unbilled", "/projects/3",
  "/tickets", "/tickets/create", "/tickets/1", "/contracts", "/contracts/create", "/contracts/1", "/contracts/1/edit",
  "/expenses", "/expenses/create", "/expenses/1/edit", "/knowledge-base", "/knowledge-base/create", "/knowledge-base/1", "/knowledge-base/1/edit",
  "/surveys", "/surveys/create", "/surveys/1", "/staff", "/staff/create", "/staff/1/edit", "/settings",
  "/analytics", "/reports", "/reports/sales-summary", "/reports/aged-receivables", "/reports/pipeline-forecast", "/reports/project-profitability",
  "/reports/customer-statement?customerId=1", "/reports/staff-utilisation", "/reminders", "/search?q=board", "/gantt", "/projects?view=gantt", "/projects?view=gantt&tasks=1&status=in_progress", "/tasks?view=gantt", "/tasks?view=gantt&projectId=1&open=1", "/reports/project-schedule", "/reports/time-gantt", "/segments", "/segments?id=1", "/prospecting",
];
const paths = process.argv[2] ? process.argv[2].split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_PATHS;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', process.env.SMOKE_EMAIL ?? "admin@pac.africa");
await page.fill('input[name="password"]', process.env.SMOKE_PASSWORD ?? "password");
await Promise.all([page.waitForURL(/\/dashboard/), page.click('button[type="submit"]')]);

let failed = 0;
for (const p of paths) {
  const res = await page.goto(`${BASE}${p}`);
  const status = res?.status() ?? 0;
  const errorBoundary = await page.locator("text=Something went wrong").count();
  const ok = status === 200 && errorBoundary === 0 && !page.url().includes("/login");
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} ${status} ${p}${errorBoundary ? " (error boundary)" : ""}`);
}
if (errors.length) console.log("Client errors:", errors);
await browser.close();
console.log(`\n${paths.length - failed}/${paths.length} passed`);
process.exit(failed ? 1 : 0);
