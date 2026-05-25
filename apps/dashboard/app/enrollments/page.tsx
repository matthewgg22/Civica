import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import { decryptDemoName, firstNameLastInitial, formatDate, shortId } from "../../lib/format";
import { isDemoFallbackEnabled, DEMO_PACKETS, getStage3Yield } from "../../lib/demo-data";
import RowActionChip from "../../components/RowActionChip";
import ActionsTakenToday from "../../components/ActionsTakenToday";

export const dynamic = "force-dynamic";

const DEFAULT_CERT_MONTHS = 12;
// Window starts at 60 days — that's when CA recert packets are mailed and
// the outreach cadence is supposed to begin. The Expiring bucket is then
// sub-segmented into 60/30/14/7 day cadence stages, each with a different
// recommended navigator action.
const EXPIRING_WINDOW_DAYS = 60;
// "Interview at risk" = scheduled interview date passed without a completion
// log. Small grace so an interview that happened "today" doesn't immediately
// flip to at-risk before the navigator gets to mark it complete.
const INTERVIEW_GRACE_DAYS = 2;

// Recert cadence sub-stages within the Expiring bucket. Mirrors the cadence
// CA navigators are expected to run as a household approaches end-of-cert:
// stage_60 = packet mailed, send first notice;
// stage_30 = reminder cadence + schedule a check-in;
// stage_14 = confirm by phone, walk through portal;
// stage_7  = critical — in-person or warm transfer to CBO partner.
type RecertStage = "stage_60" | "stage_30" | "stage_14" | "stage_7";

const RECERT_STAGE_META: Record<RecertStage, {
  label: string; action: string; chipBg: string; chipFg: string; barColor: string; numColor: string;
  actionChipLabel: string; actionConfirmedLabel: string; actionUrgency: "brick" | "warning" | "amber" | "indigo";
}> = {
  stage_60: { label: "60-day cadence", action: "send first notice",              chipBg: "bg-amber/10",   chipFg: "text-amber",   barColor: "bg-amber",   numColor: "text-amber",
              actionChipLabel: "Send first notice",          actionConfirmedLabel: "Notice sent",    actionUrgency: "amber"   },
  stage_30: { label: "30-day cadence", action: "reminder + schedule check-in",   chipBg: "bg-warning/10", chipFg: "text-warning", barColor: "bg-warning", numColor: "text-warning",
              actionChipLabel: "Send reminder",              actionConfirmedLabel: "Reminder sent",  actionUrgency: "warning" },
  stage_14: { label: "14-day cadence", action: "confirm by phone today",         chipBg: "bg-warning/20", chipFg: "text-warning", barColor: "bg-warning", numColor: "text-warning",
              actionChipLabel: "Call now",                   actionConfirmedLabel: "Call logged",    actionUrgency: "warning" },
  stage_7:  { label: "7-day cadence",  action: "in-person or CBO warm transfer", chipBg: "bg-brick/15",   chipFg: "text-brick",   barColor: "bg-brick",   numColor: "text-brick",
              actionChipLabel: "Escalate to CBO",            actionConfirmedLabel: "Escalated",      actionUrgency: "brick"   },
};

function recertStageFromDays(d: number): RecertStage {
  if (d <= 7)  return "stage_7";
  if (d <= 14) return "stage_14";
  if (d <= 30) return "stage_30";
  return "stage_60";
}

// Pilot cohort: first 10 households end-to-end through enrollment.
const PILOT_START_ISO = "2026-05-01T00:00:00Z";
const PILOT_GOAL = 10;

// Navigator throughput benchmarks. CDSS baseline drawn from FY2024 county
// reporting; Civica modeled target lifts that to 23 with packet-prep tooling.
const NAVIGATOR_BASELINE_PER_MONTH = 7;
const NAVIGATOR_TARGET_PER_MONTH = 23;

type Bucket =
  | "expired"                  // recert window has passed
  | "interview_at_risk"        // interview date passed, no completion logged
  | "expiring"                 // recert due within 30 days
  | "verification_outstanding" // county requested follow-up docs, unresolved
  | "interview_pending"        // interview scheduled, upcoming
  | "active"                   // benefits in force, no immediate action
  | "recertified";             // successfully recertified

type BucketGroup = "urgent" | "progress";

