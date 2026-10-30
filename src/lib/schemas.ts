// Zod schemas: validate anything coming from the user or the URL before it
// reaches the database. `z.infer` turns each schema into a TypeScript type,
// so validation and types never drift apart.
import { z } from "zod";
import { STOCK_LEVELS } from "./types";

export const medicineSearchSchema = z.object({
  q: z.string().trim().min(2, "Type at least 2 characters").max(100),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type MedicineSearchInput = z.infer<typeof medicineSearchSchema>;

export const nearbyStockSchema = z.object({
  medicineId: z.uuid(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().int().min(100).max(50_000).default(5_000),
  // Not z.coerce.boolean(): that turns the string "false" into true.
  includeEquivalents: z.stringbool().default(false),
});
export type NearbyStockInput = z.infer<typeof nearbyStockSchema>;

export const stockUpdateSchema = z.object({
  pharmacyId: z.uuid(),
  medicineId: z.uuid(),
  level: z.enum(STOCK_LEVELS),
});
export type StockUpdateInput = z.infer<typeof stockUpdateSchema>;

export const stockRequestSchema = z.object({
  fromPharmacyId: z.uuid(),
  toPharmacyId: z.uuid(),
  medicineId: z.uuid(),
  message: z.string().trim().max(500).optional(),
});
export type StockRequestInput = z.infer<typeof stockRequestSchema>;

export const signInSchema = z.object({
  // Tidy first, then check: z.email().trim() would reject " me@example.com".
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  next: z.string().optional(),
});
export type SignInInput = z.infer<typeof signInSchema>;

// "Who nearby has this?" sent to every pharmacy within the radius. Only
// inventory details: never anything about the patient (GDPR special category).
export const BROADCAST_RADIUS_MILES = [2, 5, 10] as const;
export const METRES_PER_MILE = 1609.344;

export const broadcastSchema = z.object({
  medicineId: z.uuid(),
  // One of the offered radii, in miles (UK pharmacies think in miles).
  radiusMiles: z.coerce
    .number()
    .refine((m) => (BROADCAST_RADIUS_MILES as readonly number[]).includes(m), "Pick a radius"),
  urgency: z.enum(["urgent", "routine"]).default("routine"),
  // Units per pack, e.g. 28 tablets. Empty means "any pack size".
  packSize: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(1).max(1000).optional(),
  ),
  quantity: z.coerce.number().int().min(1, "At least 1 pack").max(100).default(1),
});
export type BroadcastInput = z.infer<typeof broadcastSchema>;

// Applying to join a pharmacy. Spaces are removed and letters upper-cased
// first, so "fa 076" and "123 4567" are accepted as typed.
const fullName = z.string().trim().min(2, "Enter your full name").max(100);
const gphcNumber = z
  .string()
  .transform((s) => s.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{7}$/, "A GPhC registration number is 7 digits"));
const odsCode = (example: string) =>
  z
    .string()
    .transform((s) => s.replace(/\s/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{3,10}$/, `Enter the ODS code, e.g. ${example}`));

export const joinSchema = z.object({ fullName, gphcNumber, odsCode: odsCode("FA123") });
export type JoinInput = z.infer<typeof joinSchema>;

// Pharmacists outside community pharmacy: at a GP practice (checked against
// the NHS directory), or anywhere else, e.g. a locum, in their own words.
export const clinicianJoinSchema = z.discriminatedUnion("setting", [
  z.object({ setting: z.literal("gp_practice"), fullName, gphcNumber, odsCode: odsCode("C84023") }),
  z.object({
    setting: z.literal("other"),
    fullName,
    gphcNumber,
    workplace: z.string().trim().min(2, "Tell us where you work").max(120),
    postcode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/, "Enter a UK postcode, e.g. NG1 5FS"),
  }),
]);
export type ClinicianJoinInput = z.infer<typeof clinicianJoinSchema>;

// The public finder (no sign-in). Same miles as broadcasts.
export const publicFindSchema = z.object({
  medicineId: z.uuid(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMiles: z.coerce
    .number()
    .refine((m) => (BROADCAST_RADIUS_MILES as readonly number[]).includes(m), "Pick a radius")
    .default(5),
});
export type PublicFindInput = z.infer<typeof publicFindSchema>;
