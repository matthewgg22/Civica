// Notifications event spine (#514, engine integration E5).
//
// The dispatcher half of the spine: pure event -> draft mapping
// (`buildNotifications`) plus a resilient writer (`dispatchNotifications`).
// Lifecycle events (status changes, recert windows) and engine events
// (income cliffs, Component R recommendations, QC interrupts) are translated
// into typed `notifications` rows here; downstream channels (the navigator
// inbox at /outreach, APNs push, email) read from the table.
//
// Two design rules make this safe to ship ahead of its consumers:
//   1. SAFE-BEFORE-MIGRATION — `dispatchNotifications` swallows the Postgres
//      "undefined table" error (42P01), so wiring an emit site and deploying
//      it BEFORE the 20260605 migration is applied is a no-op, never a 500.
//   2. DV-SAFETY INVARIANT — `contact_safety_concern` and any other safety
//      axis is stripped from every payload and is never composed into a
//      title/body. A domestic-violence safety flag must never ride an
//      outbound channel. Enforced by `sanitizePayload` + tested.

// ── Event vocabulary ────────────────────────────────────────────────────
// Open set on purpose (the table column is plain TEXT). Adding a kind here +
// a branch in `buildNotifications` needs no migration.
export const NOTIFICATION_EVENT_TYPES = [
  "cliff_event",
  "packet_status_change",
  "recert_due",
  "recommendation_generated",
] as const;
export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export type NotificationChannel = "inbox" | "push" | "email";
export type NotificationSeverity = "info" | "action" | "urgent";

/**
 * Safety axes that must NEVER appear in a notification. Domestic-violence /
 * contact-safety signals are read-only triage inputs; they do not ride any
 * outbound channel. Kept lowercase; matching is case-insensitive.
 */
export const SAFETY_KEYS: ReadonlySet<string> = new Set([
  "contact_safety_concern",
  "safety_concern",
  "dv_flag",
  "is_dv",
  "domestic_violence",
]);

// ── Event inputs (discriminated by `type`) ──────────────────────────────
interface BaseEvent {
  orgId: string;
  packetId?: string | null;
  applicantId?: string | null;
  source: string; // e.g. 'system:argyle-webhook', 'engine:recommendation'
}

export interface CliffEvent extends BaseEvent {
  type: "cliff_event";
  monthlyIncomeUsd: number;
  payDate?: string | null;
}

export interface PacketStatusChangeEvent extends BaseEvent {
  type: "packet_status_change";
  fromStatus: string | null;
  toStatus: string;
  occurredAt: string;
}

export interface RecertDueEvent extends BaseEvent {
  type: "recert_due";
  certPeriodEnd: string; // ISO date
  daysUntilDue: number;
}

export interface RecommendationGeneratedEvent extends BaseEvent {
  type: "recommendation_generated";
  recommendationId: string;
  urgencyTier: "verdict_threatening" | "accuracy_risk" | "opportunity";
  summary: string;
  /** Free-form context from Component R — sanitized before it lands on a row. */
  context?: Record<string, unknown>;
}

export type NotificationEvent =
  | CliffEvent
  | PacketStatusChangeEvent
  | RecertDueEvent
  | RecommendationGeneratedEvent;

// ── Draft (one row to insert) ───────────────────────────────────────────
export interface NotificationDraft {
  org_id: string;
  packet_id: string | null;
  applicant_id: string | null;
  event_type: NotificationEventType;
  channel: NotificationChannel;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  source: string;
  dedupe_key: string | null;
  payload: Record<string, unknown>;
}

const ACTION_STATUSES = new Set([
  "Needs Documents",
  "Needs Applicant Clarification",
]);

/**
 * Strip safety axes from a payload object (case-insensitive key match), so a
 * DV / contact-safety signal can never be persisted on a notification row.
 * Shallow: notification payloads are flat key/value context, never nested.
 */
