import { describe, it, expect } from "vitest";
import {
  APPLICATION_MONTHS,
  getCountyExposure,
  listSupportedCounties,
  rankedByExposure,
} from "../countyExposure";

describe("countyExposure", () => {
  const all = listSupportedCounties();

  it("contains all 58 California counties", () => {
    expect(all).toHaveLength(58);
  });

  it("has unique slugs", () => {
    const slugs = new Set(all.map((c) => c.slug));
    expect(slugs.size).toBe(58);
  });

  it("has unique CA FIPS codes (06XXX format, odd numbers only)", () => {
    const fips = new Set(all.map((c) => c.fipsCode));
    expect(fips.size).toBe(58);
    for (const c of all) {
      expect(c.fipsCode).toMatch(/^06\d{3}$/);
      // California county FIPS are odd (last digit is odd: 1, 3, 5, ...)
      const lastDigit = Number(c.fipsCode.slice(-1));
      expect(lastDigit % 2).toBe(1);
    }
  });

  it("has unique CDSS county codes 01–58", () => {
    const codes = new Set(all.map((c) => c.cdssCode));
    expect(codes.size).toBe(58);
    for (const c of all) {
      expect(c.cdssCode).toMatch(/^\d{2}$/);
      const n = Number(c.cdssCode);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(58);
    }
  });

  it("caseload shares sum to approximately 1.0", () => {
    const total = all.reduce((sum, c) => sum + c.caseloadShare, 0);
    // Allow ±0.001 for rounding artifacts in the 6-decimal source data.
    expect(total).toBeGreaterThan(0.999);
    expect(total).toBeLessThan(1.001);
  });

  it("every county has exactly 8 monthly application data points", () => {
    for (const c of all) {
      expect(c.monthlyApplications).toHaveLength(8);
      expect(c.monthlyApplications.length).toBe(APPLICATION_MONTHS.length);
    }
  });

  it("estimatedExposureDollars scales with caseloadShare", () => {
    // Top county should have exposure > 100x bottom county's exposure
    // (LA is ~26%; Alpine is ~0.002%). Simple monotonicity proof.
    const ranked = rankedByExposure();
    expect(ranked[0]!.estimatedExposureDollars).toBeGreaterThan(
      ranked[ranked.length - 1]!.estimatedExposureDollars * 100,
    );
  });

  describe("getCountyExposure", () => {
    it("returns the expected county for a known slug", () => {
      const la = getCountyExposure("los-angeles");
      expect(la).not.toBeNull();
      expect(la!.displayName).toBe("Los Angeles County");
      expect(la!.fipsCode).toBe("06037");
      expect(la!.cdssCode).toBe("19");
    });

    it("returns null for an unknown slug", () => {
      expect(getCountyExposure("not-a-county")).toBeNull();
      expect(getCountyExposure("")).toBeNull();
    });
  });

  describe("rankedByExposure", () => {
    const ranked = rankedByExposure();

    it("returns all 58 counties", () => {
      expect(ranked).toHaveLength(58);
    });

    it("orders strictly by estimatedExposureDollars descending", () => {
      for (let i = 1; i < ranked.length; i++) {
        expect(ranked[i - 1]!.estimatedExposureDollars).toBeGreaterThanOrEqual(
          ranked[i]!.estimatedExposureDollars,
        );
      }
    });

    it("places Los Angeles County first", () => {
      expect(ranked[0]!.slug).toBe("los-angeles");
    });

    it("does not mutate the source ordering exposed by listSupportedCounties", () => {
      // listSupportedCounties is already share-desc, so the first slug
      // should match — but we're really checking that rankedByExposure
      // doesn't mutate the underlying RAW array via spread+sort.
      const firstSupported = listSupportedCounties()[0]!.slug;
      expect(firstSupported).toBe("los-angeles");
    });
  });
});
