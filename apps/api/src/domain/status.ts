import { PACKET_STATUS_TRANSITIONS } from '@civica/snap-enums';
import type { PacketStatus } from '@civica/snap-enums';

export type { PacketStatus };

export type TransitionError =
  | 'invalid_transition'
  | 'terminal_state'
  | 'not_assigned'
  | 'missing_consent'
  | 'missing_required_docs';

export type TransitionResult =
  | { ok: true }
  | { ok: false; error: TransitionError; message: string };

export interface TransitionContext {
  /** packet_assignments has an active (is_current = true) row. */
  hasAssignment: boolean;
  /** Applicant has accepted the current consent version. */
  hasConsent: boolean;
  /** missing_item_requests has rows with status = 'pending'. */
  hasUnresolvedMissingItems: boolean;
}

export function canTransition(
  from: PacketStatus | null,
  to: PacketStatus,
  ctx: TransitionContext,
): TransitionResult {
  if (from === 'Closed') {
    return {
      ok: false,
      error: 'terminal_state',
      message: `Packet is Closed and cannot be transitioned further.`,
    };
  }

  // Handed Off is semi-terminal: only Closed is permitted (caught by matrix below if wrong).
  if (from === 'Handed Off' && to !== 'Closed') {
    return {
      ok: false,
      error: 'terminal_state',
      message: `Packet is Handed Off and cannot be transitioned to ${to}.`,
    };
  }

  const allowed = from ? PACKET_STATUS_TRANSITIONS[from] : (['Submitted for Review'] as const);
  if (!(allowed as readonly string[]).includes(to)) {
    return {
      ok: false,
      error: 'invalid_transition',
      message: `Transition from ${from ?? 'null'} to ${to} is not permitted.`,
    };
  }

  if (to === 'In Navigator Review' && from === 'Submitted for Review') {
    if (!ctx.hasAssignment) {
      return {
        ok: false,
        error: 'not_assigned',
        message: 'Packet must be assigned to a navigator before review can begin.',
      };
    }
  }

  if (to === 'Ready for Handoff') {
    if (!ctx.hasConsent) {
      return {
        ok: false,
        error: 'missing_consent',
        message: 'Applicant consent is required before the packet can be marked ready for handoff.',
      };
    }
    if (ctx.hasUnresolvedMissingItems) {
      return {
        ok: false,
        error: 'missing_required_docs',
        message: 'All missing item requests must be resolved before the packet can be marked ready for handoff.',
      };
    }
  }

  return { ok: true };
}
