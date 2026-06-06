import { describe, it, expect } from "vitest";
import type { Facts } from "@civica/snap-rules";
import { DEMO_HOUSEHOLDS, DEMO_AS_OF, type DemoHousehold } from "../__fixtures__/demo-households";
import { assessDemoHouseholds, assessDemoHousehold } from "../demo-assessments";

// The /cbo-preview demo renders live engine output for synthetic households.
// Its credibility rests on one invariant: the engine verdict the demo shows
// must match the v0.6 oracle for every household. If the engine drifts, the
// demo would silently show a wrong verdict to a prospective CBO — so this test
// is the guard. asOf is DEMO_AS_OF (the deck's FY2026/post-OBBBA basis) — the
// exact same pinned date assessDemoHouseholds() defaults to in production, so
// the test covers the real wall-clock-free render path.
const AS_OF = DEMO_AS_OF;

describe("cbo-preview demo households — live engine matches oracle", () => {
  it("the live engine (not the fixture data) yields a non-trivial spread", () => {
    // Assert on engine OUTPUT, not h.oracleCA — otherwise a wholesale engine
    // regression could still pass this test by reading the hardcoded fixtures.
    const verdicts = assessDemoHouseholds(DEMO_AS_OF).map((a) => a.verdict);
    expect(verdicts).toContain("APPROVE");
    expect(verdicts).toContain("DENY");
    expect(DEMO_HOUSEHOLDS.length).toBeGreaterThanOrEqual(6);
  });

  it("the no-arg production path (default asOf) matches the pinned-date path", () => {
    // EngineHouseholdsPanel calls assessDemoHouseholds() with no arg. Lock that
    // default-asOf path to the oracle so a future-dated regression can't flip
    // the live demo while the explicitly-pinned tests stay green.
    for (const a of assessDemoHouseholds()) {
      expect(a.matchesOracle).toBe(true);
    }
  });

  it.each(DEMO_HOUSEHOLDS.map((h) => [h.key, h.name, h] as const))(
    "%s (%s): live verdict matches the v0.6 oracle",
    (_key, _name, household) => {
      const a = assessDemoHousehold(household, AS_OF);
      expect(a.verdict).toBe(household.oracleCA.verdict);
      expect(a.matchesOracle).toBe(true);
    },
  );

  it("APPROVE households render a positive monthly benefit; DENY renders none", () => {
    for (const a of assessDemoHouseholds(AS_OF)) {
      if (a.verdict === "APPROVE") {
        expect(a.monthlyBenefitUsd).toBeGreaterThan(0);
      } else if (a.verdict === "DENY") {
        expect(a.monthlyBenefitUsd).toBeNull();
      }
    }
  });

  it("explanation wording matches the verdict (not just non-empty)", () => {
    for (const a of assessDemoHouseholds(AS_OF)) {
      if (a.verdict === "APPROVE") {
        expect(a.why).toMatch(/eligible/i);
        expect(a.why).toContain("/mo");
      } else if (a.verdict === "DENY") {
        expect(a.why).toMatch(/exceeds the program limit/i);
      }
    }
  });

  it("a NON-income denial does not render an income reason (no fabricated 'why')", () => {
    // Regression: explain() used to hardcode every DENY as "income exceeds the
    // limit." This undocumented single adult (D05) earns $1,000/mo — which does
    // NOT exceed the limit — and is denied purely on immigration. The old copy
    // would have printed a doubly-false statement on a public page.
    const undocumented: DemoHousehold = {
      key: "D05",
      name: "Test — non-income denial",
      situation: "undocumented single adult, modest wages",
      facts: {
        household: [{ member_id: "m1", age: 38, role: "head", disability: false, elderly: false, student: "not", immigration: "undocumented", five_yr_bar: "n/a", sponsored: false, work_class: "gen_work_subject", abawd_months_used: 0, disqual: [], living: "housed" }],
        income: [{ member: "m1", type: "wages", amount: 1000, freq: "monthly", anticipation: "averaged", source_status: "ongoing" }],
        shelter: { rent: 600, sua_tier: "HCSUA", sua_amount: 663, internet: 0, homeless_deduction: false },
        deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
        assets: "n/a:not_authored",
        cat_elig: "NPA",
      } as unknown as Facts,
      oracleCA: { verdict: "DENY", eligible: false, benefit: null },
    };
    const a = assessDemoHousehold(undocumented, AS_OF);
    expect(a.verdict).toBe("DENY");
    expect(a.why).not.toMatch(/income/i);
    expect(a.why).not.toMatch(/exceeds/i);
    expect(a.why).toBe("Not eligible under SNAP rules for this household.");
  });

  it("degrades safely on malformed facts — UNKNOWN verdict, null benefit, no throw", () => {
    // Missing shelter/deductions/assets makes composeVerdict return
    // not_implemented (no verdict → UNKNOWN) AND computeBenefit throw (→ catch).
    // One input exercises both defensive branches the fixtures never hit.
    const broken: DemoHousehold = {
      key: "BROKEN",
      name: "Malformed input",
      situation: "deliberately invalid facts",
      facts: { household: [], income: [] } as unknown as Facts,
      oracleCA: { verdict: "DENY", eligible: false, benefit: null },
    };
    const a = assessDemoHousehold(broken, AS_OF);
    expect(a.verdict).toBe("UNKNOWN");
    expect(a.monthlyBenefitUsd).toBeNull();
    expect(a.why).toMatch(/could not produce/i);
    expect(a.matchesOracle).toBe(false);
  });
});
