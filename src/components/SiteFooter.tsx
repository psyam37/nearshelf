import Link from "next/link";
import { LogoMark } from "@/components/ui";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-2.5">
          <LogoMark className="h-6 w-6" />
          <span>
            <span className="font-semibold text-ink">MediBase</span> · A demo project. All
            pharmacies are fictional. Not for clinical use.
          </span>
        </p>
        <Link href="/barcodes" className="hover:text-ink">
          Demo barcodes
        </Link>
      </div>
    </footer>
  );
}
