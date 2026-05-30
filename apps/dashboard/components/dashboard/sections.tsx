/**
 * Per-section async server components for /dashboard.
 *
 * Each section calls its own request-cached fetcher(s) from
 * lib/dashboard-fetchers.ts and renders one card. The page shell +
 * UrgentBannerSection paint first; downstream sections stream in as their
 * data resolves. React.cache() dedupes shared fetches (packets, history,
 * docs) across sections, so per-section independence costs zero duplicate
 * queries.
 *
 * Visual order (reorder per /plan-design-review D9 + /plan-ceo-review):
 *   UrgentBanner > Funnel > ImpactCounter > Map + Activity >
 *   TimeToHandoff + Language > QC > DocAI
 * Morning-triage surfaces land before the brand-celebration ImpactCounter.
 */
import Link from "next/link";
import { Skeleton } from "../Skeleton";
import ImpactCounter from "../ImpactCounter";
import Funnel from "../Funnel";
import LanguageDonut from "../LanguageDonut";
import Sparkline from "../Sparkline";
import DocumentAIPanel from "../DocumentAIPanel";
import ActivityTicker from "../ActivityTicker";
import MapInteractiveWrapper from "../MapInteractiveWrapper";
import QCOutcomesPanel from "../QCOutcomesPanel";
import { caCountyToFips } from "../../lib/caCounties";
import {
  decryptDemoName,
  docKindLabel,
  firstNameLastInitial,
  shortId,
} from "../../lib/format";
import {
  DEMO_TOTAL_HOUSEHOLDS,
  DEMO_MARKETSHARE_LABEL,
  buildDemoCountyStatusMix,
  DEMO_OVERDUE_RECERTS_COUNT,
  DEMO_EXPIRING_THIS_MONTH_COUNT,
  DEMO_NEEDS_ATTENTION_COUNT,
  DEMO_FUNNEL_STAGES,
  DEMO_FUNNEL_AVG_DAYS,
} from "../../lib/demo-profile";
import {
  fetchPackets,
  fetchApplicants,
  fetchHistory,
  fetchDocs,
  fetchRiskRows,
  fetchQcRows,
  fetchMineToday,
} from "../../lib/dashboard-fetchers";

const FUNNEL_ORDER = [
  "Draft",
  "Submitted for Review",
  "In Navigator Review",
  "Ready for Handoff",
  "Handed Off",
];

// ── Presentational shell (was the inline Card in page.tsx) ──────────────────

