import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApplicationsList } from "@/components/ApplicationsList";
import { ListSkeleton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/pharmacy";

export const metadata: Metadata = {
  title: "Admin",
};

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
        eyebrow="MediBase admin"
        title="Staff applications"
        description="Every pending application. Usually a pharmacy's managers approve their own staff; you approve the first member of a pharmacy, which has no manager yet."
      />
      <ApplicationsList />
    </>
  );
}
