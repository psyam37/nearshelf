"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import type { TablesInsert } from "@/lib/database.types";
import { findPatientDetails } from "@/lib/patient-data";
import { getMyPharmacy } from "@/lib/pharmacy";
import { METRES_PER_MILE, broadcastSchema, stockRequestSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { RequestStatus } from "@/lib/types";

export type ActionState =
  { status: "idle" } | { status: "done" } | { status: "error"; message: string };

export type BroadcastState = ActionState | { status: "broadcast"; recipients: number };

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
  // Old unanswered requests (past 2 hours) shouldn't block asking again.
  await supabase.rpc("expire_stale_requests", { p_from_pharmacy_id: fromPharmacyId });
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

/**
 * "Who nearby has this?": one request to every other pharmacy within the
 * radius of the user's own pharmacy (worked out on the server, never sent by
 * the browser). Each gets it in their inbox, live.
 */
export async function broadcastStockRequest(
  _prev: BroadcastState,
  formData: FormData,
): Promise<BroadcastState> {
  if (!(await getCurrentUser())) return { status: "error", message: "Please sign in again." };
  const myPharmacy = await getMyPharmacy();
  if (!myPharmacy) {
    return { status: "error", message: "Link your account to a pharmacy first." };
  }

  const parsed = broadcastSchema.safeParse({
    medicineId: formData.get("medicineId"),
    radiusMiles: formData.get("radiusMiles"),
    urgency: formData.get("urgency") ?? undefined,
    packSize: formData.get("packSize"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return { status: "error", message: z.prettifyError(parsed.error) };
  const { medicineId, radiusMiles, urgency, packSize, quantity } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("broadcast_stock_request", {
      p_from_pharmacy_id: myPharmacy.id,
      p_medicine_id: medicineId,
      p_radius_m: Math.round(radiusMiles * METRES_PER_MILE),
      p_pack_size: packSize,
      p_quantity: quantity,
      p_urgency: urgency,
    })
    .single();

  if (error) {
    if (error.code === "42501") return { status: "error", message: "Not allowed." };
    console.error("broadcast failed:", error);
    return { status: "error", message: "Couldn't send. Try again." };
  }
  if (data.recipients === 0) {
    return {
      status: "error",
      message:
        "No other pharmacies in range, or you've already asked them all. Try a bigger radius.",
    };
  }
  return { status: "broadcast", recipients: data.recipients };
}

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

  // "Yes, we have it" is also fresh stock information, so record it: the
  // pharmacy shows as verified "In stock" in everyone's search for 2 hours.
  if (status === "confirmed") {
    const updatedRequest = data[0];

    // Upsert: update the pharmacy + medicine row if it exists, insert it if not.
    // The database trigger stamps updated_at and updated_by.
    const { error: stockError } = await supabase.from("stock_status").upsert(
      {
        pharmacy_id: updatedRequest.to_pharmacy_id,
        medicine_id: updatedRequest.medicine_id,
        level: "in_stock",
      },
      { onConflict: "pharmacy_id,medicine_id" },
    );

    if (stockError) {
      // The answer itself is saved, so don't fail the whole action over this.
      console.error("Failed to mark the medicine as in stock:", stockError);
    }
  }

  refresh();
  return { status: "done" };
}

const closeSchema = z.object({
  requestId: z.uuid(),
  reason: z.enum(["dispensed", "cancelled"]),
});

/**
 * Close one request: "dispensed" by the pharmacy holding the stock once it
 * has downloaded the prescription, or "cancelled" by the pharmacy that asked.
 */
export async function closeRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { status: "error", message: "Please sign in again." };
  const parsed = closeSchema.safeParse({
    requestId: formData.get("requestId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { status: "error", message: "That wasn't valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_stock_request", {
    p_request_id: parsed.data.requestId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    if (error.code !== "42501") console.error("close failed:", error);
    return {
      status: "error",
      message: error.message.includes("held")
        ? "The 30-minute hold has already ended."
        : error.code === "42501"
          ? error.message
          : "Couldn't save. Try again.",
    };
  }
  refresh();
  return { status: "done" };
}

/** Close every open request of a broadcast ("we got it elsewhere"). */
export async function closeBroadcast(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { status: "error", message: "Please sign in again." };
  const parsed = z.object({ broadcastId: z.uuid() }).safeParse({
    broadcastId: formData.get("broadcastId"),
  });
  if (!parsed.success) return { status: "error", message: "That wasn't valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_broadcast", {
    p_broadcast_id: parsed.data.broadcastId,
  });
  if (error) {
    console.error("close broadcast failed:", error);
    return { status: "error", message: "Couldn't close it. Try again." };
  }
  refresh();
  return { status: "done" };
}

const messageSchema = z.object({
  requestId: z.uuid(),
  body: z.string().trim().min(1, "Type a message").max(500, "Keep it under 500 characters"),
});

/** Send a handover chat message. The database decides who is sending. */
export async function sendMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { status: "error", message: "Please sign in again." };
  const parsed = messageSchema.safeParse({
    requestId: formData.get("requestId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { status: "error", message: z.prettifyError(parsed.error) };

  // Checked again here (anyone can call a Server Action directly), and once
  // more by the database, which has the final say.
  const reason = findPatientDetails(parsed.data.body);
  if (reason) {
    return { status: "error", message: `That looks like ${reason}. Never share patient details.` };
  }

  // sender_pharmacy_id is left out on purpose: a database trigger works out
  // which of the two pharmacies is sending, so nobody can pose as the other.
  // TypeScript can't see triggers, so `satisfies` checks the fields we do
  // send, and the cast tells it the trigger fills in the rest.
  const message = {
    request_id: parsed.data.requestId,
    body: parsed.data.body,
  } satisfies Omit<TablesInsert<"request_messages">, "sender_pharmacy_id">;

  const supabase = await createClient();
  const { error } = await supabase
    .from("request_messages")
    .insert(message as TablesInsert<"request_messages">);
  if (error) {
    if (error.code === "22023") {
      return { status: "error", message: "That looks like patient details, so it wasn't sent." };
    }
    if (error.message.includes("closed")) {
      return { status: "error", message: "The chat closed when the hold ended." };
    }
    console.error("message failed:", error);
    return { status: "error", message: "Couldn't send. Try again." };
  }
  return { status: "done" };
}
