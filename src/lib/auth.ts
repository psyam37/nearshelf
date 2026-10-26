// "Who is signed in?" in one place, for Server Components, Server Actions and
// Route Handlers. `server-only` makes the build fail if browser code imports it.
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
}

/** The signed-in user, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  // getClaims() checks the session token's signature, so a cookie someone
  // edited by hand is rejected. Don't trust getSession() on the server: it
  // reads the cookie without checking it.
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  const { sub, email } = data.claims;
  return { id: sub, email: typeof email === "string" ? email : null };
}

/** The signed-in user. Sends anyone else to the sign-in page, then back to `returnTo`. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/**
 * Only allow redirects to pages on this site. Without this check, a link like
 * /sign-in?next=https://evil.example could bounce someone to another site
 * right after they sign in (an "open redirect").
 */
export function safeNextPath(next: string | null | undefined, fallback = "/search"): string {
  // "//x" and "/\x" both mean "another site" to a browser.
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : fallback;
}
