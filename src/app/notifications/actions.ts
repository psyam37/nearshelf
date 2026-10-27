"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { sendToTargets } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

// The parts of a browser PushSubscription we keep. Validated: it comes from
// the browser, so it could be anything.
const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export type PushActionResult = { ok: true; message?: string } | { ok: false; message: string };

/** Remember this device for the signed-in user. */
export async function savePushSubscription(
  subscription: unknown,
  userAgent: string,
): Promise<PushActionResult> {
  if (!(await getCurrentUser())) return { ok: false, message: "Please sign in again." };
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, message: "That subscription wasn't valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_user_agent: userAgent.slice(0, 300),
  });
  if (error) {
    console.error("save subscription failed:", error);
    return { ok: false, message: "Couldn't turn notifications on. Try again." };
  }
  return { ok: true };
}

/** Forget this device (row level security: only your own). */
export async function removePushSubscription(endpoint: string): Promise<PushActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { ok: false, message: "Couldn't turn notifications off. Try again." };
  return { ok: true };
}

/** Send a test notification to all of the signed-in user's devices. */
export async function sendTestNotification(): Promise<PushActionResult> {
  if (!(await getCurrentUser())) return { ok: false, message: "Please sign in again." };
  const supabase = await createClient();
  // Your own devices: readable with your normal session, no secret key needed.
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (error) return { ok: false, message: "Couldn't load your devices." };

  const sent = await sendToTargets(data, {
    title: "MediBase notifications are on",
    body: "You'll hear about stock requests from pharmacies nearby, even when MediBase is closed.",
    url: "/requests",
    tag: "test",
  });
  return sent > 0
    ? { ok: true, message: `Sent to ${sent} ${sent === 1 ? "device" : "devices"}.` }
    : { ok: false, message: "Nothing was sent. Check the VAPID keys in .env.local." };
}
