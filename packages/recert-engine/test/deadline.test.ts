import { describe, it, expect } from 'vitest';
import { estimate, reminders } from '../src/deadline.js';

describe('estimate()', () => {
  it('CA student household: 6-month cert period', () => {
    const result = estimate({
      enrolledAt: '2026-01-15T00:00:00Z',
      state: 'CA',
      householdType: 'student',
    });
    expect(result.certPeriodEnd).toBe('2026-07-15');
    expect(result.source).toBe('estimated');
  });

  it('CA non-student household: 12-month cert period', () => {
    const result = estimate({
      enrolledAt: '2026-01-15T00:00:00Z',
      state: 'CA',
      householdType: 'standard',
    });
    expect(result.certPeriodEnd).toBe('2027-01-15');
    expect(result.source).toBe('estimated');
  });

  it('MA household: 12-month cert period', () => {
    const result = estimate({
      enrolledAt: '2026-01-15T00:00:00Z',
      state: 'MA',
      householdType: 'standard',
    });
    expect(result.certPeriodEnd).toBe('2027-01-15');
    expect(result.source).toBe('estimated');
  });

  it('MA student household: 12-month cert period (MA does not differentiate)', () => {
    const result = estimate({
      enrolledAt: '2026-03-01T00:00:00Z',
      state: 'MA',
      householdType: 'student',
    });
    expect(result.certPeriodEnd).toBe('2027-03-01');
  });

  it('returns reminders as part of the estimate', () => {
    const result = estimate({
      enrolledAt: '2026-01-15T00:00:00Z',
      state: 'CA',
      householdType: 'standard',
    });
    expect(result.reminders).toHaveLength(3);
    const types = result.reminders.map((r) => r.type);
    expect(types).toContain('T-30');
    expect(types).toContain('T-7');
    expect(types).toContain('T-0');
  });
});

describe('reminders()', () => {
  it('T-30 is 30 days before certPeriodEnd', () => {
    const result = reminders({ certPeriodEnd: '2027-01-15' });
    const t30 = result.find((r) => r.type === 'T-30');
    expect(t30?.sendAt).toBe('2026-12-16');
  });

  it('T-7 is 7 days before certPeriodEnd', () => {
    const result = reminders({ certPeriodEnd: '2027-01-15' });
    const t7 = result.find((r) => r.type === 'T-7');
    expect(t7?.sendAt).toBe('2027-01-08');
  });

  it('T-0 is the certPeriodEnd day', () => {
    const result = reminders({ certPeriodEnd: '2027-01-15' });
    const t0 = result.find((r) => r.type === 'T-0');
    expect(t0?.sendAt).toBe('2027-01-15');
  });

  it('returns exactly 3 reminders in order T-30, T-7, T-0', () => {
    const result = reminders({ certPeriodEnd: '2027-06-01' });
    expect(result.map((r) => r.type)).toEqual(['T-30', 'T-7', 'T-0']);
  });
});
