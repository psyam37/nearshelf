"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { pilotRequestSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export type PilotRequestState =
  | { status: "idle" }
  | { status: "sent"; contactName: string }
  // `values` refills the form, which React clears after every submit.
  | { status: "error"; message: string; values?: Record<string, string> };

/**
 * Save a request to join the pilot. Anyone can send one, without signing in,
 * so it's rate limited and saved with the secret key: there's no way to
 * write to the table from a browser.
 */
export async function submitPilotRequest(
  _prev: PilotRequestState,
  formData: FormData,
): Promise<PilotRequestState> {
  const values = Object.fromEntries(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  // The hidden "website" field: only bots fill it. Look successful, save nothing.
  if (values.website) return { status: "sent", contactName: values.contactName ?? "" };
  if (!allowRequest(`pilot:${clientKey(await headers())}`, 5, 60 * 60_000)) {
    return { status: "error", message: "Too many requests from here. Try again in an hour." };
  }

  const parsed = pilotRequestSchema.safeParse({
    contactName: formData.get("contactName"),
    role: formData.get("role"),
    pharmacyName: formData.get("pharmacyName"),
    odsCode: formData.get("odsCode") ?? undefined,
    postcode: formData.get("postcode"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? undefined,
    message: formData.get("message") ?? undefined,
    consent: formData.get("consent") ?? undefined,
    website: formData.get("website") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: z.prettifyError(parsed.error), values };
  const input = parsed.data;

  const admin = createAdminClient();
  if (!admin) {
    console.error("pilot request: SUPABASE_SECRET_KEY is not set");
    return {
      status: "error",
      message: "The form isn't working right now. Please try later.",
      values,
    };
  }
  const { error } = await admin.from("pilot_requests").insert({
    contact_name: input.contactName,
    role: input.role,
    pharmacy_name: input.pharmacyName,
    ods_code: input.odsCode ?? null,
    postcode: input.postcode,
    email: input.email,
    phone: input.phone ?? null,
    message: input.message || null,
  });
  if (error) {
    console.error("pilot request failed:", error);
    return { status: "error", message: "Couldn't send your request. Try again.", values };
  }
  return { status: "sent", contactName: input.contactName };
}
