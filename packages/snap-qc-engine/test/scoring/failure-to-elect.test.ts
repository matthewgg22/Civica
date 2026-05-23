import { describe, it, expect } from "vitest";
import {
  detectMissedElections,
  totalMissedMonthlyValue,
  type HouseholdElectionProfile,
} from "../../src/scoring/failure-to-elect";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseProfile: HouseholdElectionProfile = {
  state_code: "CA",
  housing_situation: "renting",
  claimed_homeless_deduction: false,
  claimed_sua_tier: "FULL",
  claimed_actual_utility_cost_usd: null,
  claimed_dependent_care_usd: null,
  claimed_medical_deduction_usd: null,
  has_heating_costs: true,
  has_electric_or_gas: true,
  has_phone: true,
  documented_monthly_utility_usd: null,
  household_members: [{ age: 35, is_disabled: false, is_working: true, receives_ssi: false }],
  monthly_dependent_care_paid_usd: null,
  monthly_medical_out_of_pocket_usd: null,
};

// ---------------------------------------------------------------------------
// 1. Homeless deduction
// ---------------------------------------------------------------------------

describe("detectMissedElections — homeless deduction", () => {
  it("flags 'homeless' situation when deduction not claimed", () => {
    const result = detectMissedElections({
      ...baseProfile,
      housing_situation: "homeless",
      claimed_homeless_deduction: false,
    });
    const flag = result.find((r) => r.kind === "homeless_deduction");
    expect(flag).toBeDefined();
    expect(flag?.confidence).toBe("high");
    expect(flag?.estimated_monthly_value_usd).toBe(198.99);
  });

  it("flags 'shelter' situation with medium confidence", () => {
    const result = detectMissedElections({
      ...baseProfile,
      housing_situation: "shelter",
      claimed_homeless_deduction: false,
    });
    const flag = result.find((r) => r.kind === "homeless_deduction");
    expect(flag?.confidence).toBe("medium");
  });

  it("does NOT flag when deduction is already claimed", () => {
    const result = detectMissedElections({
      ...baseProfile,
      housing_situation: "homeless",
      claimed_homeless_deduction: true,
    });
    expect(result.find((r) => r.kind === "homeless_deduction")).toBeUndefined();
  });

  it("does NOT flag normal renting", () => {
    const result = detectMissedElections({ ...baseProfile, housing_situation: "renting" });
    expect(result.find((r) => r.kind === "homeless_deduction")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. SUA tier upward correction
// ---------------------------------------------------------------------------

describe("detectMissedElections — SUA tier upward", () => {
  it("flags LIMITED when household has heating (should be FULL)", () => {
    const result = detectMissedElections({
      ...baseProfile,
      has_heating_costs: true,
      claimed_sua_tier: "LIMITED",
    });
    const flag = result.find((r) => r.kind === "sua_tier_upward");
    expect(flag).toBeDefined();
    expect(flag?.estimated_monthly_value_usd).toBe(663 - 170); // FULL - LIMITED = $493
    expect(flag?.confidence).toBe("high");
  });

  it("flags TELEPHONE when household has electric (should be LIMITED)", () => {
    const result = detectMissedElections({
      ...baseProfile,
      has_heating_costs: false,
      has_electric_or_gas: true,
      claimed_sua_tier: "TELEPHONE",
    });
    const flag = result.find((r) => r.kind === "sua_tier_upward");
    expect(flag?.estimated_monthly_value_usd).toBe(170 - 44); // $126
  });

  it("does NOT flag when tier is already correct", () => {
    const result = detectMissedElections({
      ...baseProfile,
      has_heating_costs: true,
      claimed_sua_tier: "FULL",
    });
    expect(result.find((r) => r.kind === "sua_tier_upward")).toBeUndefined();
  });

  it("does NOT flag when utility answers are incomplete", () => {
    const result = detectMissedElections({
      ...baseProfile,
      has_heating_costs: null,
      claimed_sua_tier: "LIMITED",
    });
    expect(result.find((r) => r.kind === "sua_tier_upward")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Actual utility cost election
// ---------------------------------------------------------------------------

describe("detectMissedElections — actual utility election", () => {
  it("flags when documented utilities exceed CA FULL HCSUA", () => {
    const result = detectMissedElections({
      ...baseProfile,
      documented_monthly_utility_usd: 850, // > $663
      claimed_actual_utility_cost_usd: null,
    });
    const flag = result.find((r) => r.kind === "actual_utility_election");
    expect(flag).toBeDefined();
    expect(flag?.estimated_monthly_value_usd).toBe(850 - 663); // $187 delta
  });

  it("does NOT flag when utilities are below FULL SUA", () => {
    const result = detectMissedElections({
      ...baseProfile,
      documented_monthly_utility_usd: 500,
    });
    expect(result.find((r) => r.kind === "actual_utility_election")).toBeUndefined();
  });

  it("does NOT flag when already elected actual costs", () => {
    const result = detectMissedElections({
      ...baseProfile,
      documented_monthly_utility_usd: 900,
      claimed_actual_utility_cost_usd: 900,
    });
    expect(result.find((r) => r.kind === "actual_utility_election")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Dependent care deduction
// ---------------------------------------------------------------------------

describe("detectMissedElections — dependent care", () => {
  it("flags working parent + child under 13 + dep-care cost not claimed", () => {
    const result = detectMissedElections({
      ...baseProfile,
      household_members: [
        { age: 32, is_disabled: false, is_working: true, receives_ssi: false },
        { age: 7,  is_disabled: false, is_working: false, receives_ssi: false },
      ],
      monthly_dependent_care_paid_usd: 650,
      claimed_dependent_care_usd: null,
    });
    const flag = result.find((r) => r.kind === "dependent_care_deduction");
    expect(flag).toBeDefined();
    expect(flag?.estimated_monthly_value_usd).toBe(650);
    expect(flag?.confidence).toBe("high");
  });

  it("does NOT flag when no child under 13", () => {
    const result = detectMissedElections({
      ...baseProfile,
      household_members: [
        { age: 32, is_disabled: false, is_working: true, receives_ssi: false },
        { age: 15, is_disabled: false, is_working: false, receives_ssi: false },
      ],
      monthly_dependent_care_paid_usd: 400,
    });
    expect(result.find((r) => r.kind === "dependent_care_deduction")).toBeUndefined();
  });

  it("does NOT flag when dep-care cost is zero", () => {
    const result = detectMissedElections({
      ...baseProfile,
      household_members: [
        { age: 30, is_disabled: false, is_working: true, receives_ssi: false },
        { age: 5,  is_disabled: false, is_working: false, receives_ssi: false },
      ],
      monthly_dependent_care_paid_usd: 0,
    });
    expect(result.find((r) => r.kind === "dependent_care_deduction")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Medical deduction (elderly / disabled)
// ---------------------------------------------------------------------------

describe("detectMissedElections — medical deduction", () => {
  it("flags elderly member with > $35/mo medical costs not claimed", () => {
    const result = detectMissedElections({
      ...baseProfile,
      household_members: [{ age: 68, is_disabled: false, is_working: false, receives_ssi: false }],
      monthly_medical_out_of_pocket_usd: 120,
      claimed_medical_deduction_usd: null,
    });
    const flag = result.find((r) => r.kind === "medical_deduction_elderly_disabled");
    expect(flag).toBeDefined();
    expect(flag?.estimated_monthly_value_usd).toBe(120 - 35); // deductible portion
    expect(flag?.confidence).toBe("high");
  });

  it("flags disabled member regardless of age", () => {
    const result = detectMissedElections({
      ...baseProfile,
      household_members: [{ age: 40, is_disabled: true, is_working: false, receives_ssi: true }],
      monthly_medical_out_of_pocket_usd: 80,
      claimed_medical_deduction_usd: null,
    });
    expect(result.find((r) => r.kind === "medical_deduction_elderly_disabled")).toBeDefined();
  });

  it("does NOT flag when medical costs are ≤ $35 threshold", () => {
    const result = detectMissedElections({
      ...baseProfile,
      household_members: [{ age: 65, is_disabled: false, is_working: false, receives_ssi: false }],
      monthly_medical_out_of_pocket_usd: 30,
    });
    expect(result.find((r) => r.kind === "medical_deduction_elderly_disabled")).toBeUndefined();
  });

  it("does NOT flag non-elderly non-disabled members", () => {
    const result = detectMissedElections({
      ...baseProfile,
      household_members: [{ age: 35, is_disabled: false, is_working: true, receives_ssi: false }],
      monthly_medical_out_of_pocket_usd: 200,
    });
    expect(result.find((r) => r.kind === "medical_deduction_elderly_disabled")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Multi-miss household + sorting + totalMissedMonthlyValue
// ---------------------------------------------------------------------------

describe("detectMissedElections — multi-miss + utilities", () => {
  it("returns multiple missed elections sorted high-confidence first", () => {
    const result = detectMissedElections({
      state_code: "CA",
      housing_situation: "homeless",
      claimed_homeless_deduction: false,
      claimed_sua_tier: "TELEPHONE",
      claimed_actual_utility_cost_usd: null,
      claimed_dependent_care_usd: null,
      claimed_medical_deduction_usd: null,
      has_heating_costs: null, // utility answers incomplete → no SUA flag
      has_electric_or_gas: true,
      has_phone: true,
      documented_monthly_utility_usd: null,
      household_members: [
        { age: 70, is_disabled: false, is_working: false, receives_ssi: false },
      ],
      monthly_dependent_care_paid_usd: null,
      monthly_medical_out_of_pocket_usd: 150,
    });

    // Expect: homeless_deduction + medical_deduction
    expect(result.length).toBeGreaterThanOrEqual(2);
    // High-confidence items come first
    expect(result[0]!.confidence).toBe("high");
  });

  it("totalMissedMonthlyValue sums all elections", () => {
    const result = detectMissedElections({
      ...baseProfile,
      housing_situation: "homeless",
      claimed_homeless_deduction: false,
      household_members: [{ age: 66, is_disabled: false, is_working: false, receives_ssi: false }],
      monthly_medical_out_of_pocket_usd: 100,
      claimed_medical_deduction_usd: null,
    });
    const total = totalMissedMonthlyValue(result);
    // homeless ($198.99) + medical ($100-$35 = $65) = $263.99
    expect(total).toBeCloseTo(263.99, 1);
  });

  it("returns empty array for fully-claimed household", () => {
    const result = detectMissedElections({ ...baseProfile });
    expect(result.length).toBe(0);
  });
});
