import { useSyncExternalStore } from "react";

/**
 * The current time in milliseconds, updated every `intervalMs` — or `null`
 * while rendering on the server and during hydration.
 *
 * Why null: the server's clock (and time zone) differ from the browser's, so
 * printing the time on both would make the HTML disagree and React would warn
 * ("hydration mismatch"). Components show something time-free until the
 * browser has the real time.
 *
 * useSyncExternalStore is React's tool for reading a value that lives outside
 * React (here, the clock): `subscribe` says when it changes, `getSnapshot`
 * reads it, `getServerSnapshot` is what the server should use.
 */
export function useNow(intervalMs = 30_000): number | null {
  const tick = useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    },
    // Rounded to the interval, so repeated reads give the same value until
    // the next tick (React requires a stable snapshot).
    () => Math.floor(Date.now() / intervalMs),
    () => null,
  );
  return tick === null ? null : tick * intervalMs;
}
