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
export const broadcastSchema = z.object({
  medicineId: z.uuid(),
  radiusM: z.coerce.number().int().min(500).max(50_000),
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
export const joinSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  gphcNumber: z
    .string()
    .transform((s) => s.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{7}$/, "A GPhC registration number is 7 digits")),
  odsCode: z
    .string()
    .transform((s) => s.replace(/\s/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{3,10}$/, "Enter your pharmacy's ODS code, e.g. FA123")),
});
export type JoinInput = z.infer<typeof joinSchema>;
