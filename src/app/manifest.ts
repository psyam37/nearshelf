import type { MetadataRoute } from "next";

// Lets MediBase be installed to a phone's home screen like an app, which
// iPhones require before they'll show push notifications.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MediBase",
    short_name: "MediBase",
    description: "Live medicine stock between nearby pharmacies.",
    start_url: "/requests",
    display: "standalone",
    background_color: "#f5f7f6",
    theme_color: "#12392b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
