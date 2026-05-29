import Link from "next/link";
import MobileNavMenu from "./MobileNavMenu";
import ShareDropdown from "./ShareDropdown";
import FirstVisitHints from "./FirstVisitHints";

type NavKey =
  | "dashboard"
  | "queue"
  | "enrollments"
  | "county"
  | "outreach"
  | "qc"
  | "compliance"
  | "ops"
  | "findings";

// Primary nav — 6 daily-driver tabs. Why Civica + Findings were demoted
// to the right-anchored Share dropdown per /plan-design-review D8 +
// /plan-ceo-review D2 (selective expansion) — they're partner-facing
// shareable surfaces, not navigator-routine destinations.
//
// §10106 / county cost-share dashboard remains hidden from nav (still
// reachable by direct URL /county) for B2G demo flexibility.
const NAV_ITEMS: { key: NavKey; href: string; label: string }[] = [
  { key: "dashboard",   href: "/dashboard",    label: "Home" },
  { key: "queue",       href: "/packets",      label: "Applications" },
  { key: "outreach",    href: "/outreach",     label: "Outreach" },
  { key: "enrollments", href: "/enrollments",  label: "Renewals" },
  { key: "qc",          href: "/qc",           label: "Quality Control" },
  // Internal corporate dashboard — visible in nav for admin/operator/navigator.
  // Middleware gate blocks audience roles (county/state_deputy/cbo_preview).
  { key: "ops",         href: "/ops",          label: "Performance" },
];

// Items folded into the Share dropdown (rendered separately by ShareDropdown).
// Used by MobileNavMenu so the mobile hamburger still shows them.
const SHARE_NAV_ITEMS: { key: NavKey; href: string; label: string }[] = [
  { key: "compliance",  href: "/compliance",   label: "Why Civica" },
  { key: "findings",    href: "/findings",     label: "Findings" },
];

const ALL_NAV_ITEMS = [...NAV_ITEMS, ...SHARE_NAV_ITEMS];

export default function AppHeader({ email, active }: { email?: string; active: NavKey }) {
  return (
    <>
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
        {/* Share dropdown — partner-facing surfaces demoted from primary nav.
            Client component; renders only a button until the user opens it. */}
        <div className="hidden md:block">
          <ShareDropdown active={active} />
        </div>
        <kbd
          className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-white/45 hover:text-white/80 transition-colors border border-white/15 hover:border-white/30 rounded px-1.5 py-0.5"
          aria-label="Open command palette, Command K"
          title="Open command palette (⌘K)"
        >
          ⌘K
        </kbd>
        {email && <span className="hidden md:inline text-[13px] text-white/50">{email}</span>}
        <form action="/auth/signout" method="post">
          <button className="text-[13px] font-medium text-white/65 hover:text-white transition-colors">Sign out</button>
        </form>
        {/* Mobile hamburger — md:hidden internally. Shows ALL nav items
            (including the Share ones) since the mobile dropdown has plenty
            of room and we'd rather not nest another dropdown on mobile. */}
        <MobileNavMenu items={ALL_NAV_ITEMS} active={active} />
      </div>
    </header>
    <FirstVisitHints />
    </>
  );
}

function NavTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-[4px] text-[13px] font-semibold transition-colors whitespace-nowrap min-h-[44px] flex items-center focus:outline-none focus:ring-2 focus:ring-white/30 ${
        active
          ? "bg-white/15 text-white"
          : "text-white/55 hover:text-white hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}
