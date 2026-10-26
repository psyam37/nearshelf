"use client";
// Runs in the browser: it reacts to typing and arrow keys.

import dynamic from "next/dynamic";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import type { BarcodeLookupResponse } from "@/app/api/barcodes/[gtin]/route";
import type { MedicineSearchResponse } from "@/app/api/medicines/route";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
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
      <label htmlFor={`${listId}-input`} className="block text-sm font-medium">
        Medicine
      </label>
      <div className="relative mt-1 flex gap-2">
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
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-900"
        />

        {showList && (
          <div className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {isBarcode ? (
              <p className="px-3 py-2.5 text-sm text-zinc-500">
                Press Enter to look up barcode {trimmed}
              </p>
            ) : loading ? (
              <p className="px-3 py-2.5 text-sm text-zinc-500">Searching…</p>
            ) : error ? (
              <p className="px-3 py-2.5 text-sm text-rose-600">{error}</p>
            ) : medicines.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-zinc-500">No medicines match “{trimmed}”</p>
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
                      index === activeIndex ? "bg-emerald-50 dark:bg-emerald-950" : ""
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium">{medicine.name}</span>
                      <span className="block text-xs text-zinc-500">
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
          className="shrink-0 rounded-lg border border-zinc-300 px-3 text-lg hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          ▥
        </button>
      </div>

      {barcodeMessage && (
        <p aria-live="polite" className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {barcodeMessage}
        </p>
      )}
      {scannerOpen && (
        <BarcodeScanner onDetected={lookUpBarcode} onClose={() => setScannerOpen(false)} />
      )}

      {selected && (
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Selected</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 font-medium">
            {selected.name}
            {selected.is_controlled && <ControlledTag />}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Equivalence group: {selected.equivalence_group}
          </p>
        </div>
      )}
    </div>
  );
}

function ControlledTag() {
  return (
    <span
      title="Controlled drug: extra legal rules apply to supply"
      className="inline-flex shrink-0 items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-violet-600/20 ring-inset"
    >
      Controlled drug
    </span>
  );
}
