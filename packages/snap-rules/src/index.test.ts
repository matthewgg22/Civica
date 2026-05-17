import { describe, it, expect } from "vitest";
import { RulesFileSchema, evaluateChecklist, loadRules, SUPPORTED_STATES } from "./index.js";
import caRaw from "../data/ca.json";
import maRaw from "../data/ma.json";

// ---------------------------------------------------------------------------
// Schema validation — build fails if either JSON file is malformed or missing
// required English/Spanish strings.
// ---------------------------------------------------------------------------

describe("ca.json schema validation", () => {
  it("parses without errors", () => {
    expect(() => RulesFileSchema.parse(caRaw)).not.toThrow();
  });

  it("state_code is CA", () => {
    const rules = RulesFileSchema.parse(caRaw);
    expect(rules.state_code).toBe("CA");
  });

  it("version is 1", () => {
    const rules = RulesFileSchema.parse(caRaw);
    expect(rules.version).toBe(1);
  });

  it("has at least one document requirement", () => {
    const rules = RulesFileSchema.parse(caRaw);
    expect(rules.document_requirements.length).toBeGreaterThan(0);
  });

  it("every requirement has non-empty helper_text_en", () => {
    const rules = RulesFileSchema.parse(caRaw);
    for (const req of rules.document_requirements) {
      expect(req.helper_text_en.trim().length).toBeGreaterThan(0);
    }
  });

  it("every requirement has non-empty helper_text_es", () => {
    const rules = RulesFileSchema.parse(caRaw);
    for (const req of rules.document_requirements) {
      expect(req.helper_text_es.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("ma.json schema validation", () => {
  it("parses without errors", () => {
    expect(() => RulesFileSchema.parse(maRaw)).not.toThrow();
  });

  it("state_code is MA", () => {
    const rules = RulesFileSchema.parse(maRaw);
    expect(rules.state_code).toBe("MA");
  });

  it("version is 1", () => {
    const rules = RulesFileSchema.parse(maRaw);
    expect(rules.version).toBe(1);
  });

  it("has at least one document requirement", () => {
    const rules = RulesFileSchema.parse(maRaw);
    expect(rules.document_requirements.length).toBeGreaterThan(0);
  });

  it("every requirement has non-empty helper_text_en", () => {
    const rules = RulesFileSchema.parse(maRaw);
    for (const req of rules.document_requirements) {
      expect(req.helper_text_en.trim().length).toBeGreaterThan(0);
    }
  });

  it("every requirement has non-empty helper_text_es", () => {
    const rules = RulesFileSchema.parse(maRaw);
    for (const req of rules.document_requirements) {
      expect(req.helper_text_es.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// loadRules
// ---------------------------------------------------------------------------

describe("loadRules", () => {
  it("loads CA", () => {
    const rules = loadRules("CA");
    expect(rules.state_code).toBe("CA");
  });

  it("loads MA (case-insensitive)", () => {
    const rules = loadRules("ma");
    expect(rules.state_code).toBe("MA");
  });

  it("throws for unsupported state", () => {
    expect(() => loadRules("TX")).toThrow(/@civica\/snap-rules/);
  });

  it("returns a cached instance on repeated calls", () => {
    const a = loadRules("CA");
    const b = loadRules("CA");
    expect(a).toBe(b);
  });

  it("SUPPORTED_STATES contains CA and MA", () => {
    expect(SUPPORTED_STATES).toContain("CA");
    expect(SUPPORTED_STATES).toContain("MA");
  });
});

// ---------------------------------------------------------------------------
// evaluateChecklist — CA
// ---------------------------------------------------------------------------

describe("evaluateChecklist CA", () => {
  it("returns photo_id for any household", () => {
    const { items } = evaluateChecklist({ state: "CA", answers: { household_size: 1 } });
    expect(items.some((i) => i.category === "photo_id")).toBe(true);
  });

  it("returns paystub when has_earned_income", () => {
    const { items } = evaluateChecklist({
      state: "CA",
      answers: { household_size: 2, has_earned_income: true },
    });
    expect(items.some((i) => i.category === "paystub")).toBe(true);
  });

  it("omits paystub when no earned income", () => {
    const { items } = evaluateChecklist({
      state: "CA",
      answers: { household_size: 1, has_earned_income: false },
    });
    expect(items.some((i) => i.category === "paystub")).toBe(false);
  });

  it("returns utility_bill when claims_utility_deduction", () => {
    const { items } = evaluateChecklist({
      state: "CA",
      answers: { household_size: 1, claims_utility_deduction: true },
    });
    expect(items.some((i) => i.category === "utility_bill")).toBe(true);
  });

  it("omits utility_bill when deduction not claimed", () => {
    const { items } = evaluateChecklist({
      state: "CA",
      answers: { household_size: 1, claims_utility_deduction: false },
    });
    expect(items.some((i) => i.category === "utility_bill")).toBe(false);
  });

  it("all returned items have status 'required'", () => {
    const { items } = evaluateChecklist({
      state: "CA",
      answers: { household_size: 3, has_earned_income: true },
    });
    expect(items.every((i) => i.status === "required")).toBe(true);
  });

  it("includes orientation flag", () => {
    const { flags } = evaluateChecklist({ state: "CA", answers: {} });
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0]).toMatch(/orientation only/i);
  });
});

// ---------------------------------------------------------------------------
// evaluateChecklist — MA
// ---------------------------------------------------------------------------

describe("evaluateChecklist MA", () => {
  it("returns photo_id for any household", () => {
    const { items } = evaluateChecklist({ state: "MA", answers: { household_size: 1 } });
    expect(items.some((i) => i.category === "photo_id")).toBe(true);
  });

  it("returns lease for any household", () => {
    const { items } = evaluateChecklist({ state: "MA", answers: { household_size: 1 } });
    expect(items.some((i) => i.category === "lease")).toBe(true);
  });

  it("returns paystub when has_earned_income", () => {
    const { items } = evaluateChecklist({
      state: "MA",
      answers: { household_size: 1, has_earned_income: true },
    });
    expect(items.some((i) => i.category === "paystub")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateChecklist — default household_size fallback
// ---------------------------------------------------------------------------

describe("evaluateChecklist household_size fallback", () => {
  it("returns photo_id even when household_size is omitted (defaults to 1)", () => {
    const { items } = evaluateChecklist({ state: "CA", answers: {} });
    expect(items.some((i) => i.category === "photo_id")).toBe(true);
  });
});
