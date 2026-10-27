import { ReserveCountdown } from "@/components/ReserveCountdown";
import { Icon } from "@/components/ui";

interface RedirectionStepsProps {
  pharmacy: { name: string; address_line: string; postcode: string; phone: string | null };
  reservedUntil: string | null;
}

/**
 * What to do after another pharmacy says "Available". MediBase never moves
 * medicine between businesses (that would need a Wholesale Dealer's Licence):
 * the patient's prescription goes to the pharmacy that has the stock.
 */
export function RedirectionSteps({ pharmacy, reservedUntil }: RedirectionStepsProps) {
  const steps = [
    {
      title: "Tell the patient where to go",
      body: (
        <>
          <strong className="text-ink">{pharmacy.name}</strong>, {pharmacy.address_line},{" "}
          {pharmacy.postcode}
          {pharmacy.phone && (
            <>
              {" · "}
              <a
                href={`tel:${pharmacy.phone.replace(/\s/g, "")}`}
                className="font-medium text-accent underline"
              >
                {pharmacy.phone}
              </a>
            </>
          )}
        </>
      ),
    },
    {
      title: "Return the prescription to the NHS Spine",
      body: "In your PMR system, return (release) the electronic prescription so it can be downloaded elsewhere. Don't dispense or transfer the medicine yourself.",
    },
    {
      title: `${pharmacy.name} dispenses it`,
      body: "They download the prescription from the Spine and dispense to the patient as normal.",
    },
  ];

  return (
    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-800 dark:bg-brand-950/50">
      <p className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-brand-900 dark:text-brand-100">
        Next steps
        {reservedUntil && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200 dark:bg-brand-900 dark:text-brand-100 dark:ring-brand-700">
            <Icon name="clock" className="h-3.5 w-3.5" />
            <ReserveCountdown until={reservedUntil} />
          </span>
        )}
      </p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white dark:bg-brand-500">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold">{step.title}</p>
              <p className="text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
