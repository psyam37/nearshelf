"use client";

import { useActionState } from "react";
import { setClinicianSharing, type ListingState } from "./actions";

interface ClinicianSharingToggleProps {
  pharmacyId: string;
  shared: boolean;
}

/** "Show our stock to GP practices" switch for the whole pharmacy. */
export function ClinicianSharingToggle({ pharmacyId, shared }: ClinicianSharingToggleProps) {
  const [state, formAction, pending] = useActionState<ListingState, FormData>(setClinicianSharing, {
    status: "idle",
  });

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="pharmacyId" value={pharmacyId} />
      <input type="hidden" name="shared" value={String(!shared)} />
      <button
        type="submit"
        role="switch"
        aria-checked={shared}
        disabled={pending}
        className="inline-flex items-center gap-3 text-sm font-medium disabled:opacity-60"
      >
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            shared ? "bg-brand-600" : "bg-silver-300 dark:bg-silver-700"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              shared ? "left-[22px]" : "left-0.5"
            }`}
          />
        </span>
        <span className="text-left">
          {shared
            ? "Verified GP practice and locum pharmacists can see our stock levels"
            : "Our stock levels are hidden from GP practice and locum pharmacists"}
        </span>
      </button>
      {state.status === "error" && <span className="text-sm text-rose-600">{state.message}</span>}
    </form>
  );
}
