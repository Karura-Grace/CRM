/** "Export: Excel · Word · CSV" links for any report key, carrying the current filters. */
export default function ExportButtons({ report, params = {}, compact = false }: { report: string; params?: Record<string, string | number | undefined | null>; compact?: boolean }) {
  const qs = (format: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
    p.set("format", format);
    return `/api/export/${report}?${p}`;
  };
  const cls = compact ? "btn-secondary btn-sm" : "btn-secondary";
  return (
    <span className="no-print inline-flex flex-wrap items-center gap-1.5" data-testid={`export-${report}`}>
      {!compact && <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Export</span>}
      <a href={qs("xlsx")} className={cls} download>Excel</a>
      <a href={qs("docx")} className={cls} download>Word</a>
      <a href={qs("csv")} className={cls} download>CSV</a>
    </span>
  );
}
