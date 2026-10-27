import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { HandoverChat } from "@/components/HandoverChat";
import { LiveRefresh } from "@/components/LiveRefresh";
import { NotificationToggle } from "@/components/NotificationToggle";
import { RedirectionSteps } from "@/components/RedirectionSteps";
import { ReserveCountdown } from "@/components/ReserveCountdown";
import { EmptyState, Icon, ListSkeleton, PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getMyPharmacy, type MyPharmacy } from "@/lib/pharmacy";
import { formatMiles, formatUpdatedAgo } from "@/lib/stock";
import { createClient } from "@/lib/supabase/server";
import { CloseBroadcastButton, CloseRequestButton } from "./CloseButtons";
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
          Your account isn&apos;t linked to a pharmacy yet.{" "}
          <Link href="/join" className="font-medium text-accent underline">
            Join your pharmacy
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
        description="Requests from pharmacies near you, and answers to yours. Everything updates live."
        actions={<NotificationToggle />}
      />
      {/* Two listeners, because a Realtime filter can only check one column. */}
      <LiveRefresh table="stock_requests" filter={`to_pharmacy_id=eq.${myPharmacy.id}`} />
      <LiveRefresh table="stock_requests" filter={`from_pharmacy_id=eq.${myPharmacy.id}`} />
      <RequestFeed pharmacy={myPharmacy} />
    </>
  );
}

// One row from outgoing_requests(), as generated from the database.
type Outgoing = Awaited<ReturnType<typeof loadFeeds>>["outgoing"][number];

async function loadFeeds(pharmacyId: string) {
  const supabase = await createClient();
  // Database functions do the joining, the distances, the lifecycle state
  // and the sorting (open first, then urgent, then nearest).
  const [incoming, outgoing] = await Promise.all([
    supabase.rpc("incoming_requests", { p_pharmacy_id: pharmacyId }),
    supabase.rpc("outgoing_requests", { p_pharmacy_id: pharmacyId }),
  ]);
  if (incoming.error) throw incoming.error;
  if (outgoing.error) throw outgoing.error;
  return { incoming: incoming.data, outgoing: outgoing.data };
}

