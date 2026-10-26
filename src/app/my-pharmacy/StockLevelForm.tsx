"use client";

import { useActionState } from "react";
import { STOCK_LABELS } from "@/lib/stock";
import { STOCK_LEVELS, type StockLevel } from "@/lib/types";
import { updateStockLevel, type StockUpdateState } from "./actions";

const SELECTED_STYLES: Record<StockLevel, string> = {
  in_stock: "bg-emerald-700 text-white border-emerald-700",
  low: "bg-amber-500 text-white border-amber-500",
  out_of_stock: "bg-rose-600 text-white border-rose-600",
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
        className="inline-flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700"
      >
        {STOCK_LEVELS.map((level) => (
          <button
            key={level}
            type="submit"
            name="level"
            value={level}
            disabled={pending}
            aria-pressed={current === level}
            className={`border-l border-zinc-300 px-2.5 py-1.5 text-xs font-medium first:border-l-0 disabled:opacity-60 dark:border-zinc-700 ${
              current === level
                ? SELECTED_STYLES[level]
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {STOCK_LABELS[level]}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-1 h-4 text-xs">
        {pending ? (
          <span className="text-zinc-500">Saving…</span>
        ) : state.status === "error" ? (
          <span className="text-rose-600">{state.message}</span>
        ) : state.status === "saved" ? (
          <span className="text-emerald-700">Saved</span>
        ) : null}
      </p>
    </form>
  );
}
