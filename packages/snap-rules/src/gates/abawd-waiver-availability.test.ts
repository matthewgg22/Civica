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

function facts(workClass: string, monthsUsed: number, countyFips?: string): Facts {
  return {
    household: [
      {
        member_id: "m1",
        age: 35,
        work_class: workClass,
        abawd_months_used: monthsUsed,
      },
    ],
    ...(countyFips ? { county_fips: countyFips } : {}),
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

  it("CA falls back to the permissive state-level flag when county is UNKNOWN", () => {
    // No county_fips given — the gate has no per-county answer available,
    // so it falls back to abawd_waiver_avail: true exactly as before #614.
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 3), ASOF, "CA");
    expect(r.passes).toBe(true);
  });
});

describe("ABAWD area-waiver exemptions respect the actual COUNTY, when known (#614)", () => {
  it("honors the waiver for a household in one of CA's 7 genuinely-waived counties", () => {
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 3, "06011"), ASOF, "CA"); // Colusa
    expect(r.passes).toBe(true);
  });

  it("REGRESSION: denies the exemption for a household in a NON-waived CA county — the precision #614 exists for", () => {
    // Before #614, CA's state-level abawd_waiver_avail: true honored this
    // exemption in EVERY county, including this one (Los Angeles), which
    // holds no waiver. That over-approved the 51 time-limited counties.
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 3, "06037"), ASOF, "CA"); // Los Angeles
    expect(r.passes).toBe(false);
    expect(r.status).toBe("time_exhausted");
  });

  it("MA's county set is real but empty — an MA county never satisfies the exemption", () => {
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 3, "25025"), ASOF, "MA"); // Suffolk
    expect(r.passes).toBe(false);
  });

  it("a county_fips for a state with NO authored county data falls back to the state-level flag, same as before", () => {
    // TX has no CA/MA-style county set authored — county_fips is present
    // but unused, and abawd_waiver_avail: false still governs.
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 3, "48201"), ASOF, "TX"); // Harris
    expect(r.passes).toBe(false);
  });

  it("the county-level answer wins even when it's MORE permissive than a naive state read would suggest", () => {
    // Symmetry check: county precision cuts both ways. A waived county
    // still exempts even though 51 of CA's 58 counties do not.
    const r = evaluateAbawd(facts("abawd_exempt:waiver_county", 3, "06107"), ASOF, "CA"); // Tulare
    expect(r.passes).toBe(true);
  });

  it("still exhausts a plainly-subject ABAWD regardless of state or county", () => {
    for (const st of ["CA", "TX", undefined]) {
      const r = evaluateAbawd(facts("abawd_subject", 3, "06011"), ASOF, st);
      expect(r.passes, `${st}`).toBe(false);
    }
  });
});
