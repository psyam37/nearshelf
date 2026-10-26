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
