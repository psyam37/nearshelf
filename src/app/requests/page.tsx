import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { LiveRefresh } from "@/components/LiveRefresh";
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
      <h1 className="text-2xl font-semibold tracking-tight">Stock requests</h1>
      <Suspense fallback={<p className="mt-6 text-sm text-zinc-500">Loading requests…</p>}>
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
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Your account isn&apos;t linked to a pharmacy yet. See{" "}
        <Link href="/my-pharmacy" className="underline">
          My pharmacy
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <p className="mt-1 text-sm text-zinc-500">For {myPharmacy.name}</p>
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
    <div className="mt-8 space-y-10">
      <section>
        <h2 className="text-lg font-semibold">Waiting for your answer ({pending.length})</h2>
        {pending.length === 0 ? (
          <Empty>No one is waiting on you right now.</Empty>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {pending.map((r) => (
              <li key={r.id} className="space-y-3 p-4">
                <p>
                  <strong>{r.from.name}</strong> asks if you have <strong>{r.medicine.name}</strong>
                </p>
                {r.message && <p className="text-sm text-zinc-600">“{r.message}”</p>}
                <p className="text-xs text-zinc-500">{formatUpdatedAgo(r.created_at, now)}</p>
                <RespondButtons requestId={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">You asked</h2>
        {outgoing.data.length === 0 ? (
          <Empty>
            Use <strong>Ask to confirm</strong> on a{" "}
            <Link href="/search" className="underline">
              search
            </Link>{" "}
            result.
          </Empty>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {outgoing.data.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p>
                    <strong>{r.medicine.name}</strong> at {r.to.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    asked {formatUpdatedAgo(r.created_at, now)}
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
          <h2 className="text-lg font-semibold">You answered</h2>
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {answered.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 p-4 text-sm">
                <span>
                  {r.medicine.name} for {r.from.name}
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

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: "bg-zinc-100 text-zinc-700",
  confirmed: "bg-emerald-100 text-emerald-800",
  declined: "bg-rose-100 text-rose-800",
};
const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Waiting",
  confirmed: "They have it",
  declined: "They don't",
};

function StatusPill({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-sm text-zinc-500">{children}</p>;
}
