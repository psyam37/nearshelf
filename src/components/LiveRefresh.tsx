"use client";

import { useRouter } from "next/navigation";
import { useTableChanges } from "@/hooks/useTableChanges";
import type { Database } from "@/lib/database.types";

interface LiveRefreshProps {
  table: keyof Database["public"]["Tables"];
  filter: string;
}

/**
 * Re-renders the current page's Server Components when matching rows change.
 * Renders nothing itself. Client state (like typed text) is kept.
 */
export function LiveRefresh({ table, filter }: LiveRefreshProps) {
  const router = useRouter();
  useTableChanges(table, filter, () => router.refresh());
  return null;
}
