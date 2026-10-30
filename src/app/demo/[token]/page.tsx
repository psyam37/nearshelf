import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, Icon, LogoMark, Skeleton } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { EnterDemoButton } from "./EnterDemoButton";

export const metadata: Metadata = {
  title: "Your NearShelf demo",
  // A private link: keep it out of search engines.
  robots: { index: false, follow: false },
};

const TRY = [
  "Search a medicine and see which pharmacies nearby have it",
  "Ask every pharmacy within 2, 5 or 10 miles in one tap",
  "Confirm a request to hold the pack for 30 minutes",
  "Arrange the handover in the text-only chat",
];

export default function DemoPage(props: PageProps<"/demo/[token]">) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12 sm:px-6">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <DemoInvite params={props.params} />
      </Suspense>
    </main>
  );
}

async function DemoInvite({ params }: Pick<PageProps<"/demo/[token]">, "params">) {
  const { token } = await params;
  const admin = createAdminClient();
  if (!admin || token.length < 32) notFound();

  // Who the link is for, and which demo pharmacy their account works at.
  const { data: request } = await admin
    .from("pilot_requests")
    .select("contact_name, demo_user_id")
    .eq("demo_token", token)
    .eq("status", "approved")
    .maybeSingle();
  if (!request?.demo_user_id) notFound();
  const { data: membership } = await admin
    .from("pharmacy_staff")
    .select("pharmacy:pharmacies(name, town)")
    .eq("user_id", request.demo_user_id)
    .limit(1)
    .maybeSingle();
  const firstName = request.contact_name.split(" ")[0];

  return (
    <Card className="p-6 sm:p-8">
      <LogoMark className="h-12 w-12" />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">
        Hi {firstName}, your demo is ready
      </h1>
      <p className="mt-2 text-muted">
        You&apos;ll be signed in as staff at{" "}
        <strong className="text-ink">{membership?.pharmacy.name ?? "a demo pharmacy"}</strong>
        {membership?.pharmacy.town && <> in {membership.pharmacy.town}</>}. It and its neighbours
        are pretend pharmacies, so nothing you do reaches a real one.
      </p>
      <ul className="mt-5 space-y-2 text-sm">
        {TRY.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <EnterDemoButton token={token} />
      </div>
      <p className="mt-4 text-xs text-muted">
        This link is just for you, so please don&apos;t share it. Ready to use NearShelf for real?
        Sign out of the demo, then{" "}
        <Link href="/join" className="font-medium text-accent underline">
          join your pharmacy
        </Link>{" "}
        with your work email and GPhC number.
      </p>
    </Card>
  );
}
