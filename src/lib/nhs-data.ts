import "server-only";
// Public NHS data behind the Insights page:
// - NHSBSA Prescription Cost Analysis: items dispensed per month and ICB
//   (opendata.nhsbsa.net, Open Government Licence v3.0). Loaded into our own
//   database by an admin, because the full history takes ~70 queries.
// - Community Pharmacy England's price concessions: medicines pharmacies
//   can't buy at the Drug Tariff price this month, a strong shortage signal.
// - postcodes.io, for which ICB a pharmacy is in.
// Data from other services is "unknown" until zod has checked it.

import { cacheLife } from "next/cache";
import { z } from "zod";

const NHSBSA = "https://opendata.nhsbsa.net/api/3/action";
const PCA_DATASET = "prescription-cost-analysis-pca-monthly-data";

export interface PcaMonth {
  month: string; // first of the month, "2026-08-01"
  resource: string; // the NHSBSA table, "PCA_202608"
}

/** Every month the NHSBSA has published, oldest first. */
export async function listPcaMonths(): Promise<PcaMonth[]> {
  const res = await fetch(`${NHSBSA}/package_show?id=${PCA_DATASET}`);
  if (!res.ok) throw new Error(`NHSBSA catalogue returned ${res.status}`);
  const body = z
    .object({ result: z.object({ resources: z.array(z.object({ name: z.string() })) }) })
    .parse(await res.json());
  return body.result.resources
    .map((r) => /^PCA_(\d{4})(\d{2})$/.exec(r.name))
    .filter((m) => m !== null)
    .map(([resource, year, month]) => ({ resource, month: `${year}-${month}-01` }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

const pcaRowSchema = z.object({
  code: z.string(),
  icb: z.string(),
  items: z.coerce.number().int().nonnegative(),
});
export type PcaRow = z.infer<typeof pcaRowSchema>;

/**
 * Items dispensed in one month, per area, for the given BNF presentation
 * codes. Areas are ICBs from May 2022; older months use the STPs that came
 * before them, which count towards England but don't match an ICB.
 */
export async function fetchPcaMonth(resource: string, bnfCodes: string[]): Promise<PcaRow[]> {
  // Codes come from our own database, but check them anyway: they go into SQL.
  if (!/^PCA_\d{6}$/.test(resource) || !bnfCodes.every((c) => /^[0-9A-Z]{15}$/.test(c))) {
    throw new Error("Unexpected NHS code");
  }
  const areaColumn = resource < "PCA_202205" ? "STP_NAME" : "ICB_NAME";
  const sql =
    `SELECT GENERIC_BNF_EQUIVALENT_CODE AS code, ${areaColumn} AS icb, SUM(CAST(ITEMS AS INT64)) AS items ` +
    `FROM \`${resource}\` WHERE GENERIC_BNF_EQUIVALENT_CODE IN (${bnfCodes.map((c) => `'${c}'`).join(",")}) ` +
    "GROUP BY 1, 2";
  const url = `${NHSBSA}/datastore_search_sql?resource_id=${resource}&sql=${encodeURIComponent(sql)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NHSBSA returned ${res.status} for ${resource}`);
  // The records sit one level deeper than the CKAN docs suggest.
  const body = z
    .object({
      result: z.object({ result: z.object({ records: z.array(pcaRowSchema).optional() }) }),
    })
    .parse(await res.json());
  return body.result.result.records ?? [];
}

/** The pharmacy's ICB, e.g. "NHS North East London Integrated Care Board". */
export async function icbForPostcode(postcode: string): Promise<string | null> {
  "use cache";
  cacheLife("days");
  const res = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`,
  );
  if (!res.ok) return null;
  const parsed = z
    .object({ result: z.object({ icb: z.string().nullable() }) })
    .safeParse(await res.json());
  return parsed.success ? parsed.data.result.icb : null;
}

/* ----------------------------------------------------------- concessions */

export interface ConcessionList {
  month: string; // "October 2026"
  drugs: { name: string; pack: string; price: string }[];
}

export const CONCESSIONS_SOURCE =
  "https://cpe.org.uk/funding-and-reimbursement/reimbursement/price-concessions/";

const MONTH_NAME =
  /(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/g;

const cellText = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&pound;/g, "£")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * This month's and last month's price concessions, newest first. Read from
 * Community Pharmacy England's page: the first two tables with a "Drug"
 * header. Null if the page can't be read, so the rest of Insights still works.
 */
export async function latestConcessions(): Promise<ConcessionList[] | null> {
  "use cache";
  cacheLife("hours");
  try {
    const res = await fetch(CONCESSIONS_SOURCE, { headers: { "User-Agent": "MediBase/1.0" } });
    if (!res.ok) return null;
    const html = await res.text();

    const lists: ConcessionList[] = [];
    for (const table of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
      const rows = [...table[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((row) =>
        [...row[0].matchAll(/<td[\s\S]*?<\/td>/g)].map((cell) => cellText(cell[0])),
      );
      if (rows[0]?.[0] !== "Drug" || rows.length < 2) continue;
      // The month is the last one named in the text just before the table.
      const before = cellText(html.slice(Math.max(0, table.index - 800), table.index));
      const month = [...before.matchAll(MONTH_NAME)].at(-1)?.[0] ?? "";
      lists.push({
        month,
        drugs: rows
          .slice(1)
          .filter((r) => r.length >= 3 && r[0])
          .map(([name, pack, price]) => ({ name, pack, price })),
      });
      if (lists.length === 2) break;
    }
    return lists.length > 0 ? lists : null;
  } catch {
    return null;
  }
}

/** Does a concession line ("Amoxicillin 500mg capsules") mean this medicine? */
export function concessionMatches(concession: string, medicineName: string): boolean {
  const a = concession.toLowerCase();
  const b = medicineName.toLowerCase();
  return a.startsWith(b) || b.startsWith(a);
}

/* -------------------------------------------------------------- analysis */

export interface MonthPoint {
  month: string; // "2026-08-01"
  england: number;
  local: number | null;
}

const monthsBefore = (month: string, n: number) => {
  const d = new Date(`${month}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};

/** Percentage change from the same month a year earlier, or null. */
export function yearOnYear(
  points: MonthPoint[],
  latest: string,
  pick: (p: MonthPoint) => number | null,
): number | null {
  const now = points.find((p) => p.month === latest);
  const then = points.find((p) => p.month === monthsBefore(latest, 12));
  const a = now && pick(now);
  const b = then && pick(then);
  if (a == null || b == null || b === 0) return null;
  return ((a - b) / b) * 100;
}

/**
 * How the coming months usually compare with a typical month, from England's
 * history: for each full year, each month's items ÷ that year's monthly
 * average, averaged across years. Returns e.g. +24 for "usually 24% busier".
 */
export function seasonalOutlook(points: MonthPoint[], from: Date, months = 3): number | null {
  const byYear = new Map<number, Map<number, number>>();
  for (const p of points) {
    const [year, month] = p.month.split("-").map(Number);
    if (!byYear.has(year)) byYear.set(year, new Map());
    byYear.get(year)!.set(month, p.england);
  }
  const fullYears = [...byYear.values()].filter((m) => m.size === 12);
  if (fullYears.length < 2) return null;

  const index = (month: number) => {
    const ratios = fullYears.map((m) => {
      const avg = [...m.values()].reduce((s, v) => s + v, 0) / 12;
      return avg > 0 ? m.get(month)! / avg : 1;
    });
    return ratios.reduce((s, r) => s + r, 0) / ratios.length;
  };
  const coming = Array.from({ length: months }, (_, i) => ((from.getMonth() + 1 + i) % 12) + 1);
  return (coming.reduce((s, m) => s + index(m), 0) / months - 1) * 100;
}

/** "Nov–Jan" for the months seasonalOutlook looks at. */
export function comingMonthsLabel(from: Date, months = 3): string {
  const name = (offset: number) =>
    new Date(from.getFullYear(), from.getMonth() + offset, 1).toLocaleString("en-GB", {
      month: "short",
    });
  return `${name(1)}–${name(months)}`;
}

/** "August 2026" from "2026-08-01". */
export const formatMonth = (month: string) =>
  new Date(`${month}T00:00:00Z`).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
