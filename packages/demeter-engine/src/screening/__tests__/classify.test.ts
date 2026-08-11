import { describe, it, expect } from "vitest";
import { classifyScreening } from "../classify";
import type { PartialFacts } from "../facts-extraction";

// Nothing here mocks composeVerdict/screenExpedited/evaluateCategorical — the
// whole point of this module is presentation logic OVER what snap-rules
// actually computes, so the tests run the real engine and check the mapping.

const ASOF = new Date("2026-08-08");

describe("classifyScreening — the six mockup outcomes", () => {
  it("not_enough_information: an incomplete screening never reaches the engine", () => {
    const c = classifyScreening({ household: [{ member_id: "a", age: 62, role: "head" }] }, "CA", ASOF);
    expect(c.outcome).toBe("not_enough_information");
    expect(c.completeness.computable).toBe(false);
    // Must NOT have attempted a verdict on incomplete data.
    expect(c.verdict).toBeUndefined();
  });

  it("categorically_eligible: pure SSI skips income/asset tests (mockup frame 05, case 1)", () => {
    const facts: PartialFacts = {
      household: [{ member_id: "a", age: 45, role: "head", immigration: "citizen" }],
      income: [{ member: "a", type: "ssi", amount: 900 }],
      shelter: { rent: 500, sua_tier: "none" },
      deductions: {},
      assets: 100_000, // would fail an asset test if one applied — proves it was skipped
      cat_elig: "pure_SSI",
    };
    const c = classifyScreening(facts, "CA", ASOF);
    expect(c.outcome).toBe("categorically_eligible");
    expect(c.verdict?.verdict).toBe("APPROVE");
  });

  it("likely_eligible: an ordinary APPROVE that is not categorical", () => {
    const facts: PartialFacts = {
      household: [{ member_id: "a", age: 62, role: "head", immigration: "citizen" }],
      income: [{ member: "a", type: "ssa", amount: 1180 }],
      shelter: { rent: 600, sua_tier: "none" },
      deductions: { medical_unreimbursed: 175 },
      assets: 500,
      cat_elig: "NPA",
    };
    const c = classifyScreening(facts, "CA", ASOF);
    expect(c.outcome).toBe("likely_eligible");
    expect(c.verdict?.verdict).toBe("APPROVE");
    expect(typeof c.verdict?.benefit).toBe("number");
  });

  it("likely_ineligible: gross income over the limit denies (mockup frame 05, case 2)", () => {
    const facts: PartialFacts = {
      household: [
        { member_id: "a", age: 30, role: "head", immigration: "citizen" },
        { member_id: "b", age: 32, role: "spouse", immigration: "citizen" },
      ],
      income: [{ member: "a", type: "wages", amount: 6000 }], // far over any 2-person screen
      shelter: { rent: 800, sua_tier: "none" },
      deductions: {},
      assets: 0,
      cat_elig: "NPA",
    };
    const c = classifyScreening(facts, "CA", ASOF);
    expect(c.outcome).toBe("likely_ineligible");
    expect(c.verdict?.verdict).toBe("DENY");
  });

  it("needs_county_review: self-employment income is flagged BEFORE the engine runs", () => {
    const facts: PartialFacts = {
      household: [{ member_id: "a", age: 40, role: "head", immigration: "citizen" }],
      income: [{ member: "a", type: "self_employment", amount: 1200 }],
      shelter: { rent: 500, sua_tier: "none" },
      deductions: {},
      assets: 0,
      cat_elig: "NPA",
    };
    const c = classifyScreening(facts, "CA", ASOF);
    expect(c.outcome).toBe("needs_county_review");
    expect(c.summary).toContain("Self-employment");
    // Deliberately does not assert a benefit figure — that's the point.
    expect(c.verdict).toBeUndefined();
  });

  it("expedited: very low income/resources classify before the ordinary verdict", () => {
    const facts: PartialFacts = {
      household: [{ member_id: "a", age: 30, role: "head", immigration: "citizen" }],
      income: [{ member: "a", type: "wages", amount: 100 }],
      shelter: { rent: 0, sua_tier: "none" },
      deductions: {},
      assets: 50,
      cat_elig: "NPA",
    };
    const c = classifyScreening(facts, "CA", ASOF);
    expect(c.outcome).toBe("expedited");
  });

  it("a complete screening always carries a one-sentence, non-empty summary", () => {
    const cases: PartialFacts[] = [
      {},
      {
        household: [{ member_id: "a", age: 62, role: "head", immigration: "citizen" }],
        income: [{ member: "a", type: "ssa", amount: 1180 }],
        shelter: { rent: 600, sua_tier: "none" },
        deductions: {},
        assets: 500,
        cat_elig: "NPA",
      },
    ];
    for (const f of cases) {
      const c = classifyScreening(f, "CA", ASOF);
      expect(c.summary.length, c.outcome).toBeGreaterThan(0);
    }
  });

  // A corpus pack can exist for a state snap-rules has no policy for — MN
  // today (NY closed this gap in #733; MN, NV, AZ, OR, WI remain open, see
  // issue #732): badged "✓ Verified" for ANSWERS, but with no benefit math.
  // The screener used to tell that reader "this household needs information
  // our screener doesn't have yet", which is false. Nothing was missing from
  // what they said, and it sent someone who had answered everything looking
  // for a document that does not exist.
  it("names a missing STATE POLICY as our gap, not the reader's", () => {
    const facts: PartialFacts = {
      household: [{ member_id: "a", age: 40, role: "head", immigration: "citizen" }],
      income: [{ member: "a", type: "wages", amount: 1500 }],
      shelter: { rent: 900, sua_tier: "none" },
      deductions: {},
      assets: 100,
      cat_elig: "NPA",
    };
    const c = classifyScreening(facts, "MN", ASOF);
    expect(c.outcome).toBe("not_enough_information");
    expect(c.verdict?.not_implemented_surfaces).toContain("state-policy-not-loaded");
    // Must not blame the reader's information…
    expect(c.summary).not.toContain("needs information our screener");
    // …must name the state and own the gap.
    expect(c.summary).toContain("MN");
    expect(c.summary.toLowerCase()).toContain("our gap");
  });
});
