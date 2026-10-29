"use client";
// Turn push notifications on or off for this browser or phone.

import { useEffect, useState } from "react";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestNotification,
} from "@/app/notifications/actions";
import { Icon, button } from "@/components/ui";

type Status =
  | "loading"
  | "unsupported" // no push in this browser
  | "needs-install" // iPhone/iPad: add to Home Screen first
  | "blocked" // the user said no; only browser settings can undo it
  | "off"
  | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** The VAPID public key arrives as base64url text; the browser wants bytes. */
function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function getRegistration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

export function NotificationToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Work out where this device stands. Runs in the browser only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && VAPID_PUBLIC_KEY;
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const installed = window.matchMedia("(display-mode: standalone)").matches;
      let next: Status;
      if (!supported) next = isIos && !installed ? "needs-install" : "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        const subscription = await (await getRegistration()).pushManager.getSubscription();
        next = subscription ? "on" : "off";
      }
      if (!cancelled) setStatus(next);
    })().catch(() => !cancelled && setStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setStatus("blocked");
        return;
      }
      const registration = await getRegistration();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // browsers require every push to show a notification
        applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
      });
      const result = await savePushSubscription(subscription.toJSON(), navigator.userAgent);
      if (result.ok) setStatus("on");
      else {
        await subscription.unsubscribe();
        setMessage(result.message);
      }
    } catch {
      setMessage("Couldn't turn notifications on in this browser.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    const subscription = await (await getRegistration()).pushManager.getSubscription();
    if (subscription) {
      await removePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setStatus("off");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const result = await sendTestNotification();
    setMessage(result.message ?? null);
    setBusy(false);
  }

  if (status === "loading") return null;

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      {status === "on" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={test} disabled={busy} className={button.small}>
            Send test
          </button>
          <button type="button" onClick={turnOff} disabled={busy} className={button.small}>
            <Icon name="bolt" className="h-3.5 w-3.5 text-accent" />
            Notifications on
          </button>
        </div>
      ) : status === "off" ? (
        <button type="button" onClick={turnOn} disabled={busy} className={button.secondary}>
          <Icon name="bolt" className="h-4 w-4 text-accent" />
          {busy ? "Turning on…" : "Turn on notifications"}
        </button>
      ) : null}
      <p className="max-w-xs text-xs text-muted sm:text-right">
        {message ??
          {
            on: "This device is alerted to requests nearby. Tap to turn off.",
            off: "Get alerted to requests nearby, even when NearShelf is closed.",
            blocked: "Notifications are blocked. Allow them in your browser settings.",
            "needs-install":
              "On iPhone, tap Share → Add to Home Screen, then open NearShelf from there.",
            unsupported: "This browser can't show notifications.",
          }[status]}
      </p>
    </div>
  );
}
