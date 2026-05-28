import { describe, it, expect } from "vitest";
import { wilsonInterval } from "@civica/snap-qc-engine";
import {
  buildSliceGroups,
  DISPLAY_DIMS,
  ROWS_PER_GROUP,
  type SliceViewRow,
} from "../slice-rates";

// A small mixed-dimension fixture mirroring v_qc_error_rate_by_slice output.
const fixture: SliceViewRow[] = [
  { slice_dim: "error_type", slice_value: "utility_sua", n: 40, errors: 6 },
  { slice_dim: "error_type", slice_value: "gig_income", n: 25, errors: 5 },
  { slice_dim: "county", slice_value: "Los Angeles", n: 30, errors: 4 },
  { slice_dim: "county", slice_value: "Fresno", n: 30, errors: 9 }, // same n, higher rate
  { slice_dim: "county", slice_value: "(unknown)", n: 1, errors: 1 },
  { slice_dim: "language", slice_value: "es", n: 12, errors: 2 },
  { slice_dim: "language", slice_value: "en", n: 50, errors: 5 },
  // county_fips is in the view but must be dropped from the UI groups.
  { slice_dim: "county_fips", slice_value: "06037", n: 30, errors: 4 },
];

describe("buildSliceGroups", () => {
  it("returns exactly the display dims, in order, dropping county_fips", () => {
    const groups = buildSliceGroups(fixture);
    expect(groups.map((g) => g.dim)).toEqual(
      DISPLAY_DIMS.map((d) => d.dim),
    );
    expect(groups.map((g) => g.dim)).toEqual([
      "error_type",
      "county",
      "language",
    ]);
    expect(groups.some((g) => g.dim === "county_fips")).toBe(false);
  });

  it("attaches the engine's Wilson band verbatim (no re-derivation)", () => {
    const groups = buildSliceGroups(fixture);
    const sua = groups
      .find((g) => g.dim === "error_type")!
      .rows.find((r) => r.sliceValue === "utility_sua")!;
    const expected = wilsonInterval(6, 40);
    expect(sua.rate).toBeCloseTo(expected.rate, 10);
    expect(sua.lower).toBeCloseTo(expected.lower, 10);
    expect(sua.upper).toBeCloseTo(expected.upper, 10);
  });

  it("sorts most-sampled first, tiebreaking on higher rate", () => {
    const county = buildSliceGroups(fixture).find((g) => g.dim === "county")!;
    // Fresno + LA both n=30; Fresno's higher rate floats above LA. (unknown)
    // n=1 sorts last.
    expect(county.rows.map((r) => r.sliceValue)).toEqual([
      "Fresno",
      "Los Angeles",
      "(unknown)",
    ]);
  });

  it("keeps an honest band for a 1/1 slice (rate 100%, wide interval)", () => {
    const unknown = buildSliceGroups(fixture)
      .find((g) => g.dim === "county")!
      .rows.find((r) => r.sliceValue === "(unknown)")!;
    expect(unknown.rate).toBe(1);
    expect(unknown.lower).toBeLessThan(0.5); // not a certain 100%
    expect(unknown.upper).toBe(1);
  });

  it("coerces string-typed counts (PostgREST bigint) to numbers", () => {
    const groups = buildSliceGroups([
      { slice_dim: "language", slice_value: "en", n: "50", errors: "5" },
    ]);
    const en = groups.find((g) => g.dim === "language")!.rows[0]!;
    expect(en.n).toBe(50);
    expect(en.errors).toBe(5);
    expect(en.rate).toBeCloseTo(0.1, 10);
  });

  it("clamps errors to n instead of throwing on a malformed row", () => {
    expect(() =>
      buildSliceGroups([
        { slice_dim: "county", slice_value: "Bad", n: 3, errors: 7 },
      ]),
    ).not.toThrow();
    const bad = buildSliceGroups([
      { slice_dim: "county", slice_value: "Bad", n: 3, errors: 7 },
    ])
      .find((g) => g.dim === "county")!
      .rows[0]!;
    expect(bad.errors).toBe(3);
    expect(bad.rate).toBe(1);
  });

  it("caps each group at ROWS_PER_GROUP", () => {
    const many: SliceViewRow[] = Array.from({ length: 25 }, (_, i) => ({
      slice_dim: "county",
      slice_value: `County ${i}`,
      n: 25 - i, // descending n so order is deterministic
      errors: 1,
    }));
    const county = buildSliceGroups(many).find((g) => g.dim === "county")!;
    expect(county.rows).toHaveLength(ROWS_PER_GROUP);
    expect(county.rows[0]!.sliceValue).toBe("County 0"); // highest n kept
  });

  it("returns all dims with empty rows for empty input", () => {
    const groups = buildSliceGroups([]);
    expect(groups).toHaveLength(DISPLAY_DIMS.length);
    expect(groups.every((g) => g.rows.length === 0)).toBe(true);
  });
});
