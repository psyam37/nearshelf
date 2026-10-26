"use client";
// Leaflet touches `window` as soon as it loads, so this file must only run in
// the browser. NearbySearch loads it with next/dynamic and `ssr: false`.

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { formatDistance, STOCK_LABELS } from "@/lib/stock";
import type { LatLng } from "@/lib/geo";
import type { NearbyStockResult, StockLevel } from "@/lib/types";

const MARKER_COLOURS: Record<StockLevel, string> = {
  in_stock: "#059669", // emerald-600
  low: "#d97706", // amber-600
  out_of_stock: "#e11d48", // rose-600
};

interface StockMapProps {
  origin: LatLng;
  results: NearbyStockResult[];
}

export default function StockMap({ origin, results }: StockMapProps) {
  // One marker per pharmacy. Results come best-level-first, so the first row
  // we see for a pharmacy is the one to colour its marker by.
  const byPharmacy = new Map<string, NearbyStockResult[]>();
  for (const row of results) {
    byPharmacy.set(row.pharmacy_id, [...(byPharmacy.get(row.pharmacy_id) ?? []), row]);
  }

  return (
    <MapContainer
      center={[origin.lat, origin.lng]}
      zoom={14}
      scrollWheelZoom={false}
      className="h-80 w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToPoints origin={origin} results={results} />

      {[...byPharmacy.values()].map((rows) => {
        const best = rows[0]; // every list here has at least one row
        return (
          <CircleMarker
            key={best.pharmacy_id}
            center={[best.lat, best.lng]}
            radius={10}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillColor: MARKER_COLOURS[best.level],
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <strong>{best.pharmacy_name}</strong>
              <br />
              {formatDistance(best.distance_m)} away
              {rows.map((row) => (
                <span key={row.medicine_id}>
                  <br />
                  {row.medicine_name}: {STOCK_LABELS[row.level]}
                </span>
              ))}
            </Popup>
          </CircleMarker>
        );
      })}

      {/* Drawn last so it sits on top of nearby pharmacy markers. */}
      <CircleMarker
        center={[origin.lat, origin.lng]}
        radius={7}
        pathOptions={{ color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }}
      >
        <Tooltip>You searched from here</Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}

// MapContainer only uses `center` when it first appears, so when the results
// change we move the map ourselves to show the searcher and every pharmacy.
function FitToPoints({ origin, results }: StockMapProps) {
  const map = useMap();
  // A string that changes only when the points do, so the effect doesn't
  // re-run (and re-zoom) on every render.
  const pointsKey = [origin, ...results].map((p) => `${p.lat},${p.lng}`).join(";");

  useEffect(() => {
    const points = pointsKey.split(";").map((p) => p.split(",").map(Number) as [number, number]);
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
  }, [map, pointsKey]);

  return null;
}
