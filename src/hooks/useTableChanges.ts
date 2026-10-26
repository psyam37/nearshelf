import { useEffect, useEffectEvent } from "react";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

// Every table name in the database, e.g. "stock_status" | "stock_requests" | …
// Pass anything else and TypeScript refuses.
type TableName = keyof Database["public"]["Tables"];

/**
 * Calls `onChange` whenever a row in `table` is inserted, updated or deleted.
 * Uses Supabase Realtime, so row level security still applies: you only hear
 * about rows you're allowed to read.
 *
 * `filter` narrows it down, e.g. "medicine_id=eq.123". Pass null to pause.
 */
export function useTableChanges(table: TableName, filter: string | null, onChange: () => void) {
  // useEffectEvent: always calls the latest `onChange` without re-subscribing
  // every time the component re-renders with a new function.
  const handleChange = useEffectEvent(onChange);

  useEffect(() => {
    if (filter === null) return;
    const supabase = createClient();
    const channel = supabase
      // A unique name per listener: two components listening to the same
      // rows would otherwise share (and close) one channel.
      .channel(`${table}:${filter}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter }, () => handleChange())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, filter]);
}
