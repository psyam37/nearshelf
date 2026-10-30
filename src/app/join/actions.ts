"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { lookupPostcode } from "@/lib/geo";
import { lookupNhsOds, tidyCase } from "@/lib/ods";
import { joinSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** A page that helps with the error, e.g. the clinician sign-up for a GP practice's code. */
export interface ErrorLink {
  href: string;
  label: string;
}

export type JoinState =
  | { status: "idle" }
  | { status: "applied"; pharmacyName: string }
  | { status: "error"; message: string; link?: ErrorLink };

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
  const { data: existing, error: findError } = await supabase
    .from("pharmacies")
    .select("id, name")
    .eq("ods_code", odsCode)
    .maybeSingle();
  if (findError) {
    console.error("pharmacy lookup failed:", findError);
    return { status: "error", message: "Couldn't check that code. Try again." };
  }
  let pharmacy = existing;
  if (!pharmacy) {
    const added = await addFromNhsDirectory(odsCode);
    if ("message" in added) return { status: "error", ...added };
    pharmacy = added;
  }

  // The database fills in who is applying and sets the status to pending.
  const { error } = await supabase
    .from("staff_applications")
    .insert({ pharmacy_id: pharmacy.id, full_name: fullName, gphc_number: gphcNumber });

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: error.message.includes("gphc_once")
          ? "That GPhC number is already registered with NearShelf. Contact us if this is wrong."
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

/**
 * A real NHS pharmacy that isn't on NearShelf yet: add it from its entry in
 * the NHS directory, so its staff can join without waiting for us. Anything
 * else gets a reason, and a link if there's a better place to go.
 */
async function addFromNhsDirectory(
  odsCode: string,
): Promise<{ id: string; name: string } | { message: string; link?: ErrorLink }> {
  let nhs;
  try {
    nhs = await lookupNhsOds(odsCode);
  } catch (err) {
    console.error(err);
    return { message: "The NHS directory didn't answer. Try again in a moment." };
  }
  if (!nhs.found)
    return { message: `No NHS organisation has the code ${odsCode}. Check it and try again.` };
  const name = tidyCase(nhs.name);
  if (nhs.isGpPractice) {
    return {
      message: `${name} is a GP practice. Pharmacists at GP practices can register to search stock instead.`,
      link: { href: "/join/clinician", label: "Register as a GP practice pharmacist" },
    };
  }
  if (!nhs.isPharmacy) return { message: `${odsCode} is ${name}, which isn't a pharmacy.` };
  if (!nhs.active)
    return { message: `${name} (${odsCode}) is no longer active in the NHS directory.` };
  if (!nhs.addressLine || !nhs.town || !nhs.postcode) {
    return {
      message: `The NHS directory has no full address for ${name}. Contact us and we'll add it.`,
    };
  }

  // Adding a pharmacy needs the secret key: signed-in users can't do it themselves.
  const admin = createAdminClient();
  if (!admin) {
    return {
      message: `${name}, ${nhs.postcode} is a real pharmacy, but not on NearShelf yet. Ask us to add it.`,
    };
  }
  let location;
  try {
    location = await lookupPostcode(nhs.postcode);
  } catch {
    return { message: `Couldn't find ${nhs.postcode} on the map. Try again later.` };
  }
  const { data: id, error } = await admin.rpc("add_nhs_pharmacy", {
    p_ods_code: odsCode,
    p_name: name,
    p_address_line: tidyCase(nhs.addressLine),
    p_town: tidyCase(nhs.town),
    p_postcode: nhs.postcode,
    p_phone: nhs.phone ?? "",
    p_lat: location.lat,
    p_lng: location.lng,
  });
  if (error) {
    console.error("adding pharmacy failed:", error);
    return { message: "Couldn't add your pharmacy to NearShelf. Try again." };
  }
  return { id, name };
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
