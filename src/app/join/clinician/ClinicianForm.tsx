"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Icon, button, input } from "@/components/ui";
import { applyAsClinician, withdrawClinicianApplication, type ClinicianJoinState } from "./actions";

const SETTINGS = [
  { value: "gp_practice", label: "A GP practice" },
  { value: "other", label: "Somewhere else, e.g. as a locum" },
] as const;

export function ClinicianForm() {
  const [state, formAction, pending] = useActionState<ClinicianJoinState, FormData>(
    applyAsClinician,
    { status: "idle" },
  );
  const [setting, setSetting] = useState<(typeof SETTINGS)[number]["value"]>("gp_practice");

  if (state.status === "applied") {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100">
        <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
        Application sent. A NearShelf admin will check your GPhC registration and approve you.
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

      <fieldset>
        <legend className="text-sm font-semibold">Where do you work?</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {SETTINGS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-950"
            >
              <input
                type="radio"
                name="setting"
                value={option.value}
                checked={setting === option.value}
                onChange={() => setSetting(option.value)}
                className="accent-brand-700"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {setting === "gp_practice" ? (
        <label className="block text-sm font-semibold">
          Your practice&apos;s ODS code
          <span className="block text-xs font-normal text-muted">
            The NHS code for your GP practice, e.g. C84023. We look up its name and address.
          </span>
          <input
            name="odsCode"
            required
            autoComplete="off"
            placeholder="e.g. C84023"
            className={`mt-1.5 uppercase placeholder:normal-case ${input}`}
          />
        </label>
      ) : (
        <>
          <label className="block text-sm font-semibold">
            Where you work
            <span className="block text-xs font-normal text-muted">
              e.g. &quot;Locum pharmacist, Nottingham&quot; or your hospital or clinic
            </span>
            <input
              name="workplace"
              required
              autoComplete="organization"
              className={`mt-1.5 ${input}`}
            />
          </label>
          <label className="block text-sm font-semibold">
            Work postcode
            <input
              name="postcode"
              required
              autoComplete="postal-code"
              placeholder="e.g. NG1 5FS"
              className={`mt-1.5 uppercase placeholder:normal-case ${input}`}
            />
          </label>
        </>
      )}

      {state.status === "error" && (
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {state.message}
          {state.link && (
            <>
              {" "}
              <Link href={state.link.href} className="font-semibold underline">
                {state.link.label}
              </Link>
            </>
          )}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${button.primary} w-full py-3`}>
        {pending ? "Checking…" : "Apply for access"}
      </button>
    </form>
  );
}

export function WithdrawClinicianButton({ applicationId }: { applicationId: string }) {
  const [state, formAction, pending] = useActionState<ClinicianJoinState, FormData>(
    withdrawClinicianApplication,
    { status: "idle" },
  );
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
