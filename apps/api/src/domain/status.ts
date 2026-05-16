import type { NavigatorStatus } from '../db/schema.js';

export type TransitionError =
  | 'invalid_transition'  // not in the allowed matrix (includes same-state no-ops)
  | 'terminal_state'      // from === 'handed_off'
  | 'not_assigned'        // awaiting_navigator → in_review requires active assignment
  | 'missing_consent'     // in_review → ready_for_handoff requires applicant consent
  | 'missing_required_docs'; // in_review → ready_for_handoff requires no unresolved missing items

export type TransitionResult =
  | { ok: true }
  | { ok: false; error: TransitionError; message: string };

export interface TransitionContext {
  /** snap_session_assignments has an active (unassigned_at IS NULL) row. */
  hasAssignment: boolean;
  /** Applicant has accepted the current consent version. */
  hasConsent: boolean;
  /** snap_missing_item_requests has rows with resolved_at IS NULL. */
  hasUnresolvedMissingItems: boolean;
}

// Allowed target statuses per source. null = session not yet in navigator queue.
const ALLOWED: Record<string, NavigatorStatus[]> = {
  null: ['awaiting_navigator'],
  awaiting_navigator: ['in_review'],
  in_review: ['awaiting_navigator', 'ready_for_handoff'],
  ready_for_handoff: ['in_review', 'handed_off'],
  handed_off: [],
};

/**
 * Pure status-transition guard. Returns { ok: true } or a structured error.
 * No DB access — callers are responsible for querying context fields.
 *
 * Used by PATCH /navigator/sessions/:id/status (Phase 14).
 */
export function canTransition(
  from: NavigatorStatus | null,
  to: NavigatorStatus,
  ctx: TransitionContext,
): TransitionResult {
  if (from === 'handed_off') {
    return {
      ok: false,
      error: 'terminal_state',
      message: 'Session has been handed off and cannot be transitioned further.',
    };
  }

  const allowed = ALLOWED[from ?? 'null'] ?? [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: 'invalid_transition',
      message: `Transition from ${from ?? 'null'} to ${to} is not permitted.`,
    };
  }

  if (from === 'awaiting_navigator' && to === 'in_review') {
    if (!ctx.hasAssignment) {
      return {
        ok: false,
        error: 'not_assigned',
        message: 'Session must be assigned to a navigator before review can begin.',
      };
    }
  }

  if (from === 'in_review' && to === 'ready_for_handoff') {
    // Consent checked before missing docs: legal requirement takes precedence.
    if (!ctx.hasConsent) {
      return {
        ok: false,
        error: 'missing_consent',
        message: 'Applicant consent is required before the session can be marked ready for handoff.',
      };
    }
    if (ctx.hasUnresolvedMissingItems) {
      return {
        ok: false,
        error: 'missing_required_docs',
        message: 'All missing item requests must be resolved before the session can be marked ready for handoff.',
      };
    }
  }

  return { ok: true };
}
