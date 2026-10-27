"use client";

import { useActionState } from "react";
import { button } from "@/components/ui";
import { reconfirmAllStock, type StockUpdateState } from "./actions";

/** One tap for the daily shelf check: "everything in stock is still in stock". */
export function ReconfirmAllButton({ pharmacyId, count }: { pharmacyId: string; count: number }) {
  const [state, formAction, pending] = useActionState<StockUpdateState, FormData>(
    reconfirmAllStock,
    { status: "idle" },
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-1 sm:items-end">
      <input type="hidden" name="pharmacyId" value={pharmacyId} />
      <button type="submit" disabled={pending} className={button.primary}>
        {pending ? "Confirming…" : `✓ Confirm ${count} still correct`}
      </button>
      <p aria-live="polite" className="text-xs">
        {state.status === "reconfirmed" ? (
          <span className="text-accent">Confirmed {state.count} medicines</span>
        ) : state.status === "error" ? (
          <span className="text-rose-600">{state.message}</span>
        ) : (
          <span className="text-muted">Re-confirms every in-stock and low medicine</span>
        )}
      </p>
    </form>
  );
}
