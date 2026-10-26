"use client";

import { useActionState } from "react";
import { devPasswordSignIn, type SignInState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900";

/** Only rendered under `npm run dev`. See devPasswordSignIn. */
export function DevSignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(devPasswordSignIn, {
    status: "idle",
  });

  return (
    <details className="mt-10 rounded-lg border border-dashed border-amber-400 p-4 text-sm">
      <summary className="cursor-pointer font-medium text-amber-700">
        Developer sign-in (test accounts, local only)
      </summary>
      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="next" value={next} />
        <label className="block">
          Email
          <input name="email" type="email" required autoComplete="off" className={inputClass} />
        </label>
        <label className="block">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="off"
            className={inputClass}
          />
        </label>
        {state.status === "error" && <p className="text-rose-600">{state.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-3 py-2 font-medium disabled:opacity-60 dark:border-zinc-700"
        >
          {pending ? "Signing in…" : "Sign in with password"}
        </button>
      </form>
    </details>
  );
}
