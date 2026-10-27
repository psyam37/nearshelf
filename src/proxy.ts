// Runs before every page request (Next.js 16 renamed "middleware" to "proxy").
// 1. Refreshes the Supabase session, so signed-in users stay signed in.
// 2. Sends signed-out visitors away from pages that need an account.
// This is only a first check: pages, Server Actions and Route Handlers check
// again themselves, and the database's row level security has the final say.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { getEnv } from "@/lib/env";

const SIGNED_IN_ONLY = ["/search", "/my-pharmacy", "/requests", "/join", "/admin"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // Called when the session was refreshed: pass the new cookies on to
        // the page being rendered and back to the browser.
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Stops a CDN caching a response that carries someone's session.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Don't put code between createServerClient and getClaims(): this call is
  // what refreshes an expired session.
  const { data } = await supabase.auth.getClaims();

  const { pathname, search } = request.nextUrl;
  const needsAccount = SIGNED_IN_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!data?.claims && needsAccount) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  // Every path except Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
