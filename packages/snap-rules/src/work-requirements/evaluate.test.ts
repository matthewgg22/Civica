import { describe, it, expect } from 'vitest';
import { evaluateWorkRequirement } from './evaluate';
import type { WorkRequirementInput } from './types';

// Helper: build a single-member household at a working-age 22 with no
// other exemptions, just toggling the LPIE inputs.
function caStudent(opts: { half?: boolean; degree?: boolean }): WorkRequirementInput {
  return {
    state: 'CA',
    hasWaiverCounty: false,
    householdMembers: [
      {
        id: 'm1',
        age: 22,
        halfTimeEnrolled: opts.half,
        degreeOrCertificateProgram: opts.degree,
      },
    ],
  };
}

describe('Session A — LPIE override in evaluateWorkRequirement', () => {
  it('half-time + degree + flag on → lpie_half_time_degree exemption', () => {
    const out = evaluateWorkRequirement(caStudent({ half: true, degree: true }), {
      lpie_auto_exempt_enabled: true,
    });
    expect(out.isSubject).toBe(false);
    expect(out.exemptionType).toBe('lpie_half_time_degree');
  });

  it('half-time + degree + flag off → falls through to 5-path (no exemption)', () => {
    const out = evaluateWorkRequirement(caStudent({ half: true, degree: true }), {
      lpie_auto_exempt_enabled: false,
    });
    // No other exemption inputs were set → member is subject.
    expect(out.isSubject).toBe(true);
    expect(out.exemptionType).toBeNull();
  });

  it('half-time + degree + no flags arg → defaults to NOT applying LPIE', () => {
    // featureFlags defaults to {} → lpie_auto_exempt_enabled is undefined → skip.
    const out = evaluateWorkRequirement(caStudent({ half: true, degree: true }));
    expect(out.isSubject).toBe(true);
    expect(out.exemptionType).toBeNull();
  });

  it('not half-time → falls through even when flag on', () => {
    const out = evaluateWorkRequirement(caStudent({ half: false, degree: true }), {
      lpie_auto_exempt_enabled: true,
    });
    expect(out.exemptionType).not.toBe('lpie_half_time_degree');
  });

  it('not degree → falls through even when flag on', () => {
    const out = evaluateWorkRequirement(caStudent({ half: true, degree: false }), {
      lpie_auto_exempt_enabled: true,
    });
    expect(out.exemptionType).not.toBe('lpie_half_time_degree');
  });

  it('non-CA state → flag has no effect (no LPIE override for MA)', () => {
    const out = evaluateWorkRequirement(
      {
        state: 'MA',
        hasWaiverCounty: false,
        householdMembers: [
          {
            id: 'm1',
            age: 22,
            halfTimeEnrolled: true,
            degreeOrCertificateProgram: true,
          },
        ],
      },
      { lpie_auto_exempt_enabled: true },
    );
    expect(out.exemptionType).not.toBe('lpie_half_time_degree');
  });
});
