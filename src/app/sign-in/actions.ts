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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
