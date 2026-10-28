import type { Metadata } from "next";
import Link from "next/link";
import { InstallApp } from "@/components/InstallApp";
import { Card, Icon, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Install the app",
  description:
    "Install MediBase on your phone or dispensary computer: its own icon, full screen, and notifications for nearby requests.",
};

const AFTER = [
  {
    title: "Sign in",
    text: "Use your work email. You stay signed in on that device.",
  },
  {
    title: "Turn on notifications",
    text: "On Requests, tap Turn on notifications, so requests reach you even when MediBase is closed.",
  },
  {
    title: "Check your shelf",
    text: "On My pharmacy, confirm your stock, or upload a report from your PMR.",
  },
];

export default function InstallPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Beta app"
        title="Install MediBase"
        description="Add MediBase to your phone or dispensary computer. It gets its own icon, opens full screen, and alerts you to requests nearby. No app store needed, and it updates itself."
      />

      <InstallApp />

      <section className="mt-12">
        <h2 className="text-lg font-semibold">After installing</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {AFTER.map((item) => (
            <Card key={item.title} className="p-5">
              <p className="flex items-center gap-2 font-semibold">
                <Icon name="check" className="h-4 w-4 text-accent" />
                {item.title}
              </p>
              <p className="mt-1 text-sm text-muted">{item.text}</p>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">
          New to MediBase?{" "}
          <Link href="/pharmacies" className="font-medium text-accent underline">
            See how it works for pharmacies
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
