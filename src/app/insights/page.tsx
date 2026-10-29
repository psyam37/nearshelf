import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { Sparkline } from "@/components/Sparkline";
import { Card, EmptyState, Icon, ListSkeleton, PageHeader, button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  CONCESSIONS_SOURCE,
  comingMonthsLabel,
  concessionMatches,
  formatMonth,
  icbForPostcode,
  latestConcessions,
  seasonalOutlook,
  yearOnYear,
  type ConcessionList,
  type MonthPoint,
} from "@/lib/nhs-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Insights",
  description: "Medicine demand and shortage signals around your pharmacy.",
};

export default function InsightsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <Insights />
      </Suspense>
    </main>
  );
}

// What pharmacy_insights() returns. Checked, like anything from outside TypeScript.
const ownSchema = z.object({
  asks_received: z.number(),
  unmet: z.number(),
  unmet_by_medicine: z.array(z.object({ medicine: z.string(), count: z.number() })),
  requests_received: z.number(),
  requests_answered: z.number(),
  confirmed_by_you: z.number(),
  avg_response_minutes: z.number().nullable(),
  network_avg_response_minutes: z.number().nullable(),
  stock_available: z.number(),
  stock_fresh: z.number(),
  referrals: z.array(
    z.object({
      at: z.string(),
      medicine: z.string(),
      direction: z.enum(["helped", "helped_you"]),
      other_pharmacy: z.string(),
    }),
  ),
});
type Own = z.infer<typeof ownSchema>;

const seriesSchema = z.array(
  z.object({
    medicine_id: z.string(),
    month: z.string(),
    england: z.number(),
    local: z.number().nullable(),
  }),
);

async function Insights() {
  await requireUser("/insights");
  const supabase = await createClient();

  const { data: membership, error } = await supabase
    .from("pharmacy_staff")
    .select("pharmacy:pharmacies(id, name, postcode)")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!membership) return <NotLinked />;
  const { pharmacy } = membership;

  const icb = await icbForPostcode(pharmacy.postcode);
  const [own, series, medicines, concessions] = await Promise.all([
    supabase.rpc("pharmacy_insights", { p_pharmacy_id: pharmacy.id }),
    supabase.rpc("nhs_dispensing_series", { p_icb_name: icb ?? "" }),
    supabase.from("medicines").select("id, name").order("name"),
    latestConcessions(),
  ]);
  if (own.error) throw own.error;
  if (series.error) throw series.error;
  if (medicines.error) throw medicines.error;

  // medicine id → its months, oldest first
  const byMedicine = new Map<string, MonthPoint[]>();
  for (const p of seriesSchema.parse(series.data)) {
    const list = byMedicine.get(p.medicine_id) ?? [];
    list.push({ month: p.month, england: p.england, local: p.local });
    byMedicine.set(p.medicine_id, list);
  }
  const area = icb ? icb.replace(/^NHS /, "").replace(/ Integrated Care Board$/, "") : null;

  return (
    <>
      <PageHeader
        eyebrow="Beta preview"
        title="Insights"
        description={`Demand and shortage signals around ${pharmacy.name}, from your NearShelf activity and public NHS data.`}
      />
      <div className="space-y-12">
        <YourPharmacy own={ownSchema.parse(own.data)} />
        {byMedicine.size === 0 ? (
          <Card className="p-6">
            <EmptyState icon="inbox">
              NHS data hasn&apos;t been loaded yet. A NearShelf admin can load it from Admin → NHS
              data for Insights.
            </EmptyState>
          </Card>
        ) : (
          <AreaDemand
            area={area}
            medicines={medicines.data}
            byMedicine={byMedicine}
            concessions={concessions}
          />
        )}
        <ShortageSignals medicines={medicines.data} concessions={concessions} />
        {byMedicine.size > 0 && (
          <SeasonalOutlook medicines={medicines.data} byMedicine={byMedicine} />
        )}
        <ComingNext />
        <p className="text-xs text-muted">
          Sources: NHSBSA Prescription Cost Analysis, items dispensed in the community, published
          about two months after each month ends (Open Government Licence v3.0); Community Pharmacy
          England price concessions; your NearShelf activity over the last 30 days.
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------- your pharmacy */

const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </Card>
  );
}

