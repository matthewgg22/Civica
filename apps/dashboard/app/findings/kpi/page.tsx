// KPI steering-tree — live page (/findings/kpi).
//
// PUBLIC route (static segment under /findings, in FULLY_PUBLIC_PREFIXES; a real
// folder takes precedence over the sibling [id] dynamic segment). Renders the
// three-pillar KPI tree from the live snapshot via getKpiTruthPoint() (server-only,
// service-role client). Degrades to a "pending" state when unpopulated.
//
// KPI framework: office-hours design 2026-05-30 + /plan-eng-review Phase 1.

import type { Metadata } from "next";
import Link from "next/link";
import { getKpiTruthPoint } from "../../../lib/analytics/kpi-snapshot";
import KpiPillarTree from "../../../components/findings/KpiPillarTree";
import PerGapPanel from "../../../components/findings/PerGapPanel";

// Live data — revalidate every 5 minutes (the snapshot refreshes daily + on demand).
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Civica KPIs — the steering tree",
  description:
    "Civica's three-pillar KPI tree (Get In / Stay Engaged / Stay On). Each KPI shows a leading in-app proxy now, bound to a measured lagging outcome that flips on once real data arrives — measured error rate never borrows a self-reported figure.",
};

export default async function KpiPage() {
  const truthPoint = await getKpiTruthPoint();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <nav className="mb-8 text-sm">
        <Link
          href="/findings"
          className="text-graphite underline-offset-2 hover:text-pine hover:underline"
        >
          ← All findings
        </Link>
      </nav>

      <header className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wider text-graphite">
          The steering tree
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          What we steer by
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-graphite">
          One leading KPI per pillar, each bound to a lagging outcome. We show the{" "}
          <strong className="font-semibold text-ink">leading</strong> proxy we can
          compute today and let it flip to a{" "}
          <strong className="font-semibold text-ink">measured</strong> reading once
          real outcomes arrive — never claiming a result we cannot back.
        </p>
      </header>

      <KpiPillarTree truthPoint={truthPoint} />

      <div className="mt-10 border-t border-hairline pt-10">
        <PerGapPanel truthPoint={truthPoint} />
      </div>
    </main>
  );
}
