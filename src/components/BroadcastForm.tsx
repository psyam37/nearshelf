"use client";

import Link from "next/link";
import { useActionState } from "react";
import { broadcastStockRequest, type BroadcastState } from "@/app/requests/actions";
import { Card, Icon, button, input } from "@/components/ui";
import type { Medicine } from "@/lib/types";

interface BroadcastFormProps {
  medicine: Medicine;
  radiusKm: number;
  myPharmacyName: string;
}

/** "Who nearby has this?" to every pharmacy within the radius, in one go. */
export function BroadcastForm({ medicine, radiusKm, myPharmacyName }: BroadcastFormProps) {
  const [state, formAction, pending] = useActionState<BroadcastState, FormData>(
    broadcastStockRequest,
    { status: "idle" },
  );

  if (state.status === "broadcast") {
    return (
      <Card className="flex items-start gap-3 border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-brand-950">
        <span className="rounded-full bg-brand-700 p-1.5 text-white dark:bg-brand-500">
          <Icon name="check" className="h-4 w-4" />
        </span>
        <div>
          <p className="font-semibold">
            Sent to {state.recipients} {state.recipients === 1 ? "pharmacy" : "pharmacies"}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Answers appear live in{" "}
            <Link href="/requests" className="font-medium text-accent underline">
              Requests
            </Link>
            . The first &ldquo;Available&rdquo; holds the stock for 30 minutes.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-brand-50 p-2 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <Icon name="bolt" className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold">Ask every pharmacy nearby</h3>
          <p className="mt-0.5 text-sm text-muted">
            Sends a request for <strong className="text-ink">{medicine.name}</strong> to all
            pharmacies within {radiusKm} km of {myPharmacyName}. They tap Available or Not
            available.
          </p>
        </div>
      </div>

      <form
        action={formAction}
        className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <input type="hidden" name="medicineId" value={medicine.id} />
        <input type="hidden" name="radiusM" value={radiusKm * 1000} />
        <label className="text-sm font-semibold">
          Pack size <span className="font-normal text-muted">(optional)</span>
          <input
            name="packSize"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            placeholder="e.g. 28"
            className={`mt-1.5 ${input}`}
          />
        </label>
        <label className="text-sm font-semibold">
          Packs needed
          <input
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            defaultValue={1}
            required
            className={`mt-1.5 ${input}`}
          />
        </label>
        <button type="submit" disabled={pending} className={`${button.primary} py-3`}>
          {pending ? "Sending…" : "Send request"}
        </button>
      </form>

      {state.status === "error" && <p className="mt-3 text-sm text-rose-600">{state.message}</p>}
      <p className="mt-4 text-xs text-muted">
        Stock details only. Never include patient information.
      </p>
    </Card>
  );
}
