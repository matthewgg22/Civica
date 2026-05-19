import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClientFromCookies } from "../../lib/supabase";
import { homeForRole } from "../../lib/roleRouting";

export const dynamic = "force-dynamic";

// T5 audience view: prospective CBO licensee (read-only demo). Shows what a
// CBO would see if they licensed the Civica platform — enrollment funnel,
// error-rate comparison vs their current process, navigator productivity.
// Used as a sales asset during licensing conversations. Content lands in a
// follow-up PR (lower priority than /county; CDSS and CBO views can ship
// after the urgent county pitch).
export default async function CBOPreviewPage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: unknown } | null)?.role;

  if (typeof role !== "string" || (role !== "cbo_preview" && role !== "admin")) {
    redirect(typeof role === "string" ? homeForRole(role) : "/login");
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="px-8 py-6 border-b border-hairline">
        <p className="text-[11px] text-muted uppercase tracking-wider font-medium">Civica · CBO preview</p>
        <h1 className="text-2xl font-semibold text-ink mt-2 tracking-tight">Platform preview</h1>
        <p className="text-sm text-graphite mt-1">Read-only demo for prospective licensee CBOs</p>
      </header>
      <section className="px-8 py-12 max-w-4xl">
        <div className="border border-hairline rounded-[4px] bg-surface p-8">
          <h2 className="text-base font-semibold text-ink">Coming soon</h2>
          <p className="text-sm text-graphite mt-2 leading-relaxed">
            This view will show enrollment funnel from intake to handoff, error rate
            comparison against the CBO&apos;s current manual process, and navigator
            throughput — the value proposition for CBOs evaluating whether to
            license the Civica platform vs continuing manual SNAP outreach.
          </p>
          <p className="text-xs text-graphite mt-4">
            Route + role guard active. Content lands in a follow-up PR.
          </p>
        </div>
      </section>
    </main>
  );
}
