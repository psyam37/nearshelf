"use client";

import { useActionState } from "react";
import { Icon, button, input } from "@/components/ui";
import { PILOT_ROLES } from "@/lib/schemas";
import { submitPilotRequest, type PilotRequestState } from "./actions";

export function PilotForm() {
  const [state, formAction, pending] = useActionState<PilotRequestState, FormData>(
    submitPilotRequest,
    { status: "idle" },
  );

  if (state.status === "sent") {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100">
        <span className="inline-flex rounded-xl bg-white/70 p-2.5 text-accent dark:bg-brand-900">
          <Icon name="check" className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Thank you, request received</h2>
        <p className="mt-1">
          We&apos;ll look at it and email you a private link to a demo of NearShelf, usually within
          a day or two. The demo has pretend pharmacies near you, so you can try everything safely.
        </p>
      </div>
    );
  }

  // After an error, refill what they typed: React clears the form on submit.
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Your name
          <input
            name="contactName"
            required
            autoComplete="name"
            defaultValue={values.contactName}
            className={`mt-1.5 ${input}`}
          />
        </label>
        <label className="block text-sm font-semibold">
          Your role
          <select
            name="role"
            required
            defaultValue={values.role ?? ""}
            className={`mt-1.5 ${input}`}
          >
            <option value="" disabled>
              Choose…
            </option>
            {PILOT_ROLES.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <label className="block text-sm font-semibold">
          Pharmacy name
          <input
            name="pharmacyName"
            required
            autoComplete="organization"
            defaultValue={values.pharmacyName}
            className={`mt-1.5 ${input}`}
          />
        </label>
        <label className="block text-sm font-semibold">
          Postcode
          <input
            name="postcode"
            required
            autoComplete="postal-code"
            placeholder="e.g. NG1 5FS"
            defaultValue={values.postcode}
            className={`mt-1.5 uppercase placeholder:normal-case ${input}`}
          />
        </label>
      </div>

      <label className="block text-sm font-semibold">
        ODS code <span className="font-normal text-muted">(optional)</span>
        <span className="block text-xs font-normal text-muted">
          Your branch&apos;s NHS code, e.g. FA123, if you know it
        </span>
        <input
          name="odsCode"
          autoComplete="off"
          placeholder="e.g. FA123"
          defaultValue={values.odsCode}
          className={`mt-1.5 uppercase placeholder:normal-case ${input}`}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Email
          <span className="block text-xs font-normal text-muted">Where we send your demo link</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={values.email}
            className={`mt-1.5 ${input}`}
          />
        </label>
        <label className="block text-sm font-semibold">
          Phone <span className="font-normal text-muted">(optional)</span>
          <span className="block text-xs font-normal text-muted">If you&apos;d rather we call</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={values.phone}
            className={`mt-1.5 ${input}`}
          />
        </label>
      </div>

      <label className="block text-sm font-semibold">
        Anything you&apos;d like us to know?{" "}
        <span className="font-normal text-muted">(optional)</span>
        <textarea
          name="message"
          rows={3}
          maxLength={1000}
          placeholder="e.g. which medicines you struggle to find, or the best time to talk"
          defaultValue={values.message}
          className={`mt-1.5 ${input}`}
        />
      </label>

      {/* Hidden from people; bots fill in every field. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="consent"
          required
          defaultChecked={values.consent === "on"}
          className="mt-0.5 h-4 w-4 rounded border-line accent-brand-700"
        />
        <span>
          NearShelf can contact me about the pilot. We only use these details for that; see our{" "}
          <a href="/privacy" className="font-medium text-accent underline">
            privacy notice
          </a>
          .
        </span>
      </label>

      {state.status === "error" && (
        <p className="rounded-xl bg-rose-50 p-3 text-sm whitespace-pre-line text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${button.primary} w-full py-3`}>
        {pending ? "Sending…" : "Request a demo"}
      </button>
    </form>
  );
}
