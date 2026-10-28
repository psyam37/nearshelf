"use client";

import { useActionState } from "react";
import { Card, Icon, button, input } from "@/components/ui";
import {
  addPharmacy,
  findPharmacyByOds,
  refreshDemo,
  syncNhsData,
  type AdminState,
} from "./actions";

const idle: AdminState = { status: "idle" };

function Message({ state }: { state: AdminState }) {
  if (state.status === "done") {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950 dark:text-brand-100">
        <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
        {state.message}
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
        {state.message}
      </p>
    );
  }
  return null;
}

/** One click before a pitch. */
export function RefreshDemoCard() {
  const [state, action, pending] = useActionState(refreshDemo, idle);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-md">
          <h3 className="font-semibold">Get the demo ready</h3>
          <p className="mt-1 text-sm text-muted">
            Demo pharmacies get freshly checked stock, their medicines are listed for patients, and
            old demo requests are cleared. Real pharmacies aren&apos;t touched. Lasts 2 hours.
          </p>
        </div>
        <form action={action}>
          <button type="submit" disabled={pending} className={button.primary}>
            <Icon name="bolt" className="h-4 w-4" />
            {pending ? "Refreshing…" : "Refresh demo"}
          </button>
        </form>
      </div>
      <Message state={state} />
    </Card>
  );
}

/** Loads the NHS dispensing data behind the Insights page. */
export function SyncNhsDataCard() {
  const [state, action, pending] = useActionState(syncNhsData, idle);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-md">
          <h3 className="font-semibold">NHS data for Insights</h3>
          <p className="mt-1 text-sm text-muted">
            Loads monthly dispensing figures for every catalogue medicine and area from NHSBSA open
            data. A few minutes the first time; after that, press it when a new month is out.
          </p>
        </div>
        <form action={action}>
          <button type="submit" disabled={pending} className={button.secondary}>
            <Icon name="download" className="h-4 w-4" />
            {pending ? "Loading NHS data…" : "Refresh NHS data"}
          </button>
        </form>
      </div>
      <Message state={state} />
    </Card>
  );
}

/** Find a real pharmacy by ODS code, check it, then add it. */
export function AddPharmacyCard() {
  const [found, lookup, looking] = useActionState(findPharmacyByOds, idle);
  const [added, add, adding] = useActionState(addPharmacy, idle);

  return (
    <Card className="p-5">
      <h3 className="font-semibold">Add a real pharmacy</h3>
      <p className="mt-1 text-sm text-muted">
        Type its NHS ODS code (e.g. FA076). We fetch the name and address from the NHS directory,
        and put it on the map.
      </p>
      <form action={lookup} className="mt-4 flex gap-2">
        <input
          name="odsCode"
          required
          placeholder="ODS code, e.g. FA076"
          autoComplete="off"
          className={`${input} uppercase placeholder:normal-case`}
        />
        <button type="submit" disabled={looking} className={button.secondary}>
          {looking ? "Looking up…" : "Look up"}
        </button>
      </form>
      {found.status !== "found" && <Message state={found} />}

      {found.status === "found" && added.status !== "done" && (
        <form action={add} className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
          <input type="hidden" name="odsCode" value={found.odsCode} />
          <p className="font-semibold">{found.name}</p>
          <p className="text-sm text-muted">
            {found.addressLine}, {found.town} {found.postcode} · {found.odsCode}
          </p>
          <label className="mt-3 block text-sm font-semibold">
            Phone <span className="font-normal text-muted">(not in the NHS data; optional)</span>
            <input
              name="phone"
              inputMode="tel"
              placeholder="e.g. 020 7946 0000"
              className={`mt-1.5 ${input}`}
            />
          </label>
          <button type="submit" disabled={adding} className={`${button.primary} mt-3`}>
            {adding ? "Adding…" : "Add to MediBase"}
          </button>
        </form>
      )}
      <Message state={added} />
    </Card>
  );
}
