import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "What NearShelf stores, why, and what it never stores.",
};

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Privacy"
        title="Privacy notice"
        description="NearShelf is built to need as little personal data as possible. Here is exactly what it keeps."
      />

      <Card className="mb-8 p-5 text-sm">
        <p className="font-semibold">In short</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>We never collect patient information. Patients don&apos;t have accounts.</li>
          <li>For pharmacy staff we keep a name, email address and GPhC registration number.</li>
          <li>We don&apos;t sell data, show adverts or use tracking cookies.</li>
        </ul>
      </Card>

      <div className="space-y-8">
        <Section title="Who we are">
          <p>
            NearShelf is a pilot service connecting community pharmacies so they can see medicine
            availability and redirect prescriptions during shortages.
            {CONTACT ? (
              <>
                {" "}
                Contact us at{" "}
                <a href={`mailto:${CONTACT}`} className="font-medium text-accent underline">
                  {CONTACT}
                </a>
                .
              </>
            ) : null}
          </p>
        </Section>

        <Section title="Patients and the public">
          <p>
            You can search NearShelf without an account. We use your postcode or location only to
            run that search, then discard it. We keep an anonymous daily count of how often each
            pharmacy&apos;s listing appeared in searches, never who searched.
          </p>
          <p>
            NearShelf never asks for, stores or passes on information about patients or their
            prescriptions. Pharmacy staff are told not to include it, and messages that look like
            patient details (such as NHS numbers or dates of birth) are refused automatically.
          </p>
        </Section>

        <Section title="Pharmacy staff and pharmacists">
          <p>To verify that only registered pharmacy professionals use NearShelf, we keep:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>your email address, to sign you in;</li>
            <li>your name and GPhC registration number, to verify you;</li>
            <li>
              which pharmacy you work at and your role there, or, for pharmacists outside community
              pharmacy, your workplace and its postcode;
            </li>
            <li>the stock updates, requests and handover messages you make, with times;</li>
            <li>if you turn on notifications, a technical address for your device.</li>
          </ul>
          <p>
            We use this to run the service (our legitimate interest in providing it, and the
            contract with your pharmacy). Stock levels are visible to other verified pharmacy staff
            and, unless your pharmacy turns it off, to verified pharmacists at GP practices; your
            pharmacy chooses what, if anything, is shown to the public.
          </p>
        </Section>

        <Section title="Pilot requests">
          <p>
            If you ask to join the pilot, we keep the name, role, pharmacy, postcode, email and
            phone number you give us, and your message, so we can review your request and send you a
            demo link. We only use them to contact you about the pilot (with your consent), and
            delete them on request.
          </p>
        </Section>

        <Section title="Where data is kept, and for how long">
          <p>
            Data is stored with Supabase (database and sign-in) and served by Vercel (hosting). Push
            notifications pass through your browser&apos;s push service. Requests and messages are
            kept for the pilot so pharmacies can see their history; we delete your account details
            when you leave, on request.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask to see, correct or delete the personal data we hold about you, or object to
            how we use it
            {CONTACT ? (
              <>
                , by emailing{" "}
                <a href={`mailto:${CONTACT}`} className="font-medium text-accent underline">
                  {CONTACT}
                </a>
              </>
            ) : null}
            . You can also complain to the Information Commissioner&apos;s Office (ico.org.uk).
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use only the cookies needed to keep you signed in. No analytics or advertising
            cookies.
          </p>
        </Section>
      </div>
    </main>
  );
}
