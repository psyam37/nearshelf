"use client";

import { useActionState } from "react";
import { Icon, button } from "@/components/ui";
import { enterDemo, type DemoState } from "./actions";

export function EnterDemoButton({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<DemoState, FormData>(enterDemo, {
    status: "idle",
  });
  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={pending} className={`${button.primary} w-full py-3`}>
        {pending ? "Opening your demo…" : "Open the demo"}
        {!pending && <Icon name="arrow" className="h-4 w-4" />}
      </button>
      {state.status === "error" && (
        <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {state.message}
        </p>
      )}
    </form>
  );
}
