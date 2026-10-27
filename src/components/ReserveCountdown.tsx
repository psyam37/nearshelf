"use client";

import { useNow } from "@/hooks/useNow";

/** "Held for 23 min · until 14:35", then "Hold ended" once the time passes. */
export function ReserveCountdown({ until }: { until: string }) {
  const now = useNow(15_000);
  const end = new Date(until).getTime();

  if (now === null) return <span>Held for 30 minutes</span>; // server / first paint
  const minutesLeft = Math.ceil((end - now) / 60_000);
  if (minutesLeft <= 0) return <span>Hold ended</span>;

  const time = new Date(end).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <span>
      Held for {minutesLeft} min · until {time}
    </span>
  );
}
