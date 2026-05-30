"use client";

/**
 * BenefitsCalPanel — navigator-facing action panel for sending a packet
 * to BenefitsCal via the CBO Assister automation pipeline.
 *
 * Two-step flow:
 *   1. "Prepare for BenefitsCal" — POST /benefitscal/prepare-export builds a
 *      BenefitsCalPayload snapshot and stores it as a 'pending_review' row.
 *      Navigator reviews the preview in this panel.
 *   2. "Submit to BenefitsCal" — POST /benefitscal/submit kicks off the Phase 2
 *      Playwright submission via ctx.waitUntil. Panel then polls /status until
 *      the row reaches a terminal state.
 *
 * Status visibility gate matches HandoffPanel: only renders the action surface
 * when the packet is in "Ready for Handoff" or "Handed Off". Other statuses
 * show an inline "not yet ready" hint.
 *
 * State machine (driven by the latest /status response):
 *   no_submission → prepared → in_flight → succeeded | failed | cancelled
 *
 *   - no_submission: route returned 404. Show "Prepare for BenefitsCal".
 *   - prepared:      status='pending_review'. Show payload preview + Submit.
 *   - in_flight:     status in {queued, running}. Poll every 5s.
 *   - succeeded:     status in {succeeded, submitted}. Show confirmation #.
 *   - failed:        status='failed'. Show error + Re-prepare.
 *   - cancelled:     status='cancelled'. Show inline note + Re-prepare.
 *
 * Blocked submissions display DRIVER_NOT_WIRED guidance pointing at the manual
 * PDF export (HandoffPanel) until TODO-15 secrets are deployed.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";
import { formatDateTime, shortId } from "../lib/format";

// ---------------------------------------------------------------------------
// Types — mirror the /status response shape and the /prepare-export response
// ---------------------------------------------------------------------------

interface StatusRow {
  submission_id: string;
  packet_id: string;
  status: BenefitsCalStatus;
  consent_type: "in_person" | "telephonic" | "async_portal";
  benefitscal_confirmation_number: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  assister_account_id: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

type BenefitsCalStatus =
  | "pending_review"
  | "queued"
  | "running"
  | "succeeded"
  | "submitted"
  | "failed"
  | "cancelled";

interface PreparedPayload {
  submission_id: string;
  status: BenefitsCalStatus;
  created_at: string;
  payload: PayloadSnapshot;
}

// Loose shape — the snapshot is jsonb on the API side. Only fields rendered
// in the preview are typed; everything else flows through as unknown.
interface PayloadSnapshot {
  packet_id?: string;
  state_code?: string;
  county?: string | null;
  org_id?: string | null;
  applicant_id?: string | null;
  // PII fields arrive as Fernet ciphertext in Phase 1 — do NOT render verbatim.
  full_name_ciphertext?: string | null;
  date_of_birth_ciphertext?: string | null;
  phone_ciphertext?: string | null;
  address_ciphertext?: string | null;
  answers?: Array<unknown>;
  document_urls?: Array<{ type?: string; url?: string }>;
  consent_type?: string;
  telephonic_consent_recorded_at?: string | null;
  prepared_at?: string;
}

interface Props {
  packetId: string;
  packetStatus: string;
  /** Pass blockers.length from the packet detail page so we mirror HandoffPanel gating. */
  blockerCount: number;
}

