import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import BaselinePanel from "../../components/qc/BaselinePanel";
import FormulaHero from "../../components/qc/FormulaHero";
import PillarTracking from "../../components/qc/PillarTracking";
import OBBBAReadinessStrip from "../../components/qc/OBBBAReadinessStrip";
import IncomingDataFeed, { type FeedPacket } from "../../components/qc/IncomingDataFeed";
import { deriveObbbaImpact, isObbbaChainEngaged } from "../../lib/analytics/obbba";
import { ENGINE_VERSION } from "@civica/snap-qc-engine";

export const dynamic = "force-dynamic";

// FLOWS retained for BaselinePanel's USDA-baseline comparison row labels.
// The numeric weights below are the LEGACY surface labels (pre-T0); the
// engine's authoritative shares now live in PILLAR_SHARES_UNNORMALIZED. The
// comparison panel still uses these as display labels until BaselinePanel is
// migrated to engine constants (T8 follow-up).
const FLOWS = [
  { id: "sua",    label: "Shelter / Utility (SUA)", weight: 50.5 },
  { id: "gig",    label: "Earned income · gig",     weight: 26.8 },
  { id: "lease",  label: "Shared lease",             weight: 11.4 },
  { id: "assets", label: "Assets",                   weight: 8.2  },
  { id: "calc",   label: "Benefit calculation",      weight: 3.1  },
] as const;

