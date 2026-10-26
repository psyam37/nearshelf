"use client";

import { useState, type FormEvent } from "react";
import { DEMO_LOCATIONS, getBrowserLocation, lookupPostcode, type NamedLocation } from "@/lib/geo";

interface LocationPickerProps {
  value: NamedLocation | null;
  onChange: (location: NamedLocation) => void;
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [postcode, setPostcode] = useState("");
  const [busy, setBusy] = useState<"gps" | "postcode" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Runs one of the lookups, handling the busy and error state the same way
  // for both. `lookup` is any function that eventually gives a NamedLocation.
  async function run(kind: "gps" | "postcode", lookup: () => Promise<NamedLocation>) {
    setBusy(kind);
    setError(null);
    try {
      onChange(await lookup());
    } catch (err) {
      // `err` is `unknown`: anything can be thrown in JavaScript, so check first.
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  function handlePostcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser reloading the page
    if (postcode.trim()) void run("postcode", () => lookupPostcode(postcode));
  }

  return (
    <div>
      <p className="text-sm font-medium">Near</p>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() =>
            run("gps", async () => ({ label: "Your location", ...(await getBrowserLocation()) }))
          }
          disabled={busy !== null}
          className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {busy === "gps" ? "Finding you…" : "📍 Use my location"}
        </button>
        <form onSubmit={handlePostcode} className="flex flex-1 gap-2">
          <label htmlFor="postcode" className="sr-only">
            Postcode
          </label>
          <input
            id="postcode"
            value={postcode}
            onChange={(event) => setPostcode(event.target.value)}
            placeholder="or a postcode, e.g. N1 6AA"
            autoComplete="postal-code"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base uppercase placeholder:normal-case focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={busy !== null || !postcode.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy === "postcode" ? "…" : "Go"}
          </button>
        </form>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        Demo areas:
        {DEMO_LOCATIONS.map((demo) => (
          <button
            key={demo.label}
            type="button"
            onClick={() => {
              setError(null);
              onChange(demo);
            }}
            className="rounded-full border border-zinc-300 px-2.5 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {demo.label}
          </button>
        ))}
      </p>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {value && !error && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Searching near <span className="font-medium">{value.label}</span>
        </p>
      )}
    </div>
  );
}
