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
  it('null → Submitted for Review (packet enters queue)', () => {
    expect(canTransition(null, 'Submitted for Review', ok)).toEqual({ ok: true });
  });

  it('Submitted for Review → In Navigator Review (navigator picks up, assigned)', () => {
    expect(canTransition('Submitted for Review', 'In Navigator Review', ok)).toEqual({ ok: true });
  });

  it('Submitted for Review → Needs Documents', () => {
    expect(canTransition('Submitted for Review', 'Needs Documents', ok)).toEqual({ ok: true });
  });

  it('Submitted for Review → Needs Applicant Clarification', () => {
    expect(canTransition('Submitted for Review', 'Needs Applicant Clarification', ok)).toEqual({ ok: true });
  });

  it('In Navigator Review → Ready for Handoff (consent + docs complete)', () => {
    expect(canTransition('In Navigator Review', 'Ready for Handoff', ok)).toEqual({ ok: true });
  });

  it('In Navigator Review → Needs Documents', () => {
    expect(canTransition('In Navigator Review', 'Needs Documents', ok)).toEqual({ ok: true });
  });

  it('In Navigator Review → Needs Applicant Clarification', () => {
    expect(canTransition('In Navigator Review', 'Needs Applicant Clarification', ok)).toEqual({ ok: true });
  });

  it('Needs Documents → In Navigator Review', () => {
    expect(canTransition('Needs Documents', 'In Navigator Review', ok)).toEqual({ ok: true });
  });

  it('Ready for Handoff → Handed Off (export complete)', () => {
    expect(canTransition('Ready for Handoff', 'Handed Off', ok)).toEqual({ ok: true });
  });

  it('Handed Off → Closed', () => {
    expect(canTransition('Handed Off', 'Closed', ok)).toEqual({ ok: true });
  });
});

// ── Terminal state ────────────────────────────────────────────────────────

describe('terminal_state — Handed Off and Closed block all further transitions', () => {
  const targets = ['Submitted for Review', 'In Navigator Review', 'Ready for Handoff', 'Handed Off'] as const;
  for (const to of targets) {
    it(`Handed Off → ${to}`, () => {
      const result = canTransition('Handed Off', to, ok);
      expect(result).toMatchObject({ ok: false, error: 'terminal_state' });
    });
    it(`Closed → ${to}`, () => {
      const result = canTransition('Closed', to, ok);
      expect(result).toMatchObject({ ok: false, error: 'terminal_state' });
    });
  }
});

// ── Invalid transitions (matrix violations) ───────────────────────────────

describe('invalid_transition — matrix violations', () => {
  it('null → In Navigator Review (must go through Submitted for Review first)', () => {
    expect(canTransition(null, 'In Navigator Review', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('null → Ready for Handoff (skip)', () => {
    expect(canTransition(null, 'Ready for Handoff', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('null → Handed Off (skip)', () => {
    expect(canTransition(null, 'Handed Off', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('Submitted for Review → Ready for Handoff (skip In Navigator Review)', () => {
    expect(canTransition('Submitted for Review', 'Ready for Handoff', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('Submitted for Review → Handed Off (skip two steps)', () => {
    expect(canTransition('Submitted for Review', 'Handed Off', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('In Navigator Review → Handed Off (skip Ready for Handoff)', () => {
    expect(canTransition('In Navigator Review', 'Handed Off', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('In Navigator Review → In Navigator Review (no-op is not a valid transition)', () => {
    expect(canTransition('In Navigator Review', 'In Navigator Review', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('Submitted for Review → Submitted for Review (no-op)', () => {
    expect(canTransition('Submitted for Review', 'Submitted for Review', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('Ready for Handoff → Submitted for Review (backwards)', () => {
    expect(canTransition('Ready for Handoff', 'Submitted for Review', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });

  it('Ready for Handoff → In Navigator Review (backwards)', () => {
    expect(canTransition('Ready for Handoff', 'In Navigator Review', ok)).toMatchObject({ ok: false, error: 'invalid_transition' });
  });
});

// ── Context gates ─────────────────────────────────────────────────────────

describe('not_assigned — Submitted for Review → In Navigator Review', () => {
  it('blocked when no active assignment', () => {
    const result = canTransition('Submitted for Review', 'In Navigator Review', noAssignment);
    expect(result).toMatchObject({ ok: false, error: 'not_assigned' });
  });

  it('allowed once assigned', () => {
    expect(canTransition('Submitted for Review', 'In Navigator Review', ok)).toEqual({ ok: true });
  });
});

describe('missing_consent — In Navigator Review → Ready for Handoff', () => {
  it('blocked when consent absent', () => {
    const result = canTransition('In Navigator Review', 'Ready for Handoff', noConsent);
    expect(result).toMatchObject({ ok: false, error: 'missing_consent' });
  });

  it('missing_consent takes priority over missing_required_docs', () => {
    // Both gates fail — consent is checked first (legal requirement).
    const result = canTransition('In Navigator Review', 'Ready for Handoff', bothMissing);
    expect(result).toMatchObject({ ok: false, error: 'missing_consent' });
  });
});

describe('missing_required_docs — In Navigator Review → Ready for Handoff', () => {
  it('blocked when unresolved missing item requests exist', () => {
    const result = canTransition('In Navigator Review', 'Ready for Handoff', unresolvedItems);
    expect(result).toMatchObject({ ok: false, error: 'missing_required_docs' });
  });

  it('allowed once all items resolved', () => {
    expect(canTransition('In Navigator Review', 'Ready for Handoff', ok)).toEqual({ ok: true });
  });
});

// ── Structured error shape ────────────────────────────────────────────────

describe('error shape', () => {
  it('blocked result carries ok:false, error code, and a non-empty message', () => {
    const result = canTransition('Submitted for Review', 'In Navigator Review', noAssignment);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not_assigned');
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
