"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { stockUpdateSchema } from "@/lib/schemas";
import { readStockReport } from "@/lib/stock-import";
import { createClient } from "@/lib/supabase/server";
import type { StockLevel } from "@/lib/types";

export type StockUpdateState =
  | { status: "idle" }
  | { status: "saved"; level: StockLevel }
  | { status: "reconfirmed"; count: number }
  | { status: "error"; message: string };

const NOT_YOUR_PHARMACY = "You can only update stock for a pharmacy you work at.";

export async function updateStockLevel(
  _prev: StockUpdateState,
  formData: FormData,
): Promise<StockUpdateState> {
  // Check again here: anyone can call a Server Action directly, not just
  // through our page, so the page having checked earlier proves nothing.
  if (!(await getCurrentUser())) {
    return { status: "error", message: "Your session has ended. Sign in again." };
  }

  const parsed = stockUpdateSchema.safeParse({
    pharmacyId: formData.get("pharmacyId"),
    medicineId: formData.get("medicineId"),
    level: formData.get("level"),
  });
  if (!parsed.success) return { status: "error", message: "That update wasn't valid." };
  const { pharmacyId, medicineId, level } = parsed.data;

  // We don't check here which pharmacy the user works at: row level security
  // in the database does, so the rule holds even if this code has a bug.
  // `upsert` = update the row if it exists, insert it if not.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_status")
    .upsert(
      { pharmacy_id: pharmacyId, medicine_id: medicineId, level },
      { onConflict: "pharmacy_id,medicine_id" },
    )
    .select("level");

  if (error) {
    // 42501 is Postgres for "row level security said no".
    if (error.code === "42501") return { status: "error", message: NOT_YOUR_PHARMACY };
    console.error("stock update failed:", error);
    return { status: "error", message: "Couldn't save. Try again." };
  }
  // An update the rules filter out changes 0 rows without an error.
  if (!data || data.length === 0) return { status: "error", message: NOT_YOUR_PHARMACY };

  refresh(); // re-render the page so "updated just now" shows
  return { status: "saved", level };
}

const reconfirmSchema = z.object({ pharmacyId: z.uuid() });

/**
 * "Still in stock": re-confirms every in-stock and low row for a pharmacy,
 * resetting their 2-hour verification. Out-of-stock rows are left alone.
 */
export async function reconfirmAllStock(
  _prev: StockUpdateState,
  formData: FormData,
): Promise<StockUpdateState> {
  if (!(await getCurrentUser())) {
    return { status: "error", message: "Your session has ended. Sign in again." };
  }
  const parsed = reconfirmSchema.safeParse({ pharmacyId: formData.get("pharmacyId") });
  if (!parsed.success) return { status: "error", message: "That update wasn't valid." };

  // Row level security limits this to the user's own pharmacy.
  const supabase = await createClient();
  const { data: count, error } = await supabase.rpc("reconfirm_stock", {
    p_pharmacy_id: parsed.data.pharmacyId,
  });
  if (error) {
    console.error("reconfirm failed:", error);
    return { status: "error", message: "Couldn't save. Try again." };
  }
  // 0 = nothing in stock to confirm (or, via row level security, not yours).
  if (!count) return { status: "error", message: "Nothing was updated." };

  refresh();
  return { status: "reconfirmed", count };
}

export type ListingState = { status: "idle" } | { status: "error"; message: string };

const listingSchema = z.object({
  pharmacyId: z.uuid(),
  medicineId: z.uuid(),
  listed: z.stringbool(),
});

/** Show (or stop showing) a medicine on the public finder. */
export async function setPublicListing(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  if (!(await getCurrentUser())) {
    return { status: "error", message: "Your session has ended. Sign in again." };
  }
  const parsed = listingSchema.safeParse({
    pharmacyId: formData.get("pharmacyId"),
    medicineId: formData.get("medicineId"),
    listed: formData.get("listed"),
  });
  if (!parsed.success) return { status: "error", message: "That wasn't valid." };
  const { pharmacyId, medicineId, listed } = parsed.data;

  // Row level security: only your pharmacy, and never controlled drugs.
  const supabase = await createClient();
  const { error } = listed
    ? await supabase
        .from("public_listings")
        .upsert(
          { pharmacy_id: pharmacyId, medicine_id: medicineId },
          { onConflict: "pharmacy_id,medicine_id", ignoreDuplicates: true },
        )
    : await supabase
        .from("public_listings")
        .delete()
        .eq("pharmacy_id", pharmacyId)
        .eq("medicine_id", medicineId);

  if (error) {
    if (error.code === "42501") {
      return { status: "error", message: "Controlled drugs can't be shown publicly." };
    }
    console.error("listing failed:", error);
    return { status: "error", message: "Couldn't save. Try again." };
  }
  refresh();
  return { status: "idle" };
}

