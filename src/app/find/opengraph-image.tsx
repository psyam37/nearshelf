import { OG_SIZE, ogCard } from "@/lib/og-card";

export const alt = "NearShelf: find your medicine at a pharmacy near you";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "For patients",
    title: "Out of stock?",
    accent: "Find it nearby.",
    subtitle:
      "Pharmacies near you share hard-to-find medicines they have in stock. Call ahead, then go.",
    rows: [
      { name: "Hoxton Square Pharmacy", meta: "0.1 mi · reported 8 min ago", level: "in" },
      { name: "Shoreditch Health", meta: "0.2 mi · reported 41 min ago", level: "in" },
      { name: "Old Street Chemist", meta: "0.3 mi · reported 25 min ago", level: "low" },
    ],
    toast: { title: "Estradiol 0.06% gel", body: "2 pharmacies near N1 have it" },
  });
}
