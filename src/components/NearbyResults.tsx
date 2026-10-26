import { StockBadge } from "@/components/StockBadge";
import { formatDistance, formatUpdatedAgo, isStale } from "@/lib/stock";
import type { NearbyStockResult } from "@/lib/types";

interface NearbyResultsProps {
  results: NearbyStockResult[];
  /** The medicine that was searched for, to flag rows that are an equivalent. */
  medicineId: string;
}

export function NearbyResults({ results, medicineId }: NearbyResultsProps) {
  const now = new Date(); // one "now" for the whole list, so every row agrees

  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {results.map((row) => {
        const stale = isStale(row.updated_at, now);
        return (
          // A pharmacy can appear twice when equivalents are included
          // (e.g. 50mg and 100mg), so the key needs both ids.
          <li key={`${row.pharmacy_id}:${row.medicine_id}`} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{row.pharmacy_name}</p>
                <p className="text-sm text-zinc-500">
                  {row.address_line}, {row.postcode} · {formatDistance(row.distance_m)}
                </p>
              </div>
              <StockBadge level={row.level} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              {row.medicine_id !== medicineId && (
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Equivalent: {row.medicine_name}
                </span>
              )}
              <span className={stale ? "text-amber-700 dark:text-amber-500" : undefined}>
                {stale ? "⚠ Possibly out of date · " : ""}updated{" "}
                {formatUpdatedAgo(row.updated_at, now)}
              </span>
              {row.phone && (
                <a href={`tel:${row.phone.replace(/\s/g, "")}`} className="underline">
                  {row.phone}
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