const ALLOWED_STATUSES = new Set(["Ready for Handoff", "Handed Off"]);
const POLL_INTERVAL_MS = 5_000;
const POLL_STATUSES: ReadonlySet<BenefitsCalStatus> = new Set([
  "queued",
  "running",
]);
const TERMINAL_STATUSES: ReadonlySet<BenefitsCalStatus> = new Set([
  "succeeded",
  "submitted",
  "failed",
  "cancelled",
]);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BenefitsCalPanel({
  packetId,
  packetStatus,
  blockerCount,
}: Props): React.JSX.Element {
  const router = useRouter();

  // Last /status response. null = not yet fetched OR 404 (no submission yet).
  const [statusRow, setStatusRow] = useState<StatusRow | null>(null);
  const [statusKnown, setStatusKnown] = useState(false); // distinguishes "loading" from "fetched, no row"
  const [statusLoading, setStatusLoading] = useState(false);

  // Most-recent prepare-export response — held in session memory for the
  // payload preview. Lost on page reload (intentional; preview can be
  // re-prepared without side effects).
  const [prepared, setPrepared] = useState<PreparedPayload | null>(null);

  // Action-in-flight indicator: "preparing" | "submitting" | null
  const [actionInFlight, setActionInFlight] = useState<
    "preparing" | "submitting" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const statusAllowed = ALLOWED_STATUSES.has(packetStatus);
  const blockedByPacket = !statusAllowed || blockerCount > 0;

  // Derived state machine label.
  const derivedState = deriveState(statusRow, statusKnown, prepared);

  // -----------------------------------------------------------------------
  // Effect: initial + polling /status fetch.
  // -----------------------------------------------------------------------

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus(): Promise<void> {
      setStatusLoading(true);
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const row = (await api.benefitscal.status(
          session.access_token,
          packetId,
        )) as StatusRow;

        if (cancelled) return;
        setStatusRow(row);
        setStatusKnown(true);
      } catch (e) {
        // 404 = no submission yet; that's an expected state, not an error.
        const msg = e instanceof Error ? e.message : String(e);
        if (/^API 404/.test(msg)) {
          if (!cancelled) {
            setStatusRow(null);
            setStatusKnown(true);
          }
        } else if (!cancelled) {
          setError(msg);
          setStatusKnown(true);
        }
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }

    void fetchStatus();

    return () => {
      cancelled = true;
    };
  }, [packetId]);

  // Polling: when the latest status is in {queued, running}, refetch every 5s.
  useEffect(() => {
    if (!statusRow || !POLL_STATUSES.has(statusRow.status)) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    pollTimerRef.current = setInterval(async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        const row = (await api.benefitscal.status(
          session.access_token,
          packetId,
        )) as StatusRow;
        if (!cancelled) {
          setStatusRow(row);
          if (TERMINAL_STATUSES.has(row.status)) {
            // Terminal — clear interval and refresh the page so any
            // packet-level lifecycle UI catches up.
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            router.refresh();
          }
        }
      } catch {
        // Best-effort poll; transient errors are not surfaced.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [statusRow, packetId, router]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  async function prepareExport(): Promise<void> {
    setActionInFlight("preparing");
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const resp = (await api.benefitscal.prepareExport(
        session.access_token,
        packetId,
        { consent_type: "async_portal" },
      )) as PreparedPayload;

      setPrepared(resp);
      setStatusRow({
        submission_id: resp.submission_id,
        packet_id: packetId,
        status: resp.status,
        consent_type: "async_portal",
        benefitscal_confirmation_number: null,
        submitted_at: null,
        submitted_by: null,
        assister_account_id: null,
        error_message: null,
        retry_count: 0,
        created_at: resp.created_at,
        updated_at: resp.created_at,
      });
      setStatusKnown(true);
      toast.success("BenefitsCal preview ready — review the payload then click Submit.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to prepare export";
      setError(msg);
      toast.error(msg);
    } finally {
      setActionInFlight(null);
    }
  }

  async function submitToBenefitsCal(): Promise<void> {
    setActionInFlight("submitting");
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const resp = (await api.benefitscal.submit(
        session.access_token,
        packetId,
      )) as { submission_id: string; status: BenefitsCalStatus; idempotent: boolean };

      // Optimistic local update — polling will reconcile.
      setStatusRow((prev) =>
        prev
          ? { ...prev, status: resp.status, submission_id: resp.submission_id }
          : null,
      );
      if (resp.idempotent) {
        toast.info("A submission was already in-flight for this packet.");
      } else {
        toast.success("Submission queued. Background automation is running.");
      }
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to submit";
      setError(msg);
      toast.error(msg);
    } finally {
      setActionInFlight(null);
    }
  }

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const disabledReason = !statusAllowed
    ? `Packet must be in "Ready for Handoff" status (current: ${packetStatus})`
    : blockerCount > 0
      ? "Resolve all readiness blockers above before submitting to BenefitsCal"
      : null;

  const canAct = !blockedByPacket && actionInFlight === null;

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-graphite italic leading-snug">
        Sends the prepared packet to BenefitsCal via the CBO Assister automation
        pipeline. A human navigator (you) approves before the background submitter
        runs. Civica does not determine SNAP eligibility.
      </p>

      {/* Status block — only when we have a row */}
      {statusKnown && statusRow ? (
        <StatusBlock row={statusRow} />
      ) : statusLoading ? (
        <p className="text-[13px] text-muted">Loading submission status…</p>
      ) : null}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 items-start">
        {showPrepareButton(derivedState) ? (
          <button
            type="button"
            onClick={prepareExport}
            disabled={!canAct}
            title={disabledReason ?? undefined}
            className="px-4 py-2 text-[13px] font-semibold rounded-[3px] bg-pine text-white hover:bg-pine/90 disabled:bg-graphite/20 disabled:text-graphite disabled:cursor-not-allowed transition-colors"
          >
            {actionInFlight === "preparing"
              ? "Preparing…"
              : derivedState === "failed" || derivedState === "cancelled"
                ? "Re-prepare for BenefitsCal"
                : "Prepare for BenefitsCal"}
          </button>
        ) : null}

        {showSubmitButton(derivedState) ? (
          <button
            type="button"
            onClick={submitToBenefitsCal}
            disabled={!canAct}
            title={disabledReason ?? undefined}
            className="px-4 py-2 text-[13px] font-semibold rounded-[3px] bg-pine text-white hover:bg-pine/90 disabled:bg-graphite/20 disabled:text-graphite disabled:cursor-not-allowed transition-colors"
          >
            {actionInFlight === "submitting" ? "Submitting…" : "Submit to BenefitsCal"}
          </button>
        ) : null}
      </div>

      {disabledReason ? (
        <p className="text-[12px] text-warning">{disabledReason}</p>
      ) : null}
      {error ? <p className="text-[13px] text-error">{error}</p> : null}

      {/* Payload preview — only when fresh prepare-export response is in state. */}
      {prepared && derivedState === "prepared" ? (
        <PayloadPreview payload={prepared.payload} />
      ) : null}

      {/* Driver-not-wired guidance for in-flight failures */}
      {statusRow?.error_message?.includes("BenefitsCal browser driver not wired") ? (
        <DriverNotWiredGuidance />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal: derive the state machine label from the status row + prepared cache
// ---------------------------------------------------------------------------

function deriveState(
  row: StatusRow | null,
  known: boolean,
  prepared: PreparedPayload | null,
): "loading" | "no_submission" | "prepared" | "in_flight" | "succeeded" | "failed" | "cancelled" {
  if (!known) return "loading";
  if (!row) return "no_submission";
  if (row.status === "pending_review") {
    // Server has a pending row. If we also have a fresh prepared snapshot
    // in session memory, treat as 'prepared' (preview available). Otherwise
    // still 'prepared' — the preview just won't render until re-prepared.
    void prepared;
    return "prepared";
  }
  if (row.status === "queued" || row.status === "running") return "in_flight";
  if (row.status === "succeeded" || row.status === "submitted") return "succeeded";
  if (row.status === "failed") return "failed";
  if (row.status === "cancelled") return "cancelled";
  return "no_submission";
}

function showPrepareButton(
  state: ReturnType<typeof deriveState>,
): boolean {
  return state === "no_submission" || state === "failed" || state === "cancelled";
}

function showSubmitButton(state: ReturnType<typeof deriveState>): boolean {
  return state === "prepared";
}

// ---------------------------------------------------------------------------
// StatusBlock — compact summary of the current submission row
// ---------------------------------------------------------------------------

function StatusBlock({ row }: { row: StatusRow }): React.JSX.Element {
  return (
    <div className="border border-hairline rounded-[3px] bg-paper p-3 space-y-1">
      <div className="flex items-center gap-2">
        <StatusBadge status={row.status} />
        <span className="font-mono text-[12px] text-muted">
          {shortId(row.submission_id)}
        </span>
        <span className="text-[12px] text-muted">
          updated {formatDateTime(row.updated_at)}
        </span>
      </div>
      {row.benefitscal_confirmation_number ? (
        <p className="text-[13px] text-ink">
          <span className="font-semibold">Confirmation:</span>{" "}
          <span className="font-mono">{row.benefitscal_confirmation_number}</span>
          {row.submitted_at ? (
            <span className="text-muted">
              {" "}
              · {formatDateTime(row.submitted_at)}
            </span>
          ) : null}
        </p>
      ) : null}
      {row.error_message ? (
        <p className="text-[13px] text-error">
          <span className="font-semibold">Error:</span> {row.error_message}
        </p>
      ) : null}
      {row.retry_count > 0 ? (
        <p className="text-[12px] text-muted">Retry attempt: {row.retry_count}</p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: BenefitsCalStatus }): React.JSX.Element {
  const map: Record<BenefitsCalStatus, { label: string; tone: string }> = {
    pending_review: { label: "Pending navigator review", tone: "bg-warning/15 text-warning" },
    queued: { label: "Queued", tone: "bg-pine/10 text-pine" },
    running: { label: "Running", tone: "bg-pine/10 text-pine" },
    succeeded: { label: "Submitted", tone: "bg-amber/15 text-amber" },
    submitted: { label: "Submitted (legacy)", tone: "bg-amber/15 text-amber" },
    failed: { label: "Failed", tone: "bg-error/15 text-error" },
    cancelled: { label: "Cancelled", tone: "bg-graphite/10 text-graphite" },
  };
  const cfg = map[status];
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-[3px] ${cfg.tone}`}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PayloadPreview — minimal summary so the navigator can sanity-check the
// prepared snapshot before clicking Submit. Ciphertext fields are intentionally
// rendered as masked counts, not values.
// ---------------------------------------------------------------------------

function PayloadPreview({
  payload,
}: {
  payload: PayloadSnapshot;
}): React.JSX.Element {
  const docCount = payload.document_urls?.length ?? 0;
  const answerCount = payload.answers?.length ?? 0;
  const hasName = Boolean(payload.full_name_ciphertext);
  const hasDob = Boolean(payload.date_of_birth_ciphertext);
  const hasAddress = Boolean(payload.address_ciphertext);
  const hasPhone = Boolean(payload.phone_ciphertext);

  return (
    <details className="border border-hairline rounded-[3px] bg-paper p-3">
      <summary className="cursor-pointer text-[13px] font-semibold text-ink">
        Payload preview
      </summary>
      <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-muted">State</dt>
        <dd className="text-ink">{payload.state_code ?? "—"}</dd>
        <dt className="text-muted">County</dt>
        <dd className="text-ink">{payload.county ?? "—"}</dd>
        <dt className="text-muted">Applicant PII</dt>
        <dd className="text-ink">
          {[
            hasName ? "name" : null,
            hasDob ? "DOB" : null,
            hasAddress ? "address" : null,
            hasPhone ? "phone" : null,
          ]
            .filter(Boolean)
            .join(", ") || "—"}{" "}
          <span className="text-muted">(encrypted)</span>
        </dd>
        <dt className="text-muted">Answers</dt>
        <dd className="text-ink">{answerCount}</dd>
        <dt className="text-muted">Documents</dt>
        <dd className="text-ink">{docCount}</dd>
        <dt className="text-muted">Consent</dt>
        <dd className="text-ink">{payload.consent_type ?? "async_portal"}</dd>
      </dl>
      <p className="mt-2 text-[11px] text-graphite italic">
        PII fields stay encrypted until the Phase 2 worker decrypts them inline.
        Nothing on this preview is decrypted in the dashboard.
      </p>
    </details>
  );
}

// ---------------------------------------------------------------------------
// DriverNotWiredGuidance — surfaces operator-actionable advice when the
// Phase 2 driver isn't available (BROWSERLESS_API_KEY missing). Per TODO-15
// the engineering path is done; this guidance is a one-shot reminder to
// finish the operator step OR fall through to the manual PDF export.
// ---------------------------------------------------------------------------

function DriverNotWiredGuidance(): React.JSX.Element {
  return (
    <div className="border border-hairline rounded-[3px] bg-amber/5 p-3 text-[13px] text-ink space-y-1">
      <p className="font-semibold">Driver not wired in this environment.</p>
      <p className="text-graphite">
        Set <code className="font-mono">BROWSERLESS_API_KEY</code> as a wrangler
        secret (TODO-15) and redeploy, or fall back to the manual PDF export in
        the Handoff &amp; Export panel above.
      </p>
    </div>
  );
}
