import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { surveyAnswers, surveyQuestions, surveys } from "@/db/schema";
import SubmitButton from "@/components/SubmitButton";
import { Badge, PageHeader } from "@/components/ui";
import { fmtDateTime, humanize } from "@/lib/utils";
import { deleteSurvey, toggleSurvey } from "../actions";

export default async function SurveyShowPage({ params }: { params: Promise<{ id: string }> }) {
  const surveyId = Number((await params).id);
  const s = await db.query.surveys.findFirst({
    where: eq(surveys.id, surveyId),
    with: { questions: { orderBy: asc(surveyQuestions.order), with: { answers: { orderBy: asc(surveyAnswers.id), with: { customer: true } } } } },
  });
  if (!s) notFound();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const publicUrl = `${origin}/s/${s.slug}`;
  const toggle = async () => { "use server"; await toggleSurvey(surveyId); };
  const del = async () => { "use server"; await deleteSurvey(surveyId); };
  return (
    <>
      <PageHeader
        title={s.subject}
        subtitle={<Badge status={s.active ? "active" : "inactive"} />}
        back={{ href: "/surveys", label: "Surveys" }}
        actions={
          <>
            <form action={toggle}><button className="btn-secondary">{s.active ? "Deactivate" : "Activate"}</button></form>
            <form action={del}><SubmitButton className="btn-danger" confirm="Delete this survey and all its answers?">Delete</SubmitButton></form>
          </>
        }
      />
      <section className="card mb-6">
        <div className="field-label">Public response link</div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-slate-100 px-2 py-1 text-sm">{publicUrl}</code>
          <Link href={`/s/${s.slug}`} target="_blank" className="text-sm">Open ↗</Link>
        </div>
        <p className="muted mt-1">Share with clients or workshop participants. {s.active ? "" : "Responses are closed while the survey is inactive."}</p>
      </section>
      <div className="space-y-4">
        {s.questions.map((q, i) => {
          const opts = (q.options ?? "").split("\n").map((o) => o.trim()).filter(Boolean);
          const tally = opts.map((o) => ({ o, n: q.answers.filter((a) => a.answer.split("\n").includes(o)).length }));
          return (
            <section key={q.id} className="card">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h2>{i + 1}. {q.question}</h2>
                <span className="badge bg-slate-100 whitespace-nowrap">{q.answers.length} response{q.answers.length === 1 ? "" : "s"} · {humanize(q.type)}</span>
              </div>
              {opts.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {tally.map(({ o, n }) => (
                    <li key={o} className="flex items-center gap-3">
                      <span className="w-48 truncate">{o}</span>
                      <span className="h-2 flex-1 rounded bg-slate-100"><span className="block h-2 rounded bg-brand-500" style={{ width: `${q.answers.length ? (n / q.answers.length) * 100 : 0}%` }} /></span>
                      <span className="w-8 text-right tabular-nums">{n}</span>
                    </li>
                  ))}
                </ul>
              ) : q.answers.length === 0 ? <p className="muted">No responses yet.</p> : (
                <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                  {q.answers.map((a) => <li key={a.id} className="rounded bg-slate-50 p-2"><div className="prose-pre">{a.answer}</div><div className="text-xs text-slate-500">{a.respondentEmail ?? a.customer?.company ?? "Anonymous"} · {fmtDateTime(a.createdAt)}</div></li>)}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
