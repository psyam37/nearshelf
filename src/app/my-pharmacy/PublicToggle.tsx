"use client";

import { useActionState } from "react";
import { Icon } from "@/components/ui";
import { setPublicListing, type ListingState } from "./actions";

interface PublicToggleProps {
  pharmacyId: string;
  medicineId: string;
  listed: boolean;
  controlled: boolean;
}

/** "Show publicly" switch for one medicine. Controlled drugs are locked off. */
export function PublicToggle({ pharmacyId, medicineId, listed, controlled }: PublicToggleProps) {
  const [state, formAction, pending] = useActionState<ListingState, FormData>(setPublicListing, {
    status: "idle",
  });

  if (controlled) {
    return (
      <span
        title="Controlled drugs are never shown to the public, for safety."
        className="inline-flex items-center gap-1 text-xs text-muted"
      >
        <Icon name="shield" className="h-3.5 w-3.5" />
        Not shown publicly
      </span>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="pharmacyId" value={pharmacyId} />
      <input type="hidden" name="medicineId" value={medicineId} />
      <input type="hidden" name="listed" value={String(!listed)} />
      <button
        type="submit"
        role="switch"
        aria-checked={listed}
        disabled={pending}
        className="group inline-flex items-center gap-2 text-xs font-medium disabled:opacity-60"
      >
        <span
          className={`relative h-5 w-9 rounded-full transition-colors ${
            listed ? "bg-brand-600" : "bg-silver-300 dark:bg-silver-700"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
              listed ? "left-[18px]" : "left-0.5"
            }`}
          />
        </span>
        <span className={listed ? "text-accent" : "text-muted"}>
          {listed ? "Shown to patients" : "Show to patients"}
        </span>
      </button>
      {state.status === "error" && <span className="text-xs text-rose-600">{state.message}</span>}
    </form>
  );
}
