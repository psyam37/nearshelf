import type { StockLevel } from "@/lib/types";
import { STOCK_LABELS } from "@/lib/stock";

interface StockBadgeProps {
  level: StockLevel;
}

const STYLES: Record<StockLevel, string> = {
  in_stock: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  low: "bg-amber-100 text-amber-800 ring-amber-600/20",
  out_of_stock: "bg-rose-100 text-rose-800 ring-rose-600/20",
};

export function StockBadge({ level }: StockBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[level]}`}
    >
      {STOCK_LABELS[level]}
    </span>
  );
}
