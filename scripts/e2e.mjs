/**
 * End-to-end workflow check (Playwright). Run against a freshly seeded DB:
 *   npm run db:reset && npm run build && npm run start   (another terminal)
 *   node scripts/e2e.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

async function login(email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "password");
  await Promise.all([page.waitForURL(/\/dashboard/), page.click('button[type="submit"]')]);
  return page;
}
// Server Actions finish with a redirect carrying ?success= / ?error=. Wait for that flash before asserting.
const submit = async (page, selector) => {
  // Let any previous flash strip itself from the URL first, so we wait for the *new* redirect.
  await page.waitForURL((u) => !/[?&](success|error)=/.test(u.search), { timeout: 5000 }).catch(() => {});
  await Promise.all([page.waitForURL((u) => /[?&](success|error)=/.test(u.search), { timeout: 15000 }), page.click(selector)]);
  await page.waitForLoadState("networkidle");
};

// Unauthenticated access is redirected
{
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  await p.goto(`${BASE}/invoices`);
  check("unauthenticated → /login", p.url().includes("/login"));
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', "admin@pac.africa"); await p.fill('input[name="password"]', "wrong");
  await p.click('button[type="submit"]'); await p.waitForTimeout(800);
  check("bad password rejected", (await p.locator("text=Invalid email or password").count()) === 1);
  await ctx.close();
}

const page = await login("admin@pac.africa");

// Customer create + contact
await page.goto(`${BASE}/customers/create`);
await page.fill('input[name="company"]', "E2E Test Holdings");
await page.fill('input[name="contactFirstName"]', "Jane"); await page.fill('input[name="contactEmail"]', "jane@e2e.example");
await submit(page, 'button:has-text("Save customer")');
check("customer created", /\/customers\/\d+/.test(page.url()) && (await page.locator("text=Jane").count()) > 0, page.url());
const custId = page.url().match(/customers\/(\d+)/)?.[1];

// Estimate with catalog autofill → convert to invoice
await page.goto(`${BASE}/estimates/create?customerId=${custId}`);
await page.locator('[data-testid="line-description"]').first().fill("Job evaluation");
await page.locator('input[type=number]').first().fill("10");
await page.waitForTimeout(200);
const total = await page.locator('[data-testid="line-total"]').innerText();
check("line items autofill from catalog + live total", total.includes("174,000.00"), total);
await submit(page, 'button:has-text("Save & mark sent")');
check("estimate created", /\/estimates\/\d+/.test(page.url()), page.url());
await submit(page, 'button:has-text("Convert to invoice")');
check("estimate → invoice", /\/invoices\/\d+/.test(page.url()), page.url());
const invUrl = page.url();

// Record partial then full payment
await page.fill('input[name="amount"]', "74000");
await submit(page, 'button:has-text("Record payment")');
check("partial payment → status partial", (await page.locator(".badge", { hasText: "Partial" }).count()) > 0);
await page.fill('input[name="amount"]', "100000");
await submit(page, 'button:has-text("Record payment")');
check("full payment → status paid", (await page.locator(".badge", { hasText: "Paid" }).count()) > 0);

// Lead convert
await page.goto(`${BASE}/leads/2`);
await submit(page, 'button:has-text("Convert to customer")');
check("lead → customer", /\/customers\/\d+/.test(page.url()) && (await page.locator("text=Kilimo Fintech").count()) > 0, page.url());

// Ticket reply + status
await page.goto(`${BASE}/tickets/1`);
await page.locator("select").first().selectOption({ label: "Acknowledgement" });
const txt = await page.locator('textarea[name="message"]').inputValue();
check("predefined reply inserted", txt.includes("We have received"));
await submit(page, 'button:has-text("Post reply")');
check("ticket reply posted", (await page.locator("text=Answered").count()) > 0);

// Task: comment + timer
await page.goto(`${BASE}/tasks/2`);
await page.fill('textarea[name="content"]', "E2E comment");
await submit(page, 'button:has-text("Post comment")');
check("task comment", (await page.locator("text=E2E comment").count()) > 0);
await submit(page, 'button:has-text("Start timer")');
await submit(page, 'button:has-text("Stop timer")');
check("timer start/stop", (await page.locator("text=Start timer").count()) > 0);

// Settings lookup add
await page.goto(`${BASE}/settings`);
await page.locator('#contractTypes input[name="name"]').fill("Training agreement");
await submit(page, '#contractTypes button:has-text("Add")');
check("settings lookup add", (await page.locator("#contractTypes", { hasText: "Training agreement" }).count()) > 0);

// Delete a referenced expense category is blocked gracefully
await page.goto(`${BASE}/settings`);
await submit(page, '#expenseCategories li:has-text("Travel") button:has-text("✕")');
check("in-use lookup delete blocked with message", page.url().includes("settings") && (await page.locator("text=still in use").count()) > 0);

// Billable expense → invoice
await page.goto(`${BASE}/expenses`);
await submit(page, 'button:has-text("Invoice")');
check("expense rebilled to invoice", /\/invoices\/\d+/.test(page.url()), page.url());

// Public survey submission
const anon = await (await browser.newContext()).newPage();
await anon.goto(`${BASE}/s/post-workshop-feedback-demo`);
await anon.check('input[value="Good"]');
await anon.fill("textarea", "Great session");
await Promise.all([anon.waitForURL(/done=1/), anon.click('button:has-text("Submit response")')]);
check("public survey submit", (await anon.locator("text=Thank you").count()) > 0);

// Staff role cannot reach admin areas
const staffPage = await login("staff@pac.africa");
await staffPage.goto(`${BASE}/settings`);
check("staff blocked from /settings", staffPage.url().includes("/dashboard"));
await staffPage.goto(`${BASE}/staff/create`);
check("staff blocked from /staff", staffPage.url().includes("/dashboard"));
check("staff sidebar hides admin", (await staffPage.locator('nav a[href="/settings"]').count()) === 0);

// Timesheets: log time manually on a task, then invoice the project's unbilled hours
await page.goto(`${BASE}/tasks/6`);
await page.fill('[data-testid=log-time-form] input[name="hours"]', "2");
await page.fill('[data-testid=log-time-form] input[name="note"]', "E2E logged time");
await submit(page, '[data-testid=log-time-form] button:has-text("Log time")');
check("log time on task", (await page.locator("text=E2E logged time").count()) > 0);
await page.goto(`${BASE}/projects/3`);
const unbilledBefore = await page.locator("[data-testid=unbilled-hours]").innerText();
check("project shows unbilled hours", unbilledBefore.startsWith("9.00"), unbilledBefore);
await submit(page, 'button:has-text("Invoice unbilled time")');
check("invoice from timesheet", /\/invoices\/\d+/.test(page.url()) && (await page.locator("text=Billed time").count()) > 0, page.url());
check("invoice total from hours", (await page.locator("text=KES 125,280.00").count()) > 0); // 9h × 12,000 + 16% VAT
const tsInvoiceUrl = page.url().split("?")[0];
await page.goto(`${BASE}/projects/3`);
check("time marked billed", (await page.locator("[data-testid=unbilled-hours]").innerText()).startsWith("0.00"));
await page.goto(tsInvoiceUrl);
await submit(page, 'button:has-text("Delete")');
await page.goto(`${BASE}/projects/3`);
check("deleting invoice un-bills time", (await page.locator("[data-testid=unbilled-hours]").innerText()).startsWith("9.00"));
await page.goto(`${BASE}/timesheets?projectId=3`);
check("timesheets page filters by project", (await page.locator("[data-testid=ts-total]").innerText()) === "9.00");

// Cron endpoint requires secret
const r = await fetch(`${BASE}/api/cron`);
check("cron endpoint rejects without secret", r.status === 401);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
