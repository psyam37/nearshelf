import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The site's public address, for links in shared previews. Set
// NEXT_PUBLIC_SITE_URL for a custom domain; on Vercel the production address
// is provided automatically.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Pages set just their own part, e.g. "Requests" → "Requests · MediBase".
  title: {
    default: "MediBase · Find the medicine. Skip the phone calls.",
    template: "%s · MediBase",
  },
  description:
    "MediBase shows pharmacy teams which nearby pharmacies have a medicine in stock, live, so they can stop phoning around.",
  applicationName: "MediBase",
  // How links look when shared (WhatsApp, iMessage, Slack, LinkedIn, email…).
  // The images come from the opengraph-image files next to each page.
  openGraph: {
    type: "website",
    siteName: "MediBase",
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
