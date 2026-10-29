import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { StockBadge } from "@/components/StockBadge";
import { Card, Icon, LogoMark, button, type IconName } from "@/components/ui";
import { hasEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { StockLevel } from "@/lib/types";

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "bolt",
    title: "Live stock levels",
    text: "In stock, low or out, updated by each pharmacy and pushed to every screen the moment it changes.",
  },
  {
    icon: "message",
    title: "Ask to confirm",
    text: "One tap sends “Do you have this?” to another pharmacy. Their answer appears for you live.",
  },
  {
    icon: "scan",
    title: "Scan any pack",
    text: "Use the camera or your counter’s USB scanner. Barcodes and the square codes on UK packs both work.",
  },
  {
    icon: "shield",
    title: "Secure by design",
    text: "Staff can only change their own pharmacy’s stock. The database enforces it, not just the app.",
  },
];

const STEPS = [
  { title: "Find the medicine", text: "Type a name or scan the pack." },
  { title: "See who has it nearby", text: "Best stock first, then nearest, on a map and a list." },
  { title: "Ask them to confirm", text: "Get a yes or no before you send the patient over." },
];

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* A soft green glow behind the hero. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[480px] max-w-4xl rounded-full bg-brand-300/25 blur-3xl dark:bg-brand-800/30"
        />
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-accent shadow-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live stock across local pharmacies
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[56px] lg:leading-[1.05]">
              Find the medicine. <span className="text-silver">Skip the phone calls.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted">
              When a prescription can’t be filled, NearShelf shows which pharmacies nearby have it
              in stock, and lets you ask them to confirm in one tap.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/search" className={`${button.primary} px-5 py-3 text-base`}>
                Pharmacy staff
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <Link href="/find" className={`${button.secondary} px-5 py-3 text-base`}>
                <Icon name="search" className="h-4 w-4" />
                I&apos;m a patient
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {["Levels, not exact counts", "Shows when each was checked", "Built on NHS dm+d"].map(
                (point) => (
                  <li key={point} className="flex items-center gap-1.5">
                    <Icon name="check" className="h-4 w-4 text-accent" />
                    {point}
                  </li>
                ),
              )}
            </ul>
          </div>

          <ProductPreview />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Everything a pharmacy team needs, nothing it doesn’t
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="p-6">
              <span className="inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-700 ring-1 ring-brand-700/10 dark:bg-brand-950 dark:text-brand-300">
                <Icon name={feature.icon} />
              </span>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="bg-logo overflow-hidden rounded-3xl p-8 text-white shadow-xl shadow-brand-950/20 sm:p-12">
          <p className="text-xs font-semibold tracking-[0.14em] text-brand-200 uppercase">
            How it works
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            From “we’re out” to “they have it” in under a minute
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl bg-white/[0.07] p-5 ring-1 ring-white/10">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-brand-900">
                  {i + 1}
                </span>
                <p className="mt-4 font-semibold">{step.title}</p>
                <p className="mt-1 text-sm text-brand-100/80">{step.text}</p>
              </li>
            ))}
          </ol>
          <Link
            href="/search"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-50"
          >
            Try it now
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {process.env.NODE_ENV === "development" && (
        <section className="mx-auto max-w-5xl px-4 sm:px-6">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Setup check (only shown in development)</h2>
            <Suspense fallback={<p className="mt-3 text-sm text-muted">Checking database…</p>}>
              <SetupCheck />
            </Suspense>
          </Card>
        </section>
      )}
    </main>
  );
}

/** A static picture of a search result, so visitors see the product at a glance. */
function ProductPreview() {
  const rows: { name: string; distance: string; level: StockLevel; updated: string }[] = [
    { name: "Hoxton Square Pharmacy", distance: "195 m", level: "in_stock", updated: "8 min ago" },
    { name: "Shoreditch Health", distance: "354 m", level: "in_stock", updated: "1 h ago" },
    { name: "Old Street Chemist", distance: "535 m", level: "low", updated: "3 h ago" },
    { name: "Angel Late Pharmacy", distance: "1.9 km", level: "out_of_stock", updated: "5 h ago" },
  ];

  return (
    <div className="bg-logo relative rounded-[28px] p-4 shadow-2xl shadow-brand-950/25 sm:p-6">
      <div className="absolute -top-4 -right-3 hidden rotate-6 sm:block">
        <LogoMark className="h-14 w-14 drop-shadow-xl" />
      </div>
      <div className="rounded-2xl bg-white p-4 text-zinc-900 shadow-lg dark:bg-surface dark:text-ink">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm">
          <Icon name="search" className="h-4 w-4 text-muted" />
          <span className="font-medium">Sertraline 50mg tablets</span>
          <span className="ml-auto rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
            near N1
          </span>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {rows.map((row) => (
            <li key={row.name} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{row.name}</p>
                <p className="text-xs text-muted">
                  {row.distance} · updated {row.updated}
                </p>
              </div>
              <StockBadge level={row.level} />
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-xs dark:bg-brand-950">
          <span className="font-medium text-brand-800 dark:text-brand-200">
            Old Street Chemist confirmed: they have it
          </span>
          <Icon name="check" className="h-4 w-4 text-brand-700 dark:text-brand-300" />
        </div>
      </div>
    </div>
  );
}

async function SetupCheck() {
  await connection(); // render at request time, not at build time

  if (!hasEnv()) {
    return (
      <CheckList
        items={[{ ok: false, text: "Supabase settings missing: copy .env.example to .env.local" }]}
      />
    );
  }

  const supabase = await createClient();
  const [pharmacies, medicines] = await Promise.all([
    supabase.from("pharmacies").select("*", { count: "exact", head: true }),
    supabase.from("medicines").select("*", { count: "exact", head: true }),
  ]);

  const dbError = pharmacies.error ?? medicines.error;
  // A head request has no response body, so a missing table can come back as
  // `count: null` with no error. Treat that as "tables not created yet".
  const tablesMissing = pharmacies.count === null || medicines.count === null;

  return (
    <CheckList
      items={[
        { ok: true, text: "Supabase settings found" },
        dbError
          ? { ok: false, text: `Database error: ${dbError.message}` }
          : tablesMissing
            ? {
                ok: false,
                text: "Tables not found: run the migration and seed.sql in the Supabase SQL Editor",
              }
            : {
                ok: true,
                text: `Database connected: ${pharmacies.count} pharmacies, ${medicines.count} medicines`,
              },
      ]}
    />
  );
}

function CheckList({ items }: { items: { ok: boolean; text: string }[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.text} className="flex items-start gap-2">
          <span aria-hidden className={item.ok ? "text-emerald-600" : "text-rose-600"}>
            {item.ok ? "✓" : "✗"}
          </span>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
