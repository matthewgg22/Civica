export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import OutreachWelcomeBanner from "../../components/OutreachWelcomeBanner";
import { formatDateTime, decryptDemoName, firstNameLastInitial } from "../../lib/format";
import { OutreachTaskActions } from "./OutreachTaskActions";
import { isDemoFallbackEnabled, DEMO_OUTREACH_TASKS, DEMO_PACKETS } from "../../lib/demo-data";

// ─────────────────────────────────────────────────────────────────────
// Outreach page — three lifecycle sections, populated from two sources:
//   1) navigator_outreach_queue rows (real tasks: manual + cliff_event)
//   2) snap_packets in states that imply follow-up is overdue or due soon
//      (synthesized rows — no task row exists yet, but the lifecycle says
//      someone needs to be contacted)
//
// Buckets:
//   applications    → pre-handoff packets stalled mid-application
//   interview       → handed off, interview scheduled/passed, not completed
//   recertification → active case, cert window ≤30 days out or overdue
//
// Synthesized rows render with View-only (no Contacted/Resolve) because
// there's no underlying task row to flip. Once the engine generates real
// tasks for these triggers, those rows promote to the action set.
// ─────────────────────────────────────────────────────────────────────

type LifecycleBucket = "applications" | "interview" | "recertification";

type OutreachTask = {
  outreach_task_id: string;
  packet_id: string;
  reason: string;
  income_usd: number | null;
  sla_hours: number | null;
  due_at: string;
  status: string;
  created_at: string;
};

type LifecyclePacket = {
  packet_id: string;
  status: string;
  county: string | null;
  state_code: string;
  updated_at: string;
  handed_off_at: string | null;
  cert_period_months: number | null;
  interview_scheduled_at: string | null;
  interview_completed_at: string | null;
  applicants: { full_name_ciphertext: string | null } | null;
};

type UrgencyLevel = "overdue" | "due-soon" | "on-track";

type OutreachRow = {
  key: string;
  bucket: LifecycleBucket;
  packetId: string;
  displayName: string;
  urgency: UrgencyLevel;
  dueAt: string | null;
  reasonLabel: string;
  detail: string | null;
  taskId: string | null;
  incomeUsd: number | null;
};

const APP_STALL_STATUSES = new Set([
  "Draft",
  "Needs Documents",
  "Needs Applicant Clarification",
]);
const APP_STALL_THRESHOLD_HOURS = 24;
const RECERT_EXPIRING_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const URGENCY_STYLES: Record<UrgencyLevel, { dot: string; label: string; badge: string }> = {
  "overdue":   { dot: "bg-brick",    label: "Overdue",  badge: "bg-brick/10 text-brick" },
  "due-soon":  { dot: "bg-warning",  label: "Due soon", badge: "bg-warning/15 text-warning" },
  "on-track":  { dot: "bg-graphite", label: "On track", badge: "bg-surface text-graphite border border-hairline" },
};

const URGENCY_RANK: Record<UrgencyLevel, number> = { "overdue": 0, "due-soon": 1, "on-track": 2 };

const BUCKET_META: Record<LifecycleBucket, { eyebrow: string; title: string; description: string; emptyText: string }> = {
  applications: {
    eyebrow: "Pre-submission",
    title: "Stalled mid-application",
    description: "Applicants who started but haven't finished — needs a nudge to keep the packet moving.",
    emptyText: "No applicants stalled mid-app.",
  },
  interview: {
    eyebrow: "Interview",
    title: "Interview confirmation",
    description: "Interview scheduled or passed without completion — top SNAP denial reason if missed.",
    emptyText: "No interview follow-ups needed right now.",
  },
  recertification: {
    eyebrow: "Recertification",
    title: "Recert window closing",
    description: `Cert period ends within ${RECERT_EXPIRING_WINDOW_DAYS} days or already lapsed — keep them on benefits.`,
    emptyText: "No recerts on the horizon.",
  },
};

function getUrgency(dueAt: string): UrgencyLevel {
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const diffMs = due - now;
  if (diffMs < 0) return "overdue";
  if (diffMs <= 2 * 60 * 60 * 1000) return "due-soon";
  return "on-track";
}

function getUrgencyByDays(daysUntilDue: number, dueSoonThresholdDays: number): UrgencyLevel {
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= dueSoonThresholdDays) return "due-soon";
  return "on-track";
}

