"use client";

import { useState, type FormEvent } from "react";
import { Icon, button } from "@/components/ui";
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
      <p className="text-sm font-semibold">Near</p>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() =>
            run("gps", async () => ({ label: "Your location", ...(await getBrowserLocation()) }))
          }
          disabled={busy !== null}
          className={button.secondary}
        >
          <Icon name="pin" className="h-4 w-4 text-accent" />
          {busy === "gps" ? "Finding you…" : "Use my location"}
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
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base uppercase placeholder:normal-case focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy !== null || !postcode.trim()}
            className={button.primary}
          >
            {busy === "postcode" ? "…" : "Go"}
          </button>
        </form>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        Demo areas:
        {DEMO_LOCATIONS.map((demo) => (
          <button
            key={demo.label}
            type="button"
            onClick={() => {
              setError(null);
              onChange(demo);
            }}
            className="rounded-full border border-line bg-surface px-2.5 py-1 font-medium text-ink transition-colors hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950"
          >
            {demo.label}
          </button>
        ))}
      </p>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {value && !error && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800 dark:bg-brand-950 dark:text-brand-200">
          <Icon name="pin" className="h-3.5 w-3.5" />
          Searching near <span className="font-semibold">{value.label}</span>
        </p>
      )}
    </div>
  );
}
