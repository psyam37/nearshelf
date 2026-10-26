import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/LiveRefresh";
import { EmptyState, Icon, ListSkeleton, PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getMyPharmacy, type MyPharmacy } from "@/lib/pharmacy";
import { formatUpdatedAgo } from "@/lib/stock";
import { createClient } from "@/lib/supabase/server";
import type { RequestStatus } from "@/lib/types";
import { RespondButtons } from "./RespondButtons";

export const metadata: Metadata = {
  title: "Requests",
};

export default function RequestsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <Suspense fallback={<RequestsSkeleton />}>
        <Requests />
      </Suspense>
    </main>
  );
}

async function Requests() {
  await requireUser("/requests");
  const myPharmacy = await getMyPharmacy();
  if (!myPharmacy) {
    return (
      <>
        <PageHeader eyebrow="Requests" title="Stock requests" />
        <EmptyState icon="store">
          Your account isn&apos;t linked to a pharmacy yet. See{" "}
          <Link href="/my-pharmacy" className="font-medium text-accent underline">
            My pharmacy
          </Link>
          .
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={myPharmacy.name}
        title="Stock requests"
        description="Pharmacies asking whether you have a medicine, and the answers to what you asked. Updates live."
      />
      {/* Two listeners, because a Realtime filter can only check one column. */}
      <LiveRefresh table="stock_requests" filter={`to_pharmacy_id=eq.${myPharmacy.id}`} />
      <LiveRefresh table="stock_requests" filter={`from_pharmacy_id=eq.${myPharmacy.id}`} />
      <RequestLists pharmacy={myPharmacy} />
    </>
  );
}

async function RequestLists({ pharmacy }: { pharmacy: MyPharmacy }) {
  const supabase = await createClient();
  // Two links point from stock_requests to pharmacies (from and to), so each
  // join names the foreign key it follows.
  const columns = `id, status, message, created_at, responded_at,
    medicine:medicines(name),
    from:pharmacies!stock_requests_from_pharmacy_id_fkey(name),
    to:pharmacies!stock_requests_to_pharmacy_id_fkey(name)`;

  const [incoming, outgoing] = await Promise.all([
    supabase
      .from("stock_requests")
      .select(columns)
      .eq("to_pharmacy_id", pharmacy.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("stock_requests")
      .select(columns)
      .eq("from_pharmacy_id", pharmacy.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (incoming.error) throw incoming.error;
  if (outgoing.error) throw outgoing.error;

  const now = new Date();
  const pending = incoming.data.filter((r) => r.status === "pending");
  const answered = incoming.data.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle count={pending.length}>Waiting for your answer</SectionTitle>
        {pending.length === 0 ? (
          <EmptyState icon="inbox">No one is waiting on you right now.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-brand-200 bg-surface p-5 shadow-sm ring-4 ring-brand-500/5 dark:border-brand-800"
              >
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-brand-50 p-2 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    <Icon name="message" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p>
                      <strong>{r.from.name}</strong> asks if you have{" "}
                      <strong>{r.medicine.name}</strong>
                    </p>
                    {r.message && <p className="mt-1 text-sm text-muted">“{r.message}”</p>}
                    <p className="mt-1 text-xs text-muted">{formatUpdatedAgo(r.created_at, now)}</p>
                    <div className="mt-4">
                      <RespondButtons requestId={r.id} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>You asked</SectionTitle>
        {outgoing.data.length === 0 ? (
          <EmptyState icon="message">
            Use <strong className="text-ink">Ask to confirm</strong> on a{" "}
            <Link href="/search" className="font-medium text-accent underline">
              search
            </Link>{" "}
            result, and the answer shows up here.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {outgoing.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 p-4 sm:px-5">
                <div className="min-w-0">
                  <p className="font-semibold">{r.medicine.name}</p>
                  <p className="text-sm text-muted">
                    at {r.to.name} · asked {formatUpdatedAgo(r.created_at, now)}
                    {r.responded_at && ` · answered ${formatUpdatedAgo(r.responded_at, now)}`}
                  </p>
                </div>
                <StatusPill status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {answered.length > 0 && (
        <section>
          <SectionTitle>You answered</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {answered.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 p-4 text-sm sm:px-5"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{r.medicine.name}</span>{" "}
                  <span className="text-muted">for {r.from.name}</span>
                </span>
                <StatusPill status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ children, count }: { children: string; count?: number }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
      {children}
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-rose-600 px-2 text-xs leading-5 font-bold text-white">
          {count}
        </span>
      )}
    </h2>
  );
}

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: "bg-surface-2 text-muted ring-line",
  confirmed:
    "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300",
  declined: "bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-300",
};
const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Waiting",
  confirmed: "They have it",
  declined: "They don't",
};

function StatusPill({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function RequestsSkeleton() {
  return (
    <div>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3 mb-10 h-8 w-64" />
      <ListSkeleton rows={3} />
    </div>
  );
}
