"use client";
// Leaflet touches `window` as soon as it loads, so this file must only run in
// the browser. NearbySearch loads it with next/dynamic and `ssr: false`.
//
// We use Leaflet directly rather than react-leaflet: react-leaflet 5 reuses a
// map it has already destroyed when React re-mounts components (which React
// does on purpose in development), and crashes.

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/geo";
import { formatDistance, STOCK_LABELS } from "@/lib/stock";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // 1. Create the map when the component appears; destroy it when it goes.
  //    A re-mount runs this again and gets a brand-new map.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // 2. Redraw the markers whenever the results change (e.g. a live update).
  useEffect(() => {
    const markers = markersRef.current;
    if (!markers) return;
    markers.clearLayers();

    // One marker per pharmacy. Results come best-level-first, so the first row
    // for a pharmacy is the one to colour its marker by.
    const byPharmacy = new Map<string, NearbyStockResult[]>();
    for (const row of results) {
      byPharmacy.set(row.pharmacy_id, [...(byPharmacy.get(row.pharmacy_id) ?? []), row]);
    }

    for (const rows of byPharmacy.values()) {
      const best = rows[0]; // every list here has at least one row
      L.circleMarker([best.lat, best.lng], {
        radius: 10,
        color: "#fff",
        weight: 2,
        fillColor: MARKER_COLOURS[best.level],
        fillOpacity: 0.9,
      })
        .bindPopup(popupFor(rows))
        .addTo(markers);
    }

    // Added last so it sits on top of nearby pharmacy markers.
    L.circleMarker([origin.lat, origin.lng], {
      radius: 7,
      color: "#fff",
      weight: 2,
      fillColor: "#2563eb",
      fillOpacity: 1,
    })
      .bindTooltip("You searched from here")
      .addTo(markers);
  }, [origin, results]);

  // 3. Zoom to fit the searcher and every pharmacy, but only when the points
  //    move: a live stock update shouldn't undo the user's panning.
  const pointsKey = [origin, ...results].map((p) => `${p.lat},${p.lng}`).join(";");
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points = pointsKey.split(";").map((p) => p.split(",").map(Number) as [number, number]);
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
  }, [pointsKey]);

  return (
    <div
      ref={containerRef}
      className="z-0 h-80 w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
    />
  );
}

/**
 * Popup content built as DOM nodes with `textContent`, never as an HTML
 * string: Leaflet would run any HTML in a name, so a pharmacy called
 * "<img src=x onerror=…>" could run code in the user's browser (XSS).
 */
function popupFor(rows: NearbyStockResult[]): HTMLElement {
  const best = rows[0];
  const box = document.createElement("div");
  const line = (text: string, bold = false) => {
    const el = document.createElement(bold ? "strong" : "div");
    el.textContent = text;
    box.append(el);
  };
  line(best.pharmacy_name, true);
  line(`${formatDistance(best.distance_m)} away`);
  for (const row of rows) line(`${row.medicine_name}: ${STOCK_LABELS[row.level]}`);
  return box;
}
