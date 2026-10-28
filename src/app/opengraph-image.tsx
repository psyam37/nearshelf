import { OG_SIZE, ogCard } from "@/lib/og-card";

export const alt = "MediBase: live medicine stock between nearby pharmacies";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Live stock between pharmacies",
    title: "Find the medicine.",
    accent: "Skip the calls.",
    subtitle: "See which pharmacies nearby have it, and ask them all in one tap.",
    rows: [
      { name: "Hoxton Square Pharmacy", meta: "0.1 mi · confirmed 8 min ago", level: "in" },
      { name: "Old Street Chemist", meta: "0.3 mi · confirmed 25 min ago", level: "low" },
      { name: "Haggerston Pharmacy", meta: "0.9 mi · checked 3 h ago", level: "unverified" },
    ],
    toast: { title: "Patient waiting: Sertraline 50mg", body: "Hoxton Square Pharmacy is asking" },
  });
}
