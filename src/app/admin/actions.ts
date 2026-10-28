"use server";
// MediBase admin tools. Every action checks the admin flag here, and the
// database functions check it again.

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { lookupPostcode } from "@/lib/geo";
import { lookupNhsOds, ODS_CODE_PATTERN, tidyCase } from "@/lib/ods";
import { isPlatformAdmin } from "@/lib/pharmacy";
import { createClient } from "@/lib/supabase/server";

export type AdminState =
  | { status: "idle" }
  | { status: "done"; message: string }
  | {
      status: "found";
      odsCode: string;
      name: string;
      addressLine: string;
      town: string;
      postcode: string;
    }
  | { status: "error"; message: string };

async function requireAdmin(): Promise<string | null> {
  if (!(await getCurrentUser())) return "Please sign in again.";
  if (!(await isPlatformAdmin())) return "Only MediBase admins can do this.";
  return null;
}

/** Before a demo: fresh stock times, patient listings, no old demo requests. */
export async function refreshDemo(_prev: AdminState): Promise<AdminState> {
  const denied = await requireAdmin();
  if (denied) return { status: "error", message: denied };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("refresh_demo_data");
  if (error) {
    console.error("refresh demo failed:", error);
    return { status: "error", message: "Couldn't refresh the demo. Try again." };
  }
  const result = z
    .object({ stock_refreshed: z.number(), newly_listed: z.number(), requests_cleared: z.number() })
    .parse(data);
  refresh();
  return {
    status: "done",
    message: `Demo ready: ${result.stock_refreshed} stock levels refreshed, ${result.requests_cleared} old requests cleared. Fresh for the next 2 hours.`,
  };
}

const odsSchema = z.object({
  odsCode: z
    .string()
    .transform((s) => s.replace(/\s/g, "").toUpperCase())
    .pipe(z.string().regex(ODS_CODE_PATTERN, "Enter an ODS code, e.g. FA076")),
});

/** Look up a real pharmacy in the NHS directory, to confirm before adding. */
export async function findPharmacyByOds(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const denied = await requireAdmin();
  if (denied) return { status: "error", message: denied };

  const parsed = odsSchema.safeParse({ odsCode: formData.get("odsCode") });
  if (!parsed.success) return { status: "error", message: z.prettifyError(parsed.error) };
  return lookupForAdding(parsed.data.odsCode);
}

async function lookupForAdding(odsCode: string): Promise<AdminState> {
  let nhs;
  try {
    nhs = await lookupNhsOds(odsCode);
  } catch {
    return { status: "error", message: "The NHS directory didn't answer. Try again in a moment." };
  }
  if (!nhs.found)
    return { status: "error", message: `No NHS organisation has the code ${odsCode}.` };
  if (!nhs.isPharmacy) return { status: "error", message: `${odsCode} isn't a pharmacy.` };
  if (!nhs.active) return { status: "error", message: `${odsCode} is no longer active.` };
  if (!nhs.addressLine || !nhs.town || !nhs.postcode) {
    return { status: "error", message: "The NHS directory has no full address for it." };
  }
  return {
    status: "found",
    odsCode,
    name: tidyCase(nhs.name),
    addressLine: tidyCase(nhs.addressLine),
    town: tidyCase(nhs.town),
    postcode: nhs.postcode,
  };
}

const addSchema = z.object({
  odsCode: odsSchema.shape.odsCode,
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9 +()]*$/, "Phone numbers can only use digits, spaces, + and brackets"),
});

/** Add the pharmacy, using the NHS details (looked up again here, not trusted from the form). */
export async function addPharmacy(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const denied = await requireAdmin();
  if (denied) return { status: "error", message: denied };

  const parsed = addSchema.safeParse({
    odsCode: formData.get("odsCode"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { status: "error", message: z.prettifyError(parsed.error) };

  const found = await lookupForAdding(parsed.data.odsCode);
  if (found.status !== "found") return found;

  let location;
  try {
    location = await lookupPostcode(found.postcode);
  } catch {
    return { status: "error", message: `Couldn't find ${found.postcode} on the map.` };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_pharmacy", {
    p_ods_code: found.odsCode,
    p_name: found.name,
    p_address_line: found.addressLine,
    p_town: found.town,
    p_postcode: found.postcode,
    p_phone: parsed.data.phone,
    p_lat: location.lat,
    p_lng: location.lng,
  });
  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? error.message : "Couldn't add it. Try again.",
    };
  }
  refresh();
  return {
    status: "done",
    message: `${found.name} is on MediBase. Its staff can now join with ODS code ${found.odsCode}.`,
  };
}
