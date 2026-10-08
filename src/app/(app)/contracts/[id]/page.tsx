import { RemindersPanel } from "@/components/crm";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import PrintButton from "@/components/PrintButton";
import SubmitButton from "@/components/SubmitButton";
import { DL, PageHeader } from "@/components/ui";
import { getDefaultCurrency } from "@/lib/settings";
import { fmtDate, fmtDateTime, money } from "@/lib/utils";
import { deleteContract, toggleSigned } from "../actions";
import { contractState } from "../state";

export default async function ContractShowPage({ params }: { params: Promise<{ id: string }> }) {
  const contractId = Number((await params).id);
  const c = await db.query.contracts.findFirst({ where: eq(contracts.id, contractId), with: { customer: true, type: true, creator: true } });
  if (!c) notFound();
  const { symbol } = await getDefaultCurrency();
  const st = contractState(c.dateEnd);
  const sign = async () => { "use server"; await toggleSigned(contractId); };
  const del = async () => { "use server"; await deleteContract(contractId); };
  return (
    <>
      <PageHeader
        title={c.subject}
        subtitle={<span className="flex items-center gap-2"><span className={`badge ${st.cls}`}>{st.label}</span>{c.signed && <span className="badge bg-emerald-100 text-emerald-800">Signed</span>}</span>}
        back={{ href: "/contracts", label: "Contracts" }}
        actions={
          <>
            <form action={sign}><button className="btn-secondary">{c.signed ? "Mark unsigned" : "Mark signed"}</button></form>
            <Link href={`/contracts/${contractId}/edit`} className="btn-secondary">Edit</Link>
            <PrintButton />
            <form action={del}><SubmitButton className="btn-danger" confirm="Delete this contract?">Delete</SubmitButton></form>
          </>
        }
      />
      <section className="card mb-6">
        <DL rows={[
          ["Customer", <Link key="c" href={`/customers/${c.customerId}`}>{c.customer.company}</Link>], ["Type", c.type?.name],
          ["Start", fmtDate(c.dateStart)], ["End", fmtDate(c.dateEnd)], ["Value", money(c.value, symbol)],
          ["Expiry notification", c.isExpiryNotify ? (c.expiryNotifiedAt ? `Sent ${fmtDateTime(c.expiryNotifiedAt)}` : "On") : "Off"],
          ["Description", c.description], ["Created by", c.creator ? `${c.creator.firstName} ${c.creator.lastName}` : null],
        ]} />
      </section>
      <section className="card">
        <h2 className="mb-3">Contract content</h2>
        {c.content ? <div className="prose-pre">{c.content}</div> : <p className="muted">No content entered.</p>}
      </section>
      <div className="no-print mt-6 max-w-xl"><RemindersPanel relType="contract" relId={contractId} back={`/contracts/${contractId}`} title="Follow-ups (e.g. renewal)" /></div>
    </>
  );
}
