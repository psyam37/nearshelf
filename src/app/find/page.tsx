import type { Metadata } from "next";
import { PublicFinder } from "@/components/PublicFinder";
import { Icon, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Find your medicine",
  description:
    "See which pharmacies near you report having your medicine in stock, then call ahead.",
};

// Public: no sign-in, and nothing about the visitor is stored.
export default function FindPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="For patients"
        title="Find your medicine nearby"
        description="Pharmacies near you share which hard-to-find medicines they have in stock. Search, then call ahead before you go."
      />

      <p className="mb-6 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Not for emergencies: call <strong>999</strong>, or <strong>NHS 111</strong> for urgent
          advice. MediBase shows what pharmacies report, not medical advice.
        </span>
      </p>

      <PublicFinder />

      <p className="mt-8 text-xs text-muted">
        We don&apos;t ask who you are, and we don&apos;t keep your location: it&apos;s used for this
        search, then forgotten.
      </p>
    </main>
  );
}
