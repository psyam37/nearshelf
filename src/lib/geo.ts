// Turning "where am I?" into a latitude/longitude, in the browser.
import { z } from "zod";

export interface LatLng {
  lat: number;
  lng: number;
}

/** A point plus a human-readable name, e.g. "Your location" or "N1 6AA". */
export interface NamedLocation extends LatLng {
  label: string;
}

// The demo pharmacies are around these two places (see supabase/seed.sql).
export const DEMO_LOCATIONS = [
  { label: "Shoreditch, London", lat: 51.526, lng: -0.08 },
  { label: "Nottingham centre", lat: 52.954, lng: -1.15 },
] as const satisfies readonly NamedLocation[];

/** Asks the browser for the device's location. Rejects with a readable message. */
export function getBrowserLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser can't share its location"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied. Try a postcode instead."
              : "Couldn't get your location. Try a postcode instead.",
          ),
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  });
}

// postcodes.io is a free UK postcode lookup. We only trust the fields we
// check here: data from another service is "unknown" until validated.
const postcodeResponseSchema = z.object({
  result: z.object({
    postcode: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }),
});

/** Looks up a UK postcode, e.g. "N1 6AA". */
export async function lookupPostcode(postcode: string): Promise<NamedLocation> {
  const cleaned = postcode.trim().toUpperCase();
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`);
  if (res.status === 404) throw new Error(`"${cleaned}" isn't a UK postcode we can find`);
  if (!res.ok) throw new Error("Postcode lookup is unavailable right now");

  const parsed = postcodeResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("Postcode lookup returned something unexpected");

  const { result } = parsed.data;
  return { label: result.postcode, lat: result.latitude, lng: result.longitude };
}
