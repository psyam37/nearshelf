"use client";

import { useActionState } from "react";
import { button, input } from "@/components/ui";
import { devPasswordSignIn, type SignInState } from "./actions";

const inputClass = `mt-1 ${input}`;

/** Shown locally, or on the live site when demo accounts are set up (lib/demo.ts). */
export function DevSignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(devPasswordSignIn, {
    status: "idle",
  });

  return (
    <details className="mt-6 rounded-xl border border-dashed border-amber-400/70 bg-amber-50/50 p-4 text-sm dark:bg-amber-950/20">
      <summary className="cursor-pointer font-semibold text-amber-800 dark:text-amber-400">
        Demo accounts (password sign-in)
      </summary>
      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="next" value={next} />
        <label className="block font-medium">
          Email
          <input name="email" type="email" required autoComplete="off" className={inputClass} />
        </label>
        <label className="block font-medium">
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
        <button type="submit" disabled={pending} className={`${button.secondary} w-full`}>
          {pending ? "Signing in…" : "Sign in with password"}
        </button>
      </form>
    </details>
  );
}
