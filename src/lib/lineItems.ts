import { round2 } from "./utils";

export interface ParsedLine {
  itemId: number | null;
  description: string;
  qty: number;
  rate: number;
  taxRate: number;
  order: number;
}

/**
 * Reconstruct line items posted by <LineItemsEditor>. The editor posts parallel arrays
 * (itemDescription[], itemQty[], itemRate[], itemTax[], itemId[]) which we zip back together.
 */
export function parseLineItems(fd: FormData, withTax = true) {
  const desc = fd.getAll("itemDescription").map(String);
  const qty = fd.getAll("itemQty").map((v) => Number(v));
  const rate = fd.getAll("itemRate").map((v) => Number(v));
  const tax = fd.getAll("itemTax").map((v) => Number(v));
  const ids = fd.getAll("itemId").map((v) => Number.parseInt(String(v), 10));

  const lines: ParsedLine[] = [];
  desc.forEach((d, i) => {
    const description = d.trim();
    if (!description) return;
    const q = Number.isFinite(qty[i]) && qty[i] > 0 ? qty[i] : 1;
    const r = Number.isFinite(rate[i]) ? rate[i] : 0;
    const t = withTax && Number.isFinite(tax[i]) ? Math.max(0, tax[i]) : 0;
    lines.push({
      itemId: Number.isFinite(ids[i]) ? ids[i] : null,
      description,
      qty: q,
      rate: r,
      taxRate: t,
      order: lines.length,
    });
  });
  return { lines, ...computeTotals(lines) };
}

export function computeTotals(lines: Pick<ParsedLine, "qty" | "rate" | "taxRate">[]) {
  let subtotal = 0;
  let tax = 0;
  for (const l of lines) {
    const amount = l.qty * l.rate;
    subtotal += amount;
    tax += (amount * l.taxRate) / 100;
  }
  subtotal = round2(subtotal);
  tax = round2(tax);
  return { subtotal, tax, total: round2(subtotal + tax) };
}
