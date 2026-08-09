import { describe, it, expect } from "vitest";
import { evaluateAbawd } from "./abawd";
import type { Facts } from "../facts";

// Regression for #608 — `abawd_waiver_avail` was declared on every state and
// read by no gate, so an AREA-based ABAWD exemption was honored even in states
// that hold no waiver at all (7 CFR 273.24(f)).
//
// Direction of error is the whole design here. Stripping an exemption denies
// food, so the rule only fires when we AFFIRMATIVELY know the state offers no
// waiver: no state, or an unregistered one, leaves the exemption standing.

const ASOF = new Date("2026-08-08"); // post-OBBBA

function facts(workClass: string, monthsUsed: number): Facts {
  return {
    household: [
      {
        member_id: "m1",
        age: 35,
        work_class: workClass,
        abawd_months_used: monthsUsed,
      },
    ],
  } as unknown as Facts;
}

describe("ABAWD area-waiver exemptions respect state waiver availability (#608)", () => {
  it("honors a waiver exemption in a state that HAS waivers (CA)", () => {
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 3), ASOF, "CA");
    expect(r.passes).toBe(true);
  });

  it("refuses a waiver exemption in a state with NO waivers (TX) once time is exhausted", () => {
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 3), ASOF, "TX");
    expect(r.passes).toBe(false);
    expect(r.status).toBe("time_exhausted");
  });

  it("does not deny in a no-waiver state while months remain — the time limit is 3 of 36", () => {
    // The exemption is stripped, but stripping it must not manufacture a
    // denial for someone still inside their allowance.
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 0), ASOF, "TX");
    expect(r.passes).toBe(true);
  });

  it("leaves PERSONAL exemptions alone in a no-waiver state", () => {
    // Disability doesn't depend on where the household lives.
    const r = evaluateAbawd(facts("abawd_exempt:disabled", 3), ASOF, "TX");
    expect(r.passes).toBe(true);
  });

  it("fails OPEN when the state is omitted", () => {
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 3), ASOF);
    expect(r.passes).toBe(true);
  });

  it("fails OPEN for an unregistered state rather than denying on a lookup miss", () => {
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 3), ASOF, "ZZ");
    expect(r.passes).toBe(true);
  });

  it("MA now refuses an area waiver — its statewide waiver expired 2025-06-30", () => {
    // DTA OLGTM-2025-31: no geographic waiver anywhere in MA for FY26. Before
    // the flag was corrected this returned passes:true, silently exempting a
    // household on a waiver that does not exist.
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 3), ASOF, "MA");
    expect(r.passes).toBe(false);
    expect(r.status).toBe("time_exhausted");
  });

  it("CA still honors the waiver — 7 counties really are waived", () => {
    // CA keeps abawd_waiver_avail: true on purpose. A state-level boolean
    // cannot say "7 of 58", and denying the genuinely-waived counties is the
    // worse error. Revisit only when Facts carries county_fips.
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 3), ASOF, "CA");
    expect(r.passes).toBe(true);
  });

  it("still exhausts a plainly-subject ABAWD regardless of state", () => {
    for (const st of ["CA", "TX", undefined]) {
      const r = evaluateAbawd(facts("abawd_subject", 3), ASOF, st);
      expect(r.passes, `${st}`).toBe(false);
    }
  });
});
