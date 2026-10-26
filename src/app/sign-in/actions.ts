"use server";
// Server Actions: functions the browser can call, that run on the server.
// Treat their input like any request from the internet: validate everything.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth";
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
 * Password sign-in for test accounts, so testing doesn't use up Supabase's
 * small allowance of sign-in emails. Only works under `npm run dev`: a
 * deployed build refuses it even if someone calls this action directly.
 */
export async function devPasswordSignIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  if (process.env.NODE_ENV !== "development") {
    return { status: "error", message: "Not available." };
  }

  const parsed = devSignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: "Enter an email and password." };

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
