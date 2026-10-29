import { ReviewButtons } from "@/components/ReviewButtons";
import { EmptyState, Icon } from "@/components/ui";
import { formatUpdatedAgo } from "@/lib/stock";
import { createClient } from "@/lib/supabase/server";

// The GPhC has no public API, so reviewers check the number on its register.
const GPHC_REGISTER_URL = "https://www.pharmacyregulation.org/registers";

/**
 * Pending staff applications: for one pharmacy (managers), or all of them
 * (NearShelf admins). Row level security decides which rows come back.
 */
export async function ApplicationsList({ pharmacyId }: { pharmacyId?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("staff_applications")
    .select("id, full_name, gphc_number, created_at, pharmacy:pharmacies(name, ods_code)")
    .eq("status", "pending")
    .order("created_at");
  if (pharmacyId) query = query.eq("pharmacy_id", pharmacyId);

  const { data, error } = await query;
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
              <p className="font-semibold">{app.full_name}</p>
              <p className="mt-0.5 text-sm text-muted">
                GPhC <span className="font-mono text-ink">{app.gphc_number}</span>
                {!pharmacyId && (
                  <>
                    {" · "}
                    {app.pharmacy.name} ({app.pharmacy.ods_code})
                  </>
                )}
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
            Approve only if the name and number match an active entry on the register.
          </p>
          <div className="mt-3">
            <ReviewButtons applicationId={app.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}
