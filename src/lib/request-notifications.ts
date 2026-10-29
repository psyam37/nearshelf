// What NearShelf says in push notifications about requests. Server only.
// Stock details only: never anything about the patient.
import "server-only";
import { notifyPharmacies, packText } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

/**
 * A new request (one "Ask to confirm", or a whole broadcast): tell the staff
 * at every pharmacy it went to. The sender reads their own requests with
 * their normal session; only finding the devices needs the secret key.
 */
export async function notifyNewRequest(
  which: { broadcastId: string } | { requestId: string },
  senderUserId: string,
) {
  const supabase = await createClient();
  const query = supabase.from("stock_requests").select(
    `id, to_pharmacy_id, urgency, pack_size, quantity, broadcast_id,
       medicine:medicines(name),
       from:pharmacies!stock_requests_from_pharmacy_id_fkey(name)`,
  );
  const { data, error } = await ("broadcastId" in which
    ? query.eq("broadcast_id", which.broadcastId)
    : query.eq("id", which.requestId));
  if (error || !data?.length) return;

  const first = data[0];
  const pack = packText(first.pack_size, first.quantity);
  await notifyPharmacies(
    data.map((r) => r.to_pharmacy_id),
    senderUserId,
    {
      title: `${first.urgency === "urgent" ? "Patient waiting: " : "Stock request: "}${first.medicine.name}`,
      body: `${first.from.name} is asking${pack ? ` for ${pack}` : ""}. Tap to answer.`,
      url: "/requests",
      tag: `request-${first.broadcast_id ?? first.id}`,
    },
  );
}

/** "Confirm we have it": tell the pharmacy that asked. */
export async function notifyConfirmed(requestId: string, responderUserId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_requests")
    .select(
      `from_pharmacy_id,
       medicine:medicines(name),
       to:pharmacies!stock_requests_to_pharmacy_id_fkey(name)`,
    )
    .eq("id", requestId)
    .maybeSingle();
  if (!data) return;

  await notifyPharmacies([data.from_pharmacy_id], responderUserId, {
    title: `${data.to.name} has ${data.medicine.name}`,
    body: "Held for your patient for 30 minutes. Tap for the next steps.",
    url: "/requests",
    tag: `confirmed-${requestId}`,
  });
}
