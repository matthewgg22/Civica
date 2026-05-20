import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import ImpactCounter from "../../components/ImpactCounter";
import Funnel from "../../components/Funnel";
import LanguageDonut from "../../components/LanguageDonut";
import Sparkline from "../../components/Sparkline";
import DocumentAIPanel from "../../components/DocumentAIPanel";
import ActivityTicker from "../../components/ActivityTicker";
import MapInteractiveWrapper from "../../components/MapInteractiveWrapper";
import QCOutcomesPanel from "../../components/QCOutcomesPanel";
import Link from "next/link";
import { caCountyToFips } from "../../lib/caCounties";
import { decryptDemoName, docKindLabel, firstNameLastInitial, shortId } from "../../lib/format";

export const dynamic = "force-dynamic";

const FUNNEL_ORDER = [
  "Draft",
  "Submitted for Review",
  "In Navigator Review",
  "Ready for Handoff",
  "Handed Off",
];

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const [packetsRes, applicantsRes, historyRes, docsRes, riskRes, qcRes] = await Promise.all([
    supabase.schema("snap_enrollment").from("snap_packets")
      .select("packet_id, status, state_code, county, county_fips, submitted_at, handed_off_at, created_at, updated_at, applicants(full_name_ciphertext, preferred_language)")
      .is("deleted_at", null)
      .limit(2000),
    supabase.schema("snap_enrollment").from("applicants")
      .select("applicant_id, preferred_language"),
    supabase.schema("snap_enrollment").from("packet_status_history")
      .select("history_id, packet_id, from_status, to_status, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(500),
    supabase.schema("snap_enrollment").from("uploaded_documents")
      .select("document_id, document_kind, classification_confidence, processing_status, uploaded_at, packet_id")
      .is("deleted_at", null)
      .limit(2000),
    (supabase.schema("snap_enrollment") as any)
      .from("packet_error_risk")
      .select("packet_id, score, tier, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    (supabase.schema("snap_enrollment") as any)
      .from("qc_outcomes")
      .select("packet_id, qc_sampled, error_found, error_type, error_amount")
      .eq("qc_sampled", true)
      .limit(2000),
  ]);

  const packets = packetsRes.data ?? [];
  const applicants = applicantsRes.data ?? [];
  const history = historyRes.data ?? [];
  const docs = docsRes.data ?? [];
  const allRiskRows: Array<{ packet_id: string; score: number | null; tier: string; created_at: string }> = riskRes.data ?? [];
  const qcRows: Array<{ packet_id: string; qc_sampled: boolean; error_found: boolean | null; error_type: string | null; error_amount: number | null }> = qcRes.data ?? [];

  // Deduplicate risk rows — keep newest row per packet
  const latestRiskByPacket = new Map<string, (typeof allRiskRows)[0]>();
  for (const row of allRiskRows) {
    const existing = latestRiskByPacket.get(row.packet_id);
    if (!existing || row.created_at > existing.created_at) {
      latestRiskByPacket.set(row.packet_id, row);
    }
  }
  const packetRiskMap: Record<string, { tier: string; score: number | null }> = {};
  for (const [pid, row] of latestRiskByPacket) {
    packetRiskMap[pid] = { tier: row.tier, score: row.score };
  }

  // ── "Mine today" — work the logged-in navigator did since midnight local time
  let mineToday = { transitions: 0, notes: 0, touchedPackets: 0 };
  if (user) {
    const { data: staff } = await supabase.schema("snap_enrollment").from("staff_users").select("staff_id").eq("auth_uid", user.id).maybeSingle();
    if (staff) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const sinceISO = startOfDay.toISOString();
      const [myHist, myNotes] = await Promise.all([
        supabase.schema("snap_enrollment").from("packet_status_history").select("packet_id").eq("changed_by_staff_id", staff.staff_id).gte("occurred_at", sinceISO),
        supabase.schema("snap_enrollment").from("navigator_notes").select("packet_id").eq("author_staff_id", staff.staff_id).gte("created_at", sinceISO).is("deleted_at", null),
      ]);
      const transitions = (myHist.data ?? []).length;
      const notes = (myNotes.data ?? []).length;
      const touchedSet = new Set<string>([
        ...(myHist.data ?? []).map((r) => r.packet_id),
        ...(myNotes.data ?? []).map((r) => r.packet_id),
      ]);
      mineToday = { transitions, notes, touchedPackets: touchedSet.size };
    }
  }

  // ── Impact: count families that reached Handed Off or Closed
  const enrolled = packets.filter((p) => p.status === "Handed Off" || p.status === "Closed").length;

  // ── Funnel: cumulative count of packets that *reached* each stage
  const reachedStage = (stage: string): number => {
    const idx = FUNNEL_ORDER.indexOf(stage);
    if (idx === -1) return 0;
    // A packet has reached `stage` if its current status index is >= idx, or its history contains a to_status with stage at or beyond idx
    return packets.filter((p) => {
      const currentIdx = FUNNEL_ORDER.indexOf(p.status);
      if (currentIdx >= idx) return true;
      return history.some(
        (h) => h.packet_id === p.packet_id && FUNNEL_ORDER.indexOf(h.to_status) >= idx
      );
    }).length;
  };

  // Average days in a stage = avg (next-stage-entry-time − stage-entry-time) across packets
  const avgDaysInStage = (stage: string): number | null => {
    const idx = FUNNEL_ORDER.indexOf(stage);
    if (idx === -1 || idx === FUNNEL_ORDER.length - 1) return null;
    const next = FUNNEL_ORDER[idx + 1];
    const durations: number[] = [];
    for (const p of packets) {
      const enter = history.find((h) => h.packet_id === p.packet_id && h.to_status === stage);
      const exit  = history.find((h) => h.packet_id === p.packet_id && h.to_status === next);
      if (enter && exit) {
        const d = (new Date(exit.occurred_at).getTime() - new Date(enter.occurred_at).getTime()) / 86_400_000;
        if (d >= 0 && d < 365) durations.push(d);
      }
    }
    if (durations.length === 0) return null;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  };

  const funnelStages = FUNNEL_ORDER.map((s) => ({
    label: s,
    count: reachedStage(s),
    avgDays: avgDaysInStage(s),
  }));

  // ── Language donut
  const langCounts: Record<string, number> = {};
  for (const a of applicants) {
    langCounts[a.preferred_language] = (langCounts[a.preferred_language] ?? 0) + 1;
  }

  // ── Time-to-handoff sparkline: by week, for the last 8 weeks (or all-time bucketed)
  const handedOff = packets.filter((p) => p.handed_off_at && p.submitted_at);
  type Bucket = { weekStart: Date; days: number[] };
  const buckets: Bucket[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    buckets.push({ weekStart: d, days: [] });
  }
  for (const p of handedOff) {
    const handedOffDate = new Date(p.handed_off_at!);
    const days = (handedOffDate.getTime() - new Date(p.submitted_at!).getTime()) / 86_400_000;
    if (days < 0 || days > 365) continue;
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (handedOffDate >= buckets[i].weekStart) {
        buckets[i].days.push(days);
        break;
      }
    }
  }
  const sparkData = buckets.map((b) => ({
    label: b.weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: b.days.length > 0 ? b.days.reduce((a, x) => a + x, 0) / b.days.length : 0,
  })).filter((d) => d.value > 0);

  // Only synthesize a sparkline when we have real handoff data; otherwise show
  // an honest empty state instead of a misleading 0d "at goal" trophy.
  const hasHandoffs = handedOff.length > 0;
  const overallAvgDays = hasHandoffs
    ? handedOff.reduce((s, p) => s + (new Date(p.handed_off_at!).getTime() - new Date(p.submitted_at!).getTime()) / 86_400_000, 0) / handedOff.length
    : 0;
  const displaySparkData = sparkData.length >= 2
    ? sparkData
    : hasHandoffs
      ? [{ label: "all-time", value: overallAvgDays }, { label: "now", value: overallAvgDays }]
      : [];

  // ── Document AI stats
  const autoExtracted = docs.filter((d) => d.processing_status === "confirmed").length;
  const confidences = docs.map((d) => d.classification_confidence).filter((c): c is number => typeof c === "number");
  const avgConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;
  const kindMap = new Map<string, { count: number; autoExtracted: number }>();
  for (const d of docs) {
    const k = kindMap.get(d.document_kind) ?? { count: 0, autoExtracted: 0 };
    k.count += 1;
    if (d.processing_status === "confirmed") k.autoExtracted += 1;
    kindMap.set(d.document_kind, k);
  }
  const docStats = {
    total: docs.length,
    autoExtracted,
    avgConfidence,
    byKind: Array.from(kindMap.entries())
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };

  // ── County map data. Prefer `county_fips`; if missing, derive from `county` text (CA only).
  const byCountyFips: Record<string, { count: number; draft: number; inProgress: number; needsAttention: number; ready: number; enrolled: number }> = {};
  for (const p of packets) {
    if (p.state_code !== "CA") continue;
    const fips = p.county_fips ?? caCountyToFips(p.county);
    if (!fips) continue;
    const k = byCountyFips[fips] ?? { count: 0, draft: 0, inProgress: 0, needsAttention: 0, ready: 0, enrolled: 0 };
    k.count += 1;
    if (p.status === "Draft") k.draft += 1;
    if (p.status === "Submitted for Review" || p.status === "In Navigator Review") k.inProgress += 1;
    if (p.status === "Needs Documents" || p.status === "Needs Applicant Clarification") k.needsAttention += 1;
    if (p.status === "Ready for Handoff") k.ready += 1;
    if (p.status === "Handed Off" || p.status === "Closed") k.enrolled += 1;
    byCountyFips[fips] = k;
  }

  // ── County-level risk aggregation for the risk map mode
  type CountyRiskBuild = { scored: number; high: number; medium: number; low: number; _scores: number[] };
  const byCountyRisk: Record<string, { scored: number; avgScore: number | null; high: number; medium: number; low: number }> = {};
  for (const p of packets) {
    if (p.state_code !== "CA") continue;
    const fips = p.county_fips ?? caCountyToFips(p.county);
    if (!fips) continue;
    const risk = packetRiskMap[p.packet_id];
    if (!risk) continue;
    const k: CountyRiskBuild = (byCountyRisk[fips] as unknown as CountyRiskBuild | undefined) ?? { scored: 0, high: 0, medium: 0, low: 0, _scores: [] };
    k.scored += 1;
    if (risk.tier === "high") k.high += 1;
    else if (risk.tier === "medium") k.medium += 1;
    else if (risk.tier === "low") k.low += 1;
    if (risk.score != null) k._scores.push(risk.score);
    (byCountyRisk as Record<string, unknown>)[fips] = k;
  }
  for (const fips of Object.keys(byCountyRisk)) {
    const k = byCountyRisk[fips] as unknown as CountyRiskBuild;
    byCountyRisk[fips] = {
      scored: k.scored,
      avgScore: k._scores.length > 0 ? Math.round(k._scores.reduce((a, b) => a + b, 0) / k._scores.length) : null,
      high: k.high,
      medium: k.medium,
      low: k.low,
    };
  }

  // ── QC outcomes stats
  const sampledRows = qcRows.filter((r) => r.qc_sampled);
  const errorRows   = sampledRows.filter((r) => r.error_found === true);
  const byErrorType: Record<string, number> = {};
  for (const r of errorRows) {
    const t = r.error_type ?? "unknown";
    byErrorType[t] = (byErrorType[t] ?? 0) + 1;
  }
  const sampledPacketIds = new Set(sampledRows.map((r) => r.packet_id));
  const qcStats = {
    totalOutcomes: sampledRows.length,
    sampledCount: sampledRows.length,
    errorCount: errorRows.length,
    errorRate: sampledRows.length > 0 ? errorRows.length / sampledRows.length : null,
    packetsCovered: sampledPacketIds.size,
    totalPackets: packets.length,
    byErrorType: Object.entries(byErrorType).sort((a, b) => b[1] - a[1]) as [string, number][],
  };

  // ── Urgent counts for the top-of-dashboard action banner
  const nowMs = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const overdueRecerts = packets.filter((p) =>
    p.status === "Handed Off" && p.handed_off_at &&
    new Date(p.handed_off_at).getTime() + 12 * monthMs < nowMs
  ).length;
  const expiringSoon = packets.filter((p) => {
    if (p.status !== "Handed Off" || !p.handed_off_at) return false;
    const recertAt = new Date(p.handed_off_at).getTime() + 12 * monthMs;
    return recertAt >= nowMs && recertAt - nowMs <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  const needsAttention = packets.filter((p) =>
    p.status === "Needs Documents" || p.status === "Needs Applicant Clarification"
  ).length;

  // ── County drill-down: pre-compute packets per county for client-side drawer.
  // The client wrapper opens a drawer with this data — no URL change, no roundtrip.
  const byCountyPackets: Record<string, typeof packets> = {};
  for (const p of packets) {
    if (p.state_code !== "CA" || !p.county) continue;
    const key = p.county;
    (byCountyPackets[key] ??= []).push(p);
  }
  for (const k of Object.keys(byCountyPackets)) {
    byCountyPackets[k].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  // ── Activity ticker: lead with applicant name + most-recent meaningful lifecycle event
  // per packet (so the ticker varies — not all rows "created").
  type ActivityItem = { id: string; kind: "transition" | "doc" | "note"; text: string; detail?: string; at: string; packetId?: string };
  const events: ActivityItem[] = [];

  // Real history rows first (authoritative)
  for (const h of history.slice(0, 30)) {
    events.push({
      id: `h-${h.history_id}`,
      kind: "transition",
      text: `Packet ${shortId(h.packet_id)} → ${h.to_status}`,
      detail: h.from_status ? `from ${h.from_status}` : "new draft",
      at: h.occurred_at,
      packetId: h.packet_id,
    });
  }

  // Real document uploads
  for (const d of docs.slice(0, 20)) {
    events.push({
      id: `d-${d.document_id}`,
      kind: "doc",
      text: `${docKindLabel(d.document_kind)} uploaded`,
      detail: `packet ${shortId(d.packet_id)}`,
      at: d.uploaded_at,
      packetId: d.packet_id,
    });
  }

  // Synth ONE event per packet, with the message tuned to current status.
  // Real history rows already cover transitions; this fills the long tail where
  // a packet has no audit row yet (or all its events are older than the synth).
  for (const p of packets) {
    const nameRaw = p.applicants?.full_name_ciphertext ? decryptDemoName(p.applicants.full_name_ciphertext) : null;
    const name = nameRaw ? firstNameLastInitial(nameRaw) : `Packet ${shortId(p.packet_id)}`;
    const where = p.county ?? "—";
    let at = p.created_at;
    let text = `${name} started a packet`;
    let detail = `new applicant · ${where}`;

    if (p.handed_off_at) {
      at = p.handed_off_at;
      text = `${name} enrolled · handed off to county`;
      detail = `benefits in force · ${where}`;
    } else if (p.submitted_at && p.status === "Submitted for Review") {
      at = p.submitted_at;
      text = `${name} submitted for review`;
      detail = `awaiting navigator · ${where}`;
    } else {
      // Status-specific framing for active workflow states
      switch (p.status) {
        case "Needs Documents":
          text = `${name} flagged for missing documents`;
          detail = `awaiting upload · ${where}`;
          at = p.updated_at;
          break;
        case "Needs Applicant Clarification":
          text = `${name} packet awaiting clarification`;
          detail = `navigator requested info · ${where}`;
          at = p.updated_at;
          break;
        case "In Navigator Review":
          text = `${name} packet is in navigator review`;
          detail = `being verified · ${where}`;
          at = p.updated_at;
          break;
        case "Ready for Handoff":
          text = `${name} cleared for handoff`;
          detail = `all docs verified · ${where}`;
          at = p.updated_at;
          break;
        case "Closed":
          text = `${name} recertified`;
          detail = `new benefit period begun · ${where}`;
          at = p.updated_at;
          break;
        // Draft → default "started a packet"
      }
    }
    events.push({ id: `p-${p.packet_id}`, kind: "transition", text, detail, at, packetId: p.packet_id });
  }

  // Deduplicate by id, sort by time desc, keep most recent 13
  // — sized to match the California Footprint card height
  // (map + Top Counties · Status Mix section).
  const seen = new Set<string>();
  const initialActivity = events
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 14);

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="dashboard" />
      <main className="max-w-6xl mx-auto px-8 py-8 space-y-5">
        {/* Compact header — H2 + subtitle inline */}
        <div className="flex items-baseline justify-between gap-6 flex-wrap pb-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-[26px] font-bold tracking-tight leading-none text-ink">SNAP Enrollment Overview</h2>
            <span className="eyebrow">California</span>
          </div>
          <p className="text-[13px] text-graphite">Live picture of every family Civica is helping enroll.</p>
        </div>

        {/* Urgent action banner + Mine Today (when there's anything to act on) */}
        {(overdueRecerts + expiringSoon + needsAttention > 0 || mineToday.touchedPackets > 0) && (
          <UrgentBanner
            overdue={overdueRecerts}
            expiring={expiringSoon}
            needsAttention={needsAttention}
            mineToday={mineToday}
          />
        )}

        {/* Impact hero */}
        <ImpactCounter enrolledPackets={enrolled} />

        {/* Map + Activity (two-up). items-start so each card sizes to its own
            content instead of stretching to match the taller one. */}
        <div className="grid grid-cols-3 gap-5 items-start">
          <Card title="California Footprint" subtitle="Packets by county. Toggle to view error risk by county." className="col-span-2">
            <MapInteractiveWrapper
              byCountyPackets={byCountyPackets}
              byCountyFips={byCountyFips}
              byCountyRisk={byCountyRisk}
              packetRiskMap={packetRiskMap}
            />
          </Card>
          <Card title="Live Activity" subtitle="Real-time status transitions and uploads.">
            <ActivityTicker initial={initialActivity} />
          </Card>
        </div>

        {/* Funnel full-width — primary operational view, given heavier visual weight */}
        <section className="bg-surface border-2 border-teal/30 rounded-[4px] p-7 shadow-sm">
          <div className="mb-5 flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <h3 className="section-title">Enrollment Funnel</h3>
              <p className="section-sub mt-1 leading-snug">From Draft to Handed Off — conversion and time-in-stage averages.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal uppercase tracking-wider bg-teal/10 px-2.5 py-1 rounded-full">
              ◆ Operations
            </span>
          </div>
          <Funnel stages={funnelStages} />
        </section>

        {/* Time-to-handoff + Language donut */}
        <div className="grid grid-cols-2 gap-5">
          <Card title="Time to Handoff" subtitle="Median days from submission to handoff, by week." weight="secondary">
            <Sparkline data={displaySparkData} label="this week" unit="d" goal={7} />
          </Card>
          <Card title="Language Equity" subtitle="Applicant preferred languages. Ensures we're serving everyone." weight="secondary">
            <LanguageDonut counts={langCounts} />
          </Card>
        </div>

        {/* QC Outcomes */}
        <QCOutcomesPanel stats={qcStats} />

        {/* Doc AI panel */}
        <Card title="Document AI" subtitle="Classification + extraction performance across uploaded documents." weight="secondary">
          <DocumentAIPanel stats={docStats} />
        </Card>
      </main>
    </div>
  );
}

