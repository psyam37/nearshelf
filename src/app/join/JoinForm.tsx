"use client";

import { useActionState } from "react";
import { Icon, button, input } from "@/components/ui";
import { applyToJoin, withdrawApplication, type JoinState } from "./actions";

export function JoinForm() {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(applyToJoin, {
    status: "idle",
  });

  if (state.status === "applied") {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100">
        <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
        Application sent to {state.pharmacyName}. A manager there (or a MediBase admin) will check
        your GPhC registration and approve you.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm font-semibold">
        Full name
        <span className="block text-xs font-normal text-muted">As on the GPhC register</span>
        <input name="fullName" required autoComplete="name" className={`mt-1.5 ${input}`} />
      </label>
      <label className="block text-sm font-semibold">
        GPhC registration number
        <span className="block text-xs font-normal text-muted">7 digits</span>
        <input
          name="gphcNumber"
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 2012345"
          className={`mt-1.5 ${input}`}
        />
      </label>
      <label className="block text-sm font-semibold">
        Your pharmacy&apos;s ODS code
        <span className="block text-xs font-normal text-muted">
          The NHS code for your branch, e.g. FA123. Demo pharmacies use DEMO01 to DEMO14.
        </span>
        <input
          name="odsCode"
          required
          autoComplete="off"
          placeholder="e.g. FA123"
          className={`mt-1.5 uppercase placeholder:normal-case ${input}`}
        />
      </label>
      {state.status === "error" && (
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${button.primary} w-full py-3`}>
        {pending ? "Checking…" : "Apply to join"}
      </button>
    </form>
  );
}

export function WithdrawButton({ applicationId }: { applicationId: string }) {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(withdrawApplication, {
    status: "idle",
  });
  return (
    <form action={formAction}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <button type="submit" disabled={pending} className={button.secondary}>
        {pending ? "Withdrawing…" : "Withdraw application"}
      </button>
      {state.status === "error" && <p className="mt-2 text-sm text-rose-600">{state.message}</p>}
    </form>
  );
}
