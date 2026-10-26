"use client";
// Camera barcode scanner. MedicineSearch loads this file only when the
// scanner is opened, so the barcode library isn't in the page's first load.

import type { IScannerControls } from "@zxing/browser";
import type { DecodeHintType as HintKey } from "@zxing/library";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { normaliseScannedCode } from "@/lib/gtin";

interface BarcodeScannerProps {
  onDetected: (gtin: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const handleDetected = useEffectEvent(onDetected);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let stopped = false;

    async function start() {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import("@zxing/browser"),
        import("@zxing/library"),
      ]);
      // In development React runs effects twice (mount, unmount, mount) to
      // catch bugs. If this run was already cleaned up, don't touch the camera:
      // stopping it later would also blank the video for the second run.
      if (stopped || !videoRef.current) return;

      // Only look for the formats medicine packs use: faster and fewer misreads.
      // Values differ per setting (a list, a true/false), hence `unknown`.
      const hints = new Map<HintKey, unknown>([
        [
          DecodeHintType.POSSIBLE_FORMATS,
          [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.DATA_MATRIX,
          ],
        ],
        // Spend longer on each frame: slower, but finds small or angled codes.
        [DecodeHintType.TRY_HARDER, true],
      ]);
      const reader = new BrowserMultiFormatReader(hints);

      try {
        controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: "environment", // the back camera on phones
              // Webcams default to 640×480, where a barcode is only a few
              // pixels per stripe. Ask for HD; the browser picks the closest.
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
          videoRef.current,
          (result, _error, scanControls) => {
            if (!result) return; // nothing readable in this frame yet
            const gtin = normaliseScannedCode(result.getText());
            if (!gtin) return; // a misread or not a product code: keep looking
            scanControls.stop();
            handleDetected(gtin);
          },
        );
        if (stopped) controls.stop(); // closed while the camera was starting
      } catch (err) {
        const denied = err instanceof DOMException && err.name === "NotAllowedError";
        setError(
          denied
            ? "Camera permission was denied. Allow it in the browser, or type the barcode number."
            : "Couldn't start the camera. Type the barcode number into the search box instead.",
        );
      }
    }

    void start();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan a barcode"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-4 dark:bg-zinc-900">
        <p className="font-medium">Scan the pack&apos;s barcode</p>
        <p className="mt-1 text-sm text-zinc-500">
          Hold the barcode or the square code steady in the frame.
        </p>
        <div className="relative mt-3 overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" />
          {/* A guide box so people know where to aim. */}
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-md border-2 border-emerald-400" />
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
