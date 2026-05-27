// Tests for the regenerate-zip-to-county seed script (TODO-6).
//
// Exercises parseHudCsv, pickDominantCounty, and buildOutputJson against a
// tiny synthetic HUD CSV. The script's main() entrypoint is not exercised
// directly — that would require mocking node:fs + process.exit, which adds
// no signal beyond what these unit tests already cover.

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseHudCsv,
  pickDominantCounty,
  buildOutputJson,
} from "../scripts/regenerate-zip-to-county";

const HERE = dirname(fileURLToPath(import.meta.url));
const MINI_CSV = resolve(HERE, "./fixtures/hud-zip-county-mini.csv");

describe("parseHudCsv", () => {
  it("parses ZIP, COUNTY, RES_RATIO from a HUD-shaped header", async () => {
    const csv = await readFile(MINI_CSV, "utf8");
    const rows = parseHudCsv(csv);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual({ zip: "90015", county_fips: "06037", res_ratio: 1.0 });
    expect(rows[3]).toEqual({ zip: "94501", county_fips: "06013", res_ratio: 0.08 });
  });

  it("pads short ZIP / COUNTY codes with leading zeros", () => {
    const csv = "ZIP,COUNTY,RES_RATIO\n02115,25025,1.0\n";
    const rows = parseHudCsv(csv);
    expect(rows[0]).toEqual({ zip: "02115", county_fips: "25025", res_ratio: 1.0 });
  });

  it("skips malformed rows without throwing", () => {
    const csv = "ZIP,COUNTY,RES_RATIO\n90015,06037,1.0\nINVALID,06037,1.0\n";
    const rows = parseHudCsv(csv);
    expect(rows).toHaveLength(1);
  });

  it("throws if required columns are missing", () => {
    expect(() => parseHudCsv("FOO,BAR\n1,2\n")).toThrow(/missing required columns/);
  });
});

describe("pickDominantCounty", () => {
  it("filters to launch states and picks max-RES_RATIO county per ZIP", async () => {
    const csv = await readFile(MINI_CSV, "utf8");
    const rows = parseHudCsv(csv);
    const { entries, unknownFips } = pickDominantCounty(rows, ["06", "25"]);

    // 06037 wins for 90015, 06075 wins for 94102, 06001 wins for 94501 (.92 > .08),
    // 25025 wins for 02115. IL + AK rows are filtered out.
    expect(Object.keys(entries).sort()).toEqual(["02115", "90015", "94102", "94501"]);
    expect(entries["94501"]!.fips).toBe("06001");
    expect(entries["02115"]!.county_name).toBe("Suffolk County");
    expect(unknownFips).toEqual([]);
  });

  it("excludes FIPS codes without a name mapping and reports them in unknownFips", () => {
    const rows = [
      { zip: "12345", county_fips: "06999", res_ratio: 1.0 },
      { zip: "90015", county_fips: "06037", res_ratio: 1.0 },
    ];
    const { entries, unknownFips } = pickDominantCounty(rows, ["06"]);
    expect(Object.keys(entries)).toEqual(["90015"]);
    expect(unknownFips).toEqual(["06999"]);
  });

  it("returns sorted-ZIP output keys for stable JSON diffs", () => {
    const rows = [
      { zip: "95014", county_fips: "06085", res_ratio: 1.0 },
      { zip: "90015", county_fips: "06037", res_ratio: 1.0 },
      { zip: "94102", county_fips: "06075", res_ratio: 1.0 },
    ];
    const { entries } = pickDominantCounty(rows, ["06"]);
    expect(Object.keys(entries)).toEqual(["90015", "94102", "95014"]);
  });
});

describe("buildOutputJson", () => {
  it("wraps entries with _meta and emits a parseable JSON document", () => {
    const json = buildOutputJson({
      entries: {
        "90015": { fips: "06037", county_name: "Los Angeles County" },
        "02101": { fips: "25025", county_name: "Suffolk County" },
      },
      states: ["06", "25"],
      vintage: "2024Q4",
    });
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed["_meta"]).toMatchObject({
      vintage: "2024Q4",
      states: ["CA", "MA"],
      coverage_model: "full-hud-crosswalk",
      ca_counties_covered: 1,
      ma_counties_covered: 1,
      zip_count: 2,
    });
    expect(parsed["90015"]).toEqual({ fips: "06037", county_name: "Los Angeles County" });
  });

  it("translates state FIPS codes back to USPS codes in _meta.states", () => {
    const json = buildOutputJson({
      entries: { "90015": { fips: "06037", county_name: "Los Angeles County" } },
      states: ["06", "25", "36"],
      vintage: "2024Q4",
    });
    const meta = (JSON.parse(json) as Record<string, { states: string[] }>)["_meta"]!;
    // Known states translate to USPS; unmapped states fall through as raw FIPS.
    expect(meta.states).toEqual(["CA", "MA", "36"]);
  });
});
