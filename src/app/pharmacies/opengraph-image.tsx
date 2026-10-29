import { OG_SIZE, ogCard } from "@/lib/og-card";

export const alt = "NearShelf for pharmacies: stop phoning round, find it in one tap";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Free pilot for local pharmacies",
    title: "Stop phoning round.",
    accent: "Find it in one tap.",
    subtitle: "One request to every pharmacy within 5 miles. Held for 30 minutes. No patient data.",
    rows: [
      { name: "Shoreditch Health", meta: "Confirmed we have it · held 30 min", level: "in" },
      { name: "Old Street Chemist", meta: "0.3 mi · confirmed 25 min ago", level: "low" },
      { name: "Angel Late Pharmacy", meta: "1.2 mi · waiting for an answer", level: "unverified" },
    ],
    toast: { title: "Old Street Chemist has it", body: "Held for your patient for 30 minutes" },
  });
}
