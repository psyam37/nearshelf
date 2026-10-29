import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Icon, PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getMyPharmacy } from "@/lib/pharmacy";
import { formatUpdatedAgo } from "@/lib/stock";
import { createClient } from "@/lib/supabase/server";
import { JoinForm, WithdrawButton } from "./JoinForm";

export const metadata: Metadata = {
  title: "Join a pharmacy",
};

export default function JoinPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Verified access"
        title="Join your pharmacy"
        description="NearShelf is for registered pharmacy professionals. Tell us your GPhC number and your branch, and a manager there will verify you."
      />
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <JoinContent />
      </Suspense>
    </main>
  );
}

async function JoinContent() {
  const user = await requireUser("/join");
  const supabase = await createClient();
  const [myPharmacy, latest] = await Promise.all([
    getMyPharmacy(),
    // The newest application by this user (row level security: only their own).
    supabase
      .from("staff_applications")
      .select("id, status, created_at, reviewed_at, pharmacy:pharmacies(name, postcode)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (latest.error) throw latest.error;
  const application = latest.data;
  const now = new Date();

  if (application?.status === "pending") {
    return (
      <Card className="p-6">
        <span className="inline-flex rounded-xl bg-amber-50 p-2.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <Icon name="clock" className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Waiting for approval</h2>
        <p className="mt-1 text-muted">
          You applied to join <strong className="text-ink">{application.pharmacy.name}</strong> (
          {application.pharmacy.postcode}) {formatUpdatedAgo(application.created_at, now)}. A
          manager there, or a NearShelf admin, will check your GPhC registration.
        </p>
        <div className="mt-5">
          <WithdrawButton applicationId={application.id} />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {myPharmacy && (
        <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900 dark:bg-brand-950 dark:text-brand-100">
          You already work at <strong>{myPharmacy.name}</strong>.{" "}
          <Link href="/my-pharmacy" className="font-semibold underline">
            Go to My pharmacy
          </Link>
          . You can also apply to another branch, e.g. if you work as a locum.
        </p>
      )}
      {application?.status === "rejected" && (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          Your application to <strong>{application.pharmacy.name}</strong> wasn&apos;t approved.
          Check your details with the pharmacy manager, then apply again.
        </p>
      )}
      <Card className="p-6">
        <JoinForm />
      </Card>
      <p className="text-xs text-muted">
        We store your name and GPhC number so your pharmacy can verify you. We never ask for or
        store patient information.
      </p>
    </div>
  );
}
