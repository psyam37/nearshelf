"use client";

import { useActionState } from "react";
import { STOCK_LABELS } from "@/lib/stock";
import { STOCK_LEVELS, type StockLevel } from "@/lib/types";
import { updateStockLevel, type StockUpdateState } from "./actions";

const SELECTED_STYLES: Record<StockLevel, string> = {
  in_stock: "bg-emerald-600 text-white shadow-sm",
  low: "bg-amber-500 text-white shadow-sm",
  out_of_stock: "bg-rose-600 text-white shadow-sm",
};

interface StockLevelFormProps {
  pharmacyId: string;
  medicineId: string;
  medicineName: string;
  current: StockLevel | null; // null = never recorded
  /** Not confirmed in the last 2 hours: offer a one-tap "still the same". */
  unverified?: boolean;
}

export function StockLevelForm({
  pharmacyId,
  medicineId,
  medicineName,
  current,
  unverified = false,
}: StockLevelFormProps) {
  const [state, formAction, pending] = useActionState<StockUpdateState, FormData>(
    updateStockLevel,
    { status: "idle" },
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="pharmacyId" value={pharmacyId} />
      <input type="hidden" name="medicineId" value={medicineId} />
      {/* Re-sending the current level re-confirms it and resets its 2 hours. */}
      {unverified && current && current !== "out_of_stock" && (
        <button
          type="submit"
          name="level"
          value={current}
          disabled={pending}
          className="mb-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60 sm:w-auto dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          ✓ Still {STOCK_LABELS[current].toLowerCase()}
        </button>
      )}
      {/* Three submit buttons: the one clicked sends its name/value pair. */}
      <div
        role="group"
        aria-label={`Stock level for ${medicineName}`}
        className="flex w-fit gap-1 rounded-xl border border-line bg-surface-2 p-1"
      >
        {STOCK_LEVELS.map((level) => (
          <button
            key={level}
            type="submit"
            name="level"
            value={level}
            disabled={pending}
            aria-pressed={current === level}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-60 ${
              current === level
                ? SELECTED_STYLES[level]
                : "text-muted hover:bg-surface hover:text-ink"
            }`}
          >
            {STOCK_LABELS[level]}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-1 h-4 text-right text-xs">
        {pending ? (
          <span className="text-muted">Saving…</span>
        ) : state.status === "error" ? (
          <span className="text-rose-600">{state.message}</span>
        ) : state.status === "saved" ? (
          <span className="text-accent">Saved</span>
        ) : null}
      </p>
    </form>
  );
}
