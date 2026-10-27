"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { broadcastStockRequest, type BroadcastState } from "@/app/requests/actions";
import { Card, Icon, button, input } from "@/components/ui";
import { BROADCAST_RADIUS_MILES } from "@/lib/schemas";
import type { Medicine } from "@/lib/types";

interface BroadcastFormProps {
  medicine: Medicine;
  myPharmacyName: string;
}

/** A pill-style radio button: the real <input> is hidden, its label is styled. */
function Choice({
  name,
  value,
  defaultChecked,
  children,
}: {
  name: string;
  value: string | number;
  defaultChecked?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-muted transition-colors peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:text-brand-800 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 dark:peer-checked:bg-brand-950 dark:peer-checked:text-brand-200">
        {children}
      </span>
    </label>
  );
}

/** "Who nearby has this?" to every pharmacy within the radius, in one go. */
export function BroadcastForm({ medicine, myPharmacyName }: BroadcastFormProps) {
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
            . The first &ldquo;Confirm we have it&rdquo; holds the stock for 30 minutes.
          </p>
        </div>
      </Card>
    );
  }

  const details = [medicine.strength, medicine.form].filter(Boolean).join(" · ");

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-brand-50 p-2 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <Icon name="bolt" className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold">Ask every pharmacy nearby</h3>
          <p className="mt-0.5 text-sm text-muted">
            <strong className="text-ink">{medicine.name}</strong>
            {details && ` (${details})`}, sent from {myPharmacyName}. Nearby pharmacies tap
            &ldquo;Confirm we have it&rdquo; or &ldquo;Not available&rdquo;.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-5 space-y-5">
        <input type="hidden" name="medicineId" value={medicine.id} />

        <fieldset>
          <legend className="text-sm font-semibold">How far</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {BROADCAST_RADIUS_MILES.map((miles) => (
              <Choice key={miles} name="radiusMiles" value={miles} defaultChecked={miles === 5}>
                {miles} miles
              </Choice>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">How urgent</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Choice name="urgency" value="urgent">
              <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
              Patient waiting
            </Choice>
            <Choice name="urgency" value="routine" defaultChecked>
              Not urgent
            </Choice>
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
        </div>
      </form>

      {state.status === "error" && <p className="mt-3 text-sm text-rose-600">{state.message}</p>}
      <p className="mt-4 text-xs text-muted">
        Stock details only. Never include patient information.
      </p>
    </Card>
  );
}
