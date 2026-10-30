"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ErrorLink, ReviewState } from "@/app/join/actions";
import { getCurrentUser } from "@/lib/auth";
import { lookupNhsOds, tidyCase } from "@/lib/ods";
import { clinicianJoinSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export type ClinicianJoinState =
  | { status: "idle" }
  | { status: "applied" }
  | { status: "error"; message: string; link?: ErrorLink };

/** Apply for view-only access to stock. A NearShelf admin approves. */
export async function applyAsClinician(
  _prev: ClinicianJoinState,
  formData: FormData,
): Promise<ClinicianJoinState> {
  if (!(await getCurrentUser())) return { status: "error", message: "Please sign in again." };

  const setting = formData.get("setting");
  const parsed = clinicianJoinSchema.safeParse(
    setting === "gp_practice"
      ? {
          setting,
          fullName: formData.get("fullName"),
          gphcNumber: formData.get("gphcNumber"),
          odsCode: formData.get("odsCode"),
        }
      : {
          setting,
          fullName: formData.get("fullName"),
          gphcNumber: formData.get("gphcNumber"),
          workplace: formData.get("workplace"),
          postcode: formData.get("postcode"),
        },
  );
  if (!parsed.success) return { status: "error", message: z.prettifyError(parsed.error) };
  const input = parsed.data;

  // A GP practice is checked against the NHS directory, and its name and
  // postcode come from there rather than from the form.
  let details: { ods_code: string | null; workplace: string; postcode: string };
  if (input.setting === "gp_practice") {
    let nhs;
    try {
      nhs = await lookupNhsOds(input.odsCode);
    } catch (err) {
      console.error(err);
      return {
        status: "error",
        message: "The NHS directory didn't answer. Try again in a moment.",
      };
    }
    if (!nhs.found) {
      return { status: "error", message: `No NHS organisation has the code ${input.odsCode}.` };
    }
    const name = tidyCase(nhs.name);
    if (nhs.isPharmacy) {
      return {
        status: "error",
        message: `${name} is a community pharmacy. Join it as staff instead.`,
        link: { href: "/join", label: "Join your pharmacy" },
      };
    }
    if (!nhs.isGpPractice) {
      return {
        status: "error",
        message: `${input.odsCode} is ${name}, which isn't a GP practice.`,
      };
    }
    if (!nhs.active || !nhs.postcode) {
      return { status: "error", message: `${name} isn't active in the NHS directory.` };
    }
    details = { ods_code: input.odsCode, workplace: name, postcode: nhs.postcode };
  } else {
    details = { ods_code: null, workplace: input.workplace, postcode: input.postcode };
  }

  const supabase = await createClient();
  // The database fills in who is applying and sets the status to pending.
  const { error } = await supabase.from("clinician_applications").insert({
    full_name: input.fullName,
    gphc_number: input.gphcNumber,
    setting: input.setting,
    ...details,
  });
  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: error.message.includes("gphc_once")
          ? "That GPhC number is already registered with NearShelf. Contact us if this is wrong."
          : "You already have an application or access.",
      };
    }
    console.error("clinician application failed:", error);
    return { status: "error", message: "Couldn't send your application. Try again." };
  }

  refresh();
  return { status: "applied" };
}

const idSchema = z.object({ applicationId: z.uuid() });

/** The applicant withdraws a pending application. */
export async function withdrawClinicianApplication(
  _prev: ClinicianJoinState,
  formData: FormData,
): Promise<ClinicianJoinState> {
  const parsed = idSchema.safeParse({ applicationId: formData.get("applicationId") });
  if (!parsed.success) return { status: "error", message: "That wasn't valid." };

  const supabase = await createClient();
  // Row level security: only your own, and only while pending.
  const { error } = await supabase
    .from("clinician_applications")
    .delete()
    .eq("id", parsed.data.applicationId);
  if (error) return { status: "error", message: "Couldn't withdraw it. Try again." };

  refresh();
  return { status: "idle" };
}

const reviewSchema = z.object({
  applicationId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
});

/** A NearShelf admin approves or rejects a clinician. */
export async function reviewClinicianApplication(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  if (!(await getCurrentUser())) return { status: "error", message: "Please sign in again." };

  const parsed = reviewSchema.safeParse({
    applicationId: formData.get("applicationId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return { status: "error", message: "That wasn't valid." };

  // The database function checks that the reviewer is an admin.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_clinician_application", {
    p_application_id: parsed.data.applicationId,
    p_approve: parsed.data.decision === "approve",
  });
  if (error) {
    const message = error.message.includes("already reviewed")
      ? "Someone already reviewed this."
      : error.code === "42501"
        ? error.message
        : "Couldn't save. Try again.";
    if (error.code !== "42501") console.error("clinician review failed:", error);
    return { status: "error", message };
  }

  refresh();
  return { status: "reviewed", decision: data === "approved" ? "approved" : "rejected" };
}
