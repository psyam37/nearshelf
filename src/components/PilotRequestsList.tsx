import { headers } from "next/headers";
import { reviewPilotRequest } from "@/app/admin/actions";
import { CopyButton } from "@/components/CopyButton";
import { ReviewButtons } from "@/components/ReviewButtons";
import { EmptyState, Icon, button } from "@/components/ui";
import { formatUpdatedAgo } from "@/lib/stock";
import { createClient } from "@/lib/supabase/server";

/** This site's address, for the demo links: the custom domain if there is one. */
async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/**
 * Requests to join the pilot, from the /pilot form. Waiting ones can be
 * approved (which makes a demo account) or rejected; approved ones show the
 * private demo link to send. Only NearShelf admins can read these.
 */
export async function PilotRequestsList() {
  const supabase = await createClient();
  const [pending, approved] = await Promise.all([
    supabase
      .from("pilot_requests")
      .select(
        "id, contact_name, role, pharmacy_name, ods_code, postcode, email, phone, message, created_at",
      )
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("pilot_requests")
      .select("id, contact_name, pharmacy_name, email, demo_token, reviewed_at")
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false })
      .limit(20),
  ]);
  if (pending.error) throw pending.error;
  if (approved.error) throw approved.error;
  const origin = await siteOrigin();
  const now = new Date();

  return (
    <div className="space-y-6">
      {pending.data.length === 0 ? (
        <EmptyState icon="inbox">No pilot requests waiting.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {pending.data.map((req) => (
            <li key={req.id} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <p className="font-semibold">
                {req.pharmacy_name}
                <span className="font-normal text-muted">
                  {" "}
                  · {req.postcode}
                  {req.ods_code && ` · ODS ${req.ods_code}`}
                </span>
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {req.contact_name}, {req.role} ·{" "}
                <a href={`mailto:${req.email}`} className="text-accent underline">
                  {req.email}
                </a>
                {req.phone && <> · {req.phone}</>} · sent {formatUpdatedAgo(req.created_at, now)}
              </p>
              {req.message && (
                <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm whitespace-pre-line">
                  {req.message}
                </p>
              )}
              <p className="mt-3 text-xs text-muted">
                Approving makes a demo account at the demo pharmacy nearest them, and a private link
                for you to send.
              </p>
              <div className="mt-3">
                <ReviewButtons applicationId={req.id} action={reviewPilotRequest} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {approved.data.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Approved: demo links to send</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {approved.data.map((req) => {
              const link = `${origin}/demo/${req.demo_token}`;
              const email = `mailto:${req.email}?subject=${encodeURIComponent(
                "Your NearShelf demo",
              )}&body=${encodeURIComponent(
                `Hi ${req.contact_name},\n\nThanks for your interest in the NearShelf pilot. Here is your private demo link:\n\n${link}\n\nIt signs you straight in as staff at a pretend pharmacy, with pretend neighbours, so you can try searching, asking every pharmacy nearby, confirming and the handover chat. Please don't share it.\n\nI'd love to hear what you think.\n\nKind regards,`,
              )}`;
              return (
                <li
                  key={req.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {req.pharmacy_name}{" "}
                      <span className="font-normal text-muted">· {req.contact_name}</span>
                    </p>
                    <p className="truncate font-mono text-xs text-muted">{link}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <CopyButton text={link} label="Copy link" />
                    <a href={email} className={button.small}>
                      <Icon name="message" className="h-3.5 w-3.5" />
                      Email it
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
