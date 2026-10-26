"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getMyPharmacy } from "@/lib/pharmacy";
import { stockRequestSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { RequestStatus } from "@/lib/types";

export type ActionState =
  { status: "idle" } | { status: "done" } | { status: "error"; message: string };

/** "Can you confirm you have X?" from my pharmacy to another one. */
export async function sendStockRequest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await getCurrentUser())) return { status: "error", message: "Please sign in again." };

  // The sender is always the user's own pharmacy, worked out on the server.
  // We never take "from" from the browser, where it could be changed.
  const myPharmacy = await getMyPharmacy();
  if (!myPharmacy) {
    return { status: "error", message: "Link your account to a pharmacy first." };
  }

  const parsed = stockRequestSchema.safeParse({
    fromPharmacyId: myPharmacy.id,
    toPharmacyId: formData.get("toPharmacyId"),
    medicineId: formData.get("medicineId"),
    message: formData.get("message") || undefined,
  });
  if (!parsed.success) return { status: "error", message: z.prettifyError(parsed.error) };
  const { fromPharmacyId, toPharmacyId, medicineId, message } = parsed.data;
  if (fromPharmacyId === toPharmacyId) {
    return { status: "error", message: "That's your own pharmacy." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stock_requests").insert({
    from_pharmacy_id: fromPharmacyId,
    to_pharmacy_id: toPharmacyId,
    medicine_id: medicineId,
    message: message ?? null,
  });

  if (error) {
    // 23505 = unique index: there's already an open request like this one.
    if (error.code === "23505") {
      return { status: "error", message: "You've already asked them. Waiting for a reply." };
    }
    if (error.code === "42501") return { status: "error", message: "Not allowed." };
    console.error("stock request failed:", error);
    return { status: "error", message: "Couldn't send. Try again." };
  }
  return { status: "done" };
}

const respondSchema = z.object({
  requestId: z.uuid(),
  // Only these two: "pending" isn't an answer.
  status: z.enum(["confirmed", "declined"] as const satisfies readonly RequestStatus[]),
});

/** The receiving pharmacy answers a request. */
export async function respondToRequest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await getCurrentUser())) return { status: "error", message: "Please sign in again." };

  const parsed = respondSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { status: "error", message: "That response wasn't valid." };
  const { requestId, status } = parsed.data;

  const supabase = await createClient();
  // Row level security only lets the receiving pharmacy update it, and the
  // database trigger only lets the status change, once.
  const { data, error } = await supabase
    .from("stock_requests")
    .update({ status })
    .eq("id", requestId)
    .select("id, to_pharmacy_id, medicine_id");

  if (error) {
    console.error("respond failed:", error);
    return {
      status: "error",
      message: error.message.includes("already been answered")
        ? "This request was already answered."
        : "Couldn't save your answer.",
    };
  }
  if (!data || data.length === 0) return { status: "error", message: "Not allowed." };

  // TODO (your turn): if the answer is "confirmed", the pharmacy is saying
  // "yes, we have it", so also record it as in stock for them. See the chat.

  refresh();
  return { status: "done" };
}
