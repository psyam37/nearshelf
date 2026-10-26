import { AskToConfirmButton } from "@/components/AskToConfirmButton";
import { StockBadge } from "@/components/StockBadge";
import { Icon } from "@/components/ui";
import { formatDistance, formatUpdatedAgo, isStale } from "@/lib/stock";
import type { NearbyStockResult } from "@/lib/types";

interface NearbyResultsProps {
  results: NearbyStockResult[];
  /** The medicine that was searched for, to flag rows that are an equivalent. */
  medicineId: string;
  /** The viewer's own pharmacy: they can ask the others to confirm. */
  myPharmacy: { id: string } | null;
}

export function NearbyResults({ results, medicineId, myPharmacy }: NearbyResultsProps) {
  const now = new Date(); // one "now" for the whole list, so every row agrees

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      {results.map((row) => {
        const stale = isStale(row.updated_at, now);
        const isMine = row.pharmacy_id === myPharmacy?.id;
        return (
          // A pharmacy can appear twice when equivalents are included
          // (e.g. 50mg and 100mg), so the key needs both ids.
          <li
            key={`${row.pharmacy_id}:${row.medicine_id}`}
            className={`p-4 sm:p-5 ${isMine ? "bg-brand-50/60 dark:bg-brand-950/40" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {row.pharmacy_name}
                  {isMine && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-200">
                      Your pharmacy
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {row.address_line}, {row.postcode}
                </p>
              </div>
              <StockBadge level={row.level} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 font-medium text-ink">
                <Icon name="pin" className="h-3.5 w-3.5 text-muted" />
                {formatDistance(row.distance_m)}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium ${
                  stale
                    ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-surface-2 text-muted"
                }`}
              >
                <Icon name="clock" className="h-3.5 w-3.5" />
                {stale ? "May be out of date · " : ""}updated{" "}
                {formatUpdatedAgo(row.updated_at, now)}
              </span>
              {row.medicine_id !== medicineId && (
                <span className="rounded-full bg-surface-2 px-2 py-1 font-medium text-ink">
                  Equivalent: {row.medicine_name}
                </span>
              )}
            </div>

            {(row.phone || (myPharmacy && !isMine)) && (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                {row.phone && (
                  <a
                    href={`tel:${row.phone.replace(/\s/g, "")}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                  >
                    <Icon name="phone" className="h-4 w-4" />
                    {row.phone}
                  </a>
                )}
                {myPharmacy && !isMine && (
                  <div className="ml-auto">
                    <AskToConfirmButton
                      toPharmacyId={row.pharmacy_id}
                      medicineId={row.medicine_id}
                    />
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
