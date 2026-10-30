"use server";
// NearShelf admin tools. Every action checks the admin flag here, and the
// database functions check it again.

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ReviewState } from "@/app/join/actions";
import { getCurrentUser } from "@/lib/auth";
import { lookupPostcode } from "@/lib/geo";
import { fetchPcaMonth, formatMonth, listPcaMonths, type PcaMonth } from "@/lib/nhs-data";
import { lookupNhsOds, ODS_CODE_PATTERN, tidyCase } from "@/lib/ods";
import { isPlatformAdmin } from "@/lib/pharmacy";
import { createAdminClient } from "@/lib/supabase/admin";
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
  if (!(await isPlatformAdmin())) return "Only NearShelf admins can do this.";
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
    message: `${found.name} is on NearShelf. Its staff can now join with ODS code ${found.odsCode}.`,
  };
}

/**
 * Load NHS dispensing data for the Insights page: every month the NHSBSA has
 * published that we don't have yet, plus the newest two again, because the
 * NHS sometimes revises them. A few minutes the first time, seconds after.
 */
export async function syncNhsData(_prev: AdminState): Promise<AdminState> {
  const denied = await requireAdmin();
  if (denied) return { status: "error", message: denied };

  const supabase = await createClient();
  const [medicines, loaded] = await Promise.all([
    supabase.from("medicines").select("id, bnf_codes"),
    supabase.rpc("nhs_dispensing_months"),
  ]);
  if (medicines.error || loaded.error) {
    return { status: "error", message: "Couldn't read the catalogue. Try again." };
  }
  // BNF code → our medicine. Several codes can belong to one medicine.
  const medicineByCode = new Map(
    medicines.data.flatMap((m) => m.bnf_codes.map((code) => [code, m.id] as const)),
  );
  const have = new Set(loaded.data);

  let months: PcaMonth[];
  try {
    months = await listPcaMonths();
  } catch {
    return { status: "error", message: "The NHSBSA data service didn't answer. Try again later." };
  }
  const todo = months.filter((m, i) => !have.has(m.month) || i >= months.length - 2);

  // A few months at a time, to be polite to the NHS service.
  const codes = [...medicineByCode.keys()];
  let rowsSaved = 0;
  const failed: string[] = [];
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4);
    const results = await Promise.allSettled(batch.map((m) => fetchPcaMonth(m.resource, codes)));

    // Add up codes that belong to the same medicine, per month and ICB.
    const totals = new Map<
      string,
      { month: string; icb_name: string; medicine_id: string; items: number }
    >();
    results.forEach((result, j) => {
      if (result.status === "rejected") {
        failed.push(batch[j].month);
        return;
      }
      for (const row of result.value) {
        const medicineId = medicineByCode.get(row.code);
        if (!medicineId) continue;
        const key = `${batch[j].month}|${row.icb}|${medicineId}`;
        const total = totals.get(key);
        if (total) total.items += row.items;
        else
          totals.set(key, {
            month: batch[j].month,
            icb_name: row.icb,
            medicine_id: medicineId,
            items: row.items,
          });
      }
    });

    const rows = [...totals.values()];
    for (let k = 0; k < rows.length; k += 1000) {
      const { error } = await supabase.from("nhs_dispensing").upsert(rows.slice(k, k + 1000));
      if (error) {
        console.error("saving NHS data failed:", error);
        return { status: "error", message: "Couldn't save the NHS data. Try again." };
      }
    }
    rowsSaved += rows.length;
  }

  refresh();
  const range =
    months.length > 0
      ? `${formatMonth(months[0].month)} to ${formatMonth(months.at(-1)!.month)}`
      : "none";
  return {
    status: failed.length > 0 ? "error" : "done",
    message:
      `NHS data up to date (${range}): ${todo.length - failed.length} months loaded, ${rowsSaved} rows.` +
      (failed.length > 0 ? ` ${failed.length} months failed; press again to retry them.` : ""),
  };
}

const pilotReviewSchema = z.object({
  applicationId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
});

/**
 * Approve or reject a pilot request. Approving makes a demo account, as
 * staff at the demo pharmacy nearest their postcode, and a private link that
 * signs them into it. The account has a made-up email, so their real address
 * stays free for when they join for real.
 */
export async function reviewPilotRequest(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const denied = await requireAdmin();
  if (denied) return { status: "error", message: denied };
  const reviewer = await getCurrentUser();
  const parsed = pilotReviewSchema.safeParse({
    applicationId: formData.get("applicationId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success || !reviewer) return { status: "error", message: "That wasn't valid." };
  const { applicationId: requestId, decision } = parsed.data;

  if (decision === "reject") {
    const supabase = await createClient();
    const { error } = await supabase.rpc("reject_pilot_request", { p_request_id: requestId });
    if (error) return { status: "error", message: "Couldn't save. Try again." };
    refresh();
    return { status: "reviewed", decision: "rejected" };
  }

  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "SUPABASE_SECRET_KEY isn't set on the server." };
  const { data: request, error: findError } = await admin
    .from("pilot_requests")
    .select("contact_name, postcode, status")
    .eq("id", requestId)
    .single();
  if (findError || request.status !== "pending") {
    return { status: "error", message: "Someone already reviewed this." };
  }

  // The nearest demo pharmacy to them; Nottingham centre if the postcode
  // can't be found.
  let point = { lat: 52.954, lng: -1.15 };
  try {
    point = await lookupPostcode(request.postcode);
  } catch {
    // Keep the fallback.
  }
  const { data: demoPharmacyId, error: nearestError } = await admin.rpc("nearest_demo_pharmacy", {
    p_lat: point.lat,
    p_lng: point.lng,
  });
  if (nearestError || !demoPharmacyId) {
    return { status: "error", message: "There are no demo pharmacies. Load the demo data first." };
  }

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: `pilot-${randomBytes(6).toString("hex")}@example.com`,
    email_confirm: true,
    user_metadata: { pilot_request_id: requestId, name: request.contact_name },
  });
  if (userError) {
    console.error("demo account failed:", userError);
    return { status: "error", message: "Couldn't create the demo account. Try again." };
  }

  const { error } = await admin.rpc("approve_pilot_request", {
    p_request_id: requestId,
    p_reviewer: reviewer.id,
    p_demo_user_id: created.user.id,
    p_demo_pharmacy_id: demoPharmacyId,
    // 24 random bytes: 32 characters, unguessable.
    p_demo_token: randomBytes(24).toString("base64url"),
  });
  if (error) {
    // Don't leave an account behind that nothing links to.
    await admin.auth.admin.deleteUser(created.user.id);
    console.error("approving pilot request failed:", error);
    return {
      status: "error",
      message: error.message.includes("already reviewed")
        ? "Someone already reviewed this."
        : "Couldn't approve it. Try again.",
    };
  }

  refresh();
  return { status: "reviewed", decision: "approved" };
}
