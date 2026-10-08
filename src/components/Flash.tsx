"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Reads ?success= / ?error= from the URL, shows a banner, then strips the query string. */
export default function Flash() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const success = params.get("success");
  const error = params.get("error");
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!success && !error) return;
    setMsg(error ? { kind: "error", text: error } : { kind: "success", text: success! });
    const rest = new URLSearchParams(params.toString());
    rest.delete("success");
    rest.delete("error");
    const qs = rest.toString();
    const t = setTimeout(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }), 400);
    return () => clearTimeout(t);
  }, [success, error, params, pathname, router]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  if (!msg) return null;
  const cls =
    msg.kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";
  return (
    <div role="status" data-flash={msg.kind} className={`no-print mb-4 flex items-start justify-between gap-4 rounded-md border px-4 py-3 text-sm ${cls}`}>
      <span>{msg.text}</span>
      <button type="button" onClick={() => setMsg(null)} className="text-current opacity-60 hover:opacity-100" aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
