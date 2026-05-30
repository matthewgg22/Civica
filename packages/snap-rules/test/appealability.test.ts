import { describe, it, expect } from "vitest";
import {
  evaluateAppealability,
  loadAppealabilityRules,
  AppealabilityRulesSchema,
} from "../src/appealability";
import caRaw from "../rules/appealability/CA.json";
import maRaw from "../rules/appealability/MA.json";

// IA-5 / CQ-4 of iOS audit 2026-05-29.
//
// Procedural fair-hearing rights are governed by 7 CFR 273.15 (90-day
// federal floor). Both CA and MA inherit the floor. The non-appealable
// list captures categories where a fair hearing is procedurally
// unavailable (already-active enrollment in a different jurisdiction,
// withdrew application before decision, certification period expired
// without a recert request).

const REF_NOW = new Date("2026-05-30T12:00:00Z");
const daysAgo = (n: number) => new Date(REF_NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("appealability schema", () => {
  it("CA.json validates", () => {
    const result = AppealabilityRulesSchema.safeParse(caRaw);
    if (!result.success) console.error(result.error.format());
    expect(result.success).toBe(true);
  });

  it("MA.json validates", () => {
    const result = AppealabilityRulesSchema.safeParse(maRaw);
    if (!result.success) console.error(result.error.format());
    expect(result.success).toBe(true);
  });

  it("loadAppealabilityRules round-trips both states", () => {
    expect(loadAppealabilityRules("CA").state_code).toBe("CA");
    expect(loadAppealabilityRules("MA").state_code).toBe("MA");
  });
});

describe("evaluateAppealability", () => {
  it("CA: within window with a normal reason → appealable", () => {
    const r = evaluateAppealability("missing_documents", "CA", daysAgo(30), REF_NOW);
    expect(r).toEqual({ isAppealable: true, reason: "within_window" });
  });

  it("CA: outside the 90-day window → window_expired", () => {
    const r = evaluateAppealability("missing_documents", "CA", daysAgo(120), REF_NOW);
    expect(r).toEqual({ isAppealable: false, reason: "window_expired" });
  });

  it("CA: exactly on day 90 is still within window", () => {
    const r = evaluateAppealability("missing_documents", "CA", daysAgo(90), REF_NOW);
    expect(r.isAppealable).toBe(true);
  });

  it("CA: non-appealable category → category_excluded", () => {
    const r = evaluateAppealability(
      "already_active_other_county",
      "CA",
      daysAgo(15),
      REF_NOW,
    );
    expect(r).toEqual({ isAppealable: false, reason: "category_excluded" });
  });

  it("MA: within window with a normal reason → appealable", () => {
    const r = evaluateAppealability("missed_interview", "MA", daysAgo(30), REF_NOW);
    expect(r).toEqual({ isAppealable: true, reason: "within_window" });
  });

  it("MA: outside the 90-day window → window_expired", () => {
    const r = evaluateAppealability("missed_interview", "MA", daysAgo(95), REF_NOW);
    expect(r.isAppealable).toBe(false);
    expect(r.reason).toBe("window_expired");
  });

  it("MA: withdrew_application is non-appealable", () => {
    const r = evaluateAppealability("withdrew_application", "MA", daysAgo(10), REF_NOW);
    expect(r).toEqual({ isAppealable: false, reason: "category_excluded" });
  });

  it("unknown / empty reason defaults to appealable (today's behavior)", () => {
    const empty = evaluateAppealability("", "CA", daysAgo(10), REF_NOW);
    expect(empty).toEqual({ isAppealable: true, reason: "unknown_reason" });
    const undef = evaluateAppealability(undefined, "CA", daysAgo(10), REF_NOW);
    expect(undef).toEqual({ isAppealable: true, reason: "unknown_reason" });
    const nul = evaluateAppealability(null, "CA", daysAgo(10), REF_NOW);
    expect(nul).toEqual({ isAppealable: true, reason: "unknown_reason" });
  });

  it("unknown state throws", () => {
    expect(() =>
      // @ts-expect-error — exercising the runtime guard
      evaluateAppealability("any", "TX", daysAgo(10), REF_NOW),
    ).toThrow(/No appealability rules for state/);
  });

  it("unknown_reason still respects category_excluded list when reason matches", () => {
    // Documentation case: an empty/missing reason can't be in a category
    // (we have nothing to match) so unknown_reason path applies.
    const r = evaluateAppealability("", "CA", daysAgo(200), REF_NOW);
    expect(r.reason).toBe("unknown_reason");
  });
});
