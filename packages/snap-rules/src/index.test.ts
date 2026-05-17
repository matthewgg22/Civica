import { describe, it, expect } from "vitest";
import { loadRules, evaluateChecklist, RulesFileSchema } from "./index";
import caRaw from "./data/ca.json";
import maRaw from "./data/ma.json";

// ---------------------------------------------------------------------------
// Schema validation — these act as the "build gate" for bilingual parity:
// Zod requires all _en AND _es fields to be non-empty strings, so a missing
// or empty translation fails the test and blocks CI.
// ---------------------------------------------------------------------------

describe("schema validation", () => {
  it("ca.json validates against RulesFileSchema", () => {
    const result = RulesFileSchema.safeParse(caRaw);
    if (!result.success) console.error(result.error.format());
    expect(result.success).toBe(true);
  });

  it("ma.json validates against RulesFileSchema", () => {
    const result = RulesFileSchema.safeParse(maRaw);
    if (!result.success) console.error(result.error.format());
    expect(result.success).toBe(true);
  });

  it("rejects a rules file with an empty label_es", () => {
    const bad = {
      ...caRaw,
      document_requirements: [
        { ...caRaw.document_requirements[0], label_es: "" },
      ],
    };
    expect(RulesFileSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a rules file with a missing helper_es", () => {
    const { helper_es: _removed, ...noHelperEs } = caRaw.document_requirements[0] as Record<string, unknown>;
    const bad = { ...caRaw, document_requirements: [noHelperEs] };
    expect(RulesFileSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown version", () => {
    expect(RulesFileSchema.safeParse({ ...caRaw, version: 99 }).success).toBe(false);
  });

  it("loadRules throws on an unrecognized state", () => {
    expect(() => loadRules("XX" as "CA")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// evaluateChecklist — four required scenarios per spec
// ---------------------------------------------------------------------------

describe("evaluateChecklist", () => {
  // (a) basic household
  it("(a) always-required items appear for a basic household", () => {
    const result = evaluateChecklist({
      state_code: "CA",
      household_size: 2,
      answers: {},
    });
    const kinds = result.required_items.map((i) => i.document_kind);
    expect(kinds).toContain("photo_id");
    expect(kinds).toContain("lease");
    expect(result.active_flags).toHaveLength(0);
  });

  it("(a) income docs are absent when no income answers provided", () => {
    const result = evaluateChecklist({
      state_code: "CA",
      household_size: 2,
      answers: {},
    });
    const kinds = result.required_items.map((i) => i.document_kind);
    expect(kinds).not.toContain("paystub");
    expect(kinds).not.toContain("tax_return");
    expect(kinds).not.toContain("benefit_letter");
  });

  it("(a) paystub required when has_earned_income is true", () => {
    const result = evaluateChecklist({
      state_code: "CA",
      household_size: 2,
      answers: { income: { has_earned_income: true } },
    });
    expect(result.required_items.map((i) => i.document_kind)).toContain("paystub");
  });

  // (b) student work-rule trigger
  it("(b) student_status flag fires when work_student.status contains 'school'", () => {
    const result = evaluateChecklist({
      state_code: "CA",
      household_size: 1,
      answers: { work_student: { status: "in school full-time" } },
    });
    expect(result.active_flags.map((f) => f.key)).toContain("student_status");
  });

  it("(b) student_status flag absent when status does not contain 'school'", () => {
    const result = evaluateChecklist({
      state_code: "CA",
      household_size: 1,
      answers: { work_student: { status: "employed" } },
    });
    expect(result.active_flags.map((f) => f.key)).not.toContain("student_status");
  });

  it("(b) student flag carries bilingual labels", () => {
    const result = evaluateChecklist({
      state_code: "CA",
      household_size: 1,
      answers: { work_student: { status: "school part-time" } },
    });
    const flag = result.active_flags.find((f) => f.key === "student_status");
    expect(flag?.label_en).toBeTruthy();
    expect(flag?.label_es).toBeTruthy();
    expect(flag?.context_en).toBeTruthy();
    expect(flag?.context_es).toBeTruthy();
  });

  // (c) shelter housing / alt-residency
  it("(c) shelter_housing flag fires when housing.type equals 'shelter'", () => {
    const result = evaluateChecklist({
      state_code: "CA",
      household_size: 1,
      answers: { housing: { type: "shelter" } },
    });
    expect(result.active_flags.map((f) => f.key)).toContain("shelter_housing");
  });

  it("(c) proof_of_residency alt_kinds includes 'other' (shelter letter)", () => {
    const result = evaluateChecklist({
      state_code: "CA",
      household_size: 1,
      answers: { housing: { type: "shelter" } },
    });
    const residency = result.required_items.find((i) => i.category === "proof_of_residency");
    expect(residency).toBeDefined();
    expect(residency?.alt_kinds).toContain("other");
    expect(residency?.alt_kinds).toContain("utility_bill");
  });

  // (d) elderly / disabled medical-expense option
  it("(d) proof_of_medical_expenses added when household.has_elderly_disabled is true", () => {
    const result = evaluateChecklist({
      state_code: "CA",
      household_size: 1,
      answers: { household: { has_elderly_disabled: true } },
    });
    const categories = result.required_items.map((i) => i.category);
    expect(categories).toContain("proof_of_medical_expenses");
  });

  it("(d) elderly_disabled flag also fires", () => {
    const result = evaluateChecklist({
      state_code: "CA",
      household_size: 1,
      answers: { household: { has_elderly_disabled: true } },
    });
    expect(result.active_flags.map((f) => f.key)).toContain("elderly_disabled");
  });

  it("(d) proof_of_medical_expenses absent when elderly_disabled not reported", () => {
    const result = evaluateChecklist({
      state_code: "CA",
      household_size: 2,
      answers: {},
    });
    expect(result.required_items.map((i) => i.category)).not.toContain("proof_of_medical_expenses");
  });

  // MA state parity
  it("MA rules load and produce always-required items", () => {
    const result = evaluateChecklist({
      state_code: "MA",
      household_size: 3,
      answers: {},
    });
    const kinds = result.required_items.map((i) => i.document_kind);
    expect(kinds).toContain("photo_id");
    expect(kinds).toContain("lease");
  });

  // Output shape
  it("result includes bilingual labels on required_items", () => {
    const result = evaluateChecklist({
      state_code: "CA",
      household_size: 1,
      answers: {},
    });
    for (const item of result.required_items) {
      expect(item.label_en).toBeTruthy();
      expect(item.label_es).toBeTruthy();
      expect(item.helper_en).toBeTruthy();
      expect(item.helper_es).toBeTruthy();
    }
  });
});
