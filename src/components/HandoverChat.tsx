"use client";
// Text-only chat between the two pharmacies while stock is held. It opens
// with "Confirm we have it" and closes with the hold. Never patient details:
// checked as you type, by the Server Action, and by the database.

import { useActionState, useEffect, useState } from "react";
import { sendMessage, type ActionState } from "@/app/requests/actions";
import { Icon } from "@/components/ui";
import { useNow } from "@/hooks/useNow";
import { useTableChanges } from "@/hooks/useTableChanges";
import { findPatientDetails } from "@/lib/patient-data";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  body: string;
  created_at: string;
  sender_pharmacy_id: string;
}

interface HandoverChatProps {
  requestId: string;
  myPharmacyId: string;
  otherPharmacyName: string;
  reservedUntil: string | null;
}

export function HandoverChat({
  requestId,
  myPharmacyId,
  otherPharmacyName,
  reservedUntil,
}: HandoverChatProps) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [reload, setReload] = useState(0);
  const now = useNow(15_000);
  const open = reservedUntil !== null && (now === null || new Date(reservedUntil).getTime() > now);

  // Load the conversation, and again whenever a message arrives.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("request_messages")
      .select("id, body, created_at, sender_pharmacy_id")
      .eq("request_id", requestId)
      .order("created_at")
      .then(({ data }) => {
        if (!cancelled && data) setMessages(data);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, reload]);
  useTableChanges("request_messages", `request_id=eq.${requestId}`, () => setReload((n) => n + 1));

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await sendMessage(prev, formData);
      if (result.status === "done") {
        setDraft("");
        setReload((n) => n + 1);
      }
      return result;
    },
    { status: "idle" },
  );

  const warning = draft ? findPatientDetails(draft) : null;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
      <p className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-muted">
        <Icon name="message" className="h-4 w-4" />
        Chat with {otherPharmacyName}
        <span className="ml-auto font-normal">{open ? "Text only" : "Closed"}</span>
      </p>

      <ul className="max-h-60 space-y-2 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
        {messages === null ? (
          <li className="text-muted">Loading…</li>
        ) : messages.length === 0 ? (
          <li className="text-muted">
            {open ? "No messages yet. Say when the patient is on their way." : "No messages."}
          </li>
        ) : (
          messages.map((m) => {
            const mine = m.sender_pharmacy_id === myPharmacyId;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <span
                  className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${
                    mine ? "bg-brand-700 text-white dark:bg-brand-600" : "bg-surface-2 text-ink"
                  }`}
                >
                  {m.body}
                </span>
              </li>
            );
          })
        )}
      </ul>

      {open ? (
        <form action={formAction} className="border-t border-line p-3">
          <input type="hidden" name="requestId" value={requestId} />
          <div className="flex gap-2">
            <input
              name="body"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              autoComplete="off"
              placeholder="e.g. Patient on their way, 10 minutes"
              aria-label={`Message ${otherPharmacyName}`}
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim() || warning !== null}
              className="rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50 dark:bg-brand-600"
            >
              Send
            </button>
          </div>
          <p className="mt-1.5 text-xs">
            {warning ? (
              <span className="font-medium text-rose-600">
                That looks like {warning}. Never share patient details here.
              </span>
            ) : state.status === "error" ? (
              <span className="text-rose-600">{state.message}</span>
            ) : (
              <span className="text-muted">No names, NHS numbers or dates of birth.</span>
            )}
          </p>
        </form>
      ) : (
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
          The chat closed when the hold ended.
        </p>
      )}
    </div>
  );
}
