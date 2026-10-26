"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { stockUpdateSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { StockLevel } from "@/lib/types";

export type StockUpdateState =
  | { status: "idle" }
  | { status: "saved"; level: StockLevel }
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
