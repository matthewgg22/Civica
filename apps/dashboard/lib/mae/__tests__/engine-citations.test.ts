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
    fpl: { "1": 1305 },
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
});
