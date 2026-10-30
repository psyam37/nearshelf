"use client";

import { useState } from "react";
import { Icon, button } from "@/components/ui";

/** Copies `text` to the clipboard, and says so for a moment. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={button.small}
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          },
          () => setCopied(false),
        );
      }}
    >
      <Icon name={copied ? "check" : "download"} className="h-3.5 w-3.5" />
      {copied ? "Copied" : label}
    </button>
  );
}