export function sanitizePayload(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!payload) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (SAFETY_KEYS.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * Pure event -> draft(s) mapping. Deterministic and side-effect free so it is
 * fully unit-testable. Most events produce exactly one inbox draft; the shape
 * leaves room for fan-out (e.g. inbox + push) without changing callers.
 */
export function buildNotifications(event: NotificationEvent): NotificationDraft[] {
  const base = {
    org_id: event.orgId,
    packet_id: event.packetId ?? null,
    applicant_id: event.applicantId ?? null,
    source: event.source,
    channel: "inbox" as NotificationChannel,
  };

  switch (event.type) {
    case "cliff_event": {
      const payDate = event.payDate ?? "";
      return [
        {
          ...base,
          event_type: "cliff_event",
          severity: "urgent",
          title: "Income cliff detected",
          body: `Confirmed income of ${usd(event.monthlyIncomeUsd)}/mo may push this household over the SNAP limit — review eligibility and reach out.`,
          dedupe_key: event.packetId
            ? `cliff:${event.packetId}:${payDate}`
            : null,
          payload: sanitizePayload({
            monthly_income_usd: event.monthlyIncomeUsd,
            pay_date: event.payDate ?? null,
          }),
        },
      ];
    }

    case "packet_status_change": {
      const severity: NotificationSeverity = ACTION_STATUSES.has(event.toStatus)
        ? "action"
        : "info";
      return [
        {
          ...base,
          event_type: "packet_status_change",
          severity,
          title: `Status: ${event.toStatus}`,
          body: event.fromStatus
            ? `Packet moved from "${event.fromStatus}" to "${event.toStatus}".`
            : `Packet is now "${event.toStatus}".`,
          dedupe_key: event.packetId
            ? `status:${event.packetId}:${event.toStatus}:${event.occurredAt}`
            : null,
          payload: sanitizePayload({
            from_status: event.fromStatus,
            to_status: event.toStatus,
            occurred_at: event.occurredAt,
          }),
        },
      ];
    }

    case "recert_due": {
      const severity: NotificationSeverity =
        event.daysUntilDue < 0
          ? "urgent"
          : event.daysUntilDue <= 7
            ? "action"
            : "info";
      const body =
        event.daysUntilDue < 0
          ? `Recertification lapsed ${Math.abs(Math.round(event.daysUntilDue))}d ago — benefits at risk.`
          : `Recertification due in ${Math.round(event.daysUntilDue)}d (${event.certPeriodEnd}).`;
      return [
        {
          ...base,
          event_type: "recert_due",
          severity,
          title:
            event.daysUntilDue < 0 ? "Recertification overdue" : "Recertification due",
          body,
          dedupe_key: event.packetId
            ? `recert:${event.packetId}:${event.certPeriodEnd}`
            : null,
          payload: sanitizePayload({
            cert_period_end: event.certPeriodEnd,
            days_until_due: event.daysUntilDue,
          }),
        },
      ];
    }

    case "recommendation_generated": {
      const severity: NotificationSeverity =
        event.urgencyTier === "verdict_threatening"
          ? "urgent"
          : event.urgencyTier === "accuracy_risk"
            ? "action"
            : "info";
      return [
        {
          ...base,
          event_type: "recommendation_generated",
          severity,
          title: "New recommendation",
          body: event.summary,
          dedupe_key: event.packetId
            ? `rec:${event.packetId}:${event.recommendationId}`
            : null,
          payload: sanitizePayload({
            recommendation_id: event.recommendationId,
            urgency_tier: event.urgencyTier,
            ...(event.context ?? {}),
          }),
        },
      ];
    }
  }
}

// ── Resilient writer ────────────────────────────────────────────────────
/** Minimal structural view of the supabase client we need — keeps the lib
 *  decoupled from the generated Database type and trivially mockable. */
export interface NotificationsDb {
  schema(name: string): {
    from(table: string): {
      upsert(
        rows: unknown,
        opts?: { onConflict?: string; ignoreDuplicates?: boolean },
      ): PromiseLike<{ error: { code?: string; message?: string } | null }>;
    };
  };
}

export interface DispatchResult {
  attempted: number;
  /** true when the write was skipped because the table doesn't exist yet. */
  tableMissing: boolean;
  error: string | null;
}

const UNDEFINED_TABLE = "42P01";

/**
 * Insert drafts into snap_enrollment.notifications, collapsing retries via the
 * dedupe_key unique index (ON CONFLICT DO NOTHING). Never throws on the
 * "table not created yet" path — emit sites can be wired and deployed before
 * the migration is applied, and they stay inert until it is.
 */
export async function dispatchNotifications(
  db: NotificationsDb,
  drafts: NotificationDraft[],
): Promise<DispatchResult> {
  if (drafts.length === 0) {
    return { attempted: 0, tableMissing: false, error: null };
  }
  const { error } = await db
    .schema("snap_enrollment")
    .from("notifications")
    .upsert(drafts, { onConflict: "dedupe_key", ignoreDuplicates: true });

  if (error) {
    if (error.code === UNDEFINED_TABLE) {
      return { attempted: drafts.length, tableMissing: true, error: null };
    }
    return { attempted: drafts.length, tableMissing: false, error: error.message ?? "unknown" };
  }
  return { attempted: drafts.length, tableMissing: false, error: null };
}

/**
 * Convenience: build + dispatch in one call, never throwing. Emit sites use
 * this inside a best-effort block so a notification failure can't break the
 * primary operation (webhook ack, status write, …).
 */
export async function emitNotification(
  db: NotificationsDb,
  event: NotificationEvent,
): Promise<DispatchResult> {
  try {
    return await dispatchNotifications(db, buildNotifications(event));
  } catch (e) {
    return {
      attempted: 0,
      tableMissing: false,
      error: e instanceof Error ? e.message : "dispatch threw",
    };
  }
}
