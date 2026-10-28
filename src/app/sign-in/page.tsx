import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, LogoMark, Skeleton } from "@/components/ui";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { demoSignInEnabled } from "@/lib/demo";
import { DevSignInForm } from "./DevSignInForm";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="relative flex flex-1 items-start justify-center px-4 py-14 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-72 max-w-xl rounded-full bg-brand-300/20 blur-3xl dark:bg-brand-800/25"
      />
      <div className="w-full max-w-sm">
        <Card className="p-7 shadow-xl shadow-brand-950/5">
          <LogoMark className="h-12 w-12" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Sign in to MediBase</h1>
          <p className="mt-1.5 mb-6 text-sm text-muted">
            For pharmacy staff. We&apos;ll email you a sign-in link, no password needed.
          </p>
          {/* Reading the URL and the session happens per request, so it streams in. */}
          <Suspense fallback={<SignInSkeleton />}>
            <SignInContent searchParams={searchParams} />
          </Suspense>
        </Card>
      </div>
    </main>
  );
}

async function SignInContent({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const params = await searchParams;
  // A query value can be a string, a list (?next=a&next=b) or missing.
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const next = safeNextPath(nextParam);

  if (await getCurrentUser()) redirect(next);

  return (
    <>
      {params.error === "link" && (
        <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          That sign-in link has expired or was already used. Ask for a new one below.
        </p>
      )}
      <SignInForm next={next} />
      {demoSignInEnabled() && <DevSignInForm next={next} />}
    </>
  );
}

function SignInSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}
