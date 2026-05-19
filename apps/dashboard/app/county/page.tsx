import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClientFromCookies } from "../../lib/supabase";
import { homeForRole } from "../../lib/roleRouting";

export const dynamic = "force-dynamic";

// T5 audience view: county DPSS director. Frames the §10106 admin cost-share
// pitch (federal admin reimbursement drops 50% → 25% Oct 1, 2026). This is
// the most urgent first-cell per CEO review — county directors are the
// buyer for the admin-cost-reduction pitch, and the deadline lands first.
// Content lands in a follow-up PR; this stub establishes the route + role
// guard so middleware/role-provisioning can land first.
export default async function CountyPage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: unknown } | null)?.role;

  if (typeof role !== "string" || (role !== "county_director" && role !== "admin")) {
    redirect(typeof role === "string" ? homeForRole(role) : "/login");
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="px-8 py-6 border-b border-hairline">
        <p className="text-[11px] text-muted uppercase tracking-wider font-medium">Civica · County DPSS</p>
        <h1 className="text-2xl font-semibold text-ink mt-2 tracking-tight">Per-case processing cost</h1>
        <p className="text-sm text-graphite mt-1">§10106 admin cost-share: 50% → 25% federal match starts Oct 1, 2026</p>
      </header>
      <section className="px-8 py-12 max-w-4xl">
        <div className="border border-hairline rounded-[4px] bg-surface p-8">
          <h2 className="text-base font-semibold text-ink">Coming soon</h2>
          <p className="text-sm text-graphite mt-2 leading-relaxed">
            This view will show per-case admin processing time, cost per application,
            and applications-per-navigator throughput for your county. Targeted at
            DPSS directors evaluating outreach partners that reduce back-and-forth
            correction cycles ahead of the FY2027 admin cost-match cut.
          </p>
          <p className="text-xs text-graphite mt-4">
            Route + role guard active. Content lands in a follow-up PR (prioritized — most urgent of the three first-cells).
          </p>
        </div>
      </section>
    </main>
  );
}
