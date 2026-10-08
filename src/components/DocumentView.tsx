/** Printable sales-document body shared by Estimates, Proposals and Invoices (browser "Print → Save as PDF"). */
import { money } from "@/lib/utils";

export interface DocLine { id: number; description: string; qty: number; rate: number; taxRate?: number }

export default function DocumentView({
  company,
  title,
  number,
  meta,
  billTo,
  lines,
  subtotal,
  tax,
  total,
  paid,
  symbol,
  withTax = true,
  notes,
}: {
  company: { name: string; address?: string; email?: string; phone?: string; vat?: string };
  title: string;
  number: string;
  meta: [string, string][];
  billTo: { name: string; lines: (string | null | undefined)[] };
  lines: DocLine[];
  subtotal: number;
  tax?: number;
  total: number;
  paid?: number;
  symbol: string;
  withTax?: boolean;
  notes?: { label: string; text: string | null | undefined }[];
}) {
  return (
    <div className="card space-y-6">
      <div className="flex flex-wrap justify-between gap-6">
        <div>
          <div className="text-xl font-bold text-brand-800">{company.name}</div>
          <div className="mt-1 whitespace-pre-line text-sm text-slate-600">
            {[company.address, company.email, company.phone, company.vat ? `PIN: ${company.vat}` : null].filter(Boolean).join("\n")}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold uppercase tracking-wide text-slate-400">{title}</div>
          <div className="text-lg font-semibold">{number}</div>
          <dl className="mt-2 text-sm">
            {meta.map(([k, v]) => (
              <div key={k} className="flex justify-end gap-3"><dt className="text-slate-500">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</div>
        <div className="font-semibold">{billTo.name}</div>
        <div className="whitespace-pre-line text-sm text-slate-600">{billTo.lines.filter(Boolean).join("\n")}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>#</th><th>Description</th><th className="text-right">Qty</th><th className="text-right">Rate</th>{withTax && <th className="text-right">Tax</th>}<th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id}>
                <td>{i + 1}</td>
                <td className="whitespace-pre-line">{l.description}</td>
                <td className="text-right tabular-nums">{l.qty}</td>
                <td className="text-right tabular-nums">{money(l.rate, symbol)}</td>
                {withTax && <td className="text-right">{l.taxRate ?? 0}%</td>}
                <td className="text-right tabular-nums">{money(l.qty * l.rate, symbol)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <dl className="w-72 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{money(subtotal, symbol)}</dd></div>
          {withTax && <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd className="tabular-nums">{money(tax ?? 0, symbol)}</dd></div>}
          <div className="flex justify-between border-t pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(total, symbol)}</dd></div>
          {paid !== undefined && (
            <>
              <div className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd className="tabular-nums">{money(paid, symbol)}</dd></div>
              <div className="flex justify-between font-semibold text-rose-700"><dt>Amount due</dt><dd className="tabular-nums">{money(total - paid, symbol)}</dd></div>
            </>
          )}
        </dl>
      </div>
      {notes?.filter((n) => n.text).map((n) => (
        <div key={n.label}>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{n.label}</div>
          <p className="prose-pre">{n.text}</p>
        </div>
      ))}
    </div>
  );
}
