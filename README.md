# PAC CRM

Client relationship management for Priority Activator Consulting: customers and contacts, leads, proposals, estimates, invoices and payments, projects and tasks, support tickets, contracts, expenses, knowledge base, surveys, staff and settings.

Built on Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM and SQLite. One deployable app, with no separate API, no Redis and no external database server. The full system document (architecture, module reference, developer handbook) is the companion *PAC CRM — System Document & Developer Guide*.

## Quick start (local)

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET (openssl rand -base64 48)
npm run db:reset              # create src/db/dev.db + load demo data
npm run dev                   # http://localhost:3000
```

Demo logins (change or delete before go-live):

| Email | Password | Role |
|---|---|---|
| admin@pac.africa | password | Administrator (all modules + Staff & Settings) |
| staff@pac.africa | password | Staff (all operational modules) |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop / build / serve production |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Apply `schema.ts` to the database (asks before anything destructive) |
| `npm run db:generate` | Write versioned SQL migrations to `./drizzle` instead |
| `npm run db:seed` | Load reference + demo data (only into an empty DB) |
| `npm run db:reset` | Wipe → push → seed. **Development only. Stop the dev server first** (see Troubleshooting) |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run cron` | Run the daily job once (overdue sweep, recurring invoices/expenses, contract-expiry notices) |
| `npm run smoke` | Log in and load every page (needs a running server; `BASE_URL=…`) |
| `node scripts/e2e.mjs` | Exercise the main workflows end to end (run on a freshly reset DB) |
| `node scripts/e2e-gantt.mjs` | Gantt views (projects, tasks, project page, timesheets), tooltips, filters and the Gantt sheets in the Excel/Word exports (fresh DB) |
| `node scripts/e2e-insights.mjs` | Reports, exports (all formats), Customer 360, reminders, tags, segments, search, AI prospecting (fresh DB; start the server with `AI_MOCK=1` or an API key) |

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `file:./dev.db` (relative to `src/db/`) or an absolute path, e.g. `file:/data/pac-crm.db` |
| `AUTH_SECRET` | HMAC key for session JWTs. **Required, unique per environment.** `openssl rand -base64 48` |
| `CRON_SECRET` | Bearer token for `GET /api/cron` (HTTP trigger for hosts without OS cron) |
| `APP_TIMEZONE` | Business timezone for "today", due dates and the daily job (default `Africa/Nairobi`) |
| `ANTHROPIC_API_KEY` | Claude API key for AI prospecting (optional — the rest of the CRM works without it) |
| `AI_MOCK` | `1` = AI runs return labelled sample results without calling the API (demos, tests) |
| `ANTHROPIC_BASE_URL` | Optional override of the API address (e.g. a corporate proxy or a test stub) |
| `INSECURE_COOKIES` | `1` only when serving production over plain HTTP. Otherwise login loops back to /login |

## Deploying

### Option A: VPS / on-prem (Node 20+)

```bash
npm ci && npm run build
npx drizzle-kit push        # first time: creates the schema
npm run db:seed             # optional: reference lists (then delete demo users/records)
pm2 start ecosystem.config.cjs   # app + daily cron at 02:00
```

Put Nginx or Caddy in front for HTTPS. Set `DATABASE_URL` to an absolute path outside the code folder (e.g. `/var/lib/pac-crm/pac-crm.db`) so redeploys don't touch data.

### Option B: Docker

```bash
cp .env.example .env   # set AUTH_SECRET, CRON_SECRET
docker compose up -d --build
```

The database lives in the `crm-data` volume, and the `cron` service runs the daily job. The first boot creates the schema. To load the reference lists: `docker compose run --rm crm npm run db:seed`.

### Option C: Vercel / serverless

The app runs, but `better-sqlite3` needs a persistent writable disk, which serverless does not provide. Switch Drizzle to Turso/libSQL or Postgres first (developer guide §8.8), then point Vercel Cron at `/api/cron` with header `Authorization: Bearer $CRON_SECRET`.

### Upgrading (schema changes)

1. **Back up the database file first** (`cp pac-crm.db pac-crm.db.bak`, or `sqlite3 pac-crm.db ".backup backup.db"`).
2. Deploy the new code, then run `npx drizzle-kit push` and **read its prompt**. It asks before any data-losing change. For audited rollouts use `npm run db:generate` and commit the SQL.

### Backups

SQLite is a single file. Schedule a nightly `sqlite3 /data/pac-crm.db ".backup /backups/crm-$(date +%F).db"` (safe while the app is running) and copy it off the server.

## Go-live checklist

- [ ] Strong unique `AUTH_SECRET` and `CRON_SECRET` set; `.env` not committed
- [ ] Served over HTTPS (secure cookies)
- [ ] Demo staff accounts deleted or passwords changed; demo customers/invoices removed (or start from an empty DB plus `db:seed`, then delete demo rows)
- [ ] Settings → Company information, invoice prefix, payment terms and bank/M-Pesa details filled in
- [ ] Daily job scheduled (`npm run cron`, pm2, compose `cron` service, or `/api/cron`)
- [ ] Nightly database backup scheduled and a restore tested once

