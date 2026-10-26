import type { Metadata } from "next";
import { Suspense } from "react";
import { StockBadge } from "@/components/StockBadge";
import { Card, ListSkeleton, PageHeader, Skeleton } from "@/components/ui";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { formatUpdatedAgo, isStale } from "@/lib/stock";
import { createClient } from "@/lib/supabase/server";
import type { StockLevel } from "@/lib/types";
import { StockLevelForm } from "./StockLevelForm";

export const metadata: Metadata = {
  title: "My pharmacy",
};

export default function MyPharmacyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <Suspense fallback={<MyPharmacySkeleton />}>
        <MyPharmacy />
      </Suspense>
    </main>
  );
}

async function MyPharmacy() {
  const user = await requireUser("/my-pharmacy");
  const supabase = await createClient();

  // Row level security only returns the signed-in user's own memberships.
  // `pharmacies(...)` follows the pharmacy_id link, like a SQL join, and the
  // generated types know the shape of the result.
  const { data: memberships, error } = await supabase
    .from("pharmacy_staff")
    .select("role, pharmacy:pharmacies(id, name, address_line, postcode)");

  if (error) throw error; // shown by the error page
  if (memberships.length === 0) return <NotLinkedYet user={user} />;

  return (
    <div className="space-y-16">
      {memberships.map(({ role, pharmacy }) => (
        <PharmacyStock key={pharmacy.id} pharmacy={pharmacy} role={role} />
      ))}
    </div>
  );
}

interface PharmacyStockProps {
  pharmacy: { id: string; name: string; address_line: string; postcode: string };
  role: string;
}

async function PharmacyStock({ pharmacy, role }: PharmacyStockProps) {
  const supabase = await createClient();
  const [medicines, stock] = await Promise.all([
    supabase.from("medicines").select("id, name, is_controlled").order("name"),
    supabase
      .from("stock_status")
      .select("medicine_id, level, updated_at")
      .eq("pharmacy_id", pharmacy.id),
  ]);
  if (medicines.error) throw medicines.error;
  if (stock.error) throw stock.error;

  // medicine id → its stock row, for quick lookups while rendering.
  const stockByMedicine = new Map(stock.data.map((row) => [row.medicine_id, row]));
  const now = new Date();

  // Counts for the summary tiles.
  const countOf = (level: StockLevel) => stock.data.filter((r) => r.level === level).length;
  const needsUpdate =
    medicines.data.length - stock.data.filter((r) => !isStale(r.updated_at, now)).length;

  const tiles = [
    { label: "In stock", value: countOf("in_stock"), dot: "bg-emerald-500" },
    { label: "Low", value: countOf("low"), dot: "bg-amber-500" },
    { label: "Out", value: countOf("out_of_stock"), dot: "bg-rose-500" },
    { label: "Need an update", value: needsUpdate, dot: "bg-silver-400" },
  ];

  return (
    <section>
      <PageHeader
        eyebrow={`My pharmacy · ${role}`}
        title={pharmacy.name}
        description={`${pharmacy.address_line}, ${pharmacy.postcode}`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="flex items-center gap-2 text-xs font-medium text-muted">
              <span aria-hidden className={`h-2 w-2 rounded-full ${tile.dot}`} />
              {tile.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-lg font-semibold">Stock levels</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        {medicines.data.map((medicine) => {
          const row = stockByMedicine.get(medicine.id);
          const stale = row ? isStale(row.updated_at, now) : false;
          return (
            <li
              key={medicine.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="min-w-0">
                <p className="font-semibold">{medicine.name}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {row ? (
                    <>
                      <StockBadge level={row.level} />
                      <span
                        className={stale ? "font-medium text-amber-700 dark:text-amber-400" : ""}
                      >
                        {stale ? "Needs an update · " : ""}updated{" "}
                        {formatUpdatedAgo(row.updated_at, now)}
                      </span>
                    </>
                  ) : (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium">
                      Not recorded yet
                    </span>
                  )}
                  {medicine.is_controlled && (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                      Controlled drug
                    </span>
                  )}
                </p>
              </div>
              <StockLevelForm
                pharmacyId={pharmacy.id}
                medicineId={medicine.id}
                medicineName={medicine.name}
                current={row?.level ?? null}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NotLinkedYet({ user }: { user: CurrentUser }) {
  const sql = `insert into public.pharmacy_staff (user_id, pharmacy_id, role)
select '${user.id}', id, 'manager'
from public.pharmacies where ods_code = 'DEMO01';`;

  return (
    <section className="max-w-2xl">
      <PageHeader
        eyebrow="My pharmacy"
        title="You're not linked to a pharmacy yet"
        description={
          <>
            You&apos;re signed in as <strong className="text-ink">{user.email}</strong>. In a real
            launch, a pharmacy manager would invite you.
          </>
        }
      />
      <Card className="p-5">
        <p className="text-sm text-muted">
          For the demo, run this in the Supabase SQL Editor to join{" "}
          <strong className="text-ink">Hoxton Square Pharmacy</strong>, then refresh this page:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-surface-2 p-4 text-xs">{sql}</pre>
      </Card>
    </section>
  );
}

function MyPharmacySkeleton() {
  return (
    <div>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-3 h-8 w-72" />
      <Skeleton className="mt-3 mb-8 h-4 w-56" />
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}
