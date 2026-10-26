"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { NearbyStockResponse } from "@/app/api/nearby/route";
import { LocationPicker } from "@/components/LocationPicker";
import { MedicineSearch } from "@/components/MedicineSearch";
import { NearbyResults } from "@/components/NearbyResults";
import type { NamedLocation } from "@/lib/geo";
import type { Medicine } from "@/lib/types";

// Load the map only in the browser (Leaflet needs `window`), and only once
// it's needed, so the page's first load stays small.
const StockMap = dynamic(() => import("@/components/StockMap"), {
  ssr: false,
  loading: () => (
    <div className="h-80 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
  ),
});

const RADIUS_OPTIONS_KM = [1, 2, 5, 10, 25] as const;

export function NearbySearch() {
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [location, setLocation] = useState<NamedLocation | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  // TODO (your turn): make this a checkbox the user can tick. See the chat.
  const includeEquivalents = false;
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
  }, [url]);

  const current = url !== null && result?.forUrl === url ? result.response : null;
  const loading = url !== null && current === null;

  return (
    <div className="space-y-6">
      <MedicineSearch onSelect={setMedicine} />
      <LocationPicker value={location} onChange={setLocation} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <label className="flex items-center gap-2">
          Within
          <select
            value={radiusKm}
            onChange={(event) => setRadiusKm(Number(event.target.value))}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {RADIUS_OPTIONS_KM.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </label>
      </div>

      {!url ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {medicine ? "Now choose where to search." : "Pick a medicine and a place to search."}
        </p>
      ) : loading ? (
        <p className="text-sm text-zinc-500">Finding pharmacies…</p>
      ) : current && "error" in current ? (
        <p className="text-sm text-rose-600">{current.error}</p>
      ) : current && current.results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No pharmacies within {radiusKm} km have a record for this medicine. Try a bigger radius.
        </p>
      ) : current && location && medicine ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            {current.results.length} {current.results.length === 1 ? "result" : "results"}
          </h2>
          <StockMap origin={location} results={current.results} />
          <NearbyResults results={current.results} medicineId={medicine.id} />
        </section>
      ) : null}
    </div>
  );
}
