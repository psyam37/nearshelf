// A small "N requests per minute per visitor" limit for public endpoints,
// so nobody can scrape the whole map. It lives in this server's memory, so
// it's a best effort: on a host that runs many copies of the app, each copy
// counts separately. A shared store (e.g. Redis) would make it exact.
import "server-only";

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** True if `key` may make another request now. */
export function allowRequest(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    // Occasionally forget old visitors so the map doesn't grow forever.
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
    }
    return true;
  }
  current.count++;
  return current.count <= limit;
}

/** The visitor's IP address, as reported by the host's proxy. */
export function clientKey(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
  );
}
