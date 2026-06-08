import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import CBOContactButton from "../../components/CBOContactButton";
import ProductSwitcher from "../../components/ProductSwitcher";
import QcTab from "../../components/cbo/QcTab";
import ApplicationsQueue from "../../components/cbo/ApplicationsQueue";
import OverviewDirector from "../../components/cbo/OverviewDirector";
import { buildPipeline } from "../../lib/cbo/demo-pipeline";

export const dynamic = "force-dynamic";

function cboPreviewEnabled(): boolean {
  const v = process.env.CBO_PREVIEW_ENABLED;
  return v === "true" || v === "1";
}

// Trigger for the synthetic demo caseload. On = populated for visual build,
// debugging, and controlled walkthroughs; off = empty (no fabricated records
// shown), ready for a real-data wiring. Default on. Set CBO_PREVIEW_SYNTHETIC=false
// to turn it off.
function cboSyntheticEnabled(): boolean {
  return process.env.CBO_PREVIEW_SYNTHETIC !== "false";
}

const TABS = [
  { key: "overview", label: "Overview"        },
  { key: "pipeline", label: "Caseload"        },
  { key: "qc",       label: "Quality Control" },
] as const;

type TabKey = typeof TABS[number]["key"];

// Partner CBO identity shown in the header (workspace context). Placeholder for
// the preview — wire `name` / `monogram` to the authenticated org record once
// CBO accounts exist. `demoUser` only shows when no real user is signed in.
const CBO_ORG = {
  name: "Bay Area Community Partners",
  monogram: "BA",
  demoUser: "a.davis@bacp.org",
} as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CBOPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  if (!cboPreviewEnabled()) notFound();

  const params = await searchParams;
  // Unknown / retired sections (e.g. a stale ?section=outreach link) fall back
  // to Overview rather than rendering an empty body.
  const requested = params.section as TabKey | undefined;
  const active: TabKey = TABS.some((t) => t.key === requested) ? (requested as TabKey) : "overview";
  const synthetic = cboSyntheticEnabled();

  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const phases = buildPipeline("CA", new Date(), synthetic);

  return (
    <main className="min-h-screen bg-paper flex flex-col">
      {/* Unified nav bar — matches the staff AppHeader design */}
      <header className="bg-surface border-b border-hairline px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-8 min-w-0">
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/cbo-preview" className="shrink-0 hover:opacity-90 transition-opacity">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/civica-wheat-mark.png" alt="Civica" width={50} height={50} className="w-[50px] h-[50px] object-contain" />
            </Link>
            <div>
              <Link href="/cbo-preview" className="block text-[17px] font-semibold tracking-tight text-ink leading-none hover:opacity-80 transition-opacity">
                Civica
              </Link>
              <div className="mt-0.5">
                <ProductSwitcher currentHref="/cbo-preview" />
              </div>
            </div>
          </div>
          {/* Section tabs */}
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Preview sections">
            {TABS.map((tab) => {
              const isActive = active === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={`/cbo-preview${tab.key === "overview" ? "" : `?section=${tab.key}`}`}
                  className={`px-3 py-1.5 rounded-[2px] text-[14px] font-semibold whitespace-nowrap min-h-[44px] flex items-center transition-colors ${
                    isActive ? "bg-ink/8 text-ink" : "text-graphite hover:text-ink hover:bg-ink/5"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {/* Workspace context: CBO org identity + signed-in user */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-[4px] bg-pine/10 text-pine text-[12px] font-bold shrink-0"
              aria-hidden="true"
            >
              {CBO_ORG.monogram}
            </span>
            <div className="hidden sm:block leading-tight min-w-0">
              <p className="text-[13px] font-semibold text-ink truncate">{CBO_ORG.name}</p>
              <p className="text-[11px] text-graphite truncate">{user?.email ?? CBO_ORG.demoUser}</p>
            </div>
          </div>
          {user && (
            <form action="/auth/signout" method="post" className="border-l border-hairline pl-3 shrink-0">
              <button className="text-[13px] font-medium text-pine hover:underline">Sign out</button>
            </form>
          )}
        </div>
      </header>

      {/* Mobile section tabs — horizontal scroll below the bar */}
      <nav className="md:hidden bg-surface border-b border-hairline px-4 overflow-x-auto scrollbar-none" aria-label="Preview sections">
        <div className="flex items-center gap-0.5">
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/cbo-preview${tab.key === "overview" ? "" : `?section=${tab.key}`}`}
                className={`px-3 py-3 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive ? "border-pine text-ink" : "border-transparent text-graphite"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Page title + section content — centered max-width (fix A) */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-6 md:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-[26px] font-bold tracking-tight leading-none text-ink mt-1">
            {TABS.find((t) => t.key === active)?.label ?? "Overview"}
          </h1>
          <p className="text-[14px] font-medium text-graphite mt-1.5">{CBO_ORG.name}</p>
        </div>
        {active === "overview"  && <OverviewDirector phases={phases} synthetic={synthetic} />}
        {active === "pipeline"  && <ApplicationsQueue phases={phases} />}
        {active === "qc"        && <QcTab synthetic={synthetic} />}
        {synthetic && <p className="text-[11px] text-graphite mt-10">Illustrative caseload</p>}
      </div>

      {/* Contact CTA — always visible, centered */}
      <div className="border-t border-hairline">
        <div className="w-full max-w-6xl mx-auto px-6 md:px-8 py-6">
          <div className="border border-hairline rounded-[2px] bg-surface p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold text-ink">Interested in licensing Civica for your CBO?</p>
              <p className="text-[13px] text-graphite mt-1">We partner with community-based organizations serving SNAP-eligible households.</p>
            </div>
            <CBOContactButton />
          </div>
        </div>
      </div>

    </main>
  );
}

