export const dynamic = "force-dynamic";

import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import Flash from "@/components/Flash";
import Sidebar from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logout } from "./logout-action";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const s = await getSettings();
  const t0 = new Date().toLocaleDateString("en-CA", { timeZone: process.env.APP_TIMEZONE || "Africa/Nairobi" });
  const dueCount = (await db.query.reminders.findMany({ where: (r, { and, eq, lte }) => and(eq(r.staffId, session.staffId), eq(r.isDone, false), lte(r.remindAt, t0)) })).length;
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar role={session.role} companyName={s.company_name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-3 text-sm">
          <form action="/search" className="mr-auto w-full max-w-sm" role="search">
            <input name="q" placeholder="Search everything… (customers, invoices, tasks)" aria-label="Search" className="field-input py-1.5" />
          </form>
          <Link href="/reminders" className="btn-ghost btn-sm" title="My open reminders due today or overdue">
            ⏰ Reminders{dueCount > 0 && <span className="ml-1 rounded-full bg-rose-600 px-1.5 text-xs font-semibold text-white" data-testid="reminder-badge">{dueCount}</span>}
          </Link>
          <span className="text-slate-600">
            {session.name} <span className="badge ml-1 bg-slate-100 text-slate-600">{session.role}</span>
          </span>
          <form action={logout}>
            <button type="submit" className="btn-ghost btn-sm">Sign out</button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Suspense fallback={null}>
            <Flash />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
