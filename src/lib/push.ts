// Sending web push notifications. Server only.
// Payloads contain stock details only: never anything about a patient.
import "server-only";
import webpush, { WebPushError } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/** What the service worker (public/sw.js) shows. Keep the two in step. */
export interface PushPayload {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag?: string;
}

interface Target {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** True once VAPID keys are configured. Without them, sending is skipped. */
function configureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:push@example.com",
    publicKey,
    privateKey,
  );
  return true;
}

/** Sends to each device. Returns how many succeeded. */
export async function sendToTargets(targets: Target[], payload: PushPayload): Promise<number> {
  if (targets.length === 0 || !configureVapid()) return 0;

  const results = await Promise.allSettled(
    targets.map((t) =>
      webpush.sendNotification(
        { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 30, urgency: "high" }, // stale after the 30-minute window
      ),
    ),
  );

  // 404/410 = the device unsubscribed or the browser was reset: forget it.
  const gone = targets.filter((_, i) => {
    const r = results[i];
    return (
      r.status === "rejected" &&
      r.reason instanceof WebPushError &&
      (r.reason.statusCode === 404 || r.reason.statusCode === 410)
    );
  });
  if (gone.length > 0) {
    await createAdminClient()
      ?.from("push_subscriptions")
      .delete()
      .in(
        "endpoint",
        gone.map((t) => t.endpoint),
      );
  }

  results.forEach((r, i) => {
    if (r.status === "rejected" && !gone.includes(targets[i])) {
      console.error("push failed:", r.reason);
    }
  });
  return results.filter((r) => r.status === "fulfilled").length;
}

/** Notifies everyone who works at these pharmacies (except the sender). */
export async function notifyPharmacies(
  pharmacyIds: string[],
  excludeUserId: string,
  payload: PushPayload,
): Promise<number> {
  const admin = createAdminClient();
  if (!admin || pharmacyIds.length === 0) {
    if (!admin) console.warn("Push skipped: SUPABASE_SECRET_KEY isn't set.");
    return 0;
  }
  const { data, error } = await admin.rpc("push_targets", {
    p_pharmacy_ids: pharmacyIds,
    p_exclude_user: excludeUserId,
  });
  if (error) {
    console.error("push_targets failed:", error);
    return 0;
  }
  return sendToTargets(data, payload);
}

/** "2 packs of 28", "1 pack", or "" when neither was given. */
export function packText(packSize: number | null, quantity: number | null): string {
  if (!quantity && !packSize) return "";
  const packs = quantity ?? 1;
  return `${packs} ${packs === 1 ? "pack" : "packs"}${packSize ? ` of ${packSize}` : ""}`;
}
