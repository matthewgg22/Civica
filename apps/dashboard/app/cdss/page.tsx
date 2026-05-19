import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClientFromCookies } from "../../lib/supabase";
import { homeForRole } from "../../lib/roleRouting";

export const dynamic = "force-dynamic";

// T5 audience view: CDSS state deputy. Frames the §10105 FY2028 cost-share
// pitch — statewide PER, error-category breakdown, Civica-enrolled cohort
// vs CA baseline. Content lands in a follow-up PR; this stub establishes
// the route + role guard so middleware/role-provisioning can land first.
export default async function CDSSPage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: unknown } | null)?.role;

  // Defensive: middleware should have routed unauthorized roles away, but
  // server components must enforce their own access — middleware can be
  // bypassed in some edge cases (e.g. internal Next.js prefetch quirks).
  if (typeof role !== "string" || (role !== "state_deputy" && role !== "admin")) {
    redirect(typeof role === "string" ? homeForRole(role) : "/login");
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="px-8 py-6 border-b border-hairline">
        <p className="text-[11px] text-muted uppercase tracking-wider font-medium">Civica · CDSS</p>
        <h1 className="text-2xl font-semibold text-ink mt-2 tracking-tight">Statewide SNAP error rate</h1>
        <p className="text-sm text-graphite mt-1">§10105 measurement window: FY2026 → FY2028 cost-share liability</p>
      </header>
      <section className="px-8 py-12 max-w-4xl">
        <div className="border border-hairline rounded-[4px] bg-surface p-8">
          <h2 className="text-base font-semibold text-ink">Coming soon</h2>
          <p className="text-sm text-graphite mt-2 leading-relaxed">
            This view will show CA statewide PER, error-category breakdown by month,
            and the Civica-enrolled cohort&apos;s error rate against the CA baseline.
            Targeted at CDSS state deputies evaluating outreach subcontractor performance
            for the FY2028 §10105 cost-share calculation.
          </p>
          <p className="text-xs text-graphite mt-4">
            Route + role guard active. Content lands in a follow-up PR.
          </p>
        </div>
      </section>
    </main>
  );
}
