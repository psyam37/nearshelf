import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Icon, PageHeader, Skeleton, button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getClinicianApplication, getMyPharmacy } from "@/lib/pharmacy";
import { formatUpdatedAgo } from "@/lib/stock";
import { ClinicianForm, WithdrawClinicianButton } from "./ClinicianForm";

export const metadata: Metadata = {
  title: "Register as a GP practice pharmacist",
};

export default function ClinicianJoinPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Verified access"
        title="Search stock as a pharmacist"
        description="For pharmacists at GP practices, and locums. See which local pharmacies have a medicine before you send a patient or a prescription there. Access is view-only."
      />
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <ClinicianJoinContent />
      </Suspense>
    </main>
  );
}

async function ClinicianJoinContent() {
  const user = await requireUser("/join/clinician");
  const [application, myPharmacy] = await Promise.all([
    getClinicianApplication(user.id),
    getMyPharmacy(),
  ]);
  const now = new Date();

  if (application?.status === "approved") {
    return (
      <Card className="p-6">
        <span className="inline-flex rounded-xl bg-brand-50 p-2.5 text-accent dark:bg-brand-950">
          <Icon name="check" className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">You&apos;re verified</h2>
        <p className="mt-1 text-muted">
          You can search stock at pharmacies that share it with local prescribers, as{" "}
          <strong className="text-ink">{application.workplace}</strong>.
        </p>
        <Link href="/search" className={`${button.primary} mt-5`}>
          Find a medicine
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </Card>
    );
  }

  if (application?.status === "pending") {
    return (
      <Card className="p-6">
        <span className="inline-flex rounded-xl bg-amber-50 p-2.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <Icon name="clock" className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Waiting for approval</h2>
        <p className="mt-1 text-muted">
          You applied as <strong className="text-ink">{application.workplace}</strong>{" "}
          {formatUpdatedAgo(application.created_at, now)}. A NearShelf admin will check your GPhC
          registration.
        </p>
        <div className="mt-5">
          <WithdrawClinicianButton applicationId={application.id} />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {myPharmacy && (
        <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900 dark:bg-brand-950 dark:text-brand-100">
          You already work at <strong>{myPharmacy.name}</strong>, so you can{" "}
          <Link href="/search" className="font-semibold underline">
            search stock
          </Link>{" "}
          already.
        </p>
      )}
      {application?.status === "rejected" && (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          Your last application wasn&apos;t approved. Check your name and GPhC number match the
          register, then apply again.
        </p>
      )}
      <Card className="p-6">
        <ClinicianForm />
      </Card>
      <p className="text-sm text-muted">
        Work in a community pharmacy?{" "}
        <Link href="/join" className="font-semibold text-accent underline">
          Join your pharmacy
        </Link>{" "}
        instead, to update stock and send requests.
      </p>
      <p className="text-xs text-muted">
        We store your name, GPhC number and workplace so we can verify you. We never ask for or
        store patient information.
      </p>
    </div>
  );
}
