"use client";

import { useActionState } from "react";
import { Icon, button } from "@/components/ui";
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
        className={button.primary}
      >
        <Icon name="check" className="h-4 w-4" />
        Available
      </button>
      <button
        type="submit"
        name="status"
        value="declined"
        disabled={pending}
        className={button.secondary}
      >
        Not available
      </button>
      {state.status === "error" && <span className="text-xs text-rose-600">{state.message}</span>}
    </form>
  );
}
