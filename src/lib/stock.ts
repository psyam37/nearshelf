import type { StockLevel } from "./types";

export const STOCK_LABELS: Record<StockLevel, string> = {
  in_stock: "In stock",
  low: "Low stock",
  out_of_stock: "Out of stock",
};

/** "just now", "25 min ago", "3 h ago", "2 days ago" */
export function formatUpdatedAgo(isoTimestamp: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(isoTimestamp).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/**
 * Stock is "verified" for this long after a pharmacy last confirmed it, then
 * shown as "Unverified": pharmacy stock changes by the minute, and a wrong
 * "in stock" sends a patient on a wasted trip. Keep in step with
 * stock_verified_window() in the database.
 */
export const UNVERIFIED_AFTER_HOURS = 2;

export function isVerified(isoTimestamp: string, now: Date = new Date()): boolean {
  const ageHours = (now.getTime() - new Date(isoTimestamp).getTime()) / 3_600_000;
  return ageHours <= UNVERIFIED_AFTER_HOURS;
}

export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

/** Distances in miles, as UK pharmacies talk about them: "0.4 mi", "3 mi". */
export function formatMiles(metres: number): string {
  const miles = metres / 1609.344;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}
