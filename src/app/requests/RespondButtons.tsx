"use client";

import { useActionState } from "react";
import { respondToRequest, type ActionState } from "./actions";

export function RespondButtons({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(respondToRequest, {
    status: "idle",
  });

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <button
        type="submit"
        name="status"
        value="confirmed"
        disabled={pending}
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        Yes, we have it
      </button>
      <button
        type="submit"
        name="status"
        value="declined"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        No
      </button>
      {state.status === "error" && <span className="text-xs text-rose-600">{state.message}</span>}
    </form>
  );
}
