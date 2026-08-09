// Input contract enforcement at the composer's front door.
//
// Pattern mirrors src/index.test.ts which uses RulesFileSchema +
// safeParse to gate state-rule JSON. Same idea here: malformed Facts
// get rejected with a structured error path; the composer never sees
// a shape it didn't agree to accept.

import { describe, it, expect } from "vitest";
import { composeVerdict } from "./verdict";
import { FactsSchema, validateFacts } from "./facts-schema";

const okFacts = {
  household: [
    { member_id: "m1", age: 35, role: "head" },
  ],
  income: [],
  shelter: { rent: 600, sua_tier: "HCSUA", sua_amount: 663, homeless_deduction: false },
  deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
  assets: 200,
  cat_elig: "NPA",
};

describe("FactsSchema (Zod input contract)", () => {
  it("accepts a minimal valid Facts shape", () => {
    expect(FactsSchema.safeParse(okFacts).success).toBe(true);
    expect(validateFacts(okFacts)).toBeNull();
  });

  it("rejects a Facts missing the household array", () => {
    const { household: _h, ...bad } = okFacts;
    expect(FactsSchema.safeParse(bad).success).toBe(false);
    const errs = validateFacts(bad);
    expect(errs).not.toBeNull();
    expect(errs!.some((e) => e.startsWith("household"))).toBe(true);
  });

  it("rejects a Facts with sua_tier outside the enum", () => {
    const bad = { ...okFacts, shelter: { ...okFacts.shelter, sua_tier: "TYPO" } };
    const errs = validateFacts(bad);
    expect(errs).not.toBeNull();
    expect(errs!.some((e) => e.includes("shelter.sua_tier"))).toBe(true);
  });

  it("rejects a Facts with non-numeric income amount", () => {
    const bad = { ...okFacts, income: [{ amount: "not a number" }] };
    const errs = validateFacts(bad);
    expect(errs).not.toBeNull();
  });

  it("accepts variant-runtime flags via passthrough (active_warrant, etc.)", () => {
    const withFlag = { ...okFacts, active_warrant: true, coresident_income_pct: 170 };
    expect(validateFacts(withFlag)).toBeNull();
  });

  it("accepts the 'n/a:not_authored' assets sentinel string", () => {
    const sentinel = { ...okFacts, assets: "n/a:not_authored" };
    expect(validateFacts(sentinel)).toBeNull();
  });

  it("rejects a Facts member with negative age", () => {
    const bad = {
      ...okFacts,
      household: [{ member_id: "m1", age: -5, role: "head" }],
    };
    const errs = validateFacts(bad);
    expect(errs).not.toBeNull();
    expect(errs!.some((e) => e.includes("household.0.age"))).toBe(true);
  });

  it("accepts a well-formed county_fips (#614)", () => {
    const withCounty = { ...okFacts, county_fips: "06011" };
    expect(validateFacts(withCounty)).toBeNull();
  });

  it("rejects a county_fips that isn't 5 digits", () => {
    const bad = { ...okFacts, county_fips: "6011" }; // missing the leading zero
    const errs = validateFacts(bad);
    expect(errs).not.toBeNull();
    expect(errs!.some((e) => e.includes("county_fips"))).toBe(true);
  });

  it("county_fips is optional — a Facts without it still validates", () => {
    expect(validateFacts(okFacts)).toBeNull();
  });
});

describe("composeVerdict input gate", () => {
  it("returns __invalid-input-shape__ for malformed Facts (not a crash)", () => {
    const { household: _h, ...bad } = okFacts;
    const r = composeVerdict(bad as any, "CA", new Date("2026-06-01"));
    expect(r.not_implemented_surfaces).toContain("__invalid-input-shape__");
    expect(r.reason).toMatch(/Facts failed schema validation/);
    expect(r.verdict).toBeUndefined();
  });

  it("returns a real verdict for a valid Facts shape", () => {
    const r = composeVerdict(okFacts as any, "CA", new Date("2026-06-01"));
    expect(r.verdict).toBeDefined();
    expect(r.not_implemented_surfaces).toBeUndefined();
  });
});
