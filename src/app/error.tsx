"use client"; // Error boundaries must be Client Components
// Shown in place of a page when something on it throws, e.g. the database is
// unreachable. The header and footer stay, so people can still get around.

import Link from "next/link";
import { useEffect } from "react";
import { Card, Icon, button } from "@/components/ui";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error); // where an error-reporting service would hook in
  }, [error]);

  // In production, errors from the server only carry an id (`digest`), never
  // the details, so nothing sensitive leaks into the browser.
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : null;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-20">
      <Card className="w-full max-w-md p-8 text-center">
        <span className="mx-auto inline-flex rounded-2xl bg-rose-50 p-3 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
          <Icon name="bolt" className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-muted">
          This page couldn&apos;t load. It&apos;s usually a brief connection problem, so trying
          again often fixes it.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={() => retry()} className={button.primary}>
            Try again
          </button>
          <Link href="/" className={button.secondary}>
            Home
          </Link>
        </div>
        {digest && <p className="mt-6 font-mono text-xs text-muted">Error id: {digest}</p>}
      </Card>
    </main>
  );
}
