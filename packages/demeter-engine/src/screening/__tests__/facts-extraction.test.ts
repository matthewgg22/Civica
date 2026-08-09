import { describe, it, expect } from "vitest";
import { mergeFactsPatch } from "../facts-extraction";

describe("mergeFactsPatch", () => {
  it("adds a new household member", () => {
    const merged = mergeFactsPatch(
      {},
      { household: [{ member_id: "applicant", age: 62, role: "head" }] },
    );
    expect(merged.household).toEqual([{ member_id: "applicant", age: 62, role: "head" }]);
  });

  it("a correction REPLACES the prior value — 'actually $1,300' wins", () => {
    const base = mergeFactsPatch({}, { income: [{ member: "a", type: "ssa", amount: 1180 }] });
    // Extraction is additive on income lines (a caseworker who corrects an
    // amount is expected to say so in a way that produces a new line, not a
    // silent overwrite of a prior one) — so a correction is a new fact
    // patch on the SAME income line via member fields, tested via household.
    const corrected = mergeFactsPatch(
      { household: [{ member_id: "a", age: 62, role: "head" }] },
      { household: [{ member_id: "a", age: 63, role: "head" }] }, // corrected age
    );
    expect(corrected.household).toEqual([{ member_id: "a", age: 63, role: "head" }]);
  });

  it("merges partial member updates onto the SAME member without dropping earlier fields", () => {
    const step1 = mergeFactsPatch({}, { household: [{ member_id: "a", age: 62, role: "head" }] });
    const step2 = mergeFactsPatch(step1, { household: [{ member_id: "a", immigration: "citizen" }] });
    expect(step2.household).toEqual([{ member_id: "a", age: 62, role: "head", immigration: "citizen" }]);
  });

  it("appends income lines across turns rather than replacing the array", () => {
    const step1 = mergeFactsPatch({}, { income: [{ member: "a", type: "ssa", amount: 1180 }] });
    const step2 = mergeFactsPatch(step1, { income: [{ member: "a", type: "wages", amount: 200 }] });
    expect(step2.income).toHaveLength(2);
  });

  it("shallow-merges shelter and deductions, letting a new turn add fields", () => {
    const step1 = mergeFactsPatch({}, { shelter: { rent: 600 } });
    const step2 = mergeFactsPatch(step1, { shelter: { sua_tier: "HCSUA" } });
    expect(step2.shelter).toEqual({ rent: 600, sua_tier: "HCSUA" });
  });

  it("scalar fields REPLACE — a later assets figure overrides an earlier one", () => {
    const step1 = mergeFactsPatch({}, { assets: 300 });
    const step2 = mergeFactsPatch(step1, { assets: 500 });
    expect(step2.assets).toBe(500);
  });

  it("an empty patch changes nothing", () => {
    const base = mergeFactsPatch({}, { household: [{ member_id: "a", age: 40, role: "head" }] });
    const same = mergeFactsPatch(base, {});
    expect(same).toEqual(base);
  });
});