function bucketForPacket(packet: LifecyclePacket | undefined): LifecycleBucket | null {
  if (!packet) return null;
  if (APP_STALL_STATUSES.has(packet.status)) return "applications";
  if (
    packet.status === "Handed Off" &&
    packet.interview_scheduled_at &&
    !packet.interview_completed_at
  ) {
    return "interview";
  }
  if (
    (packet.status === "Handed Off" || packet.status === "Closed") &&
    packet.interview_completed_at &&
    packet.handed_off_at &&
    packet.cert_period_months
  ) {
    return "recertification";
  }
  return null;
}

function certEndMs(packet: LifecyclePacket): number | null {
  if (!packet.handed_off_at || !packet.cert_period_months) return null;
  return new Date(packet.handed_off_at).getTime() + packet.cert_period_months * 30 * MS_PER_DAY;
}

// Synthesize rows from packets that are NOT already covered by a real task.
function synthesizeRow(packet: LifecyclePacket, displayName: string): OutreachRow | null {
  const bucket = bucketForPacket(packet);
  if (!bucket) return null;

  const now = Date.now();

  if (bucket === "applications") {
    const ageHours = (now - new Date(packet.updated_at).getTime()) / (60 * 60 * 1000);
    if (ageHours < APP_STALL_THRESHOLD_HOURS) return null;
    const daysStalled = Math.floor(ageHours / 24);
    const urgency: UrgencyLevel =
      daysStalled >= 7 ? "overdue" : daysStalled >= 3 ? "due-soon" : "on-track";
    return {
      key: `synth-app-${packet.packet_id}`,
      bucket,
      packetId: packet.packet_id,
      displayName,
      urgency,
      dueAt: null,
      reasonLabel: packet.status,
      detail: `Stalled ${daysStalled}d${daysStalled === 1 ? "" : ""} · last update ${formatDateTime(packet.updated_at)}`,
      taskId: null,
      incomeUsd: null,
    };
  }

  if (bucket === "interview") {
    const scheduledAt = packet.interview_scheduled_at!;
    const daysUntil = (new Date(scheduledAt).getTime() - now) / MS_PER_DAY;
    const urgency = getUrgencyByDays(daysUntil, 2);
    const detail =
      daysUntil < 0
        ? `Interview was ${Math.abs(Math.round(daysUntil))}d ago — confirm completion`
        : `Interview ${formatDateTime(scheduledAt)} — confirm attendance`;
    return {
      key: `synth-int-${packet.packet_id}`,
      bucket,
      packetId: packet.packet_id,
      displayName,
      urgency,
      dueAt: scheduledAt,
      reasonLabel: daysUntil < 0 ? "Interview at risk" : "Interview pending",
      detail,
      taskId: null,
      incomeUsd: null,
    };
  }

  // recertification
  const endMs = certEndMs(packet);
  if (endMs == null) return null;
  const daysToEnd = (endMs - now) / MS_PER_DAY;
  if (daysToEnd > RECERT_EXPIRING_WINDOW_DAYS) return null;
  const urgency = getUrgencyByDays(daysToEnd, RECERT_EXPIRING_WINDOW_DAYS);
  const dueAtIso = new Date(endMs).toISOString();
  const detail =
    daysToEnd < 0
      ? `Recert overdue by ${Math.abs(Math.round(daysToEnd))}d — benefits at risk`
      : `Recert due ${formatDateTime(dueAtIso)} (${Math.round(daysToEnd)}d)`;
  return {
    key: `synth-recert-${packet.packet_id}`,
    bucket,
    packetId: packet.packet_id,
    displayName,
    urgency,
    dueAt: dueAtIso,
    reasonLabel: daysToEnd < 0 ? "Recert overdue" : "Recert expiring",
    detail,
    taskId: null,
    incomeUsd: null,
  };
}

function displayNameFor(applicants: { full_name_ciphertext: string | null } | null): string {
  const raw = decryptDemoName(applicants?.full_name_ciphertext ?? null);
  return raw === "Unknown" || raw === "[redacted]" || raw === "[encrypted]"
    ? raw
    : firstNameLastInitial(raw);
}

