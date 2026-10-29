"use client";

import { useActionState } from "react";
import { Card, Icon, button, input } from "@/components/ui";
import { importStockReport, type ImportState } from "./actions";

/** Upload a stock report exported from ProScript Connect, Titan or another PMR. */
export function StockImportCard({ pharmacyId }: { pharmacyId: string }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importStockReport, {
    status: "idle",
  });

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-brand-50 p-2 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <Icon name="scan" className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold">Import a stock report from your PMR</h3>
          <p className="mt-0.5 text-sm text-muted">
            Export a stock list as CSV from ProScript Connect, Titan or another PMR. We read the
            barcode or description and quantity columns and set your levels in one go.
          </p>
        </div>
      </div>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <input type="hidden" name="pharmacyId" value={pharmacyId} />
        <label className="text-sm font-semibold">
          CSV file
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-1.5 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:font-semibold file:text-ink"
          />
        </label>
        <label className="text-sm font-semibold">
          Low at or below
          <input
            name="lowAt"
            type="number"
            min={0}
            max={1000}
            defaultValue={3}
            className={`mt-1.5 w-28 ${input}`}
          />
        </label>
        <button type="submit" disabled={pending} className={button.primary}>
          {pending ? "Importing…" : "Import"}
        </button>
      </form>
      {state.status === "imported" && (
        <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950 dark:text-brand-100">
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="check" className="h-4 w-4" />
            Updated {state.updated} medicines from {state.total} rows.
          </p>
          {state.unmatched.length > 0 && (
            <p className="mt-1 text-xs">
              Not on NearShelf yet: {state.unmatched.join(", ")}
              {state.total - state.updated > state.unmatched.length ? "…" : ""}
            </p>
          )}
        </div>
      )}
      {state.status === "error" && (
        <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {state.message}
        </p>
      )}
    </Card>
  );
}
