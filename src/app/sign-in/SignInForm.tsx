"use client";

import { useActionState } from "react";
import { Icon, button, input } from "@/components/ui";
import { sendSignInLink, type SignInState } from "./actions";

const initialState: SignInState = { status: "idle" };

export function SignInForm({ next }: { next: string }) {
  // `state` is whatever sendSignInLink last returned; `pending` is true while
  // it runs. TypeScript knows state is a SignInState from the action's type.
  const [state, formAction, pending] = useActionState(sendSignInLink, initialState);

  if (state.status === "sent") {
    // Inside this branch TypeScript knows `state.email` exists.
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100">
        <p className="flex items-center gap-2 font-semibold">
          <Icon name="check" className="h-4 w-4" />
          Check your email
        </p>
        <p className="mt-1">
          We sent a sign-in link to <strong>{state.email}</strong>. Open it in this browser.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="block text-sm font-semibold">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@pharmacy.co.uk"
          className={`mt-1.5 ${input}`}
        />
      </div>
      {state.status === "error" && <p className="text-sm text-rose-600">{state.message}</p>}
      <button type="submit" disabled={pending} className={`${button.primary} w-full py-3`}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
