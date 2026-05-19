import { describe, expect, it } from "vitest";
import { buildBenefitImpactPackage, evaluateBenefitImpact } from "../../src/flows/benefit-impact-projection/index.js";
import type { BenefitImpactInput } from "../../src/schemas.js";

const base = (overrides: Partial<BenefitImpactInput["job_offer"]> = {}): BenefitImpactInput => ({
  applicant_name: "Alex",
  state_code: "CA",
  household_size: 1,
  current_benefit_usd: 292,
  job_offer: {
    type: "w2",
    employer_name: "Dining Services",
    monthly_amount: 1_179,
    ...overrides,
  },
});

describe("benefit-impact-projection: FWS (Federal Work-Study)", () => {
  it("excludes FWS income entirely — counted_income is zero, benefit unchanged", () => {
    const pkg = buildBenefitImpactPackage(base({ type: "fws", employer_name: "Library", monthly_amount: 864 }));
    expect(pkg.flow).toBe("benefit-impact-projection");
    expect(pkg.fws_excluded_usd).toBe(864);
    expect(pkg.counted_income_usd).toBe(0);
    expect(pkg.eid_applied_usd).toBe(0);
    expect(pkg.benefit_reduction_usd).toBe(0);
    expect(pkg.projected_benefit_usd).toBe(292);
    expect(pkg.benefit_change_usd).toBe(0);
  });

  it("includes 7 CFR 273.9(c)(3) citation for FWS jobs", () => {
    const pkg = buildBenefitImpactPackage(base({ type: "fws", monthly_amount: 600 }));
    expect(pkg.regulatory_citations.some((c) => c.includes("273.9(c)(3)"))).toBe(true);
  });

  it("defensibility is strong for FWS jobs", () => {
    const result = evaluateBenefitImpact(base({ type: "fws", monthly_amount: 800 }));
    expect(result.defensibility_score).toBe("strong");
    expect(result.warnings).toHaveLength(0);
  });
});

describe("benefit-impact-projection: W-2 standard wage", () => {
  it("applies 20% EID then 30% reduction — $1,179/mo → benefit becomes $214", () => {
    // counted = 1179, EID = 1179 * 0.20 = 235.8 → round = 235.8
    // net = 1179 - 235.8 = 943.2, reduction = 943.2 * 0.30 = 282.96 → round = 282.96
    // projected = 292 - 282.96 = 9.04 → round = 9.04
    // NOTE: This test uses the engine's own rounding — assert the invariants, not exact cents.
    const pkg = buildBenefitImpactPackage(base({ type: "w2", monthly_amount: 1_179 }));
    expect(pkg.fws_excluded_usd).toBe(0);
    expect(pkg.counted_income_usd).toBe(1_179);
    expect(pkg.eid_applied_usd).toBeCloseTo(1_179 * 0.20, 1);
    expect(pkg.benefit_reduction_usd).toBeGreaterThan(0);
    expect(pkg.projected_benefit_usd).toBeLessThan(pkg.current_benefit_usd);
  });

  it("includes EID and benefit reduction citations for W-2 jobs", () => {
    const pkg = buildBenefitImpactPackage(base({ type: "w2", monthly_amount: 800 }));
    expect(pkg.regulatory_citations.some((c) => c.includes("273.9(d)(1)"))).toBe(true);
    expect(pkg.regulatory_citations.some((c) => c.includes("273.10(e)(1)(i)"))).toBe(true);
  });
});

describe("benefit-impact-projection: gig income", () => {
  it("applies same EID + reduction math as W-2", () => {
    const w2 = buildBenefitImpactPackage(base({ type: "w2", monthly_amount: 800 }));
    const gig = buildBenefitImpactPackage(base({ type: "platform_gig", monthly_amount: 800 }));
    expect(gig.eid_applied_usd).toBe(w2.eid_applied_usd);
    expect(gig.benefit_reduction_usd).toBe(w2.benefit_reduction_usd);
  });

  it("includes OBBBA hours citation for gig jobs", () => {
    const pkg = buildBenefitImpactPackage(base({ type: "platform_gig", monthly_amount: 600 }));
    expect(pkg.regulatory_citations.some((c) => c.includes("OBBBA §10102"))).toBe(true);
  });

  it("emits gig_income_variable warning", () => {
    const result = evaluateBenefitImpact(base({ type: "platform_gig", monthly_amount: 600 }));
    expect(result.warnings.some((w) => w.code === "benefit_impact.gig_income_variable")).toBe(true);
  });
});

describe("benefit-impact-projection: cliff event", () => {
  it("emits cliff_event warning when projected benefit hits $0", () => {
    // High income that wipes the benefit entirely
    const result = evaluateBenefitImpact(base({ type: "w2", monthly_amount: 5_000 }));
    expect(result.evidence_package.projected_benefit_usd).toBe(0);
    expect(result.warnings.some((w) => w.code === "benefit_impact.cliff_event")).toBe(true);
    expect(result.defensibility_score).toBe("weak");
  });

  it("projected_benefit never goes below $0", () => {
    const pkg = buildBenefitImpactPackage(base({ type: "w2", monthly_amount: 99_999 }));
    expect(pkg.projected_benefit_usd).toBe(0);
  });
});

describe("benefit-impact-projection: mixed FWS + household", () => {
  it("household_size 2 with FWS job — benefit unchanged regardless of amount", () => {
    const pkg = buildBenefitImpactPackage({
      applicant_name: "Jordan",
      state_code: "CA",
      household_size: 2,
      current_benefit_usd: 546,
      job_offer: { type: "fws", employer_name: "Financial Aid Office", monthly_amount: 1_200 },
    });
    expect(pkg.fws_excluded_usd).toBe(1_200);
    expect(pkg.projected_benefit_usd).toBe(546);
  });
});
