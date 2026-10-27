"use client";

import { useActionState } from "react";
import { button } from "@/components/ui";
import { closeBroadcast, closeRequest, type ActionState } from "./actions";

/** "Prescription downloaded" (holder) or "Close request" (asker), for one request. */
export function CloseRequestButton({
  requestId,
  reason,
  children,
}: {
  requestId: string;
  reason: "dispensed" | "cancelled";
  children: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(closeRequest, {
    status: "idle",
  });
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="reason" value={reason} />
      <button
        type="submit"
        disabled={pending}
        className={reason === "dispensed" ? button.primary : button.small}
      >
        {pending ? "Saving…" : children}
      </button>
      {state.status === "error" && <span className="text-xs text-rose-600">{state.message}</span>}
    </form>
  );
}

/** Close every open request in a broadcast ("got it elsewhere"). */
export function CloseBroadcastButton({ broadcastId }: { broadcastId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(closeBroadcast, {
    status: "idle",
  });
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="broadcastId" value={broadcastId} />
      <button type="submit" disabled={pending} className={button.small}>
        {pending ? "Closing…" : "Close request"}
      </button>
      {state.status === "error" && <span className="text-xs text-rose-600">{state.message}</span>}
    </form>
  );
}
