"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { stockUpdateSchema } from "@/lib/schemas";
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
