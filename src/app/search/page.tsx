import type { Metadata } from "next";
import { Suspense } from "react";
import { NearbySearch } from "@/components/NearbySearch";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getMyPharmacy } from "@/lib/pharmacy";

export const metadata: Metadata = {
  title: "Find a medicine",
};

// A Server Component (the default): it renders the static parts, and the
// interactive search inside it is a Client Component.
export default function SearchPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Search"
        title="Find a medicine nearby"
        description="Pick a medicine and where to look. Pharmacies with it in stock come first, then the nearest."
      />
      <Suspense fallback={<SearchSkeleton />}>
        <SearchForStaff />
      </Suspense>
    </main>
  );
}

// Reads the session, so it streams in behind the Suspense boundary above.
async function SearchForStaff() {
  await requireUser("/search");
  return <NearbySearch myPharmacy={await getMyPharmacy()} />;
}

function SearchSkeleton() {
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </Card>
  );
}
