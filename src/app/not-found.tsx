import Link from "next/link";
import { Card, Icon, LogoMark, button } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-20">
      <Card className="w-full max-w-md p-8 text-center">
        <LogoMark className="mx-auto h-12 w-12" />
        <p className="mt-5 text-xs font-semibold tracking-[0.14em] text-accent uppercase">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">We can&apos;t find that page</h1>
        <p className="mt-2 text-muted">The link may be old, or the address mistyped.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/search" className={button.primary}>
            <Icon name="search" className="h-4 w-4" />
            Find a medicine
          </Link>
          <Link href="/" className={button.secondary}>
            Home
          </Link>
        </div>
      </Card>
    </main>
  );
}
