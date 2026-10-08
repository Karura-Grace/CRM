/** Header fields shared by the estimate & invoice create/edit forms. */
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { Field } from "@/components/ui";

export default async function SalesDocFields({
  customerId,
  currencyId,
  date,
  secondDate,
}: {
  customerId?: number | null;
  currencyId?: number | null;
  date: string;
  secondDate: { name: string; label: string; value?: string | null };
}) {
  const [custs, currencies] = await Promise.all([
    db.query.customers.findMany({ where: eq(customers.active, true), orderBy: asc(customers.company), columns: { id: true, company: true } }),
    db.query.currencies.findMany(),
  ]);
  const defCur = currencies.find((c) => c.isDefault)?.id;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <Field label="Customer *" className="sm:col-span-2">
        <select name="customerId" required className="field-input" defaultValue={customerId ?? ""}>
          <option value="">— Select customer —</option>
          {custs.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
        </select>
      </Field>
      <Field label="Currency">
        <select name="currencyId" className="field-input" defaultValue={currencyId ?? defCur ?? ""}>
          {currencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div />
      <Field label="Date"><input type="date" name="date" className="field-input" defaultValue={date} /></Field>
      <Field label={secondDate.label}><input type="date" name={secondDate.name} className="field-input" defaultValue={secondDate.value ?? ""} /></Field>
    </div>
  );
}
