import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { items } from "@/db/schema";
import LineItemsEditor from "@/components/LineItemsEditor";
import SalesDocFields from "@/components/SalesDocFields";
import SubmitButton from "@/components/SubmitButton";
import { Field, PageHeader } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { addInterval, today } from "@/lib/utils";
import { createEstimate } from "../actions";

export const metadata = { title: "New estimate" };

export default async function NewEstimatePage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const { customerId } = await searchParams;
  const catalog = await db.query.items.findMany({ orderBy: asc(items.description) });
  const s = await getSettings();
  return (
    <>
      <PageHeader title="New estimate" back={{ href: "/estimates", label: "Estimates" }} />
      <form action={createEstimate} className="space-y-6">
        <div className="card">
          <SalesDocFields customerId={customerId ? Number(customerId) : null} date={today()} secondDate={{ name: "expiryDate", label: "Expiry date", value: addInterval(today(), "day", 14) }} />
        </div>
        <div className="card"><LineItemsEditor catalog={catalog} /></div>
        <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client note"><textarea name="clientNote" rows={3} className="field-input" /></Field>
          <Field label="Terms & conditions"><textarea name="terms" rows={3} className="field-input" defaultValue={s.estimate_terms} /></Field>
        </div>
        <div className="flex gap-2">
          <SubmitButton name="status" value="draft" className="btn-secondary">Save as draft</SubmitButton>
          <SubmitButton name="status" value="sent">Save &amp; mark sent</SubmitButton>
          <Link href="/estimates" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </>
  );
}
