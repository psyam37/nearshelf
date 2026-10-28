"use server";
// Server Actions: functions the browser can call, that run on the server.
// Treat their input like any request from the internet: validate everything.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth";
import { passwordSignInAllowed } from "@/lib/demo";
import { signInSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

// What the sign-in form shows after submitting. A union of three shapes, told
// apart by `status`, so the form can't show "sent" and an error at once.
export type SignInState =
  { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

export async function sendSignInLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: z.prettifyError(parsed.error) };
  }

  const { email, next } = parsed.data;
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", safeNextPath(next));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString() },
  });

  if (error) {
    console.error("signInWithOtp failed:", error);
    return {
      status: "error",
      message:
        error.status === 429
          ? "Too many emails sent. Wait a few minutes and try again."
          : "Couldn't send the sign-in email. Try again.",
    };
  }
  return { status: "sent", email };
}

const devSignInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
  next: z.string().optional(),
});

/**
 * Password sign-in for demo and test accounts, so demos don't depend on
 * sign-in emails. Locally any account may use it; on the live site only the
 * addresses in DEMO_SIGNIN_EMAILS (see lib/demo.ts). The check is here, in
 * the action, so calling it directly doesn't get around it.
 */
export async function devPasswordSignIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = devSignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: "Enter an email and password." };
  if (!passwordSignInAllowed(parsed.data.email)) {
    return { status: "error", message: "That isn't a demo account. Use the email link above." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { status: "error", message: "Wrong email or password." };

  redirect(safeNextPath(parsed.data.next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
