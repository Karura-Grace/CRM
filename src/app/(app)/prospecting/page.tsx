import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { prospectRuns } from "@/db/schema";
import AutoRefresh from "@/components/AutoRefresh";
import ExportButtons from "@/components/ExportButtons";
import SubmitButton from "@/components/SubmitButton";
import { Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { aiConfigured, sweepStaleRuns } from "@/lib/prospecting";
import { getSettings } from "@/lib/settings";
import { daysBetween, fmtDate, fmtDateTime, today } from "@/lib/utils";
import { convertProspect, runProspecting, setProspectStatus } from "./actions";

export const metadata = { title: "AI prospecting" };

const scoreCls = (n: number) => (n >= 80 ? "bg-emerald-100 text-emerald-800" : n >= 60 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700");

export default async function ProspectingPage({ searchParams }: { searchParams: Promise<{ status?: string; min?: string; focus?: string }> }) {
  const sp = await searchParams;
  const session = await requireUser();
  await sweepStaleRuns();
  const s = await getSettings();
  const status = sp.status ?? "open";
  const min = Number(sp.min ?? 0) || 0;
  const [runs, all] = await Promise.all([
    db.query.prospectRuns.findMany({ orderBy: desc(prospectRuns.id), limit: 10, with: { starter: true } }),
    db.query.prospects.findMany({ with: { lead: true } }),
  ]);
  const rows = all
    .filter((p) => (status === "open" ? p.status === "new" || p.status === "reviewing" : status === "all" ? true : p.status === status) && p.fitScore >= min)
    .sort((a, b) => b.fitScore - a.fitScore || (a.deadline ?? "9").localeCompare(b.deadline ?? "9"));
  const running = runs.find((r) => r.status === "running");
  const sources = s.ai_sources.split(/\s+/).filter((x) => /^https?:\/\//.test(x));
  const pill = (v: string, l: string) => <Link key={v} href={`/prospecting?status=${v}${min ? `&min=${min}` : ""}`} className={`btn btn-sm ${status === v ? "bg-brand-600 text-white hover:text-white" : "btn-secondary"}`}>{l}</Link>;

  return (
    <>
      {running && <AutoRefresh seconds={5} />}
      <PageHeader title="AI prospecting" subtitle="An AI agent searches the web and your listed tender/job sites for advertised consulting work that fits PAC’s profile. Review what it finds and convert good fits into leads." actions={<ExportButtons report="prospects-list" params={{ status: ["new", "reviewing", "converted", "dismissed"].includes(status) ? status : undefined }} compact />} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <h2 className="mb-3">Run the agent</h2>
          {!aiConfigured() ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <b>Not configured.</b> Add your Anthropic API key to the server’s <code>.env</code> as <code>ANTHROPIC_API_KEY=…</code> and restart. {session.role === "admin" ? <>Then tune the profile and sources in <Link href="/settings#ai">Settings → AI prospecting</Link>.</> : "Ask an administrator."}
            </div>
          ) : running ? (
            <div className="flex items-center gap-3 rounded-md bg-sky-50 p-4 text-sm text-sky-900" data-testid="run-running">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-sky-500" />
              Agent running since {fmtDateTime(running.startedAt)} ({running.mode}{running.focus ? ` · “${running.focus}”` : ""}). This page refreshes automatically.
            </div>
          ) : (
            <form action={runProspecting} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label className="block"><span className="field-label">Where to look</span>
                <select name="mode" defaultValue="both" className="field-input"><option value="both">Web + my sources</option><option value="search">Web search only</option><option value="sources">My sources only</option></select>
              </label>
              <label className="block sm:col-span-2"><span className="field-label">Focus (optional)</span><input name="focus" placeholder="e.g. board evaluation tenders in Uganda" className="field-input" /></label>
              <div className="flex items-end"><SubmitButton className="btn-primary w-full">Run agent</SubmitButton></div>
            </form>
          )}
          <p className="muted mt-3">Each run uses Claude ({s.ai_model}) with up to {s.ai_max_searches} web searches plus reads of your {sources.length} source page{sources.length === 1 ? "" : "s"}. Results whose link never appeared in what the agent read are discarded. Always open the advert before acting — the agent can misread pages.</p>
        </section>
        <section className="card">
          <div className="mb-2 flex items-center justify-between"><h2>Profile &amp; sources</h2>{session.role === "admin" && <Link href="/settings#ai" className="text-sm">Edit →</Link>}</div>
          <p className="line-clamp-6 whitespace-pre-line text-sm text-slate-600">{s.ai_profile}</p>
          <ul className="mt-3 space-y-1 text-sm">{sources.map((u) => <li key={u} className="truncate"><a href={u} target="_blank" rel="noreferrer noopener">{u.replace(/^https?:\/\//, "")}</a></li>)}</ul>
          <p className="muted mt-2">Daily automatic run: {s.ai_auto_daily === "1" ? "on (with the scheduled job)" : "off"}</p>
        </section>
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-center gap-2">
        <h2 className="mr-2">Prospects</h2>
        {pill("open", "To review")}{pill("converted", "Converted")}{pill("dismissed", "Dismissed")}{pill("all", "All")}
        <form className="ml-auto flex items-center gap-2 text-sm"><input type="hidden" name="status" value={status} /><span className="text-slate-500">Min fit</span><input name="min" type="number" min="0" max="100" defaultValue={min || ""} className="field-input w-20" /><button className="btn-secondary btn-sm">Apply</button></form>
      </div>
      {rows.length === 0 ? <Empty>No prospects here yet. Run the agent to search for opportunities.</Empty> : (
        <div className="space-y-3" data-testid="prospects">
          {rows.map((p) => {
            const convert = async () => { "use server"; await convertProspect(p.id); };
            const review = async () => { "use server"; await setProspectStatus(p.id, "reviewing"); };
            const dismiss = async () => { "use server"; await setProspectStatus(p.id, "dismissed"); };
            const restore = async () => { "use server"; await setProspectStatus(p.id, "new"); };
            const left = p.deadline ? daysBetween(today(), p.deadline) : null;
            return (
              <article key={p.id} className={`card ${sp.focus === String(p.id) ? "ring-2 ring-brand-300" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`badge ${scoreCls(p.fitScore)}`} title="Fit score (0–100)">Fit {p.fitScore}</span>
                      <span className="badge bg-slate-100 text-slate-700">{p.kind === "opportunity" ? "Advertised opportunity" : "Organisation to approach"}</span>
                      {p.status !== "new" && <span className="badge bg-brand-100 text-brand-800">{p.status}</span>}
                      {left !== null && <span className={`badge ${left < 0 ? "bg-slate-200 text-slate-600" : left <= 7 ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-800"}`}>{left < 0 ? `Closed ${fmtDate(p.deadline)}` : `Deadline ${fmtDate(p.deadline)} · ${left}d left`}</span>}
                    </div>
                    <a href={p.url} target="_blank" rel="noreferrer noopener" className="font-semibold">{p.title} ↗</a>
                    <div className="text-sm text-slate-600">{[p.organisation, p.location, p.source].filter(Boolean).join(" · ")}</div>
                    {p.summary && <p className="mt-2 text-sm text-slate-700">{p.summary}</p>}
                    <p className="mt-1 text-sm text-slate-500">{p.services && <><b>Services:</b> {p.services} · </>}{p.fitReason}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {p.lead ? <Link href={`/leads/${p.lead.id}`} className="btn-secondary btn-sm">Lead: {p.lead.name}</Link> : (
                      <>
                        <form action={convert}><SubmitButton className="btn-primary btn-sm">Convert to lead</SubmitButton></form>
                        {p.status === "new" && <form action={review}><button className="btn-secondary btn-sm">Reviewing</button></form>}
                        {p.status !== "dismissed" ? <form action={dismiss}><button className="btn-ghost btn-sm">Dismiss</button></form> : <form action={restore}><button className="btn-ghost btn-sm">Restore</button></form>}
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="card mt-8">
        <h2 className="mb-3">Recent runs</h2>
        {runs.length === 0 ? <p className="muted">No runs yet.</p> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Started</th><th>By</th><th>Mode</th><th>Focus</th><th>Status</th><th className="text-right">Found</th><th className="text-right">New</th><th className="text-right">Searches</th><th className="text-right">Pages read</th><th>Notes</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{fmtDateTime(r.startedAt)}</td>
                    <td>{r.starter ? r.starter.firstName : "Scheduled"}</td>
                    <td>{r.mode}</td><td>{r.focus ?? "—"}</td>
                    <td><span className={`badge ${r.status === "done" ? "bg-emerald-100 text-emerald-800" : r.status === "failed" ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-800"}`}>{r.status}{r.sample ? " (sample)" : ""}</span></td>
                    <td className="text-right">{r.found}</td><td className="text-right">{r.added}</td><td className="text-right">{r.searches}</td><td className="text-right">{r.fetches}</td>
                    <td className="max-w-sm text-xs text-slate-600">{r.error ?? r.log?.split("\n").slice(-1)[0] ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
