import { db } from "@/db";
import { currencies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { addInterval, money, round2, today } from "@/lib/utils";
import type { Params } from "./types";

export async function defaultSymbol() {
  const c = await db.query.currencies.findFirst({ where: eq(currencies.isDefault, true) });
  return c?.symbol ?? "KES";
}

/** Resolve the date range from params, falling back to the report's default. */
export function range(p: Params, def: "12m" | "ytd" | "90d" | "30d" = "12m") {
  const t = today();
  let from = p.from || "";
  const to = p.to || t;
  if (!from) {
    if (def === "ytd") from = `${t.slice(0, 4)}-01-01`;
    else if (def === "90d") from = addInterval(t, "day", -89);
    else if (def === "30d") from = addInterval(t, "day", -29);
    else from = `${addInterval(t, "month", -11).slice(0, 7)}-01`;
  }
  return { from, to };
}
export const inRange = (d: string | null | undefined, r: { from: string; to: string }) => !!d && d.slice(0, 10) >= r.from && d.slice(0, 10) <= r.to;

/** Month keys (YYYY-MM) covering a range, for monthly charts. */
export function monthsIn(r: { from: string; to: string }) {
  const out: string[] = [];
  let m = `${r.from.slice(0, 7)}-01`;
  while (m.slice(0, 7) <= r.to.slice(0, 7) && out.length < 60) { out.push(m.slice(0, 7)); m = addInterval(m, "month", 1); }
  return out;
}
export const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
export const sum = <T,>(xs: T[], f: (x: T) => number) => round2(xs.reduce((a, x) => a + (Number(f(x)) || 0), 0));
export const pct = (a: number, b: number) => (b ? round2((a / b) * 100) : 0);
export const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);
export const rangeLabel = (r: { from: string; to: string }) => `${r.from} to ${r.to}`;
export { money, round2, today };

/** Mixed-currency note: totals simply add amounts, so flag it when more than one currency is in play. */
export function currencyNote(ids: (number | null | undefined)[]) {
  const set = new Set(ids.filter((x) => x != null));
  return set.size > 1 ? ["Amounts in different currencies are added together as entered; filter by customer for single-currency totals."] : [];
}