function UrgentBanner({
  overdue,
  expiring,
  needsAttention,
  mineToday,
}: {
  overdue: number;
  expiring: number;
  needsAttention: number;
  mineToday: { transitions: number; notes: number; touchedPackets: number };
}) {
  const totalUrgent = overdue + expiring + needsAttention;
  return (
    <section className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-0">
        {/* Left: org-wide urgency */}
        <div className="px-5 py-4">
          <p className="text-[11px] uppercase tracking-wider font-bold text-graphite mb-3">Needs Action Now</p>
          {totalUrgent === 0 ? (
            <p className="text-[14px] text-graphite italic">Nothing urgent right now — caught up.</p>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {overdue > 0 && (
                <Link
                  href="/enrollments?bucket=expired"
                  className="inline-flex items-center gap-2 bg-brick/10 border border-brick/30 hover:bg-brick/15 transition-colors rounded-[3px] px-3 py-2"
                >
                  <span className="text-[22px] font-bold tabular-nums text-brick leading-none">{overdue}</span>
                  <span className="text-[12px] font-semibold text-ink leading-tight">overdue<br/>recerts</span>
                </Link>
              )}
              {expiring > 0 && (
                <Link
                  href="/enrollments?bucket=expiring"
                  className="inline-flex items-center gap-2 bg-amber/15 border border-amber/30 hover:bg-amber/20 transition-colors rounded-[3px] px-3 py-2"
                >
                  <span className="text-[22px] font-bold tabular-nums text-amber leading-none">{expiring}</span>
                  <span className="text-[12px] font-semibold text-ink leading-tight">expiring<br/>this month</span>
                </Link>
              )}
              {needsAttention > 0 && (
                <Link
                  href="/packets?filter=needs-attention"
                  className="inline-flex items-center gap-2 bg-amber/10 border border-amber/30 hover:bg-amber/15 transition-colors rounded-[3px] px-3 py-2"
                >
                  <span className="text-[22px] font-bold tabular-nums text-amber leading-none">{needsAttention}</span>
                  <span className="text-[12px] font-semibold text-ink leading-tight">packets need<br/>attention</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px bg-hairline my-4" />

        {/* Right: Mine Today */}
        <div className="px-5 py-4 bg-paper/50">
          <p className="text-[11px] uppercase tracking-wider font-bold text-graphite mb-3">Mine Today</p>
          {mineToday.touchedPackets === 0 ? (
            <div>
              <p className="text-[14px] text-graphite italic">No packet activity yet today.</p>
              <Link href="/packets?filter=needs-attention" className="text-[13px] font-semibold text-teal hover:underline mt-1.5 inline-block">
                Start with what needs attention →
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-5 flex-wrap">
              <div>
                <p className="text-[22px] font-bold tabular-nums text-ink leading-none">{mineToday.touchedPackets}</p>
                <p className="text-[12px] font-semibold text-graphite mt-1.5">packets touched</p>
              </div>
              <div>
                <p className="text-[22px] font-bold tabular-nums text-indigo leading-none">{mineToday.transitions}</p>
                <p className="text-[12px] font-semibold text-graphite mt-1.5">status changes</p>
              </div>
              <div>
                <p className="text-[22px] font-bold tabular-nums text-amber leading-none">{mineToday.notes}</p>
                <p className="text-[12px] font-semibold text-graphite mt-1.5">notes added</p>
              </div>
              <Link href="/packets?filter=mine" className="text-[13px] font-semibold text-teal hover:underline ml-auto">
                See all mine →
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Card({ title, subtitle, children, className = "", weight = "default" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; weight?: "default" | "secondary" }) {
  const borderClass = weight === "secondary" ? "border-hairline" : "border-hairline";
  const padClass = weight === "secondary" ? "p-5" : "p-6";
  return (
    <section className={`bg-surface border ${borderClass} rounded-[4px] ${padClass} ${className}`}>
      <div className="mb-4">
        <h3 className="section-title">{title}</h3>
        {subtitle && <p className="section-sub mt-1 leading-snug">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
