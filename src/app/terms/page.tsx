import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The rules for using NearShelf, for pharmacies and patients.",
};

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Terms"
        title="Terms of use"
        description="NearShelf is a pilot. These terms keep it safe, legal and useful for everyone."
      />

      <Card className="mb-8 border-amber-300/60 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <p className="font-semibold">Not for emergencies or medical advice</p>
        <p className="mt-1">
          NearShelf shows what pharmacies report about their stock. It isn&apos;t a medical device
          and doesn&apos;t give medical advice. In an emergency call 999; for urgent advice, NHS
          111.
        </p>
      </Card>

      <div className="space-y-8">
        <Rule title="What NearShelf is, and isn't">
          <p>
            NearShelf helps pharmacies see where a medicine is available, so a patient&apos;s
            prescription can be dispensed by a pharmacy that has it. It is not a marketplace: there
            are no sales, orders, payments or transfers of medicines between businesses through
            NearShelf, and you must not use it to arrange them.
          </p>
        </Rule>

        <Rule title="For pharmacy staff">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Only registered pharmacy professionals may hold an account, using their own GPhC
              number.
            </li>
            <li>
              Keep stock levels honest and up to date; re-confirm or change them when they change.
            </li>
            <li>
              Never enter patient information: no names, NHS numbers, dates of birth, addresses or
              phone numbers, in any field or message.
            </li>
            <li>
              A &ldquo;held&rdquo; item is a courtesy, not a contract: always confirm with the other
              pharmacy before sending a patient.
            </li>
            <li>
              You remain responsible for dispensing decisions and for complying with your
              professional and legal obligations.
            </li>
          </ul>
        </Rule>

        <Rule title="For patients">
          <p>
            Availability shown on NearShelf may have changed. Always call the pharmacy before you
            travel. Your prescription still needs to be sent to, or released for, that pharmacy by
            your GP surgery or current pharmacy.
          </p>
        </Rule>

        <Rule title="Accounts and access">
          <p>
            We may suspend accounts that break these terms, misuse the service, or whose
            registration can&apos;t be verified. Pharmacy managers and NearShelf admins approve who
            can join each pharmacy.
          </p>
        </Rule>

        <Rule title="The pilot">
          <p>
            NearShelf is provided free during the pilot, as it is, while we improve it. We work hard
            to keep it available and accurate but can&apos;t guarantee either. We may change these
            terms; we&apos;ll tell pharmacies about significant changes.
          </p>
        </Rule>
      </div>
    </main>
  );
}
