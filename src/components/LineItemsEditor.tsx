"use client";
import { useMemo, useState } from "react";

export interface CatalogItem {
  id: number;
  description: string;
  longDescription?: string | null;
  rate: number;
  taxRate: number;
  unit?: string | null;
}
export interface LineInit {
  itemId?: number | null;
  description: string;
  qty: number;
  rate: number;
  taxRate?: number;
}

type Row = { key: number; itemId: string; description: string; qty: string; rate: string; taxRate: string };

let seq = 0;
const blank = (): Row => ({ key: ++seq, itemId: "", description: "", qty: "1", rate: "0", taxRate: "0" });

/**
 * Shared editor for Estimates, Proposals and Invoices. Renders visible rows plus parallel
 * hidden inputs (itemDescription, itemQty, itemRate, itemTax, itemId) that parseLineItems()
 * reconstructs on the server via formData.getAll().
 */
export default function LineItemsEditor({
  catalog,
  initial,
  withTax = true,
  currency = "KES",
}: {
  catalog: CatalogItem[];
  initial?: LineInit[];
  withTax?: boolean;
  currency?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial && initial.length > 0
      ? initial.map((l) => ({
          key: ++seq,
          itemId: l.itemId ? String(l.itemId) : "",
          description: l.description,
          qty: String(l.qty),
          rate: String(l.rate),
          taxRate: String(l.taxRate ?? 0),
        }))
      : [blank()],
  );

  const byDesc = useMemo(() => new Map(catalog.map((c) => [c.description.toLowerCase(), c])), [catalog]);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (patch.description !== undefined) {
          const hit = byDesc.get(patch.description.trim().toLowerCase());
          if (hit) {
            next.itemId = String(hit.id);
            next.rate = String(hit.rate);
            next.taxRate = String(hit.taxRate);
          } else if (r.itemId) {
            next.itemId = "";
          }
        }
        return next;
      }),
    );

  const totals = rows.reduce(
    (acc, r) => {
      const amount = (Number(r.qty) || 0) * (Number(r.rate) || 0);
      acc.subtotal += amount;
      if (withTax) acc.tax += (amount * (Number(r.taxRate) || 0)) / 100;
      return acc;
    },
    { subtotal: 0, tax: 0 },
  );
  const fmt = (n: number) => `${currency} ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-3">
      <datalist id="catalog-items">
        {catalog.map((c) => (
          <option key={c.id} value={c.description}>
            {fmt(c.rate)}
            {c.unit ? ` / ${c.unit}` : ""}
          </option>
        ))}
      </datalist>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="w-1/2">Item / description</th>
              <th className="w-20">Qty</th>
              <th className="w-32">Rate</th>
              {withTax && <th className="w-24">Tax %</th>}
              <th className="w-32 text-right">Amount</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>
                  <input
                    className="field-input"
                    list="catalog-items"
                    placeholder="Pick from catalog or type a description"
                    value={r.description}
                    onChange={(e) => update(r.key, { description: e.target.value })}
                    data-testid="line-description"
                  />
                  <input type="hidden" name="itemDescription" value={r.description} />
                  <input type="hidden" name="itemId" value={r.itemId} />
                </td>
                <td>
                  <input className="field-input" type="number" step="any" min="0" value={r.qty} onChange={(e) => update(r.key, { qty: e.target.value })} />
                  <input type="hidden" name="itemQty" value={r.qty} />
                </td>
                <td>
                  <input className="field-input" type="number" step="any" value={r.rate} onChange={(e) => update(r.key, { rate: e.target.value })} data-testid="line-rate" />
                  <input type="hidden" name="itemRate" value={r.rate} />
                </td>
                {withTax && (
                  <td>
                    <input className="field-input" type="number" step="any" min="0" value={r.taxRate} onChange={(e) => update(r.key, { taxRate: e.target.value })} />
                    <input type="hidden" name="itemTax" value={r.taxRate} />
                  </td>
                )}
                <td className="text-right tabular-nums">{fmt((Number(r.qty) || 0) * (Number(r.rate) || 0))}</td>
                <td>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blank()]))}
                    aria-label="Remove line"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <button type="button" className="btn-secondary btn-sm" onClick={() => setRows((rs) => [...rs, blank()])}>
          + Add line
        </button>
        <dl className="min-w-60 space-y-1 text-sm">
          <div className="flex justify-between gap-6">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="tabular-nums">{fmt(totals.subtotal)}</dd>
          </div>
          {withTax && (
            <div className="flex justify-between gap-6">
              <dt className="text-slate-500">Tax</dt>
              <dd className="tabular-nums">{fmt(totals.tax)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-6 border-t border-slate-200 pt-1 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums" data-testid="line-total">{fmt(totals.subtotal + totals.tax)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
