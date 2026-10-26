"use client";

import { useActionState } from "react";
import { sendStockRequest, type ActionState } from "@/app/requests/actions";
import { Icon, button } from "@/components/ui";

interface AskToConfirmButtonProps {
  toPharmacyId: string;
  medicineId: string;
}

export function AskToConfirmButton({ toPharmacyId, medicineId }: AskToConfirmButtonProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(sendStockRequest, {
    status: "idle",
  });

  if (state.status === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
        <Icon name="check" className="h-4 w-4" />
        Request sent
      </span>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="toPharmacyId" value={toPharmacyId} />
      <input type="hidden" name="medicineId" value={medicineId} />
      <button type="submit" disabled={pending} className={button.small}>
        <Icon name="message" className="h-3.5 w-3.5" />
        {pending ? "Sending…" : "Ask to confirm"}
      </button>
      {state.status === "error" && <span className="text-xs text-rose-600">{state.message}</span>}
    </form>
  );
}
