"use client";

import { useActionState } from "react";
import { sendStockRequest, type ActionState } from "@/app/requests/actions";

interface AskToConfirmButtonProps {
  toPharmacyId: string;
  medicineId: string;
}

export function AskToConfirmButton({ toPharmacyId, medicineId }: AskToConfirmButtonProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(sendStockRequest, {
    status: "idle",
  });

  if (state.status === "done") {
    return <span className="text-xs font-medium text-emerald-700">✓ Request sent</span>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="toPharmacyId" value={toPharmacyId} />
      <input type="hidden" name="medicineId" value={medicineId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {pending ? "Sending…" : "Ask to confirm"}
      </button>
      {state.status === "error" && <span className="text-xs text-rose-600">{state.message}</span>}
    </form>
  );
}
