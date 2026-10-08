"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { surveyQuestions, surveys } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { flash, optStr, slugify, str } from "@/lib/utils";

const TYPES = ["text", "textarea", "radio", "checkbox"] as const;
type QType = (typeof TYPES)[number];

export async function createSurvey(fd: FormData) {
  const s = await requireUser();
  const subject = str(fd, "subject");
  if (!subject) redirect(flash("/surveys/create", "error", "Survey name is required."));
  const qs = fd.getAll("question").map(String);
  const types = fd.getAll("type").map(String);
  const options = fd.getAll("options").map(String);
  const questions = qs
    .map((q, i) => ({ question: q.trim(), type: (TYPES as readonly string[]).includes(types[i]) ? (types[i] as QType) : "textarea", options: options[i]?.trim() || null, order: i }))
    .filter((q) => q.question);
  if (questions.length === 0) redirect(flash("/surveys/create", "error", "Add at least one question."));
  const bad = questions.find((q) => (q.type === "radio" || q.type === "checkbox") && !q.options);
  if (bad) redirect(flash("/surveys/create", "error", `Question “${bad.question}” needs answer options (one per line).`));
  const slug = `${slugify(subject)}-${Math.random().toString(36).slice(2, 8)}`;
  const [sv] = await db.insert(surveys).values({ subject, description: optStr(fd, "description"), slug, createdBy: s.staffId }).returning();
  await db.insert(surveyQuestions).values(questions.map((q) => ({ ...q, surveyId: sv.id })));
  redirect(flash(`/surveys/${sv.id}`, "success", "Survey created."));
}

export async function toggleSurvey(id: number) {
  await requireUser();
  const sv = await db.query.surveys.findFirst({ where: eq(surveys.id, id) });
  if (sv) await db.update(surveys).set({ active: !sv.active }).where(eq(surveys.id, id));
  redirect(flash(`/surveys/${id}`, "success", sv?.active ? "Survey deactivated." : "Survey activated."));
}

export async function deleteSurvey(id: number) {
  await requireUser();
  await db.delete(surveys).where(eq(surveys.id, id));
  redirect(flash("/surveys", "success", "Survey deleted."));
}
