// Supabase client with the SECRET key: it ignores row level security. Used
// for two things: finding which devices to send push notifications to, which
// means reading other people's subscriptions, and adding a real pharmacy
// from the NHS directory when its first member applies. `server-only` makes
// the build fail if browser code ever imports this file.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getEnv } from "@/lib/env";

/** The admin client, or null if SUPABASE_SECRET_KEY isn't set. */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) return null;
  return createClient<Database>(getEnv().NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
