// GET /api/medicines?q=amox&limit=10
// Medicine search for the autocomplete box.
import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { medicineSearchSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Medicine } from "@/lib/types";

// The shape of every response, success or failure. The search page imports
// this type, so the browser and server code can't disagree about it.
export type MedicineSearchResponse = { medicines: Medicine[] } | { error: string };

export async function GET(request: NextRequest) {
  // ?q=amox&limit=5 → { q: "amox", limit: "5" }. Zod checks it and turns
  // "5" into the number 5 (that's what z.coerce does in the schema).
  const parsed = medicineSearchSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json<MedicineSearchResponse>(
      { error: z.prettifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { q, limit } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_medicines", { p_query: q, p_limit: limit });

  if (error) {
    console.error("search_medicines failed:", error);
    return NextResponse.json<MedicineSearchResponse>({ error: "Search failed" }, { status: 500 });
  }

  return NextResponse.json<MedicineSearchResponse>({ medicines: data });
}
