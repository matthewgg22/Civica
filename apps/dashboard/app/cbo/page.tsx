// /cbo — authenticated CBO workspace (Phase 2).
//
// Staff-only for now (navigator/admin); cbo_assister enablement is a separate
// cross-cutting rollout (see GitHub issue — RLS across ~10 tables + endpoint
// auth + operator seeding). roleRouting already reserves /cbo for cbo_assister,
// so they reach this page once enabled (and see RLS-scoped rows).
//
// This is the REAL-data sibling of the public synthetic /cbo-preview: it lists
// the org's packets (RLS-scoped — never the public prefix, so real PII stays
// gated) and links into per-case detail with the assignment / buddy / portal
// cards fed by lib/cbo/real-adapter.ts.
import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import ExtensionInstallCard from "../../components/cbo/ExtensionInstallCard";
import { submitterExtensionUrl } from "../../lib/cbo/extension";
import { timeAgo, firstNameLastInitial, decryptDemoName, shortId } from "../../lib/format";

export const dynamic = "force-dynamic";

type Packet = {
  packet_id: string;
  status: string;
  county: string | null;
  updated_at: string;
  applicants: { full_name_ciphertext: string | null } | null;
};

export default async function CboWorkspacePage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: packetsRaw } = await supabase
    .schema("snap_enrollment")
    .from("snap_packets")
    .select(`packet_id, status, county, updated_at, applicants(full_name_ciphertext)`)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  const packets = (packetsRaw ?? []) as Packet[];

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline bg-surface">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-ink">Civica · CBO workspace</span>
          {user?.email && <span className="hidden md:inline text-[13px] text-muted">{user.email}</span>}
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <header className="mb-5">
          <p className="eyebrow">Civica · CBO workspace</p>
          <h1 className="text-[26px] font-semibold text-ink leading-tight">Your cases</h1>
          <p className="section-sub mt-1">
            Real applicant cases for your organization. Open a case to review the
            caseworker assignment, the applicant&rsquo;s helper, and the BenefitsCal handoff.
          </p>
        </header>

        <div className="mb-6">
          <ExtensionInstallCard installUrl={submitterExtensionUrl()} />
        </div>

        {packets.length === 0 ? (
          <div className="bg-surface border border-hairline rounded-[4px] p-8 text-center">
            <p className="text-[15px] font-semibold text-ink">No cases yet</p>
            <p className="text-[13px] text-muted mt-1">
              When applications are assigned to your organization, they appear here.
            </p>
          </div>
        ) : (
          <ul className="bg-surface border border-hairline rounded-[4px] divide-y divide-hairline">
            {packets.map((p) => (
              <li key={p.packet_id}>
                <Link
                  href={`/cbo/${p.packet_id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-row-hover transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink truncate">
                      {firstNameLastInitial(decryptDemoName(p.applicants?.full_name_ciphertext ?? null)) ||
                        `Case ${shortId(p.packet_id)}`}
                    </p>
                    <p className="text-[12px] text-graphite">
                      {p.county ? `${p.county} County` : "—"} · updated {timeAgo(p.updated_at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] text-graphite">{p.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
