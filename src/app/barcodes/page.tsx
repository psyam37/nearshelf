import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Ean13Barcode } from "@/components/Ean13Barcode";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Demo barcodes",
};

export default function BarcodesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Demo barcodes</h1>
      <p className="mt-2 max-w-prose text-zinc-600 dark:text-zinc-400">
        The demo medicines don&apos;t have real pack barcodes, so here are made-up ones (starting
        with 20, a range kept for in-store use). Show this page on another screen or print it, then
        scan one with the ▥ button on the search page.
      </p>
      <Suspense fallback={<p className="mt-6 text-sm text-zinc-500">Loading…</p>}>
        <BarcodeList />
      </Suspense>
    </main>
  );
}

async function BarcodeList() {
  await connection(); // read the database per request, not at build time
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medicine_barcodes")
    .select("gtin, medicine:medicines(name)")
    .order("gtin");
  if (error) throw error;

  return (
    <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {data.map(({ gtin, medicine }) => (
        <li
          key={gtin}
          className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800"
        >
          <p className="mb-2 text-sm font-medium text-zinc-900">{medicine.name}</p>
          <Ean13Barcode code={gtin} />
        </li>
      ))}
    </ul>
  );
}