const BUCKET_META: Record<Bucket, { label: string; description: string; accent: string; bg: string; border: string; group: BucketGroup }> = {
  expired:                  { label: "Recert Overdue",          description: "Recertification window has passed; benefits at risk.",                       accent: "text-brick",   bg: "bg-brick/15",   border: "border-l-brick",   group: "urgent" },
  interview_at_risk:        { label: "Interview at Risk",       description: "Interview date passed without confirmation — top SNAP denial reason.",     accent: "text-brick",   bg: "bg-brick/15",   border: "border-l-brick",   group: "urgent" },
  expiring:                 { label: "Recert Expiring",         description: `Recert due within ${EXPIRING_WINDOW_DAYS} days — running 60/30/14/7-day cadence.`, accent: "text-warning", bg: "bg-warning/15", border: "border-l-warning", group: "urgent" },
  verification_outstanding: { label: "Verification Outstanding",description: "County requested follow-up documents; case stalls until provided.",        accent: "text-warning", bg: "bg-warning/15", border: "border-l-warning", group: "urgent" },
  interview_pending:        { label: "Interview Pending",       description: "Interview scheduled in the upcoming window — confirm attendance.",           accent: "text-indigo",  bg: "bg-indigo/10",        border: "border-l-indigo",       group: "progress" },
  active:                   { label: "Active",                  description: "Benefits in force, recertification not yet due.",                            accent: "text-ink",     bg: "bg-pine-surface/60",  border: "border-l-pine-surface", group: "progress" },
  recertified:              { label: "Recertified",             description: "Successfully recertified — new benefit period begun.",                       accent: "text-amber",   bg: "bg-amber/10",         border: "border-l-amber",        group: "progress" },
};

const URGENT_BUCKETS: Bucket[] = ["expired", "interview_at_risk", "expiring", "verification_outstanding"];
const PROGRESS_BUCKETS: Bucket[] = ["interview_pending", "active", "recertified"];
const BUCKET_SORT_ORDER: Record<Bucket, number> = {
  expired: 0, interview_at_risk: 1, expiring: 2, verification_outstanding: 3,
  interview_pending: 4, active: 5, recertified: 6,
};