export default async function QCPage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const [packetsRes, argyleRes, riskRes, qcRes, answersRes, shelterDocsRes] = await Promise.all([
    supabase.schema("snap_enrollment").from("snap_packets")
      .select("packet_id, status")
      .is("deleted_at", null)
      .limit(5000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.schema("snap_enrollment") as any).from("argyle_connections")
      .select("packet_id")
      .not("connected_at", "is", null)
      .limit(5000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.schema("snap_enrollment") as any).from("packet_error_risk")
      .select("packet_id, score, tier, factors, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.schema("snap_enrollment") as any).from("qc_outcomes")
      .select("packet_id, qc_sampled, error_found, error_type, logged_at")
      .order("logged_at", { ascending: false })
      .limit(2000),
    supabase.schema("snap_enrollment").from("packet_answers")
      .select("packet_id, question_key, applicant_answer")
      .in("question_key", ["has_heating_costs", "has_electric_or_gas", "has_phone", "housing_situation", "employment_status"])
      .limit(10000),
    // Shelter document coverage: packets with a confirmed lease upload.
    // document_kind='lease', processing_status='confirmed' = OCR ran and
    // applicant confirmed the extracted rent figure.
    // Replaces the previous SUA-answered proxy on ErrorReductionProjectionPanel.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.schema("snap_enrollment") as any).from("uploaded_documents")
      .select("packet_id")
      .eq("document_kind", "lease")
      .eq("processing_status", "confirmed")
      .is("deleted_at", null)
      .limit(10000),
  ]);

  const packets = packetsRes.data ?? [];
  const totalPackets = packets.length;

  // Real shelter-doc count: distinct packets with a confirmed lease upload.
  const shelterDocPacketIds = new Set(
    (shelterDocsRes.data ?? []).map((r: { packet_id: string }) => r.packet_id)
  );
  const shelterDocCount = shelterDocPacketIds.size;

  // ── Per-pillar engagement aggregates (used by FormulaHero + PillarTracking)
  const argylePacketIds = new Set((argyleRes.data ?? []).map((r: { packet_id: string }) => r.packet_id));
  const argyleConnected = argylePacketIds.size;

  // Per-packet answers indexed by packet_id for SUA-flag presence.
  const answers = answersRes.data ?? [];
  const answersByPacket = new Map<string, Record<string, string>>();
  for (const a of answers) {
    const m = answersByPacket.get(a.packet_id) ?? {};
    if (a.applicant_answer != null) m[a.question_key] = a.applicant_answer;
    answersByPacket.set(a.packet_id, m);
  }

  // Extend the answersByPacket fetch keys for OBBBA-impact derivation.
  // (The contract in lib/analytics/obbba.ts documents which keys are read.)
  // For demo / staging where these keys may not yet be present, the helper
  // returns "not_impacted" with a reason — non-blocking.

  // SUA-engaged packet count: at least one of the 3 utility questions answered.
  let suaModerate = 0;
  for (const p of packets) {
    const pa = answersByPacket.get(p.packet_id) ?? {};
    if (pa["has_heating_costs"] || pa["has_electric_or_gas"] || pa["has_phone"]) {
      suaModerate++;
    }
  }

  // ── Per-packet feed rows (IncomingDataFeed)
  // Pull the most-recently-active packets first. packet_error_risk.created_at
  // is a reasonable proxy for last-touched (score recomputed on relevant
  // change). Falls back to packets list order if risk row is absent.
  type RiskRow = { packet_id: string; created_at: string };
  const riskRows: RiskRow[] = (riskRes.data ?? []) as RiskRow[];
  const lastTouchedById = new Map<string, string>();
  for (const r of riskRows) {
    if (!lastTouchedById.has(r.packet_id)) {
      lastTouchedById.set(r.packet_id, r.created_at);
    }
  }
  const feedSorted = [...packets].sort((a, b) => {
    const ta = lastTouchedById.get(a.packet_id) ?? "";
    const tb = lastTouchedById.get(b.packet_id) ?? "";
    return tb.localeCompare(ta);
  });

  function initialsForPacket(packetId: string): string {
    // Demo-safe pseudo-initials from packet ID hash; real PII access requires
    // separate Python-backend decrypt path (memory: dashboard launch audit).
    const tail = packetId.slice(-4).toUpperCase();
    return `${tail[0] ?? "?"}.${tail[1] ?? "?"}.`;
  }

  function daysSinceCreated(packetId: string): number {
    const ts = lastTouchedById.get(packetId);
    if (!ts) return 0;
    const ms = Date.now() - new Date(ts).getTime();
    if (!Number.isFinite(ms)) return 0;
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  }

  const feedPackets: FeedPacket[] = feedSorted.slice(0, 20).map((p) => {
    const pa = answersByPacket.get(p.packet_id) ?? {};
    const hasSuaAnswer = Boolean(
      pa["has_heating_costs"] || pa["has_electric_or_gas"] || pa["has_phone"],
    );
    // OBBBA-impact tag via documented contract (lib/analytics/obbba.ts).
    // "Engaged" = the rule chain ran to a non-pending decision. Pending-
    // counsel cases (Track 1.3 / Track 2/3 / Q5) return false so the row
    // surfaces as "missing OBBBA tag" — directing navigator attention to
    // packets blocked on counsel.
    const obbbaState = deriveObbbaImpact({ packetAnswers: pa });
    return {
      packetId: p.packet_id,
      applicantInitials: initialsForPacket(p.packet_id),
      daysPending: daysSinceCreated(p.packet_id),
      engagement: {
        income: argylePacketIds.has(p.packet_id),
        shelter: shelterDocPacketIds.has(p.packet_id),
        suaFlags: hasSuaAnswer,
        obbbaImpactTagged: isObbbaChainEngaged(obbbaState),
      },
    };
  });

  // ── Baseline vs actual
  type QcRow = { packet_id: string; qc_sampled: boolean; error_found: boolean | null; error_type: string | null; logged_at: string };
  const qcRows: QcRow[] = qcRes.data ?? [];
  const sampledWithError = qcRows.filter((q) => q.qc_sampled && q.error_found === true);
  const sampleN = qcRows.filter((q) => q.qc_sampled).length;

  const errorTypeCounts: Record<string, number> = {};
  for (const q of sampledWithError) {
    const t = q.error_type ?? "unknown";
    errorTypeCounts[t] = (errorTypeCounts[t] ?? 0) + 1;
  }
  const errorTotal = sampledWithError.length;
  const flowIdToErrorKey: Record<string, string> = {
    sua: "utility_sua",
    gig: "gig_income",
    lease: "shared_lease",
    assets: "assets",
    calc: "benefit_impact_projection",
  };

  const USDA_BASELINE: Record<string, number> = {
    sua: 50.5, gig: 26.8, lease: 11.4, assets: 8.2, calc: 3.1,
  };

  const comparison = FLOWS.map((f) => {
    const key = flowIdToErrorKey[f.id];
    const count = errorTypeCounts[key] ?? 0;
    const observed = errorTotal > 0 ? (count / errorTotal) * 100 : null;
    return { flow: f.id, label: f.label, weight: f.weight, baseline: USDA_BASELINE[f.id], observed };
  });

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="qc" />

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-3">
        {/* Page header */}
        <div className="flex items-end justify-between gap-6 pb-3">
          <div>
            <p className="eyebrow mb-1">QC · Compliance intelligence</p>
            <h2 className="text-[26px] font-bold tracking-tight leading-none text-ink">Error Rate Intelligence</h2>
            <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
              How well Civica's evaluation signals cover the USDA payment-error categories, and how
              navigator-logged QC outcomes compare to California's statewide baseline.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <PeriodPicker />
            <button className="border border-hairline px-3 py-2 rounded-[3px] text-[13px] font-medium text-ink hover:bg-paper/80 transition-colors">
              Export FNS-380 →
            </button>
          </div>
        </div>

        <FormulaHero
          totalPackets={totalPackets}
          argyleConnected={argyleConnected}
          shelterDocCount={shelterDocCount}
          suaAnswered={suaModerate}
        />
        <PillarTracking
          totalPackets={totalPackets}
          argyleConnected={argyleConnected}
          shelterDocCount={shelterDocCount}
          suaAnswered={suaModerate}
        />
        <OBBBAReadinessStrip />
        <IncomingDataFeed packets={feedPackets} />
        <BaselinePanel comparison={comparison} sampleN={sampleN} />
      </div>

      <footer className="border-t border-hairline px-8 py-5 flex justify-between items-center text-[11px] text-muted font-mono tracking-wide mt-8">
        <span>Civica · error-rate intelligence · qc-engine v{ENGINE_VERSION} · live</span>
        <span>QC baseline: USDA FNS-380 FY2024 · weights are payment-error contribution</span>
      </footer>
    </div>
  );
}

function PeriodPicker() {
  const options = ["30d", "90d", "FY24"];
  return (
    <div className="inline-flex p-0.5 bg-paper border border-hairline rounded-[4px]">
      {options.map((p) => (
        <button
          key={p}
          className={`px-3 py-1.5 rounded-[3px] text-[12px] font-semibold transition-colors ${
            p === "90d" ? "bg-surface border border-hairline text-ink shadow-sm" : "text-graphite hover:text-ink"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
