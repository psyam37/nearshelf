// GET /auth/callback?code=…&next=/search
// The link in the sign-in email lands here. We swap the one-time code for a
// session (stored in cookies), then continue to the page they wanted.
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    console.error("exchangeCodeForSession failed:", error.message);
  }

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("error", "link");
  signIn.searchParams.set("next", next);
  return NextResponse.redirect(signIn);
}
