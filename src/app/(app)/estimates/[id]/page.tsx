import { RemindersPanel } from "@/components/crm";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { estimateItems, estimates } from "@/db/schema";
import DocumentView from "@/components/DocumentView";
import PrintButton from "@/components/PrintButton";
import SubmitButton from "@/components/SubmitButton";
import { Badge, PageHeader } from "@/components/ui";
import { getDefaultCurrency, getSettings } from "@/lib/settings";
import { fmtDate } from "@/lib/utils";
import { convertEstimateToInvoice, deleteEstimate, setEstimateStatus } from "../actions";

const TRANSITIONS = ["draft", "sent", "accepted", "declined", "expired"] as const;

export default async function EstimateShowPage({ params }: { params: Promise<{ id: string }> }) {
  const estimateId = Number((await params).id);
  const e = await db.query.estimates.findFirst({
    where: eq(estimates.id, estimateId),
    with: { customer: { with: { contacts: true } }, currency: true, invoice: true, items: { orderBy: asc(estimateItems.order) } },
  });
  if (!e) notFound();
  const s = await getSettings();
  const symbol = e.currency?.symbol ?? (await getDefaultCurrency()).symbol;
  const primary = e.customer.contacts.find((c) => c.isPrimary);

  const convert = async () => { "use server"; await convertEstimateToInvoice(estimateId); };
  const del = async () => { "use server"; await deleteEstimate(estimateId); };

  return (
    <>
      <PageHeader
        title={e.number}
        subtitle={<span className="flex items-center gap-2"><Badge status={e.status} />{e.invoice && <Link href={`/invoices/${e.invoice.id}`}>Invoiced as {e.invoice.number}</Link>}</span>}
        back={{ href: "/estimates", label: "Estimates" }}
        actions={
          <>
            {TRANSITIONS.filter((t) => t !== e.status).map((t) => {
              const action = async () => { "use server"; await setEstimateStatus(estimateId, t); };
              return <form key={t} action={action}><button className="btn-secondary btn-sm capitalize">Mark {t}</button></form>;
            })}
            {!e.invoiceId && <form action={convert}><SubmitButton className="btn-primary">Convert to invoice</SubmitButton></form>}
            <PrintButton />
            <form action={del}><SubmitButton className="btn-danger" confirm="Delete this estimate?">Delete</SubmitButton></form>
          </>
        }
      />
      <DocumentView
        company={{ name: s.company_name, address: s.company_address, email: s.company_email, phone: s.company_phone, vat: s.company_vat }}
        title="Estimate"
        number={e.number}
        meta={[["Date", fmtDate(e.date)], ["Valid until", fmtDate(e.expiryDate)]]}
        billTo={{ name: e.customer.company, lines: [primary ? `Attn: ${primary.firstName} ${primary.lastName}` : null, e.customer.address, [e.customer.city, e.customer.country].filter(Boolean).join(", "), e.customer.vatNumber ? `PIN: ${e.customer.vatNumber}` : null] }}
        lines={e.items}
        subtotal={e.subtotal}
        tax={e.totalTax}
        total={e.total}
        symbol={symbol}
        notes={[{ label: "Note", text: e.clientNote }, { label: "Terms & conditions", text: e.terms }]}
      />
      <div className="no-print mt-6 max-w-xl"><RemindersPanel relType="estimate" relId={estimateId} back={`/estimates/${estimateId}`} /></div>
    </>
  );
}
