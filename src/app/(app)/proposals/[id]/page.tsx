import { RemindersPanel } from "@/components/crm";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { proposalItems, proposals } from "@/db/schema";
import DocumentView from "@/components/DocumentView";
import PrintButton from "@/components/PrintButton";
import SubmitButton from "@/components/SubmitButton";
import { Badge, PageHeader } from "@/components/ui";
import { getDefaultCurrency, getSettings } from "@/lib/settings";
import { fmtDate } from "@/lib/utils";
import { convertProposalToEstimate, deleteProposal, setProposalStatus } from "../actions";

const STATUSES = ["draft", "sent", "open", "revised", "accepted", "declined"] as const;

export default async function ProposalShowPage({ params }: { params: Promise<{ id: string }> }) {
  const proposalId = Number((await params).id);
  const p = await db.query.proposals.findFirst({
    where: eq(proposals.id, proposalId),
    with: { customer: true, lead: true, items: { orderBy: asc(proposalItems.order) } },
  });
  if (!p) notFound();
  const s = await getSettings();
  const { symbol } = await getDefaultCurrency();
  const toName = p.customer?.company ?? p.proposalTo ?? p.lead?.name ?? "—";

  const convert = async () => { "use server"; await convertProposalToEstimate(proposalId); };
  const del = async () => { "use server"; await deleteProposal(proposalId); };

  return (
    <>
      <PageHeader
        title={p.subject}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge status={p.status} />
            {p.customer && <Link href={`/customers/${p.customer.id}`}>{p.customer.company}</Link>}
            {p.lead && <Link href={`/leads/${p.lead.id}`}>Lead: {p.lead.name}</Link>}
          </span>
        }
        back={{ href: "/proposals", label: "Proposals" }}
        actions={
          <>
            {STATUSES.filter((t) => t !== p.status).map((t) => {
              const a = async () => { "use server"; await setProposalStatus(proposalId, t); };
              return <form key={t} action={a}><button className="btn-secondary btn-sm capitalize">Mark {t}</button></form>;
            })}
            <form action={convert}><SubmitButton className="btn-primary">Convert to estimate</SubmitButton></form>
            <PrintButton />
            <form action={del}><SubmitButton className="btn-danger" confirm="Delete this proposal?">Delete</SubmitButton></form>
          </>
        }
      />
      {p.content && (
        <section className="card mb-6">
          <h2 className="mb-2">Proposal</h2>
          <div className="prose-pre">{p.content}</div>
        </section>
      )}
      <DocumentView
        company={{ name: s.company_name, address: s.company_address, email: s.company_email, phone: s.company_phone }}
        title="Proposal"
        number={`PRO-${String(p.id).padStart(6, "0")}`}
        meta={[["Date", fmtDate(p.date)], ["Open till", fmtDate(p.openTill)]]}
        billTo={{ name: toName, lines: [p.email] }}
        lines={p.items}
        subtotal={p.subtotal}
        total={p.total}
        symbol={symbol}
        withTax={false}
      />
      <div className="no-print mt-6 max-w-xl"><RemindersPanel relType="proposal" relId={proposalId} back={`/proposals/${proposalId}`} /></div>
    </>
  );
}
