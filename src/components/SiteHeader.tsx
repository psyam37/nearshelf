import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/sign-in/actions";
import { getCurrentUser } from "@/lib/auth";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 text-sm sm:px-6">
        <Link href="/" className="font-semibold">
          Pharmacy Stock Finder
        </Link>
        {/* The session is read per request, so only this part waits for it. */}
        <Suspense fallback={<span className="h-5 w-16" />}>
          <AccountLinks />
        </Suspense>
      </nav>
    </header>
  );
}

async function AccountLinks() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href="/sign-in" className="font-medium text-emerald-700 hover:underline">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link href="/search" className="hover:underline">
        Search
      </Link>
      <Link href="/my-pharmacy" className="hover:underline">
        My pharmacy
      </Link>
      <form action={signOut}>
        <button type="submit" className="text-zinc-500 hover:underline" title={user.email ?? ""}>
          Sign out
        </button>
      </form>
    </div>
  );
}
