import { describe, expect, it } from 'vitest';
import { canTransition } from './status.js';
import type { TransitionContext } from './status.js';

// Full context — all gates pass.
const ok: TransitionContext = {
  hasAssignment: true,
  hasConsent: true,
  hasUnresolvedMissingItems: false,
};

// Minimal context helpers for blocked-case tests.
const noAssignment: TransitionContext = { ...ok, hasAssignment: false };
const noConsent: TransitionContext = { ...ok, hasConsent: false };
const unresolvedItems: TransitionContext = { ...ok, hasUnresolvedMissingItems: true };
const bothMissing: TransitionContext = { hasAssignment: true, hasConsent: false, hasUnresolvedMissingItems: true };

// ── Allowed transitions ───────────────────────────────────────────────────

describe('allowed transitions', () => {
  it('null → awaiting_navigator (session enters queue)', () => {
    expect(canTransition(null, 'awaiting_navigator', ok)).toEqual({ ok: true });
  });

  it('awaiting_navigator → in_review (navigator picks up, assigned)', () => {
    expect(canTransition('awaiting_navigator', 'in_review', ok)).toEqual({ ok: true });
  });

  it('in_review → awaiting_navigator (navigator releases back to queue)', () => {
    expect(canTransition('in_review', 'awaiting_navigator', ok)).toEqual({ ok: true });
  });

  it('in_review → ready_for_handoff (consent + docs complete)', () => {
    expect(canTransition('in_review', 'ready_for_handoff', ok)).toEqual({ ok: true });
  });

  it('ready_for_handoff → in_review (navigator pulls back for more work)', () => {
    expect(canTransition('ready_for_handoff', 'in_review', ok)).toEqual({ ok: true });
  });

  it('ready_for_handoff → handed_off (export complete)', () => {
    expect(canTransition('ready_for_handoff', 'handed_off', ok)).toEqual({ ok: true });
  });
});

// ── Terminal state ────────────────────────────────────────────────────────

describe('terminal_state — handed_off blocks all further transitions', () => {
  const targets = ['awaiting_navigator', 'in_review', 'ready_for_handoff', 'handed_off'] as const;
  for (const to of targets) {
    it(`handed_off → ${to}`, () => {
      const result = canTransition('handed_off', to, ok);
      expect(result).toMatchObject({ ok: false, error: 'terminal_state' });
    });
  }
});

// ── Invalid transitions (matrix violations) ───────────────────────────────

describe('invalid_transition — matrix violations', () => {
  it('null → in_review (must go through awaiting_navigator first)', () => {
    expect(canTransition(null, 'in_review', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('null → ready_for_handoff (skip)', () => {
    expect(canTransition(null, 'ready_for_handoff', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('null → handed_off (skip)', () => {
    expect(canTransition(null, 'handed_off', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('awaiting_navigator → ready_for_handoff (skip in_review)', () => {
    expect(canTransition('awaiting_navigator', 'ready_for_handoff', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('awaiting_navigator → handed_off (skip two steps)', () => {
    expect(canTransition('awaiting_navigator', 'handed_off', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('in_review → handed_off (skip ready_for_handoff)', () => {
    expect(canTransition('in_review', 'handed_off', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('in_review → in_review (no-op is not a valid transition)', () => {
    expect(canTransition('in_review', 'in_review', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('awaiting_navigator → awaiting_navigator (no-op)', () => {
    expect(canTransition('awaiting_navigator', 'awaiting_navigator', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('ready_for_handoff → awaiting_navigator (backwards skip)', () => {
    expect(canTransition('ready_for_handoff', 'awaiting_navigator', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });
});

// ── Context gates ─────────────────────────────────────────────────────────

describe('not_assigned — awaiting_navigator → in_review', () => {
  it('blocked when no active assignment', () => {
    const result = canTransition('awaiting_navigator', 'in_review', noAssignment);
    expect(result).toMatchObject({ ok: false, error: 'not_assigned' });
  });

  it('allowed once assigned', () => {
    expect(canTransition('awaiting_navigator', 'in_review', ok)).toEqual({ ok: true });
  });
});

describe('missing_consent — in_review → ready_for_handoff', () => {
  it('blocked when consent absent', () => {
    const result = canTransition('in_review', 'ready_for_handoff', noConsent);
    expect(result).toMatchObject({ ok: false, error: 'missing_consent' });
  });

  it('missing_consent takes priority over missing_required_docs', () => {
    // Both gates fail — consent is checked first (legal requirement).
    const result = canTransition('in_review', 'ready_for_handoff', bothMissing);
    expect(result).toMatchObject({ ok: false, error: 'missing_consent' });
  });
});

describe('missing_required_docs — in_review → ready_for_handoff', () => {
  it('blocked when unresolved missing item requests exist', () => {
    const result = canTransition('in_review', 'ready_for_handoff', unresolvedItems);
    expect(result).toMatchObject({ ok: false, error: 'missing_required_docs' });
  });

  it('allowed once all items resolved', () => {
    expect(canTransition('in_review', 'ready_for_handoff', ok)).toEqual({ ok: true });
  });
});

// ── Structured error shape ────────────────────────────────────────────────

describe('error shape', () => {
  it('blocked result carries ok:false, error code, and a non-empty message', () => {
    const result = canTransition('awaiting_navigator', 'in_review', noAssignment);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not_assigned');
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
