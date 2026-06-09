// /cbo/[packetId] — authenticated CBO case detail (Phase 2).
//
// Real-data sibling of the synthetic /cbo-preview/application/[id] sheet. It
// renders the SAME prop-only cards (CaseAssignmentCard / BuddyLinkCard /
// PortalAutofillCard) — fed by lib/cbo/real-adapter.ts instead of demo data.
//
// Data sources:
//   - packet (assignment + docCount + applicant header): Supabase, RLS-scoped.
//   - buddies: GET /packets/:id/buddies (service-role, column-restricted — T5).
//   - portal: GET /benefitscal/status/:id.
// The two API calls are wrapped defensively so an unreachable gateway degrades
// to "unassigned / no helper / locked" rather than erroring the page.
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClientFromCookies } from "../../../lib/supabase";
import CaseAssignmentCard from "../../../components/cbo/CaseAssignmentCard";
import BuddyLinkCard from "../../../components/cbo/BuddyLinkCard";
import PortalAutofillCard from "../../../components/cbo/PortalAutofillCard";
import {
  adaptCboCase,
  type RealPacket,
  type RealBuddyRow,
  type RealBenefitsCalStatus,
} from "../../../lib/cbo/real-adapter";
import { api } from "../../../lib/api";
import { decryptDemoName, firstNameLastInitial, shortId } from "../../../lib/format";

export const dynamic = "force-dynamic";

type PacketRow = RealPacket & {
  county?: string | null;
  applicants?: { full_name_ciphertext?: string | null } | null;
};

export default async function CboCaseDetailPage({
  params,
}: {
  params: Promise<{ packetId: string }>;
}) {
  const { packetId } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  // Packet (RLS-scoped). Assignment + docCount + the applicant header derive
  // from here — no API round-trip needed for those.
  const { data: packetRaw } = await supabase
    .schema("snap_enrollment")
    .from("snap_packets")
    .select(
      `packet_id, status, county,
       applicants(full_name_ciphertext),
       packet_assignments(is_current, assigned_at, staff_users(display_name)),
       required_document_items(packet_id)`,
    )
    .eq("packet_id", packetId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!packetRaw) notFound();
  const packet = packetRaw as PacketRow;

  // Buddy + portal need the gateway. Degrade gracefully if it's unreachable.
  let buddies: RealBuddyRow[] = [];
  let benefitsCal: RealBenefitsCalStatus | null = null;
  if (token) {
    try {
      buddies = (await api.packets.buddies(token, packetId)) as RealBuddyRow[];
    } catch {
      buddies = [];
    }
    try {
      benefitsCal = (await api.benefitscal.status(token, packetId)) as RealBenefitsCalStatus;
    } catch {
      benefitsCal = null; // 404 = no submission yet (expected, not an error)
    }
  }

  const vm = adaptCboCase(packet, buddies, benefitsCal);
  const applicantName =
    firstNameLastInitial(decryptDemoName(packet.applicants?.full_name_ciphertext ?? null)) ||
    `Case ${shortId(packetId)}`;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/cbo" className="text-[13px] font-medium text-pine hover:underline">
            ← Back to cases
          </Link>
          {session?.user?.email && (
            <span className="hidden md:inline text-[13px] text-muted">{session.user.email}</span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <article className="bg-surface border border-hairline rounded-[4px] px-8 py-6">
          <header className="pb-4 border-b border-hairline">
            <p className="eyebrow">Case</p>
            <h1 className="text-[20px] font-semibold text-ink">{applicantName}</h1>
            <p className="text-[12px] text-graphite mt-0.5">
              {packet.county ? `${packet.county} County` : "—"} · {packet.status ?? "—"}
            </p>
          </header>

          {/* Case team — caseworker assignment + applicant's personal helper */}
          <section className="grid sm:grid-cols-2 gap-x-8 gap-y-4 py-4 border-b border-hairline">
            <CaseAssignmentCard assignment={vm.assignment} />
            <BuddyLinkCard buddy={vm.buddy} />
          </section>

          {/* Approved answers → BenefitsCal (live autofill runs in the extension) */}
          <PortalAutofillCard portal={vm.portal} />
        </article>
      </main>
    </div>
  );
}
