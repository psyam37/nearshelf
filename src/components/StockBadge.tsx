import type { StockLevel } from "@/lib/types";
import { STOCK_LABELS } from "@/lib/stock";

interface StockBadgeProps {
  level: StockLevel;
  /**
   * false = not confirmed in the last 2 hours. "In stock" and "Low" then show
   * as "Unverified": an old "yes" isn't a promise. "Out of stock" stays as it
   * is, since an old "no" can't send anyone on a wasted trip.
   */
  verified?: boolean;
}

// Stock colours carry meaning (go / caution / stop), so they stay emerald,
// amber and rose rather than following the brand green.
const STYLES: Record<StockLevel | "unverified", { badge: string; dot: string }> = {
  in_stock: {
    badge:
      "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/25",
    dot: "bg-emerald-500",
  },
  low: {
    badge:
      "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/25",
    dot: "bg-amber-500",
  },
  out_of_stock: {
    badge:
      "bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-400/25",
    dot: "bg-rose-500",
  },
  unverified: {
    badge:
      "bg-silver-100 text-silver-700 ring-silver-400/40 dark:bg-silver-900 dark:text-silver-300",
    dot: "bg-silver-400",
  },
};

export function StockBadge({ level, verified = true }: StockBadgeProps) {
  const unverified = !verified && level !== "out_of_stock";
  const style = STYLES[unverified ? "unverified" : level];
  return (
    <span
      title={unverified ? `Last reported: ${STOCK_LABELS[level]}` : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.badge}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {unverified ? "Unverified" : STOCK_LABELS[level]}
    </span>
  );
}
