import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { surveyQuestions, surveys } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { submitSurvey } from "./actions";

export const dynamic = "force-dynamic";

export default async function PublicSurveyPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const sv = await db.query.surveys.findFirst({ where: eq(surveys.slug, slug), with: { questions: { orderBy: asc(surveyQuestions.order) } } });
  if (!sv) notFound();
  const s = await getSettings();
  const submit = submitSurvey.bind(null, slug);
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center text-sm font-semibold uppercase tracking-wide text-brand-700">{s.company_name}</div>
        <div className="card">
          <h1>{sv.subject}</h1>
          {sv.description && <p className="muted mt-2 whitespace-pre-line">{sv.description}</p>}
          {sp.done ? (
            <p className="mt-6 rounded-md bg-emerald-50 p-4 text-emerald-800">Thank you — your response has been recorded.</p>
          ) : !sv.active || sp.error === "closed" ? (
            <p className="mt-6 rounded-md bg-amber-50 p-4 text-amber-800">This survey is not accepting responses right now.</p>
          ) : (
            <form action={submit} className="mt-6 space-y-6">
              {sp.error === "empty" && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">Please answer at least one question.</p>}
              <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />
              {sv.questions.map((q, i) => {
                const opts = (q.options ?? "").split("\n").map((o) => o.trim()).filter(Boolean);
                return (
                  <fieldset key={q.id}>
                    <legend className="field-label">{i + 1}. {q.question}</legend>
                    {q.type === "text" && <input name={`q_${q.id}`} className="field-input" />}
                    {q.type === "textarea" && <textarea name={`q_${q.id}`} rows={4} className="field-input" />}
                    {(q.type === "radio" || q.type === "checkbox") && (
                      <div className="space-y-1">
                        {opts.map((o) => (
                          <label key={o} className="flex items-center gap-2 text-sm"><input type={q.type} name={`q_${q.id}`} value={o} /> {o}</label>
                        ))}
                      </div>
                    )}
                  </fieldset>
                );
              })}
              <label className="block"><span className="field-label">Your email (optional)</span><input type="email" name="respondentEmail" className="field-input" /></label>
              <button type="submit" className="btn-primary">Submit response</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
