import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/sign-in/actions";
import { NavLink } from "@/components/NavLink";
import { RequestsLink } from "@/components/RequestsLink";
import { Icon, Logo, button } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getMyPharmacy, isPlatformAdmin } from "@/lib/pharmacy";
import { createClient } from "@/lib/supabase/server";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-[500] border-b border-line bg-canvas/80 backdrop-blur-lg">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="NearShelf home" className="shrink-0">
          <Logo />
        </Link>
        {/* The session is read per request, so only this part waits for it. */}
        <Suspense fallback={<span className="h-8 w-20" />}>
          <AccountLinks />
        </Suspense>
      </nav>
    </header>
  );
}

async function AccountLinks() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <span className="hidden md:inline-flex">
          <NavLink href="/pharmacies">
            <Icon name="store" className="h-[18px] w-[18px]" />
            For pharmacies
          </NavLink>
        </span>
        <NavLink href="/find">
          <Icon name="search" className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Find your medicine</span>
          <span className="sm:hidden">Find</span>
        </NavLink>
        <Link href="/sign-in" className={button.primary}>
          Sign in
        </Link>
      </div>
    );
  }

  const [pharmacy, admin] = await Promise.all([getMyPharmacy(), isPlatformAdmin()]);
  let pendingCount = 0;
  if (pharmacy) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("stock_requests")
      .select("id", { count: "exact", head: true })
      .eq("to_pharmacy_id", pharmacy.id)
      .eq("status", "pending");
    pendingCount = count ?? 0;
  }

  // On phones the labels hide and only the icons show, so it all fits.
  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      <NavLink href="/search">
        <Icon name="search" className="h-[18px] w-[18px]" />
        <span className="hidden sm:inline">Search</span>
      </NavLink>
      <NavLink href="/my-pharmacy">
        <Icon name="store" className="h-[18px] w-[18px]" />
        <span className="hidden sm:inline">My pharmacy</span>
      </NavLink>
      {pharmacy && (
        <NavLink href="/insights">
          <Icon name="chart" className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Insights</span>
        </NavLink>
      )}
      {pharmacy && (
        <NavLink href="/requests">
          <RequestsLink pharmacyId={pharmacy.id} initialPending={pendingCount} />
        </NavLink>
      )}
      {admin && (
        <NavLink href="/admin">
          <Icon name="shield" className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Admin</span>
        </NavLink>
      )}
      <form action={signOut} className="ml-1 border-l border-line pl-1.5 sm:ml-2 sm:pl-2">
        <button
          type="submit"
          title={user.email ? `Sign out ${user.email}` : "Sign out"}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="logout" className="h-[18px] w-[18px]" />
          <span className="sr-only">Sign out</span>
        </button>
      </form>
    </div>
  );
}
