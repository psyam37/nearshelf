"use client";
// The patient-facing finder: no sign-in, nothing stored about the patient.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { PublicFindResponse, PublicStockResult } from "@/app/api/public/find/route";
import { LocationPicker } from "@/components/LocationPicker";
import { MedicineSearch } from "@/components/MedicineSearch";
import { StockBadge } from "@/components/StockBadge";
import { Card, EmptyState, Icon, ListSkeleton, button } from "@/components/ui";
import type { NamedLocation } from "@/lib/geo";
import { BROADCAST_RADIUS_MILES } from "@/lib/schemas";
import { formatMiles, formatUpdatedAgo } from "@/lib/stock";
import type { Medicine, NearbyStockResult } from "@/lib/types";

const StockMap = dynamic(() => import("@/components/StockMap"), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-2xl bg-surface-2" />,
});

export function PublicFinder() {
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [location, setLocation] = useState<NamedLocation | null>(null);
  const [radiusMiles, setRadiusMiles] = useState<number>(5);
  const [result, setResult] = useState<{ forUrl: string; response: PublicFindResponse } | null>(
    null,
  );

  // Controlled drugs are never searched publicly (the database refuses too).
  const url =
    medicine && location && !medicine.is_controlled
      ? `/api/public/find?${new URLSearchParams({
          medicineId: medicine.id,
          lat: String(location.lat),
          lng: String(location.lng),
          radiusMiles: String(radiusMiles),
        })}`
      : null;

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((res) => res.json() as Promise<PublicFindResponse>)
      .then((response) => setResult({ forUrl: url, response }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({ forUrl: url, response: { error: "Couldn't reach NearShelf. Try again." } });
      });
    return () => controller.abort();
  }, [url]);

  const current = url !== null && result?.forUrl === url ? result.response : null;

  return (
    <div className="space-y-8">
      <Card className="space-y-6 p-5 sm:p-6">
        <MedicineSearch onSelect={setMedicine} />
        <LocationPicker value={location} onChange={setLocation} />
        <fieldset className="border-t border-line pt-5">
          <legend className="sr-only">How far</legend>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Within</span>
            {BROADCAST_RADIUS_MILES.map((miles) => (
              <button
                key={miles}
                type="button"
                onClick={() => setRadiusMiles(miles)}
                aria-pressed={radiusMiles === miles}
                className={`rounded-xl border px-3 py-1.5 font-semibold transition-colors ${
                  radiusMiles === miles
                    ? "border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
                    : "border-line text-muted hover:bg-surface-2"
                }`}
              >
                {miles} miles
              </button>
            ))}
          </div>
        </fieldset>
      </Card>

      {medicine?.is_controlled ? (
        <EmptyState icon="shield">
          <strong className="text-ink">{medicine.name}</strong> is a controlled drug, so for safety
          we don&apos;t show where it&apos;s in stock. Your GP surgery or usual pharmacy can check
          availability for you.
        </EmptyState>
      ) : !url ? (
        <EmptyState icon="search">
          Choose your medicine and where you are. We&apos;ll show nearby pharmacies that report
          having it.
        </EmptyState>
      ) : current === null ? (
        <ListSkeleton rows={3} />
      ) : "error" in current ? (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {current.error}
        </p>
      ) : current.results.length === 0 ? (
        <EmptyState icon="pin">
          No pharmacy within {radiusMiles} miles has listed this as in stock recently. Try a bigger
          distance, or ask your usual pharmacy: they can check with others nearby.
        </EmptyState>
      ) : (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            {current.results.length}{" "}
            {current.results.length === 1 ? "pharmacy reports" : "pharmacies report"} having it
          </h2>
          {location && medicine && (
            <StockMap
              origin={location}
              results={current.results.map((r) => toMapRow(r, medicine))}
            />
          )}
          <ResultsList results={current.results} />
        </section>
      )}

      <PrescriptionGuide />
    </div>
  );
}

function ResultsList({ results }: { results: PublicStockResult[] }) {
  const now = new Date();
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      {results.map((r) => (
        <li key={r.pharmacy_id} className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{r.pharmacy_name}</p>
              <p className="mt-0.5 text-sm text-muted">
                {r.address_line}, {r.town} {r.postcode} · {formatMiles(r.distance_m)}
              </p>
              <p className="mt-1 text-xs text-muted">
                Reported {formatUpdatedAgo(r.confirmed_at, now)}
              </p>
            </div>
            <StockBadge level={r.level} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {r.phone && (
              <a href={`tel:${r.phone.replace(/\s/g, "")}`} className={button.primary}>
                <Icon name="phone" className="h-4 w-4" />
                Call {r.phone}
              </a>
            )}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
              target="_blank"
              rel="noreferrer"
              className={button.secondary}
            >
              <Icon name="pin" className="h-4 w-4" />
              Directions
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The map draws staff-search rows; public rows carry the same essentials. */
function toMapRow(r: PublicStockResult, medicine: Medicine): NearbyStockResult {
  return {
    pharmacy_id: r.pharmacy_id,
    pharmacy_name: r.pharmacy_name,
    address_line: r.address_line,
    town: r.town,
    postcode: r.postcode,
    phone: r.phone,
    lat: r.lat,
    lng: r.lng,
    distance_m: r.distance_m,
    medicine_id: medicine.id,
    medicine_name: r.medicine_name,
    level: r.level,
    updated_at: r.confirmed_at,
    verified: true,
  };
}

function PrescriptionGuide() {
  const steps = [
    {
      title: "Call the pharmacy first",
      body: "Stock changes quickly. Check they still have it, and how long they'll keep it.",
    },
    {
      title: "Get your prescription sent there",
      body: "If your prescription is with another pharmacy, ask them to release it so this one can download it. If it's not issued yet, ask your GP surgery to send it there. You can also change your nominated pharmacy in the NHS App.",
    },
    {
      title: "Collect it",
      body: "The pharmacy dispenses it as normal. A paper prescription? Just take it with you.",
    },
  ];

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold">How to get your prescription there</h2>
      <ol className="mt-4 space-y-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white dark:bg-brand-500">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold">{step.title}</p>
              <p className="text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
