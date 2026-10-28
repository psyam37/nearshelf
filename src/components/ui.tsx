// Small shared building blocks, so every page looks like the same app.
// No hooks or browser APIs here: these work in Server and Client Components.

import type { ReactNode } from "react";

/* ---------------------------------------------------------------- buttons */

// `as const` keeps the exact keys, so `button.primary` autocompletes and
// `button.fancy` is a type error.
export const button = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-900/20 transition-colors hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500 disabled:pointer-events-none disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-60",
  small:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-60",
} as const;

export const input =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base text-ink shadow-sm outline-none transition placeholder:text-muted/70 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

/* ------------------------------------------------------------------ icons */

// Each icon is a 24×24 stroke path. `IconName` is worked out from this
// object's keys, so adding an icon here makes it usable everywhere.
const ICON_PATHS = {
  search: "M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
  store: "M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6",
  inbox: "M3 13h4.5l1.5 3h6l1.5-3H21M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6l2.5-8Z",
  logout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 9v6M10 9v6M13 9v6M17 9v6",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3Zm-3 9 2 2 4-4",
  message: "M4 5h16v11H8l-4 4V5Zm4 5h8M8 8h5",
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z",
  phone:
    "M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  mobile: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 17h2",
  monitor: "M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm4 16h8m-4-4v4",
  download: "M12 3v12m-5-5 5 5 5-5M5 21h14",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/* ------------------------------------------------------------------- logo */

/** The MediBase mark: a cross in a rounded square, on the logo's green. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={className}>
      <defs>
        <linearGradient id="mb-logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12392b" />
          <stop offset="1" stopColor="#1c543f" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#mb-logo-bg)" />
      <g fill="none" stroke="#fff" strokeWidth="26" strokeLinejoin="round">
        <rect x="116.5" y="116.5" width="278" height="278" rx="78" />
        <path d="M217 172Q217 163 226 163L285 163Q294 163 294 172L294 213Q294 217 298 217L339 217Q348 217 348 226L348 285Q348 294 339 294L298 294Q294 294 294 298L294 339Q294 348 285 348L226 348Q217 348 217 339L217 298Q217 294 213 294L172 294Q163 294 163 285L163 226Q163 217 172 217L213 217Q217 217 217 213Z" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">
        Medi<span className="text-brand-700 dark:text-brand-300">Base</span>
      </span>
    </span>
  );
}

/* ---------------------------------------------------------- page sections */

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">{eyebrow}</p>
        )}
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-balance sm:text-[34px]">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-prose text-muted">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/** A dashed box for "nothing here yet" messages. */
export function EmptyState({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
      {icon && (
        <span className="rounded-full bg-surface-2 p-3 text-accent">
          <Icon name={icon} className="h-5 w-5" />
        </span>
      )}
      <div className="max-w-sm">{children}</div>
    </div>
  );
}

/** Grey placeholder blocks shown while something loads. */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 p-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </Card>
  );
}
