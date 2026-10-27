"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { lookupNhsOds } from "@/lib/ods";
import { joinSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export type JoinState =
  | { status: "idle" }
  | { status: "applied"; pharmacyName: string }
  | { status: "error"; message: string };

/** Apply to join a pharmacy as staff. A manager or admin then approves. */
export async function applyToJoin(_prev: JoinState, formData: FormData): Promise<JoinState> {
  if (!(await getCurrentUser())) return { status: "error", message: "Please sign in again." };

  const parsed = joinSchema.safeParse({
    fullName: formData.get("fullName"),
    gphcNumber: formData.get("gphcNumber"),
    odsCode: formData.get("odsCode"),
  });
  if (!parsed.success) return { status: "error", message: z.prettifyError(parsed.error) };
  const { fullName, gphcNumber, odsCode } = parsed.data;

  const supabase = await createClient();
  const { data: pharmacy, error: findError } = await supabase
    .from("pharmacies")
    .select("id, name")
    .eq("ods_code", odsCode)
    .maybeSingle();
  if (findError) {
    console.error("pharmacy lookup failed:", findError);
    return { status: "error", message: "Couldn't check that code. Try again." };
  }
  if (!pharmacy) return { status: "error", message: await notOnMediBaseMessage(odsCode) };

  // The database fills in who is applying and sets the status to pending.
  const { error } = await supabase
    .from("staff_applications")
    .insert({ pharmacy_id: pharmacy.id, full_name: fullName, gphc_number: gphcNumber });

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: error.message.includes("gphc_once")
          ? "That GPhC number is already registered with MediBase. Contact us if this is wrong."
          : "You already have an application waiting. Withdraw it to apply somewhere else.",
      };
    }
    if (error.message.includes("already work at")) {
      return { status: "error", message: `You already work at ${pharmacy.name}.` };
    }
    console.error("application failed:", error);
    return { status: "error", message: "Couldn't send your application. Try again." };
  }

  refresh();
  return { status: "applied", pharmacyName: pharmacy.name };
}

/** A helpful reason when the code isn't one of MediBase's pharmacies. */
async function notOnMediBaseMessage(odsCode: string): Promise<string> {
  try {
    const nhs = await lookupNhsOds(odsCode);
    if (!nhs.found) return `No NHS organisation has the code ${odsCode}. Check it and try again.`;
    if (!nhs.isPharmacy) return `${odsCode} is ${nhs.name}, which isn't a pharmacy.`;
    if (!nhs.active) return `${nhs.name} (${odsCode}) is no longer active in the NHS directory.`;
    return `${nhs.name}${nhs.postcode ? `, ${nhs.postcode}` : ""} is a real pharmacy, but not on MediBase yet. Ask us to add it.`;
  } catch (err) {
    console.error(err);
    return `${odsCode} isn't a pharmacy on MediBase.`;
  }
}

const idSchema = z.object({ applicationId: z.uuid() });

/** The applicant withdraws a pending application. */
export async function withdrawApplication(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const parsed = idSchema.safeParse({ applicationId: formData.get("applicationId") });
  if (!parsed.success) return { status: "error", message: "That wasn't valid." };

  const supabase = await createClient();
  // Row level security: only your own, and only while pending.
  const { error } = await supabase
    .from("staff_applications")
    .delete()
    .eq("id", parsed.data.applicationId);
  if (error) return { status: "error", message: "Couldn't withdraw it. Try again." };

  refresh();
  return { status: "idle" };
}

export type ReviewState =
  | { status: "idle" }
  | { status: "reviewed"; decision: "approved" | "rejected" }
  | { status: "error"; message: string };

const reviewSchema = z.object({
  applicationId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
});

/** A manager (or admin) approves or rejects an application. */
export async function reviewApplication(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  if (!(await getCurrentUser())) return { status: "error", message: "Please sign in again." };

  const parsed = reviewSchema.safeParse({
    applicationId: formData.get("applicationId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return { status: "error", message: "That wasn't valid." };

  // The database function checks who may review, and adds the staff link.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_staff_application", {
    p_application_id: parsed.data.applicationId,
    p_approve: parsed.data.decision === "approve",
  });
  if (error) {
    const message = error.message.includes("already reviewed")
      ? "Someone already reviewed this."
      : error.code === "42501"
        ? error.message
        : "Couldn't save. Try again.";
    if (error.code !== "42501") console.error("review failed:", error);
    return { status: "error", message };
  }

  refresh();
  return { status: "reviewed", decision: data === "approved" ? "approved" : "rejected" };
}
