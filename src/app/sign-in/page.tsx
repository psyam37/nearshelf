import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { DevSignInForm } from "./DevSignInForm";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        For pharmacy staff. We&apos;ll email you a link, no password needed.
      </p>
      {/* Reading the URL and the session happens per request, so it streams in. */}
      <Suspense fallback={<div className="h-32" />}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
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
        <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          That sign-in link has expired or was already used. Ask for a new one below.
        </p>
      )}
      <SignInForm next={next} />
      {process.env.NODE_ENV === "development" && <DevSignInForm next={next} />}
    </>
  );
}
