import Link from "next/link";
import { LogoMark } from "@/components/ui";

const LINKS = [
  { href: "/pharmacies", label: "For pharmacies" },
  { href: "/find", label: "Find your medicine" },
  { href: "/install", label: "Install the app" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/barcodes", label: "Demo barcodes" },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 text-sm text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="flex items-center gap-2.5">
          <LogoMark className="h-6 w-6" />
          <span>
            <span className="font-semibold text-ink">MediBase</span> · Pilot. Demo pharmacies are
            fictional. Not for emergencies or medical advice.
          </span>
        </p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