const TASK_REASON_LABELS: Record<string, string> = {
  cliff_event: "Income cliff",
  manual: "Manual",
};

function taskToRow(task: OutreachTask, packet: LifecyclePacket | undefined): OutreachRow | null {
  const bucket = bucketForPacket(packet);
  // Tasks attached to packets outside the three buckets (e.g. fully recertified
  // closed cases) fall back to "applications" if the packet is pre-handoff,
  // otherwise to "recertification" as the safest catch-all for post-handoff work.
  const resolvedBucket: LifecycleBucket =
    bucket ?? (packet && APP_STALL_STATUSES.has(packet.status) ? "applications" : "recertification");
  return {
    key: `task-${task.outreach_task_id}`,
    bucket: resolvedBucket,
    packetId: task.packet_id,
    displayName: displayNameFor(packet?.applicants ?? null),
    urgency: getUrgency(task.due_at),
    dueAt: task.due_at,
    reasonLabel: TASK_REASON_LABELS[task.reason] ?? task.reason,
    detail: `Due ${formatDateTime(task.due_at)}`,
    taskId: task.outreach_task_id,
    incomeUsd: task.income_usd,
  };
}

function sortRows(rows: OutreachRow[]): OutreachRow[] {
  return [...rows].sort((a, b) => {
    const ur = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (ur !== 0) return ur;
    const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
}

export default async function OutreachPage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  // navigator_outreach_queue RLS policies filter by app.current_org_id.
  const orgId = (user?.user_metadata as { org_id?: string } | undefined)?.org_id ?? null;
  if (orgId) {
    await supabase.rpc("set_config" as never, {
      setting_name: "app.current_org_id",
      new_value: orgId,
      is_local: false,
    } as never);
  }

  const { data: tasks, error } = await supabase
    .schema("snap_enrollment")
    .from("navigator_outreach_queue")
    .select("outreach_task_id, packet_id, reason, income_usd, sla_hours, due_at, status, created_at")
    .eq("status", "pending")
    .order("due_at", { ascending: true })
    .limit(100);

  const useDemoFallback = isDemoFallbackEnabled() && (tasks?.length ?? 0) === 0;
  const taskList = useDemoFallback
    ? (DEMO_OUTREACH_TASKS as OutreachTask[])
    : ((tasks ?? []) as OutreachTask[]);

  // Pull every packet in a lifecycle stage that might want outreach attention.
  // Limit is generous; the synthesize step filters down to the actionable subset.
  const { data: livePackets } = !useDemoFallback
    ? await supabase
        .schema("snap_enrollment")
        .from("snap_packets")
        .select(
          "packet_id, status, county, state_code, updated_at, handed_off_at, cert_period_months, interview_scheduled_at, interview_completed_at, applicants(full_name_ciphertext)",
        )
        .is("deleted_at", null)
        .in("status", [
          "Draft",
          "Needs Documents",
          "Needs Applicant Clarification",
          "Handed Off",
          "Closed",
        ])
        .limit(300)
    : { data: [] as LifecyclePacket[] };

  const packetList: LifecyclePacket[] = useDemoFallback
    ? DEMO_PACKETS.map((p) => ({
        packet_id: p.packet_id,
        status: p.status,
        county: p.county,
        state_code: p.state_code,
        updated_at: p.updated_at,
        handed_off_at: p.handed_off_at,
        cert_period_months: p.cert_period_months ?? null,
        interview_scheduled_at: p.interview_scheduled_at ?? null,
        interview_completed_at: p.interview_completed_at ?? null,
        applicants: p.applicants
          ? { full_name_ciphertext: p.applicants.full_name_ciphertext }
          : null,
      }))
    : ((livePackets ?? []) as LifecyclePacket[]);

  const packetMap = new Map<string, LifecyclePacket>(packetList.map((p) => [p.packet_id, p]));

  // Build rows: real tasks first, then synthesize for any packet not already
  // represented by a task in the same bucket.
  const rows: OutreachRow[] = [];
  const taskedPacketBuckets = new Set<string>();
  for (const task of taskList) {
    const packet = packetMap.get(task.packet_id);
    const row = taskToRow(task, packet);
    if (!row) continue;
    rows.push(row);
    taskedPacketBuckets.add(`${row.packetId}::${row.bucket}`);
  }
  for (const packet of packetList) {
    const bucket = bucketForPacket(packet);
    if (!bucket) continue;
    if (taskedPacketBuckets.has(`${packet.packet_id}::${bucket}`)) continue;
    const synth = synthesizeRow(packet, displayNameFor(packet.applicants));
    if (synth) rows.push(synth);
  }

  const grouped: Record<LifecycleBucket, OutreachRow[]> = {
    applications: sortRows(rows.filter((r) => r.bucket === "applications")),
    interview: sortRows(rows.filter((r) => r.bucket === "interview")),
    recertification: sortRows(rows.filter((r) => r.bucket === "recertification")),
  };

  const totalCount = rows.length;
  const bucketOrder: LifecycleBucket[] = ["applications", "interview", "recertification"];

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="outreach" />

      <main className="max-w-5xl mx-auto px-8 py-8">
        <OutreachWelcomeBanner />
        <div className="flex items-baseline gap-3 mb-2">
          <Link href="/dashboard" className="text-[13px] text-muted hover:text-ink transition-colors">
            ← Home
          </Link>
          <span className="text-muted text-[13px]">|</span>
          <h1 className="text-[26px] font-semibold tracking-tight leading-tight text-ink">
            Outreach
          </h1>
          {totalCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-brick/10 text-brick">
              {totalCount} need follow-up
            </span>
          )}
        </div>
        <p className="text-[14px] text-muted mb-8">
          Grouped by lifecycle moment · Most urgent first
        </p>

        {error && !useDemoFallback && (
          <div className="bg-brick/10 border border-brick/30 text-brick rounded-[4px] p-4 mb-6 text-[13px]">
            {error.message}
          </div>
        )}

        {totalCount === 0 && (!error || useDemoFallback) ? (
          <div className="text-center py-20 bg-surface border border-hairline rounded-[4px]">
            <p className="text-[17px] font-medium text-graphite">No outreach needed</p>
            <p className="text-[13px] mt-1.5 text-muted">Every applicant is on track across all three lifecycle moments.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {bucketOrder.map((bucket) => {
              const meta = BUCKET_META[bucket];
              const sectionRows = grouped[bucket];
              return (
                <section key={bucket}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <p className="eyebrow">{meta.eyebrow}</p>
                    <span className="text-[11px] font-mono text-muted tabular-nums">
                      {sectionRows.length}
                    </span>
                  </div>
                  <h2 className="text-[18px] font-semibold tracking-tight text-ink leading-tight">
                    {meta.title}
                  </h2>
                  <p className="text-[13px] text-muted mb-3">{meta.description}</p>

                  {sectionRows.length === 0 ? (
                    <div className="bg-surface border border-hairline rounded-[4px] px-5 py-6 text-center">
                      <p className="text-[13px] text-muted">{meta.emptyText}</p>
                    </div>
                  ) : (
                    <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
                      {sectionRows.map((row, i) => {
                        const urgencyStyle = URGENCY_STYLES[row.urgency];
                        const incomeStr =
                          row.incomeUsd != null
                            ? `$${row.incomeUsd.toLocaleString("en-US")}/mo`
                            : null;
                        return (
                          <div
                            key={row.key}
                            className={`flex items-start gap-4 px-5 py-4 ${i > 0 ? "border-t border-hairline" : ""}`}
                          >
                            <div className="pt-1 shrink-0">
                              <span
                                className={`block w-2.5 h-2.5 rounded-full ${urgencyStyle.dot}`}
                                title={urgencyStyle.label}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <p className="text-[15px] font-semibold text-ink">
                                  {row.displayName}
                                </p>
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${urgencyStyle.badge}`}
                                >
                                  {urgencyStyle.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 flex-wrap mt-1.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal/10 text-teal">
                                  {row.reasonLabel}
                                </span>
                                {incomeStr && (
                                  <span className="text-[13px] text-graphite tabular-nums">
                                    {incomeStr}
                                  </span>
                                )}
                                {row.detail && (
                                  <span className="text-[13px] text-muted">{row.detail}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {row.taskId && <OutreachTaskActions taskId={row.taskId} />}
                              <Link
                                href={`/packets/${row.packetId}`}
                                className="text-[13px] font-semibold text-pine hover:underline whitespace-nowrap"
                              >
                                View →
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
