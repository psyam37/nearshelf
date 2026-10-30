"use client";

import { useActionState } from "react";
import { reviewApplication, type ReviewState } from "@/app/join/actions";
import { Icon, button } from "@/components/ui";

interface ReviewButtonsProps {
  applicationId: string;
  /** Which kind of application: staff (the default) or clinician. */
  action?: (prev: ReviewState, formData: FormData) => Promise<ReviewState>;
}

export function ReviewButtons({ applicationId, action = reviewApplication }: ReviewButtonsProps) {
  const [state, formAction, pending] = useActionState<ReviewState, FormData>(action, {
    status: "idle",
  });

  if (state.status === "reviewed") {
    return (
      <p className="text-sm font-semibold text-accent">
        {state.decision === "approved" ? "Approved: they can now use NearShelf." : "Rejected."}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <button
        type="submit"
        name="decision"
        value="approve"
        disabled={pending}
        className={button.primary}
      >
        <Icon name="check" className="h-4 w-4" />
        Approve
      </button>
      <button
        type="submit"
        name="decision"
        value="reject"
        disabled={pending}
        className={button.secondary}
      >
        Reject
      </button>
      {state.status === "error" && <span className="text-sm text-rose-600">{state.message}</span>}
    </form>
  );
}
