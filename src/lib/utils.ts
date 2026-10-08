/** Shared helpers: money/date formatting, badges, numbering, date-interval math, form parsing. */

export function money(n: number | null | undefined, symbol = "KES"): string {
  const v = Number(n ?? 0);
  return `${symbol} ${v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Business timezone for "today" (dates are stored as YYYY-MM-DD). Override with APP_TIMEZONE. */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Africa/Nairobi";

export function today(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d.length === 10 ? `${d}T00:00:00` : d.replace(" ", "T"));
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d.includes("T") ? d : `${d.replace(" ", "T")}Z`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: APP_TIMEZONE });
}

export type Interval = "day" | "week" | "month" | "year";

/** Add `every` × `type` to an ISO date (YYYY-MM-DD). Month/year math clamps to month end. */
export function addInterval(date: string, type: Interval, every: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  switch (type) {
    case "day":
      d.setUTCDate(d.getUTCDate() + every);
      break;
    case "week":
      d.setUTCDate(d.getUTCDate() + 7 * every);
      break;
    case "month":
    case "year": {
      const months = type === "month" ? every : every * 12;
      const day = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + months);
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(day, last));
      break;
    }
  }
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}

/** e.g. formatNumber("INV", 7) → "INV-000007" */
export function formatNumber(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(6, "0")}`;
}

/** Tailwind classes for status pills. */
const BADGES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-sky-100 text-sky-800",
  open: "bg-sky-100 text-sky-800",
  revised: "bg-indigo-100 text-indigo-800",
  accepted: "bg-emerald-100 text-emerald-800",
  declined: "bg-rose-100 text-rose-800",
  expired: "bg-amber-100 text-amber-800",
  unpaid: "bg-rose-100 text-rose-800",
  partial: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-200 text-red-900",
  cancelled: "bg-slate-200 text-slate-600",
  not_started: "bg-slate-100 text-slate-700",
  in_progress: "bg-sky-100 text-sky-800",
  on_hold: "bg-amber-100 text-amber-800",
  finished: "bg-emerald-100 text-emerald-800",
  testing: "bg-violet-100 text-violet-800",
  awaiting_feedback: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700",
  medium: "bg-sky-100 text-sky-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-rose-100 text-rose-800",
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-slate-200 text-slate-600",
  admin: "bg-brand-100 text-brand-800",
  staff: "bg-slate-100 text-slate-700",
  lost: "bg-rose-100 text-rose-800",
  junk: "bg-slate-200 text-slate-600",
  converted: "bg-emerald-100 text-emerald-800",
};

export function badgeClass(status: string): string {
  return BADGES[status] ?? "bg-slate-100 text-slate-700";
}

const LABELS: Record<string, string> = { mpesa: "M-Pesa", bank_transfer: "Bank transfer" };

export function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  if (LABELS[s]) return LABELS[s];
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
}

/* ── FormData helpers ── */

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
export function num(fd: FormData, key: string, fallback = 0): number {
  const v = Number(str(fd, key));
  return Number.isFinite(v) ? v : fallback;
}
export function optInt(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "1" || v === "true";
}
export function ints(fd: FormData, key: string): number[] {
  return fd
    .getAll(key)
    .map((v) => Number.parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n));
}

/** Build a redirect URL carrying a flash message. */
export function flash(path: string, kind: "success" | "error", message: string): string {
  // Keep any #fragment at the end, otherwise the query string would be swallowed by it.
  const [base, hash] = path.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${kind}=${encodeURIComponent(message)}${hash ? `#${hash}` : ""}`;
}
