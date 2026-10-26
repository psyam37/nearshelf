"use client";
// The inside of the header's Requests link: icon, label and a live count of
// requests waiting for an answer. (The link itself is the NavLink around it.)

import { useState } from "react";
import { Icon } from "@/components/ui";
import { useTableChanges } from "@/hooks/useTableChanges";
import { createClient } from "@/lib/supabase/client";

interface RequestsLinkProps {
  pharmacyId: string;
  /** Pending count when the page was rendered; kept up to date live after that. */
  initialPending: number;
}

export function RequestsLink({ pharmacyId, initialPending }: RequestsLinkProps) {
  const [pending, setPending] = useState(initialPending);

  // A request to us arrived or was answered: count again.
  useTableChanges("stock_requests", `to_pharmacy_id=eq.${pharmacyId}`, async () => {
    const { count } = await createClient()
      .from("stock_requests")
      .select("id", { count: "exact", head: true })
      .eq("to_pharmacy_id", pharmacyId)
      .eq("status", "pending");
    if (count !== null) setPending(count);
  });

  return (
    <>
      <span className="relative">
        <Icon name="inbox" className="h-[18px] w-[18px]" />
        {pending > 0 && (
          <span
            aria-label={`${pending} waiting`}
            className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[10px] leading-4 font-bold text-white ring-2 ring-canvas"
          >
            {pending}
          </span>
        )}
      </span>
      <span className="hidden sm:inline">Requests</span>
    </>
  );
}
