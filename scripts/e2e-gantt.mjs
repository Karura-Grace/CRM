/**
 * Gantt views & schedule exports (Playwright). Run against a freshly seeded DB with the app running:
 *   node scripts/e2e-gantt.mjs
 */
import { chromium } from "playwright";
import ExcelJS from "exceljs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "admin@pac.africa"); await page.fill('input[name="password"]', "password");
await Promise.all([page.waitForURL(/\/dashboard/), page.click('button[type="submit"]')]);

// Projects Gantt (sidebar shortcut → projects with tasks)
await page.goto(`${BASE}/gantt`); await page.waitForLoadState("networkidle");
check("sidebar shortcut lands on project Gantt", /view=gantt/.test(page.url()));
const pg = page.locator("[data-testid=gantt-projects]");
check("project Gantt renders an SVG", (await pg.locator("svg").count()) === 1);
check("project rows and task rows both listed", (await pg.getByText("Board governance evaluation 2026").count()) > 0 && (await pg.getByText("Board member interviews").count()) > 0);
check("milestone diamonds drawn", (await pg.locator('path[fill="#eb6834"]').count()) >= 3);
check("today marker drawn", (await pg.getByText("Today", { exact: true }).count()) >= 1);
await pg.getByRole("button", { name: "Month" }).click();
check("scale switch to month", (await pg.getByRole("button", { name: "Month" }).getAttribute("aria-pressed")) === "true");
await pg.getByRole("button", { name: "Table" }).click();
check("table view lists items", (await pg.locator("table tbody tr").count()) >= 9);
await pg.getByRole("button", { name: "Chart" }).click();

// Tooltip on hover over a milestone
const box = await pg.locator("svg").boundingBox();
const diamond = pg.locator('path[fill="#eb6834"]').first();
const db = await diamond.boundingBox();
await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2);
check("milestone tooltip appears", await pg.getByText(/Milestone ·/).isVisible().catch(() => false), `svg at ${Math.round(box.x)}`);

// Tasks Gantt with overdue flag
await page.goto(`${BASE}/tasks?view=gantt`); await page.waitForLoadState("networkidle");
const tg = page.locator("[data-testid=gantt-tasks]");
check("task Gantt shows overdue label", (await tg.getByText(/Overdue/).count()) >= 2);
check("overdue stub drawn in red", (await tg.locator('path[fill="#d03b3b"]').count()) >= 1);
await page.selectOption('select[name="projectId"]', "1"); await Promise.all([page.waitForURL(/projectId=1/), page.click("text=Filter")]);
check("task Gantt filters by project", (await page.locator("[data-testid=gantt-tasks]").getByText("Import client list into CRM").count()) === 0);

// Project page schedule + time Gantt
await page.goto(`${BASE}/projects/1`); await page.waitForLoadState("networkidle");
check("project page has schedule Gantt", (await page.locator("[data-testid=gantt-project] svg").count()) === 1);
check("project page has time Gantt", (await page.locator("[data-testid=gantt-project-time]").count()) === 1);

// Timesheet Gantt
await page.goto(`${BASE}/timesheets`); await page.waitForLoadState("networkidle");
const ts = page.locator("[data-testid=gantt-timesheet]");
check("timesheet Gantt draws logged-day bars", (await ts.locator('path[fill="#2a78d6"]').count()) >= 4);
check("timesheet Gantt has no month scale", (await ts.getByRole("button", { name: "Month" }).count()) === 0);

// Task page link
await page.goto(`${BASE}/tasks/1`);
check("task page links to Gantt", (await page.getByRole("link", { name: "View on Gantt" }).getAttribute("href"))?.includes("#schedule"));

// Reports & exports
for (const key of ["project-schedule", "time-gantt"]) {
  await page.goto(`${BASE}/reports/${key}`); await page.waitForLoadState("networkidle");
  check(`${key}: report shows Gantt`, (await page.locator("[data-testid=gantt-report]").count()) === 1);
  const x = await page.request.get(`${BASE}/api/export/${key}?format=xlsx`);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await x.body());
  const g = wb.getWorksheet("Gantt");
  check(`${key}: Excel has a Gantt sheet with shaded cells`, !!g && g.rowCount >= 5 && JSON.stringify(g.getRow(5).values).length > 10);
  const d = await page.request.get(`${BASE}/api/export/${key}?format=docx`);
  check(`${key}: Word export downloads`, d.status() === 200 && (await d.body()).length > 5000);
  const c = await page.request.get(`${BASE}/api/export/${key}?format=csv`);
  check(`${key}: CSV export downloads`, c.status() === 200 && (await c.text()).split("\n").length > 2);
}
check("no client-side errors", errors.length === 0, errors.join(" | "));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
