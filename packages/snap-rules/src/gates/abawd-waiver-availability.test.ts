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

// County-level resolution (#614). CA waives 7 of 58 counties, so the
// state-level boolean is wrong for someone no matter which way it is set.
// With a county in hand the gate can answer precisely — but ONLY tightening
// where the county is known and demonstrably outside the live list.
describe("county-level ABAWD waiver resolution (#614)", () => {
  function inCounty(fips: string | undefined, monthsUsed = 3): Facts {
    const f = facts("abawd_exempt:waiver_county", monthsUsed) as Facts & { county_fips?: string };
    if (fips) f.county_fips = fips;
    return f;
  }

  it("honors the waiver in a genuinely waived CA county (Tulare)", () => {
    expect(evaluateAbawd(inCounty("06107"), ASOF, "CA").passes).toBe(true);
  });

  it("refuses it in a CA county that is NOT waived (Los Angeles)", () => {
    // The 51 time-limited counties were silently over-approved before this.
    const r = evaluateAbawd(inCounty("06037"), ASOF, "CA");
    expect(r.passes).toBe(false);
    expect(r.status).toBe("time_exhausted");
  });

  it("treats an ABSENT county as unknown, not as unwaived", () => {
    // The critical asymmetry: missing data must never manufacture a denial.
    expect(evaluateAbawd(inCounty(undefined), ASOF, "CA").passes).toBe(true);
  });

  it("stops honoring CA waivers once the grant window closes (after 2026-10-31)", () => {
    const afterExpiry = new Date("2026-11-15");
    expect(evaluateAbawd(inCounty("06107"), afterExpiry, "CA").passes).toBe(false);
  });

  it("honored them inside the window", () => {
    expect(evaluateAbawd(inCounty("06107"), new Date("2026-03-01"), "CA").passes).toBe(true);
  });

  it("does not deny a waived-county member who still has months left", () => {
    expect(evaluateAbawd(inCounty("06037", 0), ASOF, "CA").passes).toBe(true);
  });

  it("MA denies regardless of county — it holds no waiver at all", () => {
    expect(evaluateAbawd(inCounty("25025"), ASOF, "MA").passes).toBe(false);
  });
});

describe("county_fips passes schema validation (#614)", () => {
  // validateFacts returns string[] of problems, or null when clean.
  const base = {
    household: [
      { member_id: "m1", role: "head", age: 35, work_class: "abawd_subject", abawd_months_used: 0 },
    ],
    income: [],
    shelter: { rent: 0, sua_tier: "none" },
    deductions: {},
    assets: 0,
    cat_elig: "none",
  };

  it("accepts a well-formed 5-digit FIPS", async () => {
    const { validateFacts } = await import("../facts-schema");
    expect(validateFacts({ ...base, county_fips: "06107" })).toBeNull();
  });

  it("reports a malformed FIPS instead of letting it through", async () => {
    const { validateFacts } = await import("../facts-schema");
    const errs = validateFacts({ ...base, county_fips: "6107" }); // not zero-padded
    expect(errs).not.toBeNull();
    expect(errs!.join(" ")).toContain("county_fips");
  });

  it("stays optional — omitting it is still valid", async () => {
    const { validateFacts } = await import("../facts-schema");
    expect(validateFacts(base)).toBeNull();
  });
});
