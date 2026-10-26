// GET /api/nearby?medicineId=…&lat=…&lng=…&radiusM=5000&includeEquivalents=true
// Pharmacies near a point that have a record for the medicine, best stock
// level first, then nearest.
import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { nearbyStockSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { NearbyStockResult } from "@/lib/types";

export type NearbyStockResponse = { results: NearbyStockResult[] } | { error: string };

export async function GET(request: NextRequest) {
  // Stock levels are for signed-in staff. The database enforces this too (row
  // level security), but it would just return no rows, which looks like a bug.
  if (!(await getCurrentUser())) {
    return NextResponse.json<NearbyStockResponse>({ error: "Please sign in" }, { status: 401 });
  }

  const parsed = nearbyStockSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json<NearbyStockResponse>(
      { error: z.prettifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { medicineId, lat, lng, radiusM, includeEquivalents } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nearby_stock", {
    p_medicine_id: medicineId,
    p_lat: lat,
    p_lng: lng,
    p_radius_m: radiusM,
    p_include_equivalents: includeEquivalents,
  });

  if (error) {
    console.error("nearby_stock failed:", error);
    return NextResponse.json<NearbyStockResponse>({ error: "Search failed" }, { status: 500 });
  }

  return NextResponse.json<NearbyStockResponse>({ results: data });
}