## Reports, analytics & exports

- **Analytics** (`/analytics`): live KPIs (invoiced, collected, receivables, overdue, weighted pipeline, conversion, billable share, ticket response) and charts. Every tile and chart links to its full report.
- **Reports** (`/reports`): 25 reports in five groups — Sales & finance (sales summary, invoice register, aged receivables, payments, customer ranking, **customer statement of account**), Pipeline (weighted forecast, lead sources & conversion, proposals & estimates), Delivery (project profitability, timesheet detail, staff utilisation, tasks & deadlines, **project schedule (Gantt)**, **timesheet Gantt**), Operations (expenses, expense register, tickets & response times, contracts) and Lists (customers, contacts/mailing list, leads, saved segments, AI prospects, reminders). Each has filters, summary tiles, charts (with a table view) and a data table.
- **Exports**: every report — and the main list pages via their **Excel / Word / CSV** buttons — downloads as a formatted Excel workbook (frozen header, filters, number & date formats, totals, a Summary sheet with chart data), a Word document (letterhead, filters, summary, landscape table when wide, page numbers) or a UTF-8 CSV that opens cleanly in Excel. Endpoint: `GET /api/export/<report-key>?format=xlsx|docx|csv&<filters>` (sign-in required; every export is logged in the activity log).
- **Adding a report**: add a `ReportDef` to one of the arrays in `src/lib/reports/` — the screen, the three exporters and the catalogue pick it up automatically.

## Modern CRM features

- **Customer 360 timeline** (customer page): one feed of everything — lead history, proposals, estimates, invoices, payments, projects, finished tasks, weekly time, tickets and replies, contracts, expenses, logged calls/meetings/emails and follow-ups — filterable by Relationship / Sales / Finance / Delivery / Support. Log an interaction straight from the timeline. The statement of account is one click away (view, Excel, Word, CSV).
- **Follow-up reminders**: add to any customer, lead, invoice, estimate, proposal, project, task, ticket or contract. Due/overdue reminders show in the header badge, on the dashboard and under **Reminders**.
- **Pipeline forecast**: each lead stage has a win probability (Settings → Lead statuses); leads have an expected close date. The board shows value and weighted value per stage; the forecast report groups weighted value by close month.
- **Global search**: the header search box finds customers, contacts, leads, invoices, estimates, proposals, projects, tasks, tickets, contracts, knowledge-base articles, expenses and AI prospects.
- **Tags & saved segments**: tag customers and leads (on their pages), filter lists by tag, and build **Segments** — saved filters over customers, contacts or leads (tags, group, location, stage, source, owner) that export as mailing lists.

## AI prospecting (lead generation)

**What it does.** An AI agent (Claude, via the Anthropic API) looks for *advertised* consulting work that fits PAC — RFPs, EOIs, tenders, terms of reference — plus organisations showing clear triggers for PAC's services. It (1) runs web searches and (2) reads the tender portals and job boards you list in **Settings → AI prospecting**. Each find is stored as a prospect with a fit score (0–100), deadline, matched services and a one-line reason. **Convert to lead** creates the lead (source "AI prospecting", tagged "Tender"), copies the advert link and deadline, and sets a reminder five days before the deadline.

**Setup.** 1) Create an API key at console.anthropic.com and set `ANTHROPIC_API_KEY` in `.env`; restart. 2) Edit the PAC profile and the source URLs in Settings (the defaults are a starting point — replace them with the portals you actually monitor). 3) Click **Run agent** on the AI prospecting page, or switch on the daily automatic run (it runs with `npm run cron`).

**Safeguards.** The agent is told never to invent organisations, deadlines or links, and the app independently discards any result whose link (or at least its website) never appeared in the pages the agent actually searched or read. Duplicate links are ignored. Even so, AI can misread a page — always open the advert before acting.

**Cost & limits.** Each run makes up to *Max web searches* searches (default 8; Anthropic bills web search per 1,000 searches plus normal token usage) and reads each listed source page. Runs take about 1–3 minutes and execute in the background on the Node server; on serverless hosts use the scheduled job instead. Some sites block automated reading or require a login; those pages will simply return nothing. Respect each site's terms of use.

**Model.** Default `claude-sonnet-5-5` (configurable in Settings). Tools used: `web_search_20250305`, `web_fetch_20250910`.

## Gantt charts

All Gantt charts share one component (`src/components/Gantt.tsx`) and one data layer (`src/lib/gantt.ts`), so the screens and the exports show the same schedule.

