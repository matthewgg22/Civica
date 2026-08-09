import { describe, it, expect } from "vitest";
import { akUtilityRegionFor } from "./ak-utility-regions";

// #631: the whole point is that Anchorage and, say, Nome should NOT get the
// same utility rate. Spot-check one county per region (all 6), the two
// "combined name, split code" cases the source document's own wording
// glosses over, and the renamed Wade Hampton → Kusilvak county.

describe("akUtilityRegionFor", () => {
  it("Central — Anchorage (02020)", () => {
    const r = akUtilityRegionFor("02020");
    expect(r?.HCSUA.toNumber()).toBe(625);
    expect(r?.phone.toNumber()).toBe(26);
    expect(r?.LUA.toNumber()).toBe(134 + 61 + 59);
  });

  it("Northern — Fairbanks North Star (02090) is a DIFFERENT rate than Central", () => {
    const r = akUtilityRegionFor("02090");
    expect(r?.HCSUA.toNumber()).toBe(825);
    expect(r?.HCSUA.toNumber()).not.toBe(akUtilityRegionFor("02020")?.HCSUA.toNumber());
  });

  it("Northwest — Nome (02180), the highest heating rate of the six regions", () => {
    const r = akUtilityRegionFor("02180");
    expect(r?.HCSUA.toNumber()).toBe(1107);
  });

  it("South Central — Kenai Peninsula (02122)", () => {
    const r = akUtilityRegionFor("02122");
    expect(r?.HCSUA.toNumber()).toBe(591);
  });

  it("Southeastern — Juneau (02110)", () => {
    const r = akUtilityRegionFor("02110");
    expect(r?.HCSUA.toNumber()).toBe(517);
  });

  it("Southwestern — Bethel (02050)", () => {
    const r = akUtilityRegionFor("02050");
    expect(r?.HCSUA.toNumber()).toBe(1064);
  });

  it("Kusilvak (02158) — the renamed Wade Hampton — resolves to Southwestern, not undefined", () => {
    const r = akUtilityRegionFor("02158");
    expect(r?.HCSUA.toNumber()).toBe(1064);
  });

  it("both halves of the source document's combined 'Skagway/Hoonah/Angoon' wording resolve to Southeastern", () => {
    expect(akUtilityRegionFor("02230")?.HCSUA.toNumber()).toBe(517); // Skagway
    expect(akUtilityRegionFor("02105")?.HCSUA.toNumber()).toBe(517); // Hoonah-Angoon
  });

  it("both halves of the source document's combined 'Wrangell/Petersburg' wording resolve to Southeastern", () => {
    expect(akUtilityRegionFor("02275")?.HCSUA.toNumber()).toBe(517); // Wrangell
    expect(akUtilityRegionFor("02195")?.HCSUA.toNumber()).toBe(517); // Petersburg
  });

  it("both halves of the post-2019 Valdez-Cordova split land in their document-correct regions", () => {
    expect(akUtilityRegionFor("02066")?.HCSUA.toNumber()).toBe(825); // Copper River → Northern
    expect(akUtilityRegionFor("02063")?.HCSUA.toNumber()).toBe(591); // Chugach → South Central
  });

  it("returns undefined for an unrecognized FIPS — callers must fall back, never treat this as $0", () => {
    expect(akUtilityRegionFor("99999")).toBeUndefined();
  });

  it("returns undefined when county is omitted", () => {
    expect(akUtilityRegionFor(undefined)).toBeUndefined();
  });

  it("covers all 30 current AK boroughs/census areas", () => {
    const fips = [
      "02013", "02016", "02020", "02050", "02060", "02063", "02066", "02068",
      "02070", "02090", "02100", "02105", "02110", "02122", "02130", "02150",
      "02158", "02164", "02170", "02180", "02185", "02188", "02195", "02198",
      "02220", "02230", "02240", "02275", "02282", "02290",
    ];
    expect(fips.length).toBe(30);
    for (const f of fips) {
      expect(akUtilityRegionFor(f), f).toBeDefined();
    }
  });
});
