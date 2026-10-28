import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ApplicationsList } from "@/components/ApplicationsList";
import { StockBadge } from "@/components/StockBadge";
import { Card, Icon, ListSkeleton, PageHeader, Skeleton, button } from "@/components/ui";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { STOCK_LABELS, UNVERIFIED_AFTER_HOURS, formatUpdatedAgo, isVerified } from "@/lib/stock";
import { createClient } from "@/lib/supabase/server";
import type { StockLevel } from "@/lib/types";
import { PublicToggle } from "./PublicToggle";
import { ReconfirmAllButton } from "./ReconfirmAllButton";
import { StockImportCard } from "./StockImportCard";
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
  const [medicines, stock, stats] = await Promise.all([
    supabase.from("medicines").select("id, name, is_controlled").order("name"),
    supabase
      .from("stock_status")
      .select("medicine_id, level, updated_at")
      .eq("pharmacy_id", pharmacy.id),
    // What this pharmacy shows on the public finder, and how often it was seen.
    supabase.rpc("public_listing_stats", { p_pharmacy_id: pharmacy.id }),
  ]);
  if (medicines.error) throw medicines.error;
  if (stock.error) throw stock.error;
  if (stats.error) throw stats.error;
  const listed = new Set(stats.data.map((row) => row.medicine_id));
  const totalViews = stats.data.reduce((sum, row) => sum + row.views_30d, 0);

  // medicine id → its stock row, for quick lookups while rendering.
  const stockByMedicine = new Map(stock.data.map((row) => [row.medicine_id, row]));
  const now = new Date();

  // Counts for the summary tiles. "Available" = in stock or low: the reports
  // that lapse to Unverified after 2 hours.
  const available = stock.data.filter((r) => r.level !== "out_of_stock");
  const unverifiedCount = available.filter((r) => !isVerified(r.updated_at, now)).length;
  const verifiedCount = (level: StockLevel) =>
    stock.data.filter((r) => r.level === level && isVerified(r.updated_at, now)).length;

  const tiles = [
    { label: "In stock", value: verifiedCount("in_stock"), dot: "bg-emerald-500" },
    { label: "Low", value: verifiedCount("low"), dot: "bg-amber-500" },
    {
      label: "Out",
      value: stock.data.filter((r) => r.level === "out_of_stock").length,
      dot: "bg-rose-500",
    },
    { label: "Unverified", value: unverifiedCount, dot: "bg-silver-400" },
  ];

  return (
    <section>
      <PageHeader
        eyebrow={`My pharmacy · ${role}`}
        title={pharmacy.name}
        description={`${pharmacy.address_line}, ${pharmacy.postcode}`}
        actions={
          unverifiedCount > 0 ? (
            <ReconfirmAllButton pharmacyId={pharmacy.id} count={available.length} />
          ) : undefined
        }
      />

      {unverifiedCount > 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>{unverifiedCount}</strong>{" "}
          {unverifiedCount === 1 ? "medicine shows" : "medicines show"} as{" "}
          <strong>Unverified</strong> to other pharmacies: not confirmed in the last{" "}
          {UNVERIFIED_AFTER_HOURS} hours. Check the shelf, then confirm.
        </p>
      )}

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

      {role === "manager" && (
        <section className="mt-10">
          <h2 className="mb-1 text-lg font-semibold">Staff applications</h2>
          <p className="mb-3 text-sm text-muted">
            People asking to join {pharmacy.name}. Check each GPhC number before approving.
          </p>
          <Suspense fallback={<ListSkeleton rows={1} />}>
            <ApplicationsList pharmacyId={pharmacy.id} />
          </Suspense>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-1 text-lg font-semibold">Shown to patients</h2>
        <p className="mb-3 text-sm text-muted">
          Medicines you switch on below appear on the public{" "}
          <Link href="/find" className="font-medium text-accent underline">
            Find your medicine
          </Link>{" "}
          page, only while you&apos;ve confirmed them in the last {UNVERIFIED_AFTER_HOURS} hours.
          Controlled drugs are never shown.
        </p>
        <Card className="p-5">
          {stats.data.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing listed yet. Hard-to-find medicines (e.g. HRT) help patients most.
            </p>
          ) : (
            <>
              <p className="text-sm">
                Patients saw your listings{" "}
                <strong className="text-lg tabular-nums">{totalViews}</strong>{" "}
                {totalViews === 1 ? "time" : "times"} in the last 30 days.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {stats.data.map((row) => (
                  <li
                    key={row.medicine_id}
                    className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium"
                  >
                    {row.medicine_name}{" "}
                    <span className="text-muted tabular-nums">· {row.views_30d}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </section>

      <div className="mt-10">
        <StockImportCard pharmacyId={pharmacy.id} />
      </div>

      <h2 className="mt-10 mb-3 text-lg font-semibold">Stock levels</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        {medicines.data.map((medicine) => {
          const row = stockByMedicine.get(medicine.id);
          const unverified = row
            ? row.level !== "out_of_stock" && !isVerified(row.updated_at, now)
            : false;
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
                      <StockBadge level={row.level} verified={!unverified} />
                      <span
                        className={
                          unverified ? "font-medium text-amber-700 dark:text-amber-400" : ""
                        }
                      >
                        {unverified
                          ? `Said “${STOCK_LABELS[row.level]}” ${formatUpdatedAgo(row.updated_at, now)}`
                          : `Confirmed ${formatUpdatedAgo(row.updated_at, now)}`}
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
                <div className="mt-2">
                  <PublicToggle
                    pharmacyId={pharmacy.id}
                    medicineId={medicine.id}
                    listed={listed.has(medicine.id)}
                    controlled={medicine.is_controlled}
                  />
                </div>
              </div>
              <StockLevelForm
                pharmacyId={pharmacy.id}
                medicineId={medicine.id}
                medicineName={medicine.name}
                current={row?.level ?? null}
                unverified={unverified}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NotLinkedYet({ user }: { user: CurrentUser }) {
  return (
    <section className="max-w-xl">
      <PageHeader
        eyebrow="My pharmacy"
        title="You're not part of a pharmacy yet"
        description={
          <>
            You&apos;re signed in as <strong className="text-ink">{user.email}</strong>. To see and
            update stock, join your pharmacy with your GPhC number. A manager there verifies you.
          </>
        }
      />
      <Link href="/join" className={button.primary}>
        Join your pharmacy
        <Icon name="arrow" className="h-4 w-4" />
      </Link>
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