const sharingSchema = z.object({
  pharmacyId: z.uuid(),
  shared: z.stringbool(),
});

/** Let approved GP practice and locum pharmacists see this pharmacy's stock, or not. */
export async function setClinicianSharing(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  if (!(await getCurrentUser())) {
    return { status: "error", message: "Your session has ended. Sign in again." };
  }
  const parsed = sharingSchema.safeParse({
    pharmacyId: formData.get("pharmacyId"),
    shared: formData.get("shared"),
  });
  if (!parsed.success) return { status: "error", message: "That wasn't valid." };

  // The database function checks that you work at this pharmacy.
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_clinician_sharing", {
    p_pharmacy_id: parsed.data.pharmacyId,
    p_share: parsed.data.shared,
  });
  if (error) {
    if (error.code !== "42501") console.error("sharing change failed:", error);
    return {
      status: "error",
      message: error.code === "42501" ? NOT_YOUR_PHARMACY : "Couldn't save. Try again.",
    };
  }
  refresh();
  return { status: "idle" };
}

export type ImportState =
  | { status: "idle" }
  | { status: "imported"; updated: number; total: number; unmatched: string[] }
  | { status: "error"; message: string };

const importSchema = z.object({
  pharmacyId: z.uuid(),
  lowAt: z.coerce.number().int().min(0).max(1000).default(3),
  file: z
    .instanceof(File, { message: "Choose a CSV file" })
    .refine((f) => f.size > 0, "That file is empty")
    .refine((f) => f.size <= 1_000_000, "Keep the file under 1 MB"),
});

/**
 * Set stock levels from a PMR stock report (ProScript Connect, Titan or any
 * PMR's CSV export). Quantities become levels: 0 → Out, up to `lowAt` → Low,
 * more → In stock. Only medicines NearShelf recognises are changed.
 */
export async function importStockReport(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  if (!(await getCurrentUser())) {
    return { status: "error", message: "Your session has ended. Sign in again." };
  }
  const parsed = importSchema.safeParse({
    pharmacyId: formData.get("pharmacyId"),
    lowAt: formData.get("lowAt") || undefined,
    file: formData.get("file"),
  });
  if (!parsed.success) return { status: "error", message: z.prettifyError(parsed.error) };
  const { pharmacyId, lowAt, file } = parsed.data;

  const supabase = await createClient();
  const [medicines, barcodes] = await Promise.all([
    supabase.from("medicines").select("id, name, strength, form"),
    supabase.from("medicine_barcodes").select("gtin, medicine_id"),
  ]);
  if (medicines.error || barcodes.error) {
    return { status: "error", message: "Couldn't load the medicine list. Try again." };
  }

  const report = readStockReport(
    await file.text(),
    medicines.data,
    new Map(barcodes.data.map((b) => [b.gtin, b.medicine_id])),
    lowAt,
  );
  if ("error" in report) return { status: "error", message: report.error };
  if (report.rows.length === 0) {
    return {
      status: "error",
      message: `None of the ${report.total} rows matched a NearShelf medicine.`,
    };
  }

  // Row level security: only your own pharmacy's stock can be written.
  const { error } = await supabase.from("stock_status").upsert(
    report.rows.map((row) => ({
      pharmacy_id: pharmacyId,
      medicine_id: row.medicineId,
      level: row.level,
    })),
    { onConflict: "pharmacy_id,medicine_id" },
  );
  if (error) {
    if (error.code === "42501") return { status: "error", message: NOT_YOUR_PHARMACY };
    console.error("import failed:", error);
    return { status: "error", message: "Couldn't save. Try again." };
  }

  refresh();
  return {
    status: "imported",
    updated: report.rows.length,
    total: report.total,
    unmatched: report.unmatched.slice(0, 8),
  };
}
