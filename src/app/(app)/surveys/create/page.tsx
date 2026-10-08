import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { Field, PageHeader } from "@/components/ui";
import { createSurvey } from "../actions";

export const metadata = { title: "New survey" };
const SLOTS = 8;

export default function NewSurveyPage() {
  return (
    <>
      <PageHeader title="New survey" back={{ href: "/surveys", label: "Surveys" }} />
      <form action={createSurvey} className="space-y-6">
        <div className="card grid grid-cols-1 gap-4">
          <Field label="Survey name *"><input name="subject" required className="field-input" placeholder="e.g. Post-workshop feedback" /></Field>
          <Field label="Intro text shown to respondents"><textarea name="description" rows={2} className="field-input" /></Field>
        </div>
        <div className="card space-y-4">
          <h2>Questions</h2>
          <p className="muted">Fill in as many as you need — blank rows are ignored. For single/multiple choice, list one option per line.</p>
          {Array.from({ length: SLOTS }, (_, i) => (
            <div key={i} className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-6">
              <Field label={`Question ${i + 1}`} className="sm:col-span-3"><input name="question" className="field-input" /></Field>
              <Field label="Type">
                <select name="type" className="field-input" defaultValue="textarea">
                  <option value="textarea">Long text</option><option value="text">Short text</option><option value="radio">Single choice</option><option value="checkbox">Multiple choice</option>
                </select>
              </Field>
              <Field label="Options (choice types)" className="sm:col-span-2"><textarea name="options" rows={2} className="field-input" /></Field>
            </div>
          ))}
        </div>
        <div className="flex gap-2"><SubmitButton>Create survey</SubmitButton><Link href="/surveys" className="btn-secondary">Cancel</Link></div>
      </form>
    </>
  );
}