function CardShell({
  title,
  subtitle,
  children,
  className = "",
  weight = "default",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  weight?: "default" | "secondary";
}) {
  const padClass = weight === "secondary" ? "p-5" : "p-6";
  return (
    <section className={`bg-surface border border-hairline rounded-[4px] ${padClass} ${className}`}>
      <div className="mb-4">
        <h3 className="section-title">{title}</h3>
        {subtitle && <p className="section-sub mt-1 leading-snug">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

// ── Section: UrgentBanner ───────────────────────────────────────────────────

export async function UrgentBannerSection() {
  const [{ packets, isDemo }, mineToday] = await Promise.all([
    fetchPackets(),
    fetchMineToday(),
  ]);

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const overdueFromPackets = packets.filter(
    (p) =>
      p.status === "Handed Off" &&
      p.handed_off_at &&
      new Date(p.handed_off_at).getTime() + 12 * monthMs < nowMs
  ).length;
  const expiringFromPackets = packets.filter((p) => {
    if (p.status !== "Handed Off" || !p.handed_off_at) return false;
    const recertAt = new Date(p.handed_off_at).getTime() + 12 * monthMs;
    return recertAt >= nowMs && recertAt - nowMs <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  const needsAttentionFromPackets = packets.filter(
    (p) => p.status === "Needs Documents" || p.status === "Needs Applicant Clarification"
  ).length;

  const overdue = isDemo ? DEMO_OVERDUE_RECERTS_COUNT : overdueFromPackets;
  const expiring = isDemo ? DEMO_EXPIRING_THIS_MONTH_COUNT : expiringFromPackets;
  const needsAttention = isDemo ? DEMO_NEEDS_ATTENTION_COUNT : needsAttentionFromPackets;

  // Preserve original behavior: hide entirely when nothing urgent AND no
  // personal activity today. (Reorder applies only to when it DOES render.)
  if (overdue + expiring + needsAttention === 0 && mineToday.touchedPackets === 0) {
    return null;
  }

  const totalUrgent = overdue + expiring + needsAttention;
  return (
    <section className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-0">
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
                  className="inline-flex items-center gap-2 bg-warning/15 border border-warning/30 hover:bg-warning/20 transition-colors rounded-[3px] px-3 py-2"
                >
                  <span className="text-[22px] font-bold tabular-nums text-warning leading-none">{expiring}</span>
                  <span className="text-[12px] font-semibold text-ink leading-tight">expiring<br/>this month</span>
                </Link>
              )}
              {needsAttention > 0 && (
                <Link
                  href="/packets?filter=needs-attention"
                  className="inline-flex items-center gap-2 bg-warning/10 border border-warning/30 hover:bg-warning/15 transition-colors rounded-[3px] px-3 py-2"
                >
                  <span className="text-[22px] font-bold tabular-nums text-warning leading-none">{needsAttention}</span>
                  <span className="text-[12px] font-semibold text-ink leading-tight">packets need<br/>attention</span>
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="hidden md:block w-px bg-hairline my-4" />
        <div className="px-5 py-4 bg-paper/50">
          <p className="text-[11px] uppercase tracking-wider font-bold text-graphite mb-3">Mine Today</p>
          {mineToday.touchedPackets === 0 ? (
            <div>
              <p className="text-[14px] text-graphite italic">No packet activity yet today.</p>
              <Link href="/packets?filter=needs-attention" className="text-[13px] font-semibold text-pine hover:underline mt-1.5 inline-block">
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
              <Link href="/packets?filter=mine" className="text-[13px] font-semibold text-pine hover:underline ml-auto">
                See all mine →
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Section: Funnel ─────────────────────────────────────────────────────────

export async function FunnelSection() {
  const [{ packets, isDemo }, history] = await Promise.all([
    fetchPackets(),
    fetchHistory(),
  ]);

  const reachedStage = (stage: string): number => {
    const idx = FUNNEL_ORDER.indexOf(stage);
    if (idx === -1) return 0;
    return packets.filter((p) => {
      const currentIdx = FUNNEL_ORDER.indexOf(p.status);
      if (currentIdx >= idx) return true;
      return history.some(
        (h) => h.packet_id === p.packet_id && FUNNEL_ORDER.indexOf(h.to_status) >= idx
      );
    }).length;
  };

  const avgDaysInStage = (stage: string): number | null => {
    const idx = FUNNEL_ORDER.indexOf(stage);
    if (idx === -1 || idx === FUNNEL_ORDER.length - 1) return null;
    const next = FUNNEL_ORDER[idx + 1];
    const durations: number[] = [];
    for (const p of packets) {
      const enter = history.find((h) => h.packet_id === p.packet_id && h.to_status === stage);
      const exit = history.find((h) => h.packet_id === p.packet_id && h.to_status === next);
      if (enter && exit) {
        const d = (new Date(exit.occurred_at).getTime() - new Date(enter.occurred_at).getTime()) / 86_400_000;
        if (d >= 0 && d < 365) durations.push(d);
      }
    }
    if (durations.length === 0) return null;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  };

  const FUNNEL_KEY_MAP: Record<string, keyof typeof DEMO_FUNNEL_STAGES> = {
    "Draft": "draft",
    "Submitted for Review": "submitted",
    "In Navigator Review": "in_nav_review",
    "Ready for Handoff": "ready_for_handoff",
    "Handed Off": "handed_off",
  };
  const funnelStages = FUNNEL_ORDER.map((s) => {
    if (isDemo) {
      const key = FUNNEL_KEY_MAP[s];
      return {
        label: s,
        count: key ? DEMO_FUNNEL_STAGES[key] : 0,
        avgDays: key ? DEMO_FUNNEL_AVG_DAYS[key] : null,
      };
    }
    return { label: s, count: reachedStage(s), avgDays: avgDaysInStage(s) };
  });

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-7">
      <div className="mb-5 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h3 className="section-title">Enrollment Funnel</h3>
          <p className="section-sub mt-1 leading-snug">From Draft to Handed Off — conversion and time-in-stage averages.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-pine uppercase tracking-wider bg-pine/10 px-2.5 py-1 rounded-full">
          ◆ Operations
        </span>
      </div>
      <Funnel stages={funnelStages} />
    </section>
  );
}

// ── Section: ImpactCounter ──────────────────────────────────────────────────

export async function ImpactCounterSection() {
  const { packets, isDemo } = await fetchPackets();
  const enrolledFromPackets = packets.filter(
    (p) => p.status === "Handed Off" || p.status === "Closed"
  ).length;
  const enrolled = isDemo ? DEMO_TOTAL_HOUSEHOLDS : enrolledFromPackets;
  const projectionLabel = isDemo ? DEMO_MARKETSHARE_LABEL : undefined;
  return <ImpactCounter enrolledPackets={enrolled} projectionLabel={projectionLabel} />;
}

// ── Section: California Footprint (Map) ─────────────────────────────────────

export async function MapSection() {
  const [{ packets, isDemo }, riskRows] = await Promise.all([
    fetchPackets(),
    fetchRiskRows(),
  ]);

  const latestRiskByPacket = new Map<string, (typeof riskRows)[0]>();
  for (const row of riskRows) {
    const existing = latestRiskByPacket.get(row.packet_id);
    if (!existing || row.created_at > existing.created_at) {
      latestRiskByPacket.set(row.packet_id, row);
    }
  }
  const packetRiskMap: Record<string, { tier: string; score: number | null }> = {};
  for (const [pid, row] of latestRiskByPacket) {
    packetRiskMap[pid] = { tier: row.tier, score: row.score };
  }

  const byCountyFipsFromPackets: Record<
    string,
    { count: number; draft: number; inProgress: number; needsAttention: number; ready: number; enrolled: number }
  > = {};
  for (const p of packets) {
    if (p.state_code !== "CA") continue;
    const fips = p.county_fips ?? caCountyToFips(p.county);
    if (!fips) continue;
    const k = byCountyFipsFromPackets[fips] ?? { count: 0, draft: 0, inProgress: 0, needsAttention: 0, ready: 0, enrolled: 0 };
    k.count += 1;
    if (p.status === "Draft") k.draft += 1;
    if (p.status === "Submitted for Review" || p.status === "In Navigator Review") k.inProgress += 1;
    if (p.status === "Needs Documents" || p.status === "Needs Applicant Clarification") k.needsAttention += 1;
    if (p.status === "Ready for Handoff") k.ready += 1;
    if (p.status === "Handed Off" || p.status === "Closed") k.enrolled += 1;
    byCountyFipsFromPackets[fips] = k;
  }
  const byCountyFips = isDemo ? buildDemoCountyStatusMix() : byCountyFipsFromPackets;

  type CountyRiskBuild = { scored: number; high: number; medium: number; low: number; _scores: number[] };
  const byCountyRisk: Record<
    string,
    { scored: number; avgScore: number | null; high: number; medium: number; low: number }
  > = {};
  for (const p of packets) {
    if (p.state_code !== "CA") continue;
    const fips = p.county_fips ?? caCountyToFips(p.county);
    if (!fips) continue;
    const risk = packetRiskMap[p.packet_id];
    if (!risk) continue;
    const k: CountyRiskBuild = (byCountyRisk[fips] as unknown as CountyRiskBuild | undefined) ?? {
      scored: 0, high: 0, medium: 0, low: 0, _scores: [],
    };
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

  const byCountyPackets: Record<string, typeof packets> = {};
  for (const p of packets) {
    if (p.state_code !== "CA" || !p.county) continue;
    const key = p.county;
    (byCountyPackets[key] ??= []).push(p);
  }
  for (const k of Object.keys(byCountyPackets)) {
    byCountyPackets[k].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  return (
    <CardShell
      title="California Footprint"
      subtitle="Packets by county. Toggle to view error risk by county."
    >
      <MapInteractiveWrapper
        byCountyPackets={byCountyPackets}
        byCountyFips={byCountyFips}
        byCountyRisk={byCountyRisk}
        packetRiskMap={packetRiskMap}
      />
    </CardShell>
  );
}

// ── Section: Live Activity ──────────────────────────────────────────────────

export async function ActivityTickerSection() {
  const [{ packets }, history, docs] = await Promise.all([
    fetchPackets(),
    fetchHistory(),
    fetchDocs(),
  ]);

  type ActivityItem = {
    id: string;
    kind: "transition" | "doc" | "note";
    text: string;
    detail?: string;
    at: string;
    packetId?: string;
  };
  const events: ActivityItem[] = [];

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

  for (const p of packets) {
    const nameRaw = p.applicants?.full_name_ciphertext
      ? decryptDemoName(p.applicants.full_name_ciphertext)
      : null;
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
      }
    }
    events.push({ id: `p-${p.packet_id}`, kind: "transition", text, detail, at, packetId: p.packet_id });
  }

  const seen = new Set<string>();
  const initialActivity = events
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 14);

  return (
    <CardShell title="Live Activity" subtitle="Real-time status transitions and uploads.">
      <ActivityTicker initial={initialActivity} />
    </CardShell>
  );
}

// ── Section: Time-to-Handoff Sparkline ──────────────────────────────────────

export async function TimeToHandoffSection() {
  const { packets } = await fetchPackets();
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
  const sparkData = buckets
    .map((b) => ({
      label: b.weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: b.days.length > 0 ? b.days.reduce((a, x) => a + x, 0) / b.days.length : 0,
    }))
    .filter((d) => d.value > 0);
  const hasHandoffs = handedOff.length > 0;
  const overallAvgDays = hasHandoffs
    ? handedOff.reduce(
        (s, p) => s + (new Date(p.handed_off_at!).getTime() - new Date(p.submitted_at!).getTime()) / 86_400_000,
        0
      ) / handedOff.length
    : 0;
  const displaySparkData = sparkData.length >= 2
    ? sparkData
    : hasHandoffs
      ? [{ label: "all-time", value: overallAvgDays }, { label: "now", value: overallAvgDays }]
      : [];

  return (
    <CardShell
      title="Time to Handoff"
      subtitle="Median days from submission to handoff, by week."
      weight="secondary"
    >
      <Sparkline data={displaySparkData} label="this week" unit="d" goal={7} />
    </CardShell>
  );
}

// ── Section: Language Equity (Donut) ────────────────────────────────────────

export async function LanguageEquitySection() {
  const applicants = await fetchApplicants();
  const langCounts: Record<string, number> = {};
  for (const a of applicants) {
    langCounts[a.preferred_language] = (langCounts[a.preferred_language] ?? 0) + 1;
  }
  return (
    <CardShell
      title="Language Equity"
      subtitle="Applicant preferred languages. Ensures we're serving everyone."
      weight="secondary"
    >
      <LanguageDonut counts={langCounts} />
    </CardShell>
  );
}

// ── Section: QC Outcomes ────────────────────────────────────────────────────

export async function QCOutcomesSection() {
  const [qcRows, { packets }] = await Promise.all([fetchQcRows(), fetchPackets()]);
  const sampledRows = qcRows.filter((r) => r.qc_sampled);
  const errorRows = sampledRows.filter((r) => r.error_found === true);
  const byErrorType: Record<string, number> = {};
  for (const r of errorRows) {
    const t = r.error_type ?? "unknown";
    byErrorType[t] = (byErrorType[t] ?? 0) + 1;
  }
  const sampledPacketIds = new Set(sampledRows.map((r) => r.packet_id));
  const stats = {
    totalOutcomes: sampledRows.length,
    sampledCount: sampledRows.length,
    errorCount: errorRows.length,
    errorRate: sampledRows.length > 0 ? errorRows.length / sampledRows.length : null,
    packetsCovered: sampledPacketIds.size,
    totalPackets: packets.length,
    byErrorType: Object.entries(byErrorType).sort((a, b) => b[1] - a[1]) as [string, number][],
  };
  return <QCOutcomesPanel stats={stats} />;
}

// ── Section: Document AI ────────────────────────────────────────────────────

export async function DocumentAISection() {
  const docs = await fetchDocs();
  const autoExtracted = docs.filter((d) => d.processing_status === "confirmed").length;
  const confidences = docs
    .map((d) => d.classification_confidence)
    .filter((c): c is number => typeof c === "number");
  const avgConfidence =
    confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;
  const kindMap = new Map<string, { count: number; autoExtracted: number }>();
  for (const d of docs) {
    const k = kindMap.get(d.document_kind) ?? { count: 0, autoExtracted: 0 };
    k.count += 1;
    if (d.processing_status === "confirmed") k.autoExtracted += 1;
    kindMap.set(d.document_kind, k);
  }
  const stats = {
    total: docs.length,
    autoExtracted,
    avgConfidence,
    byKind: Array.from(kindMap.entries())
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
  return (
    <CardShell
      title="Document AI"
      subtitle="Classification + extraction performance across uploaded documents."
      weight="secondary"
    >
      <DocumentAIPanel stats={stats} />
    </CardShell>
  );
}

// ── Skeletons ───────────────────────────────────────────────────────────────

export function UrgentBannerSkeleton() {
  return (
    <section className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-0 min-h-[96px]">
        <div className="px-5 py-4 space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="hidden md:block w-px bg-hairline my-4" />
        <div className="px-5 py-4 bg-paper/50 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </section>
  );
}

export function FunnelSectionSkeleton() {
  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-7 space-y-5 min-h-[280px]">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    </section>
  );
}

export function ImpactCounterSkeleton() {
  return (
    <div
      className="text-ink rounded-[6px] overflow-hidden border border-hairline min-h-[140px] p-7"
      style={{ backgroundColor: "#E7E5E2" }}
    >
      <div className="grid grid-cols-3 gap-6 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSectionSkeleton({ minHeight = 200 }: { minHeight?: number }) {
  return (
    <div
      className="bg-surface border border-hairline rounded-[4px] p-6 space-y-4"
      style={{ minHeight }}
    >
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
