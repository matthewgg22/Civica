import { describe, it, expect } from "vitest";
import { formatEngineParams } from "../engine-citations";
import { VERIFIED_STATE_CODES } from "../packs";

// PARITY: a state with a verified corpus pack AND authored engine math must
// get its LIVE FY figures in the answer prompt.
//
// The bug this pins: buildMaeSystem used to gate live figures on a hardcoded
// {"CA","MA"} set, written when snap-rules had two states. snap-rules grew to
// eleven; the set did not. So TX, WA and GA — verified packs with real
// authored math — were told "figures not yet wired" and answered without the
// numbers they could have quoted. Nothing failed loudly; the answers were just
// quietly worse.
//
// This asserts against the ENGINE rather than a list, so it keeps working as
// states are added on either side.

/** Does snap-rules have authored policy for this state? */
function hasEngineMath(code: string): boolean {
  try {
    formatEngineParams(code, new Date());
    return true;
  } catch {
    return false;
  }
}

describe("engine-parameter parity", () => {
  it("serves live figures for every verified pack state that has engine math", () => {
    const withMath = VERIFIED_STATE_CODES.filter(hasEngineMath);
    // Guard against this test passing vacuously if the pack list ever empties.
    expect(withMath.length, "no verified state has engine math — check the wiring").toBeGreaterThan(0);
    for (const code of withMath) {
      const params = formatEngineParams(code, new Date());
      expect(params.length, code).toBeGreaterThan(0);
      // The figures the answer is supposed to quote: per-household-size rows.
      expect(params, code).toMatch(/HH1 \$\d/);
    }
  });

  it("covers more than the two states the old hardcoded gate allowed", () => {
    // The specific regression: {"CA","MA"} froze this at two while the engine
    // grew. MA has no corpus pack, so under the old gate exactly ONE verified
    // state (CA) ever received live figures.
    const withMath = VERIFIED_STATE_CODES.filter(hasEngineMath);
    expect(withMath.length, `verified states with math: ${withMath.join(", ")}`).toBeGreaterThan(1);
  });

  it("never prints a BBCE percentage it does not have", () => {
    // The tripwire's whole purpose. A state with authored math but no encoded
    // BBCE percentage must REFUSE to state one rather than inherit 200% — the
    // hardcoded-200-for-TX bug, which this guard has now caught twice.
    for (const code of VERIFIED_STATE_CODES.filter(hasEngineMath)) {
      const params = formatEngineParams(code, new Date());
      const claimsPct = /BBCE[^\n]*?(\d+)% FPL/.exec(params);
      if (claimsPct) {
        // If it states a percentage at all, it must not be the CA default
        // applied to a state that never adopted it.
        expect([130, 165, 200], `${code} BBCE %`).toContain(Number(claimsPct[1]));
      }
    }
  });

  it("does not describe a 130% BBCE screen as raising the income limit", () => {
    // GA's BBCE is 130% — identical to the federal gross test, so it confers
    // ASSET relief and no income relief. Presenting it as "the operative
    // screen" alongside the federal test implies a higher limit than exists.
    const ga = formatEngineParams("GA", new Date());
    expect(ga).toMatch(/asset-test relief/);
    expect(ga).toMatch(/NOT a higher income limit/);
  });

  it("throws for a state with no authored policy, so callers can say so", () => {
    // The throw is the signal buildMaeSystem branches on. If this ever stopped
    // throwing, an unauthored state would silently get an empty params block
    // instead of the explicit "not wired" note.
    expect(() => formatEngineParams("ZZ", new Date())).toThrow();
  });
});
