import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApplicationsList } from "@/components/ApplicationsList";
import { ClinicianApplicationsList } from "@/components/ClinicianApplicationsList";
import { PilotRequestsList } from "@/components/PilotRequestsList";
import { ListSkeleton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/pharmacy";
import { AddPharmacyCard, RefreshDemoCard, SyncNhsDataCard } from "./AdminTools";

export const metadata: Metadata = {
  title: "Admin",
};

// Loading the NHS data history can take a few minutes the first time.
export const maxDuration = 300;

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <AdminContent />
      </Suspense>
    </main>
  );
}

async function AdminContent() {
  await requireUser("/admin");
  // Not an admin? Pretend the page doesn't exist rather than advertise it.
  if (!(await isPlatformAdmin())) notFound();

  return (
    <>
      <PageHeader
        eyebrow="NearShelf admin"
        title="Admin"
        description="Demo tools for pitches, onboarding real pharmacies, NHS data, and applications to approve."
      />
      <div className="space-y-4">
        <RefreshDemoCard />
        <AddPharmacyCard />
        <SyncNhsDataCard />
      </div>
      <h2 className="mt-10 mb-1 text-lg font-semibold">Pilot requests</h2>
      <p className="mb-3 text-sm text-muted">
        From the{" "}
        <a href="/pilot" className="font-medium text-accent underline">
          Join the pilot
        </a>{" "}
        form. Demo accounts only ever see the demo pharmacies.
      </p>
      <PilotRequestsList />
      <h2 className="mt-10 mb-1 text-lg font-semibold">Staff applications</h2>
      <p className="mb-3 text-sm text-muted">
        You approve the first member of a pharmacy, who becomes its manager. From then on its
        managers approve their own staff.
      </p>
      <ApplicationsList />
      <h2 className="mt-10 mb-1 text-lg font-semibold">GP practice and other pharmacists</h2>
      <p className="mb-3 text-sm text-muted">
        View-only access to stock, for pharmacists outside community pharmacy. Only you approve
        these.
      </p>
      <ClinicianApplicationsList />
    </>
  );
}
