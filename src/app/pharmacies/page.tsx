import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Icon, LogoMark, button, type IconName } from "@/components/ui";

export const metadata: Metadata = {
  title: "For pharmacies",
  description:
    "Stop phoning around. NearShelf shows which pharmacies near you have a medicine, and lets you ask them all in one tap. Free pilot for independent pharmacies.",
};

// The pilot form: approved pharmacies get a private demo link.
const PILOT_HREF = "/pilot";

/** A screenshot that switches with the visitor's light/dark theme. */
function Screen({
  name,
  alt,
  width,
  height,
}: {
  name: string;
  alt: string;
  width: number;
  height: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line shadow-2xl shadow-brand-950/15">
      <Image
        src={`/screens/${name}-light.webp`}
        alt={alt}
        width={width}
        height={height}
        className="block w-full dark:hidden"
      />
      <Image
        src={`/screens/${name}-dark.webp`}
        alt={alt}
        width={width}
        height={height}
        className="hidden w-full dark:block"
      />
    </div>
  );
}

const PAINS = [
  { stat: "10+", label: "phone calls to find one shortage item" },
  { stat: "20 min", label: "of a pharmacist's time, per search" },
  { stat: "1", label: "patient leaving empty-handed, again" },
];

const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "bolt",
    title: "Ask everyone at once",
    text: "One request reaches every pharmacy within 2, 5 or 10 miles, as a notification.",
  },
  {
    icon: "check",
    title: "Someone taps “Confirm we have it”",
    text: "The pack is held for 30 minutes. A text-only chat opens for the handover.",
  },
  {
    icon: "message",
    title: "Tell the patient where to go",
    text: "NearShelf shows the address, phone number and the steps, right when you need them.",
  },
  {
    icon: "store",
    title: "Release the prescription",
    text: "Return it to the NHS Spine in your PMR. The other pharmacy downloads and dispenses it.",
  },
];

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "Is this legal? We can't trade medicines with other businesses.",
    a: "Correct, and NearShelf never does. There are no payments, orders or stock transfers. It only shows who has a medicine, so the patient's prescription can go to that pharmacy. Medicines never move between businesses, so no Wholesale Dealer's Licence is involved.",
  },
  {
    q: "What about patient data and GDPR?",
    a: "NearShelf holds no patient data at all. Requests contain stock details only, and the handover chat refuses anything that looks like an NHS number, date of birth, postcode or phone number. The only personal data is your staff's name and GPhC number, used to verify them.",
  },
  {
    q: "Do I have to change my PMR? We use ProScript Connect / Titan.",
    a: "No. NearShelf runs in a browser tab next to ProScript Connect, Titan or any other PMR, and works with the same USB barcode scanner. You can also upload a stock report exported from your PMR to set your levels in one go. A direct live link with PMR vendors is planned.",
  },
  {
    q: "Will competitors see all my stock?",
    a: "Only signed-in, GPhC-verified pharmacy staff see stock levels, and only as In stock / Low / Out, never quantities. Verified pharmacists at GP practices can see them too, so they send patients to you first; you can switch that off. The public only sees medicines you choose to list.",
  },
  {
    q: "What about controlled drugs?",
    a: "Staff can find them like anything else, but they are never shown to the public, so your pharmacy is never advertised as holding Schedule 2 stock.",
  },
  {
    q: "How much time does it take?",
    a: "A quick shelf check each morning (one tap confirms everything is still correct), and a tap when a request comes in. Most pharmacies spend a few minutes a day.",
  },
  {
    q: "What does it cost?",
    a: "Nothing during the pilot. We want feedback from a small group of local pharmacies first.",
  },
];

