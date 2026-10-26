"use client";
// Runs in the browser: it reacts to typing and arrow keys.

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import type { MedicineSearchResponse } from "@/app/api/medicines/route";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Medicine } from "@/lib/types";

const MIN_QUERY_LENGTH = 2; // matches medicineSearchSchema

// The last answer from the server, remembered with the query it was for.
// Comparing `forQuery` with what's in the box tells us if we're still loading.
interface SearchResult {
  forQuery: string;
  response: MedicineSearchResponse;
}

export function MedicineSearch({ onSelect }: { onSelect?: (medicine: Medicine) => void }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1); // highlighted row, -1 = none
  const [selected, setSelected] = useState<Medicine | null>(null);
  const [open, setOpen] = useState(false);

  const listId = useId();
  const trimmed = query.trim();
  const debouncedQuery = useDebouncedValue(trimmed, 250);
  // Once a medicine is picked the box holds its full name; no need to search for it.
  const canSearch = debouncedQuery.length >= MIN_QUERY_LENGTH && selected === null;

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
  const loading = trimmed.length >= MIN_QUERY_LENGTH && !isCurrent;
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

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); // stop the cursor jumping to the start/end
      if (medicines.length === 0) return;
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      // Wrap around: down from the last row goes to the first, and back.
      setActiveIndex((i) => (i + step + medicines.length) % medicines.length);
    } else if (event.key === "Enter") {
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
      <div className="relative mt-1">
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder="Start typing, e.g. amoxicillin"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-900"
        />

        {showList && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {loading ? (
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
      </div>

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
