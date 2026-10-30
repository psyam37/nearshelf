import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { PilotForm } from "./PilotForm";

export const metadata: Metadata = {
  title: "Join the pilot",
  description:
    "Ask to join the free NearShelf pilot. We'll send you a private demo with pretend pharmacies near you.",
};

const STEPS = [
  "Tell us about your pharmacy below.",
  "We check it and email you a private demo link.",
  "Try NearShelf with pretend pharmacies near you: search, ask, confirm, chat.",
  "If it helps, your team joins for real with their GPhC numbers.",
];

export default function PilotPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Free pilot"
        title="Join the NearShelf pilot"
        description="For community pharmacies that are tired of phoning round. No cost and no commitment during the pilot."
      />
      <ol className="mb-6 grid gap-2 sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <Card className="relative p-6">
        <PilotForm />
      </Card>
      <p className="mt-4 text-xs text-muted">
        NearShelf never asks for or stores patient information.
      </p>
    </main>
  );
}
