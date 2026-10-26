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
}

export function StockLevelForm({
  pharmacyId,
  medicineId,
  medicineName,
  current,
}: StockLevelFormProps) {
  const [state, formAction, pending] = useActionState<StockUpdateState, FormData>(
    updateStockLevel,
    { status: "idle" },
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="pharmacyId" value={pharmacyId} />
      <input type="hidden" name="medicineId" value={medicineId} />
      {/* Three submit buttons: the one clicked sends its name/value pair. */}
      <div
        role="group"
        aria-label={`Stock level for ${medicineName}`}
        className="inline-flex gap-1 rounded-xl border border-line bg-surface-2 p-1"
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
