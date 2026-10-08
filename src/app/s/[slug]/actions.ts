"use server";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { surveyAnswers, surveys } from "@/db/schema";

/** Public, unauthenticated survey submission. Only accepts answers for active surveys' own questions. */
export async function submitSurvey(slug: string, fd: FormData) {
  const sv = await db.query.surveys.findFirst({ where: and(eq(surveys.slug, slug), eq(surveys.active, true)), with: { questions: true } });
  if (!sv) redirect(`/s/${slug}?error=closed`);
  if (String(fd.get("website") ?? "")) redirect(`/s/${slug}?done=1`); // honeypot
  const email = String(fd.get("respondentEmail") ?? "").trim().slice(0, 200) || null;
  const rows = sv.questions
    .map((q) => {
      const vals = fd.getAll(`q_${q.id}`).map((v) => String(v).trim()).filter(Boolean);
      return { questionId: q.id, answer: vals.join("\n").slice(0, 5000), respondentEmail: email };
    })
    .filter((r) => r.answer);
  if (rows.length === 0) redirect(`/s/${slug}?error=empty`);
  await db.insert(surveyAnswers).values(rows);
  redirect(`/s/${slug}?done=1`);
}
