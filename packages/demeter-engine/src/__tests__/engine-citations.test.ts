import { describe, it, expect, vi } from "vitest";

// Mock the engine so formatEngineParams is hermetic and deterministic.
vi.mock("@civica/snap-rules", () => ({
  getEngineParams: vi.fn(() => ({
    max_allotment: { "2": 546, "1": 298 }, // intentionally unsorted to test ordering
    sd: { "1": 209, "4": 223 },
    shelter_cap: 744,
    min_benefit: 24,
    asset_limit: 3000,
    asset_limit_ed: 4500,
    // Real FY26 values as getEngineParams actually returns them — including
    // the HH3/HH6 roundDollar drift documented in the drift test below.
    fpl: { "1": 1305, "3": 2222, "4": 2680, "6": 3597 },
    sua: { HCSUA: 663, LUA: 170, phone: 20, none: 0 },
    homeless_ded: 198.99,
  })),
}));

import {
  MAE_ENGINE_CITATIONS,
  MAE_CITATIONS_PROVENANCE,
  formatEngineParams,
} from "../engine-citations";

describe("Mae engine citations", () => {
  it("carries the engine's core federal authority chain", () => {
    for (const cite of [
      "7 CFR 273.1", // household composition
      "7 CFR 273.5", // students
      "7 CFR 273.8", // asset test
      "7 CFR 273.9(a)(1)", // gross income
      "7 CFR 273.9(a)(2)", // net income
      "7 CFR 273.9(d)(2)", // earned income deduction
      "7 CFR 273.10", // benefit calc
      "7 CFR 273.2(f)", // verification hierarchy
      "7 CFR 273.2(i)", // expedited
      "7 CFR 273.24", // ABAWD
    ]) {
      expect(MAE_ENGINE_CITATIONS, cite).toContain(cite);
    }
  });

  it("carries OBBBA and California-specific authorities", () => {
    expect(MAE_ENGINE_CITATIONS).toContain("119-21"); // OBBBA public law
    expect(MAE_ENGINE_CITATIONS).toContain("ACL 25-68"); // CA SUA
    expect(MAE_ENGINE_CITATIONS).toContain("ACIN I-46-25"); // CA BBCE 200% FPL
    expect(MAE_ENGINE_CITATIONS).toContain("ABAWD time limits"); // CA ABAWD note
    expect(MAE_ENGINE_CITATIONS.toLowerCase()).toContain("county"); // per-county waiver gap surfaced
  });

  it("flags FY/COLA dating and counsel-unsigned provenance", () => {
    expect(MAE_CITATIONS_PROVENANCE).toMatch(/FY26|COLA/);
    expect(MAE_CITATIONS_PROVENANCE.toLowerCase()).toContain("counsel");
  });

  it("renders live engine figures with sizes in ascending order", () => {
    const out = formatEngineParams("CA", new Date(0));
    expect(out).toContain("Live engine parameters");
    expect(out).toContain("HH1 $298, HH2 $546"); // sorted despite unsorted input
    expect(out).toContain("$744"); // shelter cap
    expect(out).toContain("HCSUA $663"); // SUA tier
    expect(out).toMatch(/130%/); // gross-income multiplier note
  });

  it("prints the operative gross-income screens as dollars, not as a multiplier to derive", () => {
    const out = formatEngineParams("CA", new Date(0));
    // 130% federal test: round(fpl × 1.30).
    expect(out).toContain("Gross-income limit, 130% FPL");
    expect(out).toContain("HH1 $1697"); // 1305 × 1.30 = 1696.5 → 1697 (half-up)
    expect(out).toContain("HH4 $3484"); // 2680 × 1.30 = 3484 — matches CDSS ACIN I-46-25
    // 200% BBCE screen, keyed per state (TX is 165% — never hardcode 200).
    expect(out).toContain("BBCE categorical-eligibility gross screen, 200% FPL");
    expect(out).toContain("HH4 $5360"); // 2680 × 2 — matches ACIN
    expect(formatEngineParams("MA", new Date(0))).toContain("200% FPL"); // MA is also 200%
  });

  it("KNOWN DEFECT canary: the FPL base carries snap-rules' roundDollar drift at HH3/HH6", () => {
    // getEngineParams builds p.fpl with roundDollar(); the income gates'
    // canonical fplMonthly() uses floorDollar(). FY26 canonical values are
    // HH3 $2221 and HH6 $3596, so these printed screens are $2 high.
    // WHEN snap-rules ISSUE #601 IS FIXED this test fails — that is the signal
    // to update the mock to the floored base and DELETE this test.
    const out = formatEngineParams("CA", new Date(0));
    expect(out).toContain("HH3 $4444"); // drifted; canonical would be $4442
    expect(out).toContain("HH6 $7194"); // drifted; canonical would be $7192
  });
});
