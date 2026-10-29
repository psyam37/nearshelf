"use client";
// The /install page: a one-tap "Install NearShelf" button where the browser
// allows it (Chrome and Edge, on Android and computers), and step-by-step help
// for everything else (Safari on iPhone has no install button for websites).

import { useEffect, useState, useSyncExternalStore } from "react";
import { Card, Icon, button, type IconName } from "@/components/ui";

type Platform = "ios" | "android" | "desktop";

// Chrome's install event isn't in TypeScript's built-in types, so we describe
// the two parts we use ourselves.
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPads say they're a Mac, but Macs don't have touch screens.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  return /Android/.test(ua) ? "android" : "desktop";
}

// Is this page running as the installed app, rather than in a browser tab?
const STANDALONE = "(display-mode: standalone)";
function isInstalledApp() {
  const iosHomeScreen = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia(STANDALONE).matches || iosHomeScreen;
}
function subscribeToDisplayMode(onChange: () => void) {
  const query = window.matchMedia(STANDALONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const neverChanges = () => () => {};

const GUIDES: {
  platform: Platform;
  title: string;
  icon: IconName;
  steps: string[];
  note: string;
}[] = [
  {
    platform: "ios",
    title: "iPhone and iPad",
    icon: "mobile",
    steps: [
      "Open this page in Safari.",
      "Tap Share: the square with an arrow pointing up.",
      "Scroll down, tap Add to Home Screen, then Add.",
    ],
    note: "On iPhone, notifications only work in the installed app (iOS 16.4 or later).",
  },
  {
    platform: "android",
    title: "Android",
    icon: "mobile",
    steps: [
      "Open this page in Chrome.",
      "Tap ⋮ at the top right.",
      "Tap Install app (or Add to Home screen), then Install.",
    ],
    note: "NearShelf appears with your other apps.",
  },
  {
    platform: "desktop",
    title: "Dispensary computer",
    icon: "monitor",
    steps: [
      "Open this page in Chrome or Edge.",
      "Click the install icon at the right end of the address bar.",
      "Click Install. NearShelf opens in its own window.",
    ],
    note: "Pin it to the taskbar next to your PMR. Safari on a Mac: File → Add to Dock.",
  },
];

export function InstallApp() {
  // `null` on the server, where there's no browser to ask.
  const platform = useSyncExternalStore(neverChanges, detectPlatform, () => null);
  const installed = useSyncExternalStore(subscribeToDisplayMode, isInstalledApp, () => false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    // The same worker that shows notifications; browsers want one before
    // they offer to install.
    navigator.serviceWorker
      ?.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {});

    function onInstallPrompt(event: Event) {
      event.preventDefault(); // use our button, not the browser's own banner
      setInstallPrompt(event as InstallPromptEvent);
    }
    function onInstalled() {
      setInstallPrompt(null);
      setJustInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null); // each prompt can only be shown once
    if (outcome === "accepted") setJustInstalled(true);
  }

  return (
    <div className="space-y-8">
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        {installed || justInstalled ? (
          <p className="flex items-center gap-3 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              <Icon name="check" />
            </span>
            {installed
              ? "You're using the installed app. Updates arrive by themselves."
              : "Installed. Open NearShelf from your home screen or apps."}
          </p>
        ) : (
          <>
            <div>
              <p className="font-semibold">
                {installPrompt
                  ? "NearShelf is ready to install on this device."
                  : platform === "ios"
                    ? "On iPhone and iPad, install from Safari's Share menu."
                    : "Install from your browser's menu."}
              </p>
              <p className="mt-1 text-sm text-muted">
                {installPrompt
                  ? "Free, no app store, and it updates itself."
                  : "Follow the steps for your device below. It takes about ten seconds."}
              </p>
            </div>
            {installPrompt && (
              <button type="button" onClick={install} className={button.primary}>
                <Icon name="download" className="h-4 w-4" />
                Install NearShelf
              </button>
            )}
          </>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {/* This device's steps first; the others after, in their usual order. */}
        {GUIDES.toSorted(
          (a, b) => Number(b.platform === platform) - Number(a.platform === platform),
        ).map((guide) => {
          const thisDevice = guide.platform === platform;
          return (
            <Card
              key={guide.platform}
              className={`p-5 ${thisDevice ? "border-brand-400 ring-4 ring-brand-500/10" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Icon name={guide.icon} className="h-5 w-5 text-accent" />
                  {guide.title}
                </h2>
                {thisDevice && (
                  <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    This device
                  </span>
                )}
              </div>
              <ol className="mt-4 space-y-3 text-sm">
                {guide.steps.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white dark:bg-brand-600">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-muted">{guide.note}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
