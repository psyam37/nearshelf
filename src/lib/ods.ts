// NHS Organisation Data Service (ODS): the national directory of NHS
// organisation codes. Every community pharmacy has one (e.g. "FA076").
// The ORD API is public and needs no key.
import "server-only";
import { z } from "zod";

/** Upper-case letters and digits, as ODS codes are written. */
export const ODS_CODE_PATTERN = /^[A-Z0-9]{3,10}$/;

/** The ODS role id for "Pharmacy". */
const PHARMACY_ROLE = "RO182";

// Only the fields we use, checked: data from another service is untrusted.
const ordResponseSchema = z.object({
  Organisation: z.object({
    Name: z.string(),
    Status: z.string(),
    GeoLoc: z
      .object({ Location: z.object({ PostCode: z.string().optional() }).partial() })
      .optional(),
    Roles: z.object({ Role: z.array(z.object({ id: z.string() })) }),
  }),
});

export type NhsOdsLookup =
  | { found: true; name: string; postcode: string | null; active: boolean; isPharmacy: boolean }
  | { found: false };

/** Looks up a code in the NHS directory. Throws if the NHS service is unreachable. */
export async function lookupNhsOds(code: string): Promise<NhsOdsLookup> {
  const res = await fetch(
    `https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations/${encodeURIComponent(code)}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) },
  );
  if (res.status === 404) return { found: false };
  if (!res.ok) throw new Error(`NHS ODS lookup failed: ${res.status}`);

  const parsed = ordResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("NHS ODS returned something unexpected");
  const org = parsed.data.Organisation;
  return {
    found: true,
    name: org.Name,
    postcode: org.GeoLoc?.Location?.PostCode ?? null,
    active: org.Status === "Active",
    isPharmacy: org.Roles.Role.some((role) => role.id === PHARMACY_ROLE),
  };
}
