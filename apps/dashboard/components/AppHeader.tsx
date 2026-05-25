import Link from "next/link";
import MobileNavMenu from "./MobileNavMenu";

type NavKey = "dashboard" | "queue" | "enrollments" | "county" | "outreach" | "qc" | "compliance" | "ops";

// §10106 / county cost-share dashboard is intentionally not in the
// top nav — it's a B2G demo surface, still reachable by direct URL
// (/county) for share-outs to county directors. The content exists;
// only the nav entry is hidden to keep the daily-driver bar focused.
const NAV_ITEMS: { key: NavKey; href: string; label: string }[] = [
  { key: "dashboard",   href: "/dashboard",    label: "Home" },
  { key: "queue",       href: "/packets",      label: "Applications" },
  { key: "outreach",    href: "/outreach",     label: "Outreach" },
  { key: "enrollments", href: "/enrollments",  label: "Renewals" },
  { key: "qc",          href: "/qc",           label: "Quality Control" },
  // Internal corporate dashboard — visible in nav for admin/operator/navigator.
  // Middleware gate blocks audience roles (county/state_deputy/cbo_preview).
  // Sits before "Why Civica" so the daily-driver tabs stay grouped left and
  // the marketing/positioning surface stays rightmost.
  { key: "ops",         href: "/ops",          label: "Performance" },
  { key: "compliance",  href: "/compliance",   label: "Why Civica" },
];

export default function AppHeader({ email, active }: { email?: string; active: NavKey }) {
  return (
    <header className="bg-pine px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-4 sm:gap-8 min-w-0">
        <Link href="/dashboard" className="flex items-center gap-3 group shrink-0">
          <div className="w-8 h-8 rounded-[6px] overflow-hidden shrink-0 ring-1 ring-white/15 group-hover:ring-white/30 transition-all">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/civica-mark.svg" alt="Civica" width={32} height={32} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-white leading-none">Civica</p>
            <p className="text-[10px] text-white/45 mt-0.5 uppercase tracking-wider font-semibold">Navigator</p>
          </div>
        </Link>
        {/* Desktop nav — hidden on <md, replaced by MobileNavMenu hamburger */}
        <nav className="hidden md:flex items-center gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavTab key={item.key} href={item.href} label={item.label} active={active === item.key} />
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3 sm:gap-5">
        <kbd
          className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-white/45 hover:text-white/80 transition-colors border border-white/15 hover:border-white/30 rounded px-1.5 py-0.5"
          title="Open command palette (⌘K)"
        >
          ⌘K
        </kbd>
        {email && <span className="hidden md:inline text-[13px] text-white/50">{email}</span>}
        <form action="/auth/signout" method="post">
          <button className="text-[13px] font-medium text-white/65 hover:text-white transition-colors">Sign out</button>
        </form>
        {/* Mobile hamburger — md:hidden internally */}
        <MobileNavMenu items={NAV_ITEMS} active={active} />
      </div>
    </header>
  );
}

function NavTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-[4px] text-[13px] font-semibold transition-colors whitespace-nowrap ${
        active
          ? "bg-white/15 text-white"
          : "text-white/55 hover:text-white hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}
