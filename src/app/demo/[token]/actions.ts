"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DemoState = { status: "idle" } | { status: "error"; message: string };

const tokenSchema = z.object({ token: z.string().min(32).max(64) });

/**
 * Sign in to the demo account behind a demo link. The server makes a one-off
 * sign-in code for the account and uses it straight away, so no email is
 * sent and no password exists.
 */
export async function enterDemo(_prev: DemoState, formData: FormData): Promise<DemoState> {
  if (!allowRequest(`demo:${clientKey(await headers())}`, 20, 60 * 60_000)) {
    return { status: "error", message: "Too many tries. Wait a while and try again." };
  }
  const parsed = tokenSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) return { status: "error", message: "That demo link isn't valid." };

  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "The demo isn't available right now." };
  const { data: request } = await admin
    .from("pilot_requests")
    .select("demo_user_id")
    .eq("demo_token", parsed.data.token)
    .eq("status", "approved")
    .maybeSingle();
  if (!request?.demo_user_id) {
    return { status: "error", message: "This demo link has been switched off." };
  }

  const { data: account } = await admin.auth.admin.getUserById(request.demo_user_id);
  if (!account.user?.email)
    return { status: "error", message: "This demo link has been switched off." };

  // generateLink only makes the code; it doesn't send an email.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: account.user.email,
  });
  if (linkError) {
    console.error("demo link failed:", linkError);
    return { status: "error", message: "Couldn't open the demo. Try again." };
  }
  // Using the code with the normal client signs this browser in (cookies).
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (error) {
    console.error("demo sign-in failed:", error);
    return { status: "error", message: "Couldn't open the demo. Try again." };
  }

  // Demo stock goes "Unverified" after 2 hours, so freshen it for this visit.
  // A stale demo is better than no demo, so a failure here doesn't stop them.
  const { error: refreshError } = await admin.rpc("refresh_demo_stock_times");
  if (refreshError) console.error("refreshing demo stock failed:", refreshError);

  redirect("/search");
}
