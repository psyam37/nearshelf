// GET /api/public/find?medicineId=…&lat=…&lng=…&radiusMiles=5
// The patient-facing search. No sign-in. The database function decides what
// the public may see (listed, confirmed in 2 hours, never controlled drugs).
import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { METRES_PER_MILE, publicFindSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export type PublicStockResult =
  Database["public"]["Functions"]["public_find_stock"]["Returns"][number];
export type PublicFindResponse = { results: PublicStockResult[] } | { error: string };

export async function GET(request: NextRequest) {
  if (!allowRequest(`find:${clientKey(request.headers)}`)) {
    return NextResponse.json<PublicFindResponse>(
      { error: "Too many searches. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const parsed = publicFindSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json<PublicFindResponse>(
      { error: z.prettifyError(parsed.error) },
      { status: 400 },
    );
  }
  const { medicineId, lat, lng, radiusMiles } = parsed.data;

  // The patient's location is used for this search only, never stored.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_find_stock", {
    p_medicine_id: medicineId,
    p_lat: lat,
    p_lng: lng,
    p_radius_m: Math.round(radiusMiles * METRES_PER_MILE),
  });
  if (error) {
    console.error("public_find_stock failed:", error);
    return NextResponse.json<PublicFindResponse>({ error: "Search failed" }, { status: 500 });
  }
  return NextResponse.json<PublicFindResponse>({ results: data });
}
