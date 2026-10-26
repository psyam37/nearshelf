"use client";

import Link from "next/link";
import { useState } from "react";
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
    <Link href="/requests" className="inline-flex items-center gap-1.5 hover:underline">
      Requests
      {pending > 0 && (
        <span
          aria-label={`${pending} waiting`}
          className="min-w-5 rounded-full bg-rose-600 px-1.5 text-center text-xs leading-5 font-semibold text-white"
        >
          {pending}
        </span>
      )}
    </Link>
  );
}