export default async function EnrollmentsPage({ searchParams }: { searchParams: Promise<{ bucket?: Bucket; stage?: RecertStage; q?: string }> }) {
  const params = await searchParams;
  const activeBucket = (params.bucket as Bucket) ?? "all" as Bucket;
  // Stage filter only applies when activeBucket === "expiring". Clicking a
  // cadence sub-card sets bucket=expiring AND stage=stage_N so the list
  // narrows to just that cadence stage.
  const activeStage = (params.stage as RecertStage | undefined) ?? null;
  const query = params.q?.trim() ?? "";
  const queryLower = query.toLowerCase();
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const { data: livePackets } = await supabase
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, applicant_id, status, county, state_code, handed_off_at, closed_at, applicants(full_name_ciphertext, preferred_language)")
    .in("status", ["Handed Off", "Closed"])
    .is("deleted_at", null)
    .order("handed_off_at", { ascending: false })
    .limit(500);

  // Demo fallback for empty local DB (RLS recursion bug). Carries the
  // post-handoff lifecycle fields through the projection so bucket
  // derivation below can read them. Live DB rows don't have these columns
  // yet — they degrade to "no signal" and fall back to handed_off_at +
  // 12mo math.
  const useDemoFallback = isDemoFallbackEnabled() && (livePackets?.length ?? 0) === 0;
  const packets = useDemoFallback
    ? DEMO_PACKETS.filter((p) => p.status === "Handed Off" || p.status === "Closed").map((p) => ({
        packet_id: p.packet_id,
        applicant_id: p.applicant_id,
        status: p.status,
        county: p.county,
        state_code: p.state_code,
        handed_off_at: p.handed_off_at,
        closed_at: p.closed_at,
        applicants: p.applicants,
        cert_period_months: p.cert_period_months,
        interview_scheduled_at: p.interview_scheduled_at,
        interview_completed_at: p.interview_completed_at,
        verification_requested_at: p.verification_requested_at,
        verification_resolved_at: p.verification_resolved_at,
        last_outreach_at: p.last_outreach_at,
        last_outreach_channel: p.last_outreach_channel,
        outreach_attempts: p.outreach_attempts,
      }))
    : livePackets;

  // Sprint metrics: pilot cohort progress + 30-day throughput.
  // Both windows derived from handed_off_at — same field as the existing
  // bucket query above. We could fold into one query but a separate query
  // keeps the bucket logic above unchanged and pulls only what the panels
  // need (no applicants join).
  const thirtyDaysAgoISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: livePilotPackets } = await supabase
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, handed_off_at")
    .in("status", ["Handed Off", "Closed"])
    .is("deleted_at", null)
    .gte("handed_off_at", PILOT_START_ISO)
    .order("handed_off_at", { ascending: false });

  const pilotPackets = useDemoFallback && (livePilotPackets?.length ?? 0) === 0
    ? DEMO_PACKETS
        .filter((p) => (p.status === "Handed Off" || p.status === "Closed") && p.handed_off_at && p.handed_off_at >= PILOT_START_ISO)
        .map((p) => ({ packet_id: p.packet_id, handed_off_at: p.handed_off_at }))
    : livePilotPackets;

  const pilotCount = (pilotPackets ?? []).length;
  const mostRecentEnrollmentISO = pilotPackets?.[0]?.handed_off_at ?? null;
  const throughput30Day = (pilotPackets ?? []).filter(
    (p) => p.handed_off_at && p.handed_off_at >= thirtyDaysAgoISO,
  ).length;

  const now = Date.now();
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
  const oneDayMs = 24 * 60 * 60 * 1000;

  type LifecyclePacket = typeof packets extends Array<infer T> | null | undefined ? T : never;
  type Row = {
    packet_id: string;
    applicant_id: string | null;
    name: string;
    county: string | null;
    state_code: string;
    handed_off_at: string | null;
    bucket: Bucket;
    daysToRecert: number; // negative if overdue
    recertDate: Date | null;
    recertStage: RecertStage | null; // only set for expiring + expired buckets
    // Lifecycle stage signals — surfaced as per-row pills / actions.
    interviewScheduledAt: Date | null;
    interviewCompleted: boolean;
    verificationOutstanding: boolean;
    verificationRequestedAt: Date | null;
    lastOutreachAt: Date | null;
    lastOutreachChannel: string | null;
    outreachAttempts: number;
  };

  const rows: Row[] = (packets ?? []).map((raw) => {
    const p = raw as LifecyclePacket & {
      cert_period_months?: number | null;
      interview_scheduled_at?: string | null;
      interview_completed_at?: string | null;
      verification_requested_at?: string | null;
      verification_resolved_at?: string | null;
      last_outreach_at?: string | null;
      last_outreach_channel?: string | null;
      outreach_attempts?: number | null;
    };
    const name = p.applicants ? firstNameLastInitial(decryptDemoName(p.applicants.full_name_ciphertext)) : "Unknown";
    const handed = p.handed_off_at ? new Date(p.handed_off_at) : null;
    const certMonths = p.cert_period_months ?? DEFAULT_CERT_MONTHS;
    const recertDate = handed ? new Date(handed.getTime() + certMonths * oneMonthMs) : null;
    const daysToRecert = recertDate ? Math.floor((recertDate.getTime() - now) / oneDayMs) : 0;

    const interviewScheduledAt = p.interview_scheduled_at ? new Date(p.interview_scheduled_at) : null;
    const interviewCompleted = !!p.interview_completed_at;
    const verificationRequestedAt = p.verification_requested_at ? new Date(p.verification_requested_at) : null;
    const verificationOutstanding = !!verificationRequestedAt && !p.verification_resolved_at;
    const lastOutreachAt = p.last_outreach_at ? new Date(p.last_outreach_at) : null;

    // Bucket precedence (most urgent wins): closed → recertified;
    // recert overdue; interview at risk; verification outstanding;
    // recert expiring; interview pending; otherwise active.
    let bucket: Bucket;
    if (p.status === "Closed") {
      bucket = "recertified";
    } else if (recertDate && daysToRecert < 0) {
      bucket = "expired";
    } else if (interviewScheduledAt && !interviewCompleted && (now - interviewScheduledAt.getTime()) > INTERVIEW_GRACE_DAYS * oneDayMs) {
      bucket = "interview_at_risk";
    } else if (verificationOutstanding) {
      bucket = "verification_outstanding";
    } else if (recertDate && daysToRecert <= EXPIRING_WINDOW_DAYS) {
      bucket = "expiring";
    } else if (interviewScheduledAt && !interviewCompleted) {
      bucket = "interview_pending";
    } else {
      bucket = "active";
    }

    const recertStage = (bucket === "expiring") ? recertStageFromDays(daysToRecert) : null;

    return {
      packet_id: p.packet_id,
      applicant_id: (p as { applicant_id?: string | null }).applicant_id ?? null,
      name,
      county: p.county,
      state_code: p.state_code,
      handed_off_at: p.handed_off_at,
      bucket,
      daysToRecert,
      recertDate,
      recertStage,
      interviewScheduledAt,
      interviewCompleted,
      verificationOutstanding,
      verificationRequestedAt,
      lastOutreachAt,
      lastOutreachChannel: p.last_outreach_channel ?? null,
      outreachAttempts: p.outreach_attempts ?? 0,
    };
  });

  const counts: Record<Bucket, number> = {
    expired: rows.filter((r) => r.bucket === "expired").length,
    interview_at_risk: rows.filter((r) => r.bucket === "interview_at_risk").length,
    expiring: rows.filter((r) => r.bucket === "expiring").length,
    verification_outstanding: rows.filter((r) => r.bucket === "verification_outstanding").length,
    interview_pending: rows.filter((r) => r.bucket === "interview_pending").length,
    active: rows.filter((r) => r.bucket === "active").length,
    recertified: rows.filter((r) => r.bucket === "recertified").length,
  };
  const urgentTotal = URGENT_BUCKETS.reduce((sum, b) => sum + counts[b], 0);

  // Cadence-stage counts within the Expiring bucket. Drives the sub-card row
  // below the urgent grid and surfaces the 60/30/14/7 distribution that's
  // otherwise hidden behind a single Expiring count.
  const stageCounts: Record<RecertStage, number> = {
    stage_60: rows.filter((r) => r.bucket === "expiring" && r.recertStage === "stage_60").length,
    stage_30: rows.filter((r) => r.bucket === "expiring" && r.recertStage === "stage_30").length,
    stage_14: rows.filter((r) => r.bucket === "expiring" && r.recertStage === "stage_14").length,
    stage_7:  rows.filter((r) => r.bucket === "expiring" && r.recertStage === "stage_7").length,
  };
  const RECERT_STAGES: RecertStage[] = ["stage_60", "stage_30", "stage_14", "stage_7"];

  const bucketFiltered = (activeBucket as string) === "all"
    ? rows
    : rows.filter((r) => r.bucket === activeBucket);
  // Stage filter only narrows further when bucket=expiring AND stage=<one>.
  const stageFiltered = (activeBucket === "expiring" && activeStage)
    ? bucketFiltered.filter((r) => r.recertStage === activeStage)
    : bucketFiltered;
  const filtered = queryLower
    ? stageFiltered.filter((r) =>
        r.name.toLowerCase().includes(queryLower) ||
        (r.county ?? "").toLowerCase().includes(queryLower) ||
        shortId(r.packet_id).toLowerCase().includes(queryLower)
      )
    : stageFiltered;

  // Sort by lifecycle urgency (overdue → at-risk → expiring → verification → pending → active → recertified),
  // then by days-to-recert within each bucket.
  filtered.sort((a, b) => {
    if (BUCKET_SORT_ORDER[a.bucket] !== BUCKET_SORT_ORDER[b.bucket]) {
      return BUCKET_SORT_ORDER[a.bucket] - BUCKET_SORT_ORDER[b.bucket];
    }
    return a.daysToRecert - b.daysToRecert;
  });

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="enrollments" />
      <main className="max-w-6xl mx-auto px-8 py-8 space-y-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="eyebrow mb-1.5">Renewals</p>
            <h2 className="text-[28px] font-semibold tracking-tight leading-tight text-ink">Enrollment Lifecycle</h2>
            <p className="text-[15px] text-graphite mt-1.5">
              Every household after handoff — interview → verification → active → recert. Sorted by what needs action first. SNAP cert period typically {DEFAULT_CERT_MONTHS} months (24 for elderly/disabled).
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <ActionsTakenToday />
          </div>
        </div>

        {/* Sprint metrics — pilot cohort progress + 30-day throughput.
            Honest about 0/10 if no enrollments yet; the measurement infra
            is the artifact, not the number. */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PilotCohortCard
            count={pilotCount}
            goal={PILOT_GOAL}
            mostRecentISO={mostRecentEnrollmentISO}
          />
          <NavigatorThroughputCard
            count={throughput30Day}
            baseline={NAVIGATOR_BASELINE_PER_MONTH}
            target={NAVIGATOR_TARGET_PER_MONTH}
          />
        </section>

        {/* Stage 3 yield band (revenue / monetization across the enrolled
            cohort) used to live here. Removed 2026-05-25 — it read as
            investor-pitch finance on a page whose grammar is per-household
            navigator action. Component lives at components/Stage3YieldBand
            for re-mount on /compliance or a /monetization surface. The
            per-row Stage3 chips (`$X saved`, hrs, D-SNP) stay because
            they're per-household and contextual to the navigator's view. */}

        {/* Bucket summary cards — split into two rows by lifecycle group:
            urgent (needs action today) up top, in-progress states below.
            Each card doubles as a filter chip when clicked. */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Needs action</p>
            <span className="text-[11px] text-graphite tabular-nums">{urgentTotal} household{urgentTotal === 1 ? "" : "s"} flagged</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {URGENT_BUCKETS.map((b) => {
              const meta = BUCKET_META[b];
              const isActive = activeBucket === b;
              const href = isActive ? "/enrollments" : `/enrollments?bucket=${b}`;
              return (
                <Link
                  key={b}
                  href={href}
                  className={`block ${meta.bg} border-l-4 ${meta.border} border-y border-r border-hairline rounded-[4px] px-5 py-4 transition-all hover:shadow-sm ${isActive ? "ring-2 ring-ink/20" : ""}`}
                >
                  <p className={`text-[36px] font-bold tabular-nums leading-none ${meta.accent}`}>{counts[b]}</p>
                  <p className="text-[15px] font-bold text-ink mt-2.5">{meta.label}</p>
                  <p className="text-[13px] text-graphite mt-1.5 leading-snug">{meta.description}</p>
                </Link>
              );
            })}
          </div>
          {/* Recert cadence sub-row — only renders when the Expiring bucket
              has any households. Drills the single Expiring count into the
              60/30/14/7-day pipeline so navigators can scan the week's
              workload at a glance. Each sub-card is a clickable filter that
              narrows the list to one cadence stage. */}
          {counts.expiring > 0 && (
            <>
              <div className="flex items-baseline justify-between pt-1">
                <p className="eyebrow">Recert cadence · {counts.expiring} in pipeline</p>
                {activeStage && (
                  <Link href={`/enrollments?bucket=expiring${query ? `&q=${encodeURIComponent(query)}` : ""}`} className="text-[12px] text-pine hover:underline font-medium">
                    show all cadence stages
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-4 gap-4">
                {RECERT_STAGES.map((s) => {
                  const meta = RECERT_STAGE_META[s];
                  const isActive = activeBucket === "expiring" && activeStage === s;
                  const href = isActive
                    ? `/enrollments?bucket=expiring${query ? `&q=${encodeURIComponent(query)}` : ""}`
                    : `/enrollments?bucket=expiring&stage=${s}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
                  const count = stageCounts[s];
                  const isEmpty = count === 0;
                  return (
                    <Link
                      key={s}
                      href={href}
                      aria-disabled={isEmpty}
                      className={`block ${meta.chipBg} border-l-4 border-y border-r border-hairline rounded-[4px] px-4 py-3 transition-all hover:shadow-sm ${isActive ? "ring-2 ring-ink/20" : ""} ${isEmpty ? "opacity-50 pointer-events-none" : ""}`}
                      style={{ borderLeftColor: `var(--color-${meta.actionUrgency})` }}
                    >
                      <p className={`text-[28px] font-bold tabular-nums leading-none ${meta.numColor}`}>{count}</p>
                      <p className="text-[13px] font-bold text-ink mt-1.5">{meta.label}</p>
                      <p className="text-[11px] text-graphite mt-1 leading-snug uppercase tracking-wider font-semibold">{meta.action}</p>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <p className="eyebrow">In progress</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {PROGRESS_BUCKETS.map((b) => {
              const meta = BUCKET_META[b];
              const isActive = activeBucket === b;
              const href = isActive ? "/enrollments" : `/enrollments?bucket=${b}`;
              return (
                <Link
                  key={b}
                  href={href}
                  className={`block ${meta.bg} border-l-4 ${meta.border} border-y border-r border-hairline rounded-[4px] px-5 py-4 transition-all hover:shadow-sm ${isActive ? "ring-2 ring-ink/20" : ""}`}
                >
                  <p className={`text-[36px] font-bold tabular-nums leading-none ${meta.accent}`}>{counts[b]}</p>
                  <p className="text-[15px] font-bold text-ink mt-2.5">{meta.label}</p>
                  <p className="text-[13px] text-graphite mt-1.5 leading-snug">{meta.description}</p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Search + active-filter chip */}
        <div className="flex items-center gap-3 flex-wrap">
          <form method="get" className="relative flex-1 max-w-md">
            {(activeBucket as string) !== "all" && (
              <input type="hidden" name="bucket" value={activeBucket} />
            )}
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-[14px]">⌕</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search by household, county, or packet ID…"
              className="w-full bg-surface border border-hairline rounded-[3px] pl-9 pr-3 py-2 text-[14px] focus:outline-none focus:border-pine focus:ring-2 focus:ring-pine/15 transition-all"
            />
          </form>
          {(activeBucket as string) !== "all" && (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-graphite">Filter:</span>
              <span className={`font-semibold ${BUCKET_META[activeBucket].accent}`}>{BUCKET_META[activeBucket].label}</span>
              {activeStage && (
                <span className={`font-semibold ${RECERT_STAGE_META[activeStage].numColor}`}>
                  · {RECERT_STAGE_META[activeStage].label}
                </span>
              )}
              <Link
                href={query ? `/enrollments?q=${encodeURIComponent(query)}` : "/enrollments"}
                className="text-pine hover:underline font-medium"
              >
                clear ×
              </Link>
            </div>
          )}
          {query && (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-graphite">Searching:</span>
              <span className="font-semibold text-ink">"{query}"</span>
              <Link
                href={(activeBucket as string) === "all" ? "/enrollments" : `/enrollments?bucket=${activeBucket}`}
                className="text-pine hover:underline font-medium"
              >
                clear ×
              </Link>
            </div>
          )}
          <span className="text-[12px] text-muted tabular-nums ml-auto">
            {filtered.length} of {rows.length} enrollments
          </span>
        </div>

        {/* List */}
        <section className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          <div
            className="grid gap-4 px-6 py-3 bg-paper border-b border-hairline text-[12px] uppercase tracking-wider font-bold text-ink"
            style={{ gridTemplateColumns: "1.4fr 0.9fr 1fr 1.4fr auto" }}
          >
            <div>Household</div>
            <div>County</div>
            <div>Enrolled</div>
            <div>Lifecycle Stage</div>
            <div></div>
          </div>
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-[14px] text-muted">No enrollments in this bucket.</p>
          ) : (
            filtered.slice(0, 200).map((r, i) => {
              const yieldRow = getStage3Yield(r.applicant_id);
              return (
              <Link
                key={r.packet_id}
                href={`/packets/${r.packet_id}`}
                style={{ gridTemplateColumns: "1.4fr 0.9fr 1fr 1.4fr auto" }}
                className={`grid gap-4 px-6 py-3.5 items-center hover:bg-paper transition-colors ${i > 0 ? "border-t border-hairline/50" : ""}`}
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-[16px] font-bold text-ink truncate">{r.name}</span>
                    <span className="text-[11px] text-graphite font-mono tabular-nums shrink-0">{shortId(r.packet_id)}</span>
                  </div>
                  {yieldRow && <Stage3Chips yieldRow={yieldRow} />}
                  <OutreachPill
                    attempts={r.outreachAttempts}
                    lastAt={r.lastOutreachAt}
                    channel={r.lastOutreachChannel}
                  />
                </div>
                <div className="text-[14px] text-ink font-medium truncate">{r.county ?? "—"}, {r.state_code}</div>
                <div className="text-[14px] text-ink tabular-nums font-medium">{r.handed_off_at ? formatDate(r.handed_off_at) : "—"}</div>
                <div>
                  <LifecycleStage
                    bucket={r.bucket}
                    days={r.daysToRecert}
                    recertDate={r.recertDate}
                    recertStage={r.recertStage}
                    applicantName={r.name}
                    interviewScheduledAt={r.interviewScheduledAt}
                    verificationRequestedAt={r.verificationRequestedAt}
                  />
                </div>
                <span className="text-muted text-[18px]">›</span>
              </Link>
              );
            })
          )}
          {filtered.length > 200 && (
            <p className="px-6 py-3 text-[12px] text-muted text-center border-t border-hairline bg-paper/50">
              Showing 200 of {filtered.length} · refine via the summary cards above
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function PilotCohortCard({
  count,
  goal,
  mostRecentISO,
}: {
  count: number;
  goal: number;
  mostRecentISO: string | null;
}) {
  const pct = Math.min(100, (count / goal) * 100);
  const reached = count >= goal;
  // Goal-reached = positive outcome → amber (per DESIGN.md §1, pine is CTAs only).
  const barColor = reached ? "bg-amber" : count > 0 ? "bg-wheat" : "bg-hairline";
  const numberColor = reached ? "text-amber" : "text-ink";
  const recent = mostRecentISO ? formatDate(mostRecentISO) : null;

  return (
    <div className="bg-surface border border-hairline rounded-[6px] px-5 py-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Pilot cohort</p>
        <span className="text-[11px] text-graphite tabular-nums">since May 1, 2026</span>
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className={`text-[36px] font-bold tabular-nums leading-none ${numberColor}`}>{count}</span>
        <span className="text-[18px] text-graphite font-semibold leading-none">/ {goal}</span>
        <span className="text-[14px] text-graphite font-medium ml-1.5">households enrolled</span>
      </div>
      <div className="relative rounded-full overflow-hidden mt-3" style={{ height: 6, background: "rgba(0,0,0,0.08)" }}>
        <div className={`absolute inset-y-0 left-0 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[12px] text-graphite mt-2 leading-snug">
        {reached
          ? `Goal reached. Last enrollment: ${recent}.`
          : count > 0
            ? `${goal - count} to go. Last enrollment: ${recent}.`
            : `Awaiting first enrolled household. Pilot window closes end of May 2026.`}
      </p>
    </div>
  );
}

function NavigatorThroughputCard({
  count,
  baseline,
  target,
}: {
  count: number;
  baseline: number;
  target: number;
}) {
  // Use the count as a single-org proxy; once multi-org data exists, divide
  // count by active navigator headcount to get the per-navigator number.
  const pctOfTarget = target > 0 ? Math.min(100, (count / target) * 100) : 0;
  // Target-met = positive outcome → amber (DESIGN.md §1: pine is CTAs only).
  const barColor = count >= target ? "bg-amber" : count >= baseline ? "bg-wheat" : "bg-hairline";

  return (
    <div className="bg-surface border border-hairline rounded-[6px] px-5 py-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">30-day throughput</p>
        <span className="text-[11px] text-graphite tabular-nums">rolling 30 days</span>
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="text-[36px] font-bold tabular-nums leading-none text-ink">{count}</span>
        <span className="text-[14px] text-graphite font-medium ml-1.5">packets handed off</span>
      </div>
      <div className="relative rounded-full overflow-hidden mt-3" style={{ height: 6, background: "rgba(0,0,0,0.08)" }}>
        <div className={`absolute inset-y-0 left-0 ${barColor}`} style={{ width: `${pctOfTarget}%` }} />
      </div>
      <p className="text-[12px] text-graphite mt-2 leading-snug">
        Modeled target: <span className="font-semibold text-ink tabular-nums">{target}</span>/navigator/month
        {" "}· CDSS baseline: <span className="tabular-nums">{baseline}</span>/navigator/month. Pre-pilot — divide by active navigator headcount when pilot org seats are filled.
      </p>
    </div>
  );
}

function Stage3Chips({ yieldRow }: { yieldRow: import("../../lib/demo-data").Stage3Yield }) {
  // Render only the chips that have a non-zero signal. Empty households
  // render nothing here — keeps the row clean for the majority case.
  const chips: Array<{ key: string; label: string; bg: string; fg: string; title: string }> = [];

  if (yieldRow.adSavingsThisMonth > 0) {
    chips.push({
      key: "ads",
      label: `$${yieldRow.adSavingsThisMonth.toFixed(2)} saved`,
      bg: "bg-amber-surface",
      fg: "text-amber",
      title: `Ad attribution this month — closed-loop RMN savings`,
    });
  }
  if (yieldRow.hoursLoggedThisMonth > 0) {
    const pct = Math.round((yieldRow.hoursLoggedThisMonth / 80) * 100);
    const isAtRisk = yieldRow.hoursLoggedThisMonth < 60;
    // DESIGN.md §1: pine is CTAs only. Pine-surface fill is allowed (success-adjacent),
    // but chip FG must be neutral ink — not text-pine.
    chips.push({
      key: "hours",
      label: `${yieldRow.hoursLoggedThisMonth} / 80 hrs`,
      bg: isAtRisk ? "bg-warning/10" : "bg-pine-surface",
      fg: isAtRisk ? "text-warning" : "text-ink",
      title: `ABAWD work-hours this month (${pct}% of 80-hr requirement)${isAtRisk ? " — behind pace" : ""}`,
    });
  }
  if (yieldRow.workforceReferralValue > 0) {
    chips.push({
      key: "workforce",
      label: `+$${yieldRow.workforceReferralValue} placement`,
      bg: "bg-pine-surface",
      fg: "text-ink",
      title: "Workforce-platform referral payout this month",
    });
  }
  if (yieldRow.dsnpEligible) {
    chips.push({
      key: "dsnp",
      label: yieldRow.dsnpWarmTransferValue > 0 ? "D-SNP · transferred" : "D-SNP eligible",
      bg: "bg-indigo/10",
      fg: "text-indigo",
      title: yieldRow.dsnpWarmTransferValue > 0
        ? `Medicare Advantage warm transfer fired this month ($${yieldRow.dsnpWarmTransferValue} lead)`
        : "Cohort-eligible for D-SNP warm transfer — iOS prompt pending",
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
      {chips.map((c) => (
        <span
          key={c.key}
          title={c.title}
          className={`inline-flex items-center px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold tabular-nums ${c.bg} ${c.fg}`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

function OutreachPill({
  attempts,
  lastAt,
  channel,
}: {
  attempts: number;
  lastAt: Date | null;
  channel: string | null;
}) {
  if (attempts === 0) {
    return (
      <p className="text-[10px] uppercase tracking-wider font-bold text-graphite/70">
        no outreach logged
      </p>
    );
  }
  const days = lastAt ? Math.max(0, Math.floor((Date.now() - lastAt.getTime()) / (24 * 60 * 60 * 1000))) : null;
  const channelLabel: Record<string, string> = { sms: "SMS", call: "call", email: "email", in_person: "in-person" };
  const channelStr = channel ? channelLabel[channel] ?? channel : "touch";
  const recencyStr = days === null ? "" : days === 0 ? "today" : `${days}d ago`;
  return (
    <p className="text-[10px] uppercase tracking-wider font-semibold text-graphite tabular-nums">
      {attempts} attempt{attempts === 1 ? "" : "s"} · last {channelStr}
      {recencyStr ? ` ${recencyStr}` : ""}
    </p>
  );
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function LifecycleStage({
  bucket,
  days,
  recertDate,
  recertStage,
  applicantName,
  interviewScheduledAt,
  verificationRequestedAt,
}: {
  bucket: Bucket;
  days: number;
  recertDate: Date | null;
  recertStage: RecertStage | null;
  applicantName: string;
  interviewScheduledAt: Date | null;
  verificationRequestedAt: Date | null;
}) {
  // Recertified — terminal-good state, no progress bar.
  if (bucket === "recertified") {
    return (
      <div className="flex items-center gap-2.5">
        <span className="inline-block w-2 h-2 rounded-full bg-indigo" />
        <div>
          <p className="text-[14px] font-semibold text-indigo">Recertified</p>
          <p className="text-[11px] text-muted">new cycle started</p>
        </div>
      </div>
    );
  }

  // Interview-stage buckets — show interview date prominently, no recert bar
  // (recert is months away and would be misleading).
  if (bucket === "interview_at_risk" && interviewScheduledAt) {
    const daysSince = Math.floor((Date.now() - interviewScheduledAt.getTime()) / (24 * 60 * 60 * 1000));
    return (
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-[20px] font-bold tabular-nums leading-none text-brick">Interview missed</span>
        </div>
        <p className="text-[12px] text-graphite tabular-nums">
          Scheduled {formatShortDate(interviewScheduledAt)} · {daysSince}d ago, unconfirmed
        </p>
        <RowActionChip
          label="Call applicant"
          confirmedLabel="Call logged"
          urgency="brick"
          ariaLabel={`Log a recovery call to ${applicantName}`}
          applicantName={applicantName}
        />
      </div>
    );
  }
  if (bucket === "interview_pending" && interviewScheduledAt) {
    const daysUntil = Math.max(0, Math.ceil((interviewScheduledAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    return (
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-[26px] font-bold tabular-nums leading-none text-indigo">{daysUntil}</span>
          <span className="text-[14px] text-graphite font-semibold">d</span>
          <span className="text-[12px] text-graphite tabular-nums ml-auto font-medium">
            on {formatShortDate(interviewScheduledAt)}
          </span>
        </div>
        <p className="text-[12px] text-graphite">Interview scheduled</p>
        <RowActionChip
          label="Confirm attendance"
          confirmedLabel="Confirmed"
          urgency="indigo"
          ariaLabel={`Confirm interview attendance for ${applicantName}`}
          applicantName={applicantName}
        />
      </div>
    );
  }
  if (bucket === "verification_outstanding" && verificationRequestedAt) {
    const daysSince = Math.floor((Date.now() - verificationRequestedAt.getTime()) / (24 * 60 * 60 * 1000));
    return (
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-[20px] font-bold tabular-nums leading-none text-warning">Verification open</span>
        </div>
        <p className="text-[12px] text-graphite tabular-nums">
          County requested {daysSince}d ago · {formatShortDate(verificationRequestedAt)}
        </p>
        <RowActionChip
          label="Upload docs"
          confirmedLabel="Doc uploaded"
          urgency="warning"
          ariaLabel={`Upload verification docs for ${applicantName}`}
          applicantName={applicantName}
        />
      </div>
    );
  }

  // Recert countdown bar — overdue (brick), expiring (cadence-stage color),
  // or active (amber). % of nominal 12-month cycle elapsed (clamped 0–100).
  // For expiring rows, the bar color + sub-label come from the cadence stage
  // (60/30/14/7) so a 7-day-window household reads as brick even though
  // it shares a bucket with 60-day households.
  const totalDays = DEFAULT_CERT_MONTHS * 30;
  const elapsedDays = totalDays - days;
  const pctElapsed = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

  const isOverdue = bucket === "expired";
  const isExpiring = bucket === "expiring";
  const stageMeta = isExpiring && recertStage ? RECERT_STAGE_META[recertStage] : null;

  const numberColor = isOverdue
    ? "text-brick"
    : stageMeta?.numColor ?? "text-ink";
  const barColor = isOverdue
    ? "bg-brick"
    : stageMeta?.barColor ?? "bg-amber";

  const displayDays = isOverdue ? `−${Math.abs(days)}` : `${days}`;
  const subLabel = isOverdue
    ? "days past recert"
    : stageMeta
      ? `days until recert · ${stageMeta.action}`
      : "days until recert";
  const subLabelColor = isOverdue
    ? "text-brick"
    : stageMeta?.numColor ?? "text-graphite";

  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className={`text-[26px] font-bold tabular-nums leading-none ${numberColor}`}>{displayDays}</span>
        <span className="text-[14px] text-graphite font-semibold">d</span>
        {stageMeta && (
          <span className={`text-[10px] uppercase tracking-wider font-bold tabular-nums px-1.5 py-0.5 rounded-[3px] ${stageMeta.chipBg} ${stageMeta.chipFg}`}>
            {stageMeta.label}
          </span>
        )}
        {recertDate && (
          <span className="text-[12px] text-graphite tabular-nums ml-auto font-medium">
            {isOverdue ? "due" : "by"} {formatShortDate(recertDate)}
          </span>
        )}
      </div>
      <div className="relative rounded-full overflow-hidden" style={{ height: 8, background: "rgba(0,0,0,0.10)" }}>
        <div
          className={`absolute inset-y-0 left-0 ${barColor}`}
          style={{ width: `${pctElapsed}%` }}
        />
        {isOverdue && (
          <div className="absolute inset-y-0 right-0 w-1 bg-brick animate-pulse" />
        )}
      </div>
      <p className={`text-[11px] uppercase tracking-wider font-bold mt-1.5 ${subLabelColor}`}>
        {subLabel}
      </p>
      {isOverdue ? (
        <RowActionChip
          label="Call applicant"
          confirmedLabel="Call logged"
          urgency="brick"
          ariaLabel={`Log a recovery call to ${applicantName}`}
          applicantName={applicantName}
        />
      ) : stageMeta ? (
        <RowActionChip
          label={stageMeta.actionChipLabel}
          confirmedLabel={stageMeta.actionConfirmedLabel}
          urgency={stageMeta.actionUrgency}
          ariaLabel={`${stageMeta.actionChipLabel} for ${applicantName}`}
          applicantName={applicantName}
        />
      ) : null}
    </div>
  );
}
