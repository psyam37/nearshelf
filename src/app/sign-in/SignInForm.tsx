"use client";

import { useActionState } from "react";
import { sendSignInLink, type SignInState } from "./actions";

const initialState: SignInState = { status: "idle" };

export function SignInForm({ next }: { next: string }) {
  // `state` is whatever sendSignInLink last returned; `pending` is true while
  // it runs. TypeScript knows state is a SignInState from the action's type.
  const [state, formAction, pending] = useActionState(sendSignInLink, initialState);

  if (state.status === "sent") {
    // Inside this branch TypeScript knows `state.email` exists.
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        <p className="font-medium">Check your email</p>
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
        <label htmlFor="email" className="block text-sm font-medium">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {state.status === "error" && <p className="text-sm text-rose-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
