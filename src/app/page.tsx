import { Suspense } from "react";
import { connection } from "next/server";
import { StockBadge } from "@/components/StockBadge";
import { hasEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { STOCK_LEVELS } from "@/lib/types";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="text-sm font-medium tracking-wide text-emerald-700 uppercase">
          Baseline · Day 1
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Pharmacy Stock Finder
        </h1>
        <p className="mt-3 max-w-prose text-zinc-600 dark:text-zinc-400">
          Helps pharmacy teams see which nearby pharmacies have a medicine in stock, instead of
          phoning around. Shows availability levels, not exact counts, with when each was last
          confirmed.
        </p>
      </header>

      <section className="mb-8 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Setup check</h2>
        <Suspense fallback={<p className="mt-3 text-sm text-zinc-500">Checking database…</p>}>
          <SetupCheck />
        </Suspense>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Stock badges</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The component every search result will use (src/components/StockBadge.tsx).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {STOCK_LEVELS.map((level) => (
            <StockBadge key={level} level={level} />
          ))}
        </div>
      </section>
    </main>
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
