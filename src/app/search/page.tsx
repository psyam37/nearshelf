import type { Metadata } from "next";
import Link from "next/link";
import { NearbySearch } from "@/components/NearbySearch";

export const metadata: Metadata = {
  title: "Find a medicine · Pharmacy Stock Finder",
};

// A Server Component (the default): it renders the static parts, and the
// interactive search box inside it is a Client Component.
export default function SearchPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Home
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Find a medicine</h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">
        Pick a medicine, then where to look. Best availability is shown first, then nearest.
      </p>
      <NearbySearch />
    </main>
  );
}
