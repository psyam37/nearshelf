import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface MyPharmacy {
  id: string;
  name: string;
}

/**
 * The pharmacy the signed-in user works at, or null. If they're linked to
 * several, the one they joined first. (A pharmacy switcher could come later.)
 */
export async function getMyPharmacy(): Promise<MyPharmacy | null> {
  const supabase = await createClient();
  // Row level security only returns the user's own memberships.
  const { data, error } = await supabase
    .from("pharmacy_staff")
    .select("pharmacy:pharmacies(id, name)")
    .order("created_at")
    .limit(1)
    .maybeSingle(); // one row or null, instead of a list

  if (error) throw error;
  return data?.pharmacy ?? null;
}

/** Is the signed-in user a NearShelf admin? (They can only read their own row.) */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("platform_admins").select("user_id").maybeSingle();
  if (error) throw error;
  return data !== null;
}

export interface ClinicianApplication {
  id: string;
  status: "pending" | "approved" | "rejected";
  workplace: string;
  created_at: string;
}

/**
 * The signed-in user's latest application for view-only access as a
 * pharmacist outside community pharmacy (GP practice, locum), or null.
 */
export async function getClinicianApplication(
  userId: string,
): Promise<ClinicianApplication | null> {
  const supabase = await createClient();
  // Filter by user: admins can see everyone's applications.
  const { data, error } = await supabase
    .from("clinician_applications")
    .select("id, status, workplace, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
