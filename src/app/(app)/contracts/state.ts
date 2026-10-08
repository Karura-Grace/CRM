import { daysBetween, today } from "@/lib/utils";

/** Active/expiring/expired is computed from the end date — there is no stored status to fall out of sync. */
export function contractState(dateEnd: string | null) {
  if (!dateEnd) return { label: "Active", cls: "bg-emerald-100 text-emerald-800" };
  const d = daysBetween(today(), dateEnd);
  if (d < 0) return { label: "Expired", cls: "bg-rose-100 text-rose-800" };
  if (d <= 30) return { label: `Expires in ${d}d`, cls: "bg-amber-100 text-amber-800" };
  return { label: "Active", cls: "bg-emerald-100 text-emerald-800" };
}
