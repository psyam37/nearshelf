"use client";
// Runs in the browser: it reacts to typing and arrow keys.

import dynamic from "next/dynamic";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import type { BarcodeLookupResponse } from "@/app/api/barcodes/[gtin]/route";
import type { MedicineSearchResponse } from "@/app/api/medicines/route";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Icon, button } from "@/components/ui";
import { GTIN_PATTERN } from "@/lib/gtin";
import type { Medicine } from "@/lib/types";

const MIN_QUERY_LENGTH = 2; // matches medicineSearchSchema

// The camera scanner (and its barcode library) only loads when opened.
const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), { ssr: false });

// The last answer from the server, remembered with the query it was for.
// Comparing `forQuery` with what's in the box tells us if we're still loading.
interface SearchResult {
  forQuery: string;
  response: MedicineSearchResponse;
}

interface MedicineSearchProps {
  /** Called with the picked medicine, or null when the user starts typing again. */
  onSelect?: (medicine: Medicine | null) => void;
}

export function MedicineSearch({ onSelect }: MedicineSearchProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1); // highlighted row, -1 = none
  const [selected, setSelected] = useState<Medicine | null>(null);
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeMessage, setBarcodeMessage] = useState<string | null>(null);

  const listId = useId();
  const trimmed = query.trim();
  // All digits = a barcode number (typed, or "typed" by a USB scanner).
  const isBarcode = GTIN_PATTERN.test(trimmed);
  const debouncedQuery = useDebouncedValue(trimmed, 250);
  // Once a medicine is picked the box holds its full name; no need to search for it.
  const canSearch =
    debouncedQuery.length >= MIN_QUERY_LENGTH && selected === null && !/^\d+$/.test(debouncedQuery);

  // Fetch whenever the debounced query changes.
  useEffect(() => {
    if (!canSearch) return;

    // If the query changes again before this request finishes, cancel it,
    // so an old, slow answer can never overwrite a newer one.
    const controller = new AbortController();
    const params = new URLSearchParams({ q: debouncedQuery, limit: "10" });

    fetch(`/api/medicines?${params}`, { signal: controller.signal })
      .then((res) => res.json() as Promise<MedicineSearchResponse>)
      .then((response) => setResult({ forQuery: debouncedQuery, response }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({ forQuery: debouncedQuery, response: { error: "Couldn't reach the server" } });
      });

    return () => controller.abort();
  }, [debouncedQuery, canSearch]);

  // Work out what to show from the state above, rather than storing it too.
  const isCurrent = result?.forQuery === trimmed;
  const loading = trimmed.length >= MIN_QUERY_LENGTH && !isCurrent && !isBarcode;
  // `"medicines" in result.response` narrows the union type: inside this
  // branch TypeScript knows response is the { medicines } variant.
  const medicines: Medicine[] =
    isCurrent && "medicines" in result.response ? result.response.medicines : [];
  const error = isCurrent && "error" in result.response ? result.response.error : null;
  const showList = open && trimmed.length >= MIN_QUERY_LENGTH && selected === null;

  function choose(medicine: Medicine) {
    setSelected(medicine);
    setQuery(medicine.name);
    setOpen(false);
    setActiveIndex(-1);
    onSelect?.(medicine);
  }

  async function lookUpBarcode(gtin: string) {
    setScannerOpen(false);
    setQuery(gtin);
    setOpen(false);
    setBarcodeMessage("Looking up barcode…");
    try {
      const res = await fetch(`/api/barcodes/${gtin}`);
      const data = (await res.json()) as BarcodeLookupResponse;
      if ("medicine" in data) {
        setBarcodeMessage(null);
        choose(data.medicine);
      } else {
        setBarcodeMessage(data.error);
      }
    } catch {
      setBarcodeMessage("Couldn't reach the server");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); // stop the cursor jumping to the start/end
      if (medicines.length === 0) return;
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      // Wrap around: down from the last row goes to the first, and back.
      setActiveIndex((i) => (i + step + medicines.length) % medicines.length);
    } else if (event.key === "Enter") {
      if (isBarcode && selected === null) {
        event.preventDefault();
        void lookUpBarcode(trimmed);
        return;
      }
      const medicine = medicines[activeIndex];
      if (showList && medicine) {
        event.preventDefault();
        choose(medicine);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="w-full">
      <label htmlFor={`${listId}-input`} className="block text-sm font-semibold">
        Medicine
      </label>
      <div className="relative mt-1.5 flex gap-2">
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-muted"
        />
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder="Type a name, e.g. amoxicillin, or scan"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setBarcodeMessage(null);
            if (selected) onSelect?.(null);
            setSelected(null);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface py-2.5 pr-3.5 pl-10 text-base shadow-sm outline-none placeholder:text-muted/70 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
        />

        {showList && (
          <div className="absolute top-full z-10 mt-2 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-xl shadow-brand-950/10">
            {isBarcode ? (
              <p className="px-3 py-2.5 text-sm text-muted">
                Press Enter to look up barcode {trimmed}
              </p>
            ) : loading ? (
              <p className="px-3 py-2.5 text-sm text-muted">Searching…</p>
            ) : error ? (
              <p className="px-3 py-2.5 text-sm text-rose-600">{error}</p>
            ) : medicines.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted">No medicines match “{trimmed}”</p>
            ) : (
              <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto py-1">
                {medicines.map((medicine, index) => (
                  <li
                    key={medicine.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    // onMouseDown (not onClick) fires before the input's
                    // onBlur closes the list.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(medicine);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${
                      index === activeIndex ? "bg-brand-50 dark:bg-brand-950" : ""
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium">{medicine.name}</span>
                      <span className="block text-xs text-muted">
                        {medicine.equivalence_group}
                        {medicine.form ? ` · ${medicine.form}` : ""}
                      </span>
                    </span>
                    {medicine.is_controlled && <ControlledTag />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          aria-label="Scan a barcode with the camera"
          title="Scan a barcode"
          className={`${button.secondary} shrink-0 px-3`}
        >
          <Icon name="scan" className="h-5 w-5 text-accent" />
          <span className="hidden sm:inline">Scan</span>
        </button>
      </div>

      {barcodeMessage && (
        <p aria-live="polite" className="mt-2 text-sm text-muted">
          {barcodeMessage}
        </p>
      )}
      {scannerOpen && (
        <BarcodeScanner onDetected={lookUpBarcode} onClose={() => setScannerOpen(false)} />
      )}

      {selected && (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-950">
          <span className="mt-0.5 rounded-full bg-brand-700 p-1 text-white dark:bg-brand-500">
            <Icon name="check" className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {selected.name}
              {selected.is_controlled && <ControlledTag />}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {[selected.form, selected.strength].filter(Boolean).join(" · ")}
              {" · "}group: {selected.equivalence_group}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlledTag() {
  return (
    <span
      title="Controlled drug: extra legal rules apply to supply"
      className="inline-flex shrink-0 items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800 ring-1 ring-violet-600/20 ring-inset dark:bg-violet-950 dark:text-violet-300"
    >
      Controlled drug
    </span>
  );
}
