import { reviewClinicianApplication } from "@/app/join/clinician/actions";
import { GPHC_REGISTER_URL } from "@/components/ApplicationsList";
import { ReviewButtons } from "@/components/ReviewButtons";
import { EmptyState, Icon } from "@/components/ui";
import { formatUpdatedAgo } from "@/lib/stock";
import { createClient } from "@/lib/supabase/server";

/**
 * Pending applications from pharmacists outside community pharmacy (GP
 * practices, locums). Only NearShelf admins see these and approve them.
 */
export async function ClinicianApplicationsList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinician_applications")
    .select(
      "id, full_name, gphc_number, setting, ods_code, workplace, postcode, nhs_email, created_at",
    )
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  const now = new Date();

  if (data.length === 0) {
    return <EmptyState icon="shield">No applications waiting.</EmptyState>;
  }

  return (
    <ul className="space-y-3">
      {data.map((app) => (
        <li key={app.id} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {app.full_name}
                {app.nhs_email && (
                  <span
                    title="Applied while signed in with an NHSmail or NHS organisation email address"
                    className="ml-2 inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 align-middle text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                  >
                    <Icon name="check" className="h-3 w-3" />
                    NHS email
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                GPhC <span className="font-mono text-ink">{app.gphc_number}</span>
                {" · "}
                {app.workplace}
                {app.ods_code ? ` (GP practice ${app.ods_code})` : ""}, {app.postcode}
                {" · "}applied {formatUpdatedAgo(app.created_at, now)}
              </p>
            </div>
            <a
              href={GPHC_REGISTER_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent underline"
            >
              <Icon name="shield" className="h-4 w-4" />
              Check the GPhC register
            </a>
          </div>
          <p className="mt-3 text-xs text-muted">
            Approve only if the name and number match an active pharmacist on the register.
            {app.setting === "other" && " They gave their own workplace: check it seems right."}
            {!app.nhs_email &&
              " No NHS email: ring their workplace, or ask them to email you from their NHSmail address."}
          </p>
          <div className="mt-3">
            <ReviewButtons applicationId={app.id} action={reviewClinicianApplication} />
          </div>
        </li>
      ))}
    </ul>
  );
}