- **Projects** (`/projects` → **Gantt**, or **Gantt schedule** in the sidebar): one bar per project from start date to deadline, filled to its progress %, with milestone diamonds. **Show tasks** nests each project's tasks under it. Filter by project status.
- **Tasks** (`/tasks` → **Gantt**): every task from start to due date, filterable by project, assignee, "only mine" and open tasks. Overdue tasks get a red overrun bar up to today and a "⚠ Overdue" label.
- **Project page**: a **Schedule** section (project, milestones and its tasks) and, under Timesheet, a time Gantt for the last six weeks. Task pages have **View on Gantt**.
- **Timesheets** (`/timesheets`): a time Gantt — one row per task × person, a mini-bar for every day time was logged (height = hours, 8 h = full) drawn over the task's planned window, so work done outside the plan stands out. It follows the page's person / project / date filters (default: last four weeks).
- **Controls**: Day / Week / Month scale (Day / Week for time), hover tooltips (dates, duration, status, progress, hours, milestone details), a dashed **Today** line, and a **Table** view.
- **Exports**: the **Project schedule (Gantt)** and **Timesheet Gantt** reports download to Excel (data sheet + a *Gantt* sheet with shaded week columns, ◆ milestones and today's column highlighted), Word (a landscape Gantt page after the table) and CSV.
- **Bar dates**: tasks without a start date start on their first logged time (or the day they were created); a project without a deadline ends at its latest task or milestone date.

## Timesheets

Time is logged against **tasks**, and tasks belong to **projects**, so every hour rolls up to both.

- **Recording time:** use the start/stop timer on a task, or **Log time** (date, start, hours, note) on the task page, the project page or the Timesheets page. Admins can log time for anyone; staff log their own.
- **Timesheets page** (`/timesheets`): a weekly grid per person, hours by person and by project, and every entry. Filter by person, project, date range or billing state.
- **Billing rules:** time is billable when the task is marked billable with an hourly rate, or when the project's billing type is *Project hours* or *Task hours* (then the project rate applies unless the task has its own rate). Time on fixed-rate projects is tracked but not billed.
- **Invoicing time:** on a project, **Invoice unbilled time** creates a draft invoice with one line per task (hours × rate, plus the default tax % from Settings) and stamps each entry with that invoice, so it can't be billed twice. Deleting the invoice returns those entries to "unbilled". Invoiced entries can't be deleted.

## Customising

- **Branding:** colours in `tailwind.config.ts` (`brand`), company name and details in Settings.
- **Navigation:** `src/components/Sidebar.tsx` (`NAV`). For admin-only modules also update `ADMIN_ONLY_PREFIXES` in `src/proxy.ts`.
- **New lookup list:** add the table in `src/db/schema.ts`, then add one entry to `src/app/(app)/settings/lookups.ts`.
- **New module:** follow developer guide §8.6 (schema → `db:push` → `actions.ts` → pages → sidebar).
- **Email notifications:** the hand-off point is marked `TODO(email)` in `src/lib/jobs.ts`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Login redirects back to `/login` in production | Serve over HTTPS, or set `INSECURE_COOKIES=1` for an HTTP-only test box. Check `AUTH_SECRET` is set |
| After `db:reset` the app still shows old data | The running server still holds the deleted DB file. Restart the server after a reset |
| "There is not enough information to infer relation" | A `relations()` block is missing its reverse side (developer guide §8.2) |
| `better-sqlite3` native build error | Node 20+, plus `python3 make g++` (Linux) or Xcode CLT (macOS) |

## Differences from the system document

These are deliberate. Update the system document to match when convenient.

- **Next.js 16.4.0 instead of 16.3.4.** 16.0–16.3.7 carry published security advisories (including a critical one); 16.4.0 is patched. React is on 19.2.x for the same reason.
- **Extensions from §8.10 already wired in:** predefined ticket replies (picker on the reply box), public survey response form (`/s/<slug>`), recurring expenses and expense-to-invoice rebilling, task time tracking, printable invoice, estimate, proposal and contract views (Print → Save as PDF), and an HTTP cron trigger (`/api/cron`).
- **Reporting & AI release:** reports & analytics, Excel/Word/CSV exports, Customer 360, reminders, global search, tags & segments, weighted forecast and AI prospecting (see sections above). New tables: `tags`, `taggings`, `saved_segments`, `reminders`, `prospect_runs`, `prospects`; new columns: `lead_statuses.probability`, `leads.expected_close`, `activity_log.kind`.
- **Timesheets module** (`/timesheets`, plus timesheet panels on tasks, projects and invoices) with manual time entry, a weekly grid and invoicing of unbilled hours. Uses the existing `task_timers` table plus an `invoice_id` column.
- **Extra screens:** Payments list, invoice edit, contract, task, expense and article edit pages, proposal → estimate conversion, and lead lost/junk/converted filters.
- **Scheduled job also marks overdue invoices** and stamps contracts once notified, so expiry notices are never repeated.
- **Surveys** accept any number of questions, with single and multiple choice as well as free-text answers.
- **Every lookup list is editable in Settings**, including ticket priorities, statuses and services, contract types, expense categories and predefined replies.
- **`db:push` no longer uses `--force`**, so it prompts before destructive changes. Only `db:reset` (development) forces.
