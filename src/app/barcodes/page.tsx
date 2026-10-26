import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Ean13Barcode } from "@/components/Ean13Barcode";
import { PageHeader, Skeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Demo barcodes",
};

export default function BarcodesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="For testing"
        title="Demo barcodes"
        description="The demo medicines don't have real pack barcodes, so here are made-up ones (starting with 20, a range kept for in-store use). Show this page on another screen or print it, then use Scan on the search page."
      />
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        }
      >
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
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map(({ gtin, medicine }) => (
        <li key={gtin} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <p className="mb-2 text-sm font-medium text-zinc-900">{medicine.name}</p>
          <Ean13Barcode code={gtin} />
        </li>
      ))}
    </ul>
  );
}