function YourPharmacy({ own }: { own: Own }) {
  return (
    <section>
      <SectionTitle eyebrow="Phase 1 · From NearShelf" title="Your pharmacy, last 30 days" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Unmet requests nearby"
          value={String(own.unmet)}
          detail={`of ${own.asks_received} requests that reached you; nobody had it`}
        />
        <Stat
          label="Your response time"
          value={own.avg_response_minutes === null ? "—" : `${own.avg_response_minutes} min`}
          detail={
            own.network_avg_response_minutes === null
              ? "No answers yet"
              : `NearShelf average ${own.network_avg_response_minutes} min`
          }
        />
        <Stat
          label="Requests answered"
          value={percent(own.requests_answered, own.requests_received)}
          detail={`${own.requests_answered} of ${own.requests_received}, ${own.confirmed_by_you} confirmed`}
        />
        <Stat
          label="Stock confirmed in last 2 h"
          value={percent(own.stock_fresh, own.stock_available)}
          detail={`${own.stock_fresh} of ${own.stock_available} items you have`}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold">Unmet demand nearby</h3>
          <p className="mt-1 text-sm text-muted">Asked for near you, and nobody had it.</p>
          {own.unmet_by_medicine.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nothing unmet in the last 30 days.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {own.unmet_by_medicine.map((row) => (
                <li key={row.medicine} className="flex justify-between gap-3 py-2">
                  <span>{row.medicine}</span>
                  <span className="font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold">Referral log</h3>
          <p className="mt-1 text-sm text-muted">Patients sent between you and other pharmacies.</p>
          {own.referrals.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No confirmed requests yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {own.referrals.map((r) => (
                <li key={`${r.at}-${r.medicine}`} className="flex justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium">{r.medicine}</span>
                    <span className="block text-xs text-muted">
                      {r.direction === "helped"
                        ? `You had it for ${r.other_pharmacy}`
                        : `${r.other_pharmacy} had it for you`}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {new Date(r.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- area demand */

// Rounded before the sign is chosen, so −0.3% shows as "0%", not "−0%".
const formatChange = (change: number | null) => {
  if (change === null) return "—";
  const rounded = Math.round(change);
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded)}%`;
};

function concessionFor(name: string, concessions: ConcessionList[] | null) {
  for (const [i, list] of (concessions ?? []).entries()) {
    const hit = list.drugs.find((d) => concessionMatches(d.name, name));
    if (hit) return { ...hit, month: list.month, current: i === 0 };
  }
  return null;
}

interface AreaDemandProps {
  area: string | null;
  medicines: { id: string; name: string }[];
  byMedicine: Map<string, MonthPoint[]>;
  concessions: ConcessionList[] | null;
}

function AreaDemand({ area, medicines, byMedicine, concessions }: AreaDemandProps) {
  const latest = [...byMedicine.values()]
    .flat()
    .reduce((max, p) => (p.month > max ? p.month : max), "");

  const rows = medicines
    .map((m) => {
      const points = byMedicine.get(m.id) ?? [];
      const recent = points.filter((p) => p.month <= latest).slice(-24);
      const localTrend = recent.every((p) => p.local !== null) && recent.length >= 12;
      return {
        ...m,
        localItems: points.find((p) => p.month === latest)?.local ?? null,
        localChange: yearOnYear(points, latest, (p) => p.local),
        englandChange: yearOnYear(points, latest, (p) => p.england),
        trend: recent.map((p) => (localTrend ? p.local! : p.england)),
        trendLabel: `${localTrend ? area : "England"}, ${formatMonth(recent[0]?.month ?? latest)} to ${formatMonth(latest)}`,
        concession: concessionFor(m.name, concessions),
      };
    })
    .filter((r) => r.trend.length > 0)
    // Fastest-growing in this area first: the trending scarcity list.
    .sort((a, b) => (b.localChange ?? -Infinity) - (a.localChange ?? -Infinity));

  return (
    <section>
      <SectionTitle
        eyebrow="Phase 1 · NHS open data"
        title={`Demand in ${area ?? "England"}`}
        description={`Items dispensed in ${formatMonth(latest)}, compared with a year earlier. Fastest-rising first.`}
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Medicine</th>
              <th className="px-4 py-3 text-right font-medium">Items, {area ?? "area"}</th>
              <th className="px-4 py-3 text-right font-medium">vs a year ago</th>
              <th className="px-4 py-3 text-right font-medium">England</th>
              <th className="px-4 py-3 font-medium">2-year trend</th>
              <th className="px-4 py-3 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {r.localItems?.toLocaleString("en-GB") ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                  {formatChange(r.localChange)}
                </td>
                <td className="px-4 py-2.5 text-right text-muted tabular-nums">
                  {formatChange(r.englandChange)}
                </td>
                <td className="px-4 py-1.5">
                  <Sparkline values={r.trend} label={`Items a month, ${r.trendLabel}`} />
                </td>
                <td className="px-4 py-2.5">
                  {r.concession && (
                    <span
                      title={`${r.concession.name}, pack of ${r.concession.pack}: ${r.concession.price}`}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                        r.concession.current
                          ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                          : "bg-surface-2 text-muted"
                      }`}
                    >
                      <Icon name="bolt" className="h-3 w-3" />
                      {r.concession.current ? "Price concession" : "Concession last month"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

/* ----------------------------------------------------- shortage signals */

function ShortageSignals({
  medicines,
  concessions,
}: {
  medicines: { id: string; name: string }[];
  concessions: ConcessionList[] | null;
}) {
  const [current] = concessions ?? [];
  const ours = medicines
    .map((m) => ({ name: m.name, concession: concessionFor(m.name, concessions) }))
    .filter((m) => m.concession !== null);

  return (
    <section>
      <SectionTitle
        eyebrow="Phase 1 · National signals"
        title="Shortage signals"
        description="Price concessions: medicines pharmacies can't buy at the NHS Drug Tariff price, usually because supply is short."
      />
      {!current ? (
        <Card className="p-5 text-sm text-muted">
          The price concessions list couldn&apos;t be read just now. It refreshes every few hours.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <Card className="p-5">
            <p className="text-sm text-muted">On price concession, {current.month}</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">{current.drugs.length}</p>
            <p className="mt-1 text-xs text-muted">medicines across England</p>
            <a
              href={CONCESSIONS_SOURCE}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
            >
              Full list from Community Pharmacy England
              <Icon name="arrow" className="h-4 w-4" />
            </a>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold">In the NearShelf catalogue</h3>
            {ours.length === 0 ? (
              <p className="mt-3 text-sm text-muted">None this month or last.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line text-sm">
                {ours.map(({ name, concession }) => (
                  <li key={name} className="flex justify-between gap-3 py-2">
                    <span>
                      <span className="font-medium">{name}</span>
                      <span className="block text-xs text-muted">
                        {concession!.month}, pack of {concession!.pack}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{concession!.price}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}

/* ----------------------------------------------------- seasonal outlook */

function SeasonalOutlook({
  medicines,
  byMedicine,
}: {
  medicines: { id: string; name: string }[];
  byMedicine: Map<string, MonthPoint[]>;
}) {
  const today = new Date();
  const outlook = medicines
    .map((m) => ({ name: m.name, change: seasonalOutlook(byMedicine.get(m.id) ?? [], today) }))
    .filter((m): m is { name: string; change: number } => m.change !== null && m.change > 0)
    .sort((a, b) => b.change - a.change);
  if (outlook.length === 0) return null;

  const rising = outlook.slice(0, 6);
  const biggest = Math.max(...rising.map((m) => Math.abs(m.change)), 1);

  return (
    <section>
      <SectionTitle
        eyebrow="Phase 2 preview · Seasonal"
        title={`What usually rises in ${comingMonthsLabel(today)}`}
        description="From England's dispensing since 2021: how these months compare with an average month for each medicine."
      />
      <Card className="p-5">
        <ul className="space-y-3">
          {rising.map((m) => (
            <li
              key={m.name}
              className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[16rem_minmax(0,1fr)_3.5rem]"
            >
              <span className="text-sm">{m.name}</span>
              <span className="order-last col-span-2 h-2.5 rounded-full bg-surface-2 sm:order-none sm:col-span-1">
                <span
                  className="block h-full rounded-full bg-brand-600"
                  style={{ width: `${(Math.max(m.change, 0) / biggest) * 100}%` }}
                />
              </span>
              <span className="text-right text-sm font-semibold tabular-nums">
                {formatChange(m.change)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

/* ---------------------------------------------------------- coming next */

function ComingNext() {
  return (
    <section>
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <Icon name="clock" className="h-6 w-6" />
        </span>
        <div className="flex-1">
          <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
            Phase 2 · Coming next
          </p>
          <h2 className="mt-1 font-semibold">
            Days of stock left, and stock that isn&apos;t moving
          </h2>
          <p className="mt-1 text-sm text-muted">
            Upload your PMR stock report regularly, and NearShelf will work out how fast each item
            goes, estimate the days left, and suggest reordering before local demand runs you out.
          </p>
        </div>
        <Link href="/my-pharmacy" className={button.secondary}>
          Upload a stock report
        </Link>
      </Card>
    </section>
  );
}

/* --------------------------------------------------------------- shared */

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
    </div>
  );
}

function NotLinked() {
  return (
    <Card className="p-6">
      <EmptyState icon="store">
        Insights are for pharmacy staff. Join your pharmacy from{" "}
        <Link href="/my-pharmacy" className="font-medium text-accent underline">
          My pharmacy
        </Link>{" "}
        first.
      </EmptyState>
    </Card>
  );
}
