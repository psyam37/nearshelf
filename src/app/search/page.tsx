import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NearbySearch } from "@/components/NearbySearch";
import { Card, Icon, PageHeader, Skeleton, button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getClinicianApplication, getMyPharmacy, isPlatformAdmin } from "@/lib/pharmacy";

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
// Stock levels are for pharmacy staff, admins and approved clinicians; the
// database enforces the same rule.
async function SearchForStaff() {
  const user = await requireUser("/search");
  const [myPharmacy, admin, clinician] = await Promise.all([
    getMyPharmacy(),
    isPlatformAdmin(),
    getClinicianApplication(user.id),
  ]);
  if (myPharmacy || admin || clinician?.status === "approved") {
    return <NearbySearch myPharmacy={myPharmacy} />;
  }
  return <NotVerifiedYet pending={clinician?.status === "pending"} />;
}

function NotVerifiedYet({ pending }: { pending: boolean }) {
  return (
    <Card className="p-6">
      <span className="inline-flex rounded-xl bg-brand-50 p-2.5 text-accent dark:bg-brand-950">
        <Icon name="shield" className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">
        {pending ? "Your application is waiting for approval" : "Verify yourself to see stock"}
      </h2>
      <p className="mt-1 text-muted">
        {pending
          ? "Once a NearShelf admin has checked your GPhC registration, you can search stock here."
          : "Stock levels are only shown to GPhC-registered pharmacy professionals. Join your pharmacy, or register as a pharmacist at a GP practice or as a locum."}
      </p>
      {!pending && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/join" className={button.primary}>
            Join your pharmacy
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
          <Link href="/join/clinician" className={button.secondary}>
            GP practice or locum pharmacist
          </Link>
        </div>
      )}
    </Card>
  );
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
