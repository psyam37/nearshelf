"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { NearbyStockResponse } from "@/app/api/nearby/route";
import { LocationPicker } from "@/components/LocationPicker";
import { MedicineSearch } from "@/components/MedicineSearch";
import { NearbyResults } from "@/components/NearbyResults";
import { Card, EmptyState, ListSkeleton } from "@/components/ui";
import { useTableChanges } from "@/hooks/useTableChanges";
import type { NamedLocation } from "@/lib/geo";
import type { Medicine } from "@/lib/types";

// Load the map only in the browser (Leaflet needs `window`), and only once
// it's needed, so the page's first load stays small.
const StockMap = dynamic(() => import("@/components/StockMap"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-2xl bg-surface-2" />,
});

const RADIUS_OPTIONS_KM = [1, 2, 5, 10, 25] as const;

interface NearbySearchProps {
  /** The pharmacy the user works at, if any: lets them ask others to confirm stock. */
  myPharmacy: { id: string; name: string } | null;
}

export function NearbySearch({ myPharmacy }: NearbySearchProps) {
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [location, setLocation] = useState<NamedLocation | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [includeEquivalents, setIncludeEquivalents] = useState(false);
  // Bumped whenever the database says stock changed, to fetch again.
  const [refreshCount, setRefreshCount] = useState(0);
  const [result, setResult] = useState<{ forUrl: string; response: NearbyStockResponse } | null>(
    null,
  );

  // The request URL doubles as a "what are we searching for" key: if it
  // changes, the old results no longer match.
  const url =
    medicine && location
      ? `/api/nearby?${new URLSearchParams({
          medicineId: medicine.id,
          lat: String(location.lat),
          lng: String(location.lng),
          radiusM: String(radiusKm * 1000),
          includeEquivalents: String(includeEquivalents),
        })}`
      : null;

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((res) => res.json() as Promise<NearbyStockResponse>)
      .then((response) => setResult({ forUrl: url, response }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({ forUrl: url, response: { error: "Couldn't reach the server" } });
      });
    return () => controller.abort();
  }, [url, refreshCount]);

  const current = url !== null && result?.forUrl === url ? result.response : null;
  const loading = url !== null && current === null;

  // Listen for stock changes to the medicines on screen (with equivalents,
  // that can be several). While refetching, the old results stay visible.
  const medicineIds =
    current && "results" in current && current.results.length > 0
      ? [...new Set(current.results.map((row) => row.medicine_id))].sort()
      : medicine
        ? [medicine.id]
        : [];
  const liveFilter =
    url && medicineIds.length > 0 ? `medicine_id=in.(${medicineIds.join(",")})` : null;
  useTableChanges("stock_status", liveFilter, () => setRefreshCount((n) => n + 1));

  return (
    <div className="space-y-8">
      <Card className="space-y-6 p-5 sm:p-6">
        <MedicineSearch onSelect={setMedicine} />
        <LocationPicker value={location} onChange={setLocation} />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-5 text-sm">
          <label className="flex items-center gap-2 text-muted">
            Within
            <select
              value={radiusKm}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-medium text-ink"
            >
              {RADIUS_OPTIONS_KM.map((km) => (
                <option key={km} value={km}>
                  {km} km
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={includeEquivalents}
              onChange={(e) => setIncludeEquivalents(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-brand-700"
            />
            <span>Include other strengths and brands</span>
          </label>
        </div>
      </Card>

      {!url ? (
        <EmptyState icon={medicine ? "pin" : "search"}>
          {medicine
            ? "Now choose where to search: your location, a postcode or a demo area."
            : "Pick a medicine and a place to search. Results appear here, with a map."}
        </EmptyState>
      ) : loading ? (
        <ListSkeleton />
      ) : current && "error" in current ? (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {current.error}
        </p>
      ) : current && current.results.length === 0 ? (
        <EmptyState icon="pin">
          No pharmacies within {radiusKm} km have a record for this medicine. Try a bigger radius.
        </EmptyState>
      ) : current && location && medicine ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-semibold tracking-tight">
              {current.results.length} {current.results.length === 1 ? "pharmacy" : "pharmacies"}{" "}
              <span className="font-normal text-muted">near {location.label}</span>
            </h2>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
              Live
            </span>
          </div>
          <StockMap origin={location} results={current.results} />
          <NearbyResults
            results={current.results}
            medicineId={medicine.id}
            myPharmacy={myPharmacy}
          />
        </section>
      ) : null}
    </div>
  );
}
