import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClientFromCookies } from "../../../lib/supabase";
import AppHeader from "../../../components/AppHeader";
import DataSourcesPanel from "../../../components/compliance/DataSourcesPanel";
import { publicDataSources } from "../../../lib/analytics/obbba";

export const dynamic = "force-dynamic";

export default async function ComplianceSourcesPage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const sources = publicDataSources();

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="compliance" />

      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="mb-6">
          <Link
            href="/compliance"
            className="text-[12px] text-graphite hover:text-pine inline-flex items-center gap-1.5 mb-4 font-medium"
          >
            ← Back to compliance
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-1.5">
            Provenance · public data sources behind all five pillars
          </p>
          <h1 className="text-[28px] font-bold tracking-tight text-ink leading-tight">
            Sources &amp; provenance
          </h1>
          <p className="text-[14px] text-graphite mt-2 max-w-3xl leading-relaxed">
            Every external dataset Civica leans on for the compliance dashboards,
            plus the FOIA targets that close the remaining gaps. Refresh dates
            marked <span className="font-mono">2026-05-20</span> are sources we
            don&apos;t refresh on a schedule yet.
          </p>
        </div>

        <DataSourcesPanel sources={sources} />
      </div>
    </div>
  );
}
