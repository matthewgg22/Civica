import Link from "next/link";

/**
 * Tab switcher between /outreach (daily tasks) and /outreach/network
 * (entity attribution + approval). Renders as a slim hairline-divider strip
 * at the top of each /outreach page so the operator can switch contexts
 * without losing visual continuity.
 */
export default function OutreachTabs({
  active,
  pendingCount,
}: {
  active: "tasks" | "network";
  /** Surfaces a small badge next to "Network" when there are pending-approval
      entities awaiting operator action. */
  pendingCount?: number;
}) {
  return (
    <div className="border-b border-hairline mb-4">
      <nav className="flex gap-1" aria-label="Outreach sub-navigation">
        <TabLink href="/outreach" label="Daily tasks" active={active === "tasks"} />
        <TabLink
          href="/outreach/network"
          label="Outreach network"
          active={active === "network"}
          badge={pendingCount && pendingCount > 0 ? `${pendingCount} pending` : undefined}
        />
      </nav>
    </div>
  );
}

function TabLink({
  href,
  label,
  active,
  badge,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2.5 text-[13px] font-semibold transition-colors border-b-2 -mb-px inline-flex items-center gap-2 ${
        active
          ? "border-ink text-ink"
          : "border-transparent text-graphite hover:text-ink"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {label}
      {badge && (
        <span className="inline-flex items-center text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-[3px] bg-warning/15 text-warning border border-warning/30">
          {badge}
        </span>
      )}
    </Link>
  );
}
