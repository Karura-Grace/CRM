/** Small server-safe presentational helpers shared across modules. */
import Link from "next/link";
import type { ReactNode } from "react";
import { badgeClass, humanize } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="no-print mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>{title}</h1>
          {subtitle && <div className="muted mt-1">{subtitle}</div>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Badge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge ${badgeClass(status)}`}>{label ?? humanize(status)}</span>;
}

export function ColorBadge({ color, label }: { color?: string | null; label?: string | null }) {
  if (!label) return <span className="muted">—</span>;
  const c = color || "#64748b";
  return (
    <span className="badge" style={{ backgroundColor: `${c}22`, color: c, border: `1px solid ${c}55` }}>
      {label}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</div>;
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function DL({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{k}</dt>
          <dd className="mt-0.5 text-slate-800">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="card overflow-x-auto p-0">{children}</div>;
}