export default function PharmaciesPage() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="bg-logo relative overflow-hidden text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-brand-400/20 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-5xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-100 ring-1 ring-white/15">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Now inviting local pharmacies to the pilot
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[56px] lg:leading-[1.05]">
              Stop phoning round.
              <span className="block text-brand-200">Find it in one tap.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-brand-100/85">
              When a wholesaler can&apos;t supply, NearShelf shows which pharmacies near you have
              it, and asks them all at once. Your patient leaves knowing exactly where to go.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={PILOT_HREF}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-brand-900 shadow-lg transition-colors hover:bg-brand-50"
              >
                Join the free pilot
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/10"
              >
                See how it works
              </a>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="rotate-1 rounded-3xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur">
              <Screen name="requests" alt="NearShelf request feed" width={1600} height={2328} />
            </div>
            <div className="absolute -bottom-6 -left-8 flex items-center gap-3 rounded-2xl bg-ink/90 px-4 py-3 text-white shadow-2xl ring-1 ring-white/10">
              <LogoMark className="h-9 w-9" />
              <div className="text-sm">
                <p className="font-semibold">Patient waiting: Sertraline 50mg</p>
                <p className="text-xs text-brand-100/80">Hoxton Square Pharmacy · 0.3 mi</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">The problem</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance">
          Shortages turn your team into a call centre
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PAINS.map((pain) => (
            <Card key={pain.label} className="p-6">
              <p className="text-4xl font-semibold tracking-tight text-accent">{pain.stat}</p>
              <p className="mt-2 text-sm text-muted">{pain.label}</p>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Typical figures pharmacists describe; your mileage will vary.
        </p>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-surface/60">
        <div className="mx-auto grid max-w-5xl items-start gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
              How it works
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
              Move the prescription, not the medicine
            </h2>
            <p className="mt-3 text-muted">
              The legal way to help a patient during a shortage, made quick.
            </p>
            <ol className="mt-8 space-y-6">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 font-semibold text-white dark:bg-brand-600">
                    {i + 1}
                  </span>
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      <Icon name={step.icon} className="h-4 w-4 text-accent" />
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm text-muted">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <Screen
            name="search"
            alt="NearShelf search with map and verified stock"
            width={1600}
            height={3211}
          />
        </div>
      </section>

      {/* Your shelf, your rules */}
      <section className="mx-auto grid max-w-5xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <Screen
          name="pharmacy"
          alt="My pharmacy: stock levels and public listings"
          width={1600}
          height={1498}
        />
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
            Your shelf, your rules
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
            Honest stock, in seconds a day
          </h2>
          <ul className="mt-6 space-y-4 text-sm">
            {[
              ["Levels, not counts", "In stock / Low / Out. Competitors never see quantities."],
              [
                "Always fresh",
                "Anything not confirmed in 2 hours shows as Unverified. One tap re-confirms the lot.",
              ],
              [
                "Scan or import",
                "Scan packs with your USB scanner, or upload a stock report from ProScript Connect or Titan.",
              ],
              [
                "You choose what patients see",
                "List shortage items like HRT for local patients. Controlled drugs are never public.",
              ],
            ].map(([title, text]) => (
              <li key={title} className="flex gap-3">
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <span>
                  <strong className="font-semibold">{title}.</strong>{" "}
                  <span className="text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Works with your PMR */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <Card className="flex flex-col gap-6 p-8 sm:flex-row sm:items-center">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <Icon name="scan" className="h-7 w-7" />
          </span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">
              Works alongside ProScript Connect, Titan and other PMRs
            </h2>
            <p className="mt-1 text-sm text-muted">
              Nothing to install: NearShelf runs in a browser tab next to your PMR, with the same
              barcode scanner. Upload a CSV stock report to set your levels in one go. Direct PMR
              integration is on the roadmap.
            </p>
            <Link
              href="/install"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
            >
              Or install it as an app on your phone and dispensary PC
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      </section>

      {/* Security strip */}
      <section className="bg-logo text-white">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-3 sm:px-6">
          {[
            [
              "shield",
              "GPhC-verified staff only",
              "Every account is checked against the GPhC register and your NHS ODS code.",
            ],
            [
              "message",
              "No patient data",
              "Not stored, not sent. Enforced by the database, not just the app.",
            ],
            [
              "bolt",
              "Built for the counter",
              "Push alerts, one-tap answers, and a 30-minute hold.",
            ],
          ].map(([icon, title, text]) => (
            <div key={title}>
              <Icon name={icon as IconName} className="h-6 w-6 text-brand-200" />
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-brand-100/80">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">Questions pharmacists ask</h2>
        <div className="mt-8 space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-2xl border border-line bg-surface p-5 shadow-sm open:border-brand-300"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span className="rounded-full bg-surface-2 p-1 text-muted transition-transform group-open:rotate-90">
                  <Icon name="arrow" className="h-4 w-4" />
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-5xl px-4 pb-8 sm:px-6">
        <div className="bg-logo relative overflow-hidden rounded-3xl px-8 py-12 text-center text-white shadow-xl shadow-brand-950/20 sm:px-16">
          <LogoMark className="mx-auto h-14 w-14" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight">
            Be one of the first pharmacies on NearShelf
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100/85">
            Free during the pilot. Ask to join and we&apos;ll send you a private demo to try first.
            When you&apos;re ready, your team joins with their GPhC numbers and you&apos;re live.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={PILOT_HREF}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-brand-900 hover:bg-brand-50"
            >
              Join the free pilot
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
            <Link
              href="/find"
              className={`${button.secondary} border-white/30 bg-transparent px-6 py-3 text-white hover:bg-white/10`}
            >
              See the patient view
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
