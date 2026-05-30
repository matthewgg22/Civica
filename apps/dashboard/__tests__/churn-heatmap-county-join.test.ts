// Regression guard for the /findings/retention choropleth (ChurnHeatmap).
//
// The map joins CF-18 county data to the us-atlas topojson BY NAME. A name
// mismatch doesn't fail the build — it silently renders that county gray
// ("insufficient volume"), quietly dropping it from the map. This test asserts
// every county in CF18_COUNTY_MAP resolves to a real California county in the
// atlas, so a typo or an atlas rename is caught in CI instead of on the page.

import { feature } from "topojson-client";
import countiesData from "us-atlas/counties-10m.json";
import { describe, it, expect } from "vitest";
import { CF18_COUNTY_MAP } from "../lib/analytics/cf18-county-map";

describe("CF-18 county map joins cleanly to us-atlas (no silent-gray counties)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc = feature(countiesData as any, (countiesData as any).objects.counties) as any;
  const caNames = new Set<string>(
    fc.features
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((f: any) => String(f.id ?? "").padStart(5, "0").startsWith("06"))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => String(f.properties.name).trim().toLowerCase()),
  );

  it("finds California's 58 counties in the atlas", () => {
    expect(caNames.size).toBe(58);
  });

  for (const c of CF18_COUNTY_MAP.byCounty) {
    it(`${c.county} resolves to a CA county`, () => {
      expect(caNames.has(c.county.trim().toLowerCase())).toBe(true);
    });
  }
});
