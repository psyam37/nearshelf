import type { Metadata } from "next";
import { Suspense } from "react";
import { StockBadge } from "@/components/StockBadge";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { formatUpdatedAgo, isStale } from "@/lib/stock";
import { createClient } from "@/lib/supabase/server";
import { StockLevelForm } from "./StockLevelForm";

export const metadata: Metadata = {
  title: "My pharmacy · Pharmacy Stock Finder",
};

export default function MyPharmacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading your pharmacy…</p>}>
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

  if (error) throw error; // shown by Next.js's error page
  if (memberships.length === 0) return <NotLinkedYet user={user} />;

  return (
    <div className="space-y-12">
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

  return (
    <section>
      <p className="text-sm font-medium tracking-wide text-emerald-700 uppercase">
        My pharmacy · {role}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{pharmacy.name}</h1>
      <p className="text-sm text-zinc-500">
        {pharmacy.address_line}, {pharmacy.postcode}
      </p>

      <ul className="mt-6 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {medicines.data.map((medicine) => {
          const row = stockByMedicine.get(medicine.id);
          return (
            <li
              key={medicine.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">{medicine.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  {row ? (
                    <>
                      <StockBadge level={row.level} />
                      <span className={isStale(row.updated_at, now) ? "text-amber-700" : undefined}>
                        updated {formatUpdatedAgo(row.updated_at, now)}
                      </span>
                    </>
                  ) : (
                    "Not recorded yet"
                  )}
                  {medicine.is_controlled && <span>· Controlled drug</span>}
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
    <section className="max-w-prose">
      <h1 className="text-2xl font-semibold tracking-tight">My pharmacy</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        You&apos;re signed in as <strong>{user.email}</strong>, but your account isn&apos;t linked
        to a pharmacy yet. In a real launch, a pharmacy manager would invite you.
      </p>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        For the demo, run this in the Supabase SQL Editor to join{" "}
        <strong>Hoxton Square Pharmacy</strong>, then refresh this page:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-100 p-4 text-xs dark:bg-zinc-900">
        {sql}
      </pre>
    </section>
  );
}