async function RequestFeed({ pharmacy }: { pharmacy: MyPharmacy }) {
  const { incoming, outgoing } = await loadFeeds(pharmacy.id);
  const now = new Date();

  const open = incoming.filter((r) => r.state === "open");
  const holding = incoming.filter((r) => r.state === "held");
  const history = incoming.filter((r) => r.state !== "open" && r.state !== "held");

  // A broadcast is many rows with the same broadcast_id; a single "Ask to
  // confirm" is a group of one. Map keeps the newest first.
  const groups = new Map<string, Outgoing[]>();
  for (const r of outgoing) {
    const key = r.broadcast_id ?? r.id;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <div className="space-y-12">
      {/* ------------------------------------------------ Requests near you */}
      <section>
        <SectionTitle count={open.length}>Requests near you</SectionTitle>
        {open.length === 0 ? (
          <EmptyState icon="inbox">No open requests nearby right now.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {open.map((r) => (
              <li key={r.id}>
                {/* Tap to reveal the answer buttons, so a stray tap can't send one. */}
                <details className="group rounded-2xl border border-line bg-surface shadow-sm open:border-brand-300 open:ring-4 open:ring-brand-500/5">
                  <summary className="flex cursor-pointer list-none items-start gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        {r.urgency === "urgent" && <UrgentBadge />}
                        <span className="font-semibold">{r.medicine_name}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {[
                          [r.medicine_strength, r.medicine_form].filter(Boolean).join(" "),
                          packText(r),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="font-medium text-ink">{r.from_name}</span>
                        <span className="inline-flex items-center gap-1">
                          <Icon name="pin" className="h-3.5 w-3.5" />
                          {formatMiles(r.distance_m)}
                        </span>
                        <span>{formatUpdatedAgo(r.created_at, now)}</span>
                      </p>
                    </div>
                    <span className="mt-1 rounded-full bg-surface-2 p-1 text-muted transition-transform group-open:rotate-90">
                      <Icon name="arrow" className="h-4 w-4" />
                    </span>
                  </summary>
                  <div className="border-t border-line px-4 pt-3 pb-4 sm:px-5">
                    <RespondButtons requestId={r.id} />
                    <p className="mt-2 text-xs text-muted">
                      Confirming holds it for their patient for 30 minutes and opens a chat with{" "}
                      {r.from_name}.
                    </p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ----------------------------------------------------- You're holding */}
      {holding.length > 0 && (
        <section>
          <SectionTitle count={holding.length}>You&apos;re holding</SectionTitle>
          <ul className="space-y-3">
            {holding.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-brand-200 bg-surface p-5 shadow-sm dark:border-brand-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {r.medicine_name}
                      {packText(r) && (
                        <span className="font-normal text-muted"> · {packText(r)}</span>
                      )}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-accent">
                      <Icon name="clock" className="h-4 w-4" />
                      For {r.from_name}&apos;s patient ·{" "}
                      {r.reserved_until && <ReserveCountdown until={r.reserved_until} />}
                    </p>
                  </div>
                  <CloseRequestButton requestId={r.id} reason="dispensed">
                    Prescription downloaded
                  </CloseRequestButton>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Tap &ldquo;Prescription downloaded&rdquo; once you&apos;ve pulled it from the NHS
                  Spine. If it isn&apos;t, the hold ends by itself after 30 minutes.
                </p>
                <HandoverChat
                  requestId={r.id}
                  myPharmacyId={pharmacy.id}
                  otherPharmacyName={r.from_name}
                  reservedUntil={r.reserved_until}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------------------------------------------- Your requests */}
      <section>
        <SectionTitle>Your requests</SectionTitle>
        {groups.size === 0 ? (
          <EmptyState icon="message">
            Use <strong className="text-ink">Ask every pharmacy nearby</strong> on the{" "}
            <Link href="/search" className="font-medium text-accent underline">
              search
            </Link>{" "}
            page, and the answers show up here.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {[...groups.entries()].map(([key, rows]) => (
              <OutgoingGroup key={key} rows={rows} pharmacyId={pharmacy.id} now={now} />
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------------- History */}
      {history.length > 0 && (
        <section>
          <SectionTitle>Answered</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm sm:px-5"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{r.medicine_name}</span>{" "}
                  <span className="text-muted">
                    for {r.from_name} · {formatUpdatedAgo(r.created_at, now)}
                  </span>
                </span>
                <StatePill state={r.state} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function OutgoingGroup({
  rows,
  pharmacyId,
  now,
}: {
  rows: Outgoing[];
  pharmacyId: string;
  now: Date;
}) {
  const first = rows[0];
  const held = rows.filter((r) => r.state === "held");
  const count = (state: string) => rows.filter((r) => r.state === state).length;
  const stillOpen = rows.some((r) => r.state === "open" || r.state === "held");
  const isBroadcast = rows.length > 1 || first.broadcast_id !== null;

  return (
    <li className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {first.urgency === "urgent" && <UrgentBadge />}
            {first.medicine_name}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {[
              packText(first),
              isBroadcast
                ? `asked ${rows.length} ${rows.length === 1 ? "pharmacy" : "pharmacies"}`
                : `asked ${first.to_name}`,
              formatUpdatedAgo(first.created_at, now),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {isBroadcast ? (
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted">
            {count("held") + count("dispensed")} have it · {count("open")} waiting
          </span>
        ) : (
          <StatePill state={first.state} />
        )}
      </div>

      {/* Every pharmacy holding it: what to do next, and the chat. */}
      {held.map((r) => (
        <div key={r.id} className="mt-4">
          {isBroadcast && (
            <p className="flex items-center gap-2 text-sm font-semibold">
              <StatePill state="held" />
              {r.to_name} · {formatMiles(r.distance_m)}
            </p>
          )}
          <RedirectionSteps
            pharmacy={{
              name: r.to_name,
              address_line: r.to_address,
              postcode: r.to_postcode,
              phone: r.to_phone,
            }}
            reservedUntil={r.reserved_until}
          />
          <HandoverChat
            requestId={r.id}
            myPharmacyId={pharmacyId}
            otherPharmacyName={r.to_name}
            reservedUntil={r.reserved_until}
          />
        </div>
      ))}

      {/* Everyone else, compactly. */}
      {isBroadcast && rows.length > held.length && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {rows
            .filter((r) => r.state !== "held")
            .map((r) => (
              <li
                key={r.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs"
              >
                {r.to_name}
                <span className="text-muted">· {STATE_LABELS[r.state] ?? r.state}</span>
              </li>
            ))}
        </ul>
      )}

      {stillOpen && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-xs text-muted">
            Sorted it another way? Close it so nobody holds stock for nothing.
          </p>
          {first.broadcast_id ? (
            <CloseBroadcastButton broadcastId={first.broadcast_id} />
          ) : (
            <CloseRequestButton requestId={first.id} reason="cancelled">
              Close request
            </CloseRequestButton>
          )}
        </div>
      )}
    </li>
  );
}

/** "2 packs of 28", "1 pack", or "" when neither was given. */
function packText(r: { pack_size: number | null; quantity: number | null }): string {
  if (!r.quantity && !r.pack_size) return "";
  const packs = r.quantity ?? 1;
  return `${packs} ${packs === 1 ? "pack" : "packs"}${r.pack_size ? ` of ${r.pack_size}` : ""}`;
}

function UrgentBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-600/20 ring-inset dark:bg-rose-950 dark:text-rose-300">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" aria-hidden />
      Patient waiting
    </span>
  );
}

function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
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

const STATE_LABELS: Record<string, string> = {
  open: "waiting",
  held: "holding it",
  dispensed: "dispensed",
  declined: "not available",
  cancelled: "closed",
  expired: "expired",
};

const STATE_STYLES: Record<string, string> = {
  open: "bg-surface-2 text-muted ring-line",
  held: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300",
  dispensed: "bg-brand-50 text-brand-800 ring-brand-600/20 dark:bg-brand-950 dark:text-brand-200",
  declined: "bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-300",
  cancelled: "bg-surface-2 text-muted ring-line",
  expired: "bg-surface-2 text-muted ring-line",
};

function StatePill({ state }: { state: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${
        STATE_STYLES[state] ?? STATE_STYLES.open
      }`}
    >
      {STATE_LABELS[state] ?? state}
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
