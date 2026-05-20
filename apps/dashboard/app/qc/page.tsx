import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import ApiCoveragePanel from "../../components/qc/ApiCoveragePanel";
import ScoringPanel from "../../components/qc/ScoringPanel";
import BaselinePanel from "../../components/qc/BaselinePanel";

export const dynamic = "force-dynamic";

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

  const [packetsRes, argyleRes, riskRes, qcRes, answersRes] = await Promise.all([
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
  ]);

  const packets = packetsRes.data ?? [];
  const totalPackets = packets.length;

  // ── API coverage
  const argylePacketIds = new Set((argyleRes.data ?? []).map((r: { packet_id: string }) => r.packet_id));
  const argyleConnected = argylePacketIds.size;
  const argylePct = totalPackets > 0 ? Math.round((argyleConnected / totalPackets) * 100) : 0;

  const apiData = [
    {
      id: "argyle", name: "Argyle", status: "live" as const,
      purpose: "Earned income (gig) verification",
      flow: "gig", weight: 26.8,
      connectedPct: argylePct,
      connectedN: argyleConnected,
      totalN: totalPackets,
      detail: `Income history pulled for ${argyleConnected.toLocaleString()} of ${totalPackets.toLocaleString()} active packets.`,
      since: "Live since Jan 2026",
    },
    {
      id: "sua-rules", name: "SUA Rules Engine", status: "live" as const,
      purpose: "Shelter / utility allowance tier determination",
      flow: "sua", weight: 50.5,
      connectedPct: 100, connectedN: totalPackets, totalN: totalPackets,
      detail: "determineSUATier() from @civica/snap-rules — deterministic, free, no external API. HEAP compliance via checkHEAPCompliance(). UtilityAPI removed from roadmap.",
      since: "Live since May 2026",
    },
    {
      id: "sublease", name: "Sublease classifier", status: "phase2" as const,
      purpose: "Shared-lease detection from uploads",
      flow: "lease", weight: 11.4,
      connectedPct: 0, connectedN: 0, totalN: totalPackets,
      detail: "Not yet integrated. Currently navigator-discretion only.",
      since: "Target Q4 2026",
    },
  ];

  // ── Scoring soundness
  type RiskRow = { packet_id: string; score: number | null; tier: string; factors: string[] };
  const allRisk: RiskRow[] = riskRes.data ?? [];
  const latestRisk = new Map<string, RiskRow>();
  for (const r of allRisk) {
    if (!latestRisk.has(r.packet_id)) latestRisk.set(r.packet_id, r);
  }
  const scored = [...latestRisk.values()];
  const complete = scored.filter((r) => r.score !== null).length;
  const incomplete = totalPackets - latestRisk.size + scored.filter((r) => r.score === null).length;

  // Defensibility per flow — derive from actual data where possible
  const answers = answersRes.data ?? [];
  const answersByPacket = new Map<string, Record<string, string>>();
  for (const a of answers) {
    const m = answersByPacket.get(a.packet_id) ?? {};
    if (a.applicant_answer != null) m[a.question_key] = a.applicant_answer;
    answersByPacket.set(a.packet_id, m);
  }

  let gigStrong = 0, gigWeak = 0;
  let suaModerate = 0, suaWeak = 0;
  let leaseWeak = 0, leaseModerate = 0;
  let assetsModerate = 0, assetsWeak = 0;
  const totalForDef = Math.max(totalPackets, 1);

  for (const p of packets) {
    const hasArgyle = argylePacketIds.has(p.packet_id);
    const pa = answersByPacket.get(p.packet_id) ?? {};

    // gig: Argyle = strong, else weak
    if (hasArgyle) gigStrong++; else gigWeak++;

    // sua: any of the 3 SUA utility questions answered = moderate; none answered = weak
    const hasSuaAnswer = pa["has_heating_costs"] || pa["has_electric_or_gas"] || pa["has_phone"];
    if (hasSuaAnswer) suaModerate++; else suaWeak++;

    // lease: housing_situation answered = moderate, else weak
    if (pa["housing_situation"]) leaseModerate++; else leaseWeak++;

    // assets: self-reported → moderate by default
    assetsModerate++;
  }

  const defensibility = [
    {
      flow: "gig",
      strong: Math.round((gigStrong / totalForDef) * 100),
      moderate: 0,
      weak: Math.round((gigWeak / totalForDef) * 100),
      source: argyleConnected > 0 ? "Argyle live" : "no signal",
    },
    {
      flow: "sua",
      strong: 0,
      moderate: Math.round((suaModerate / totalForDef) * 100),
      weak: Math.round((suaWeak / totalForDef) * 100),
      source: "no signal · awaiting UtilityAPI",
    },
    {
      flow: "lease",
      strong: 0,
      moderate: Math.round((leaseModerate / totalForDef) * 100),
      weak: Math.round((leaseWeak / totalForDef) * 100),
      source: "navigator discretion only",
    },
    {
      flow: "assets",
      strong: 0,
      moderate: Math.round((assetsModerate / totalForDef) * 100),
      weak: Math.round((assetsWeak / totalForDef) * 100),
      source: "self-reported",
    },
    {
      flow: "calc",
      strong: 100,
      moderate: 0,
      weak: 0,
      source: "deterministic · CDSS rules engine",
    },
  ];

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

        <ApiCoveragePanel apis={apiData} totalPackets={totalPackets} />
        <ScoringPanel
          total={totalPackets}
          complete={complete}
          incomplete={incomplete}
          defensibility={defensibility}
        />
        <BaselinePanel comparison={comparison} sampleN={sampleN} />
      </div>

      <footer className="border-t border-hairline px-8 py-5 flex justify-between items-center text-[11px] text-muted font-mono tracking-wide mt-8">
        <span>Civica · error-rate intelligence v0.1 · live</span>
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
