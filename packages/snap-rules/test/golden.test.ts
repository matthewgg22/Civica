// Verdict-composer golden tests. Each fixture pair (input.json,
// expected.json) under test/golden/composer/<scenario>/ is an
// independent assertion. A fixture that drifts fails the test loudly
// with the per-field diff.
//
// Adding a regression: drop a new directory in. No test code change.
//
// Pattern mirrors packages/snap-qc-engine/test/golden.test.ts.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { composeVerdict } from "../src/verdict";
import type { Facts } from "../src/facts";
import { discoverGoldenFixtures } from "./golden/_discover";

interface GoldenInput {
  facts: Facts;
  state: string;
  /** ISO date string; defaults to 2026-06-01 (FY26 mid-fiscal). */
  asOf?: string;
}

interface GoldenExpected {
  verdict: "APPROVE" | "DENY";
  /** Exact numeric match. Use `null` for DENY scenarios. */
  benefit: number | null;
  /** Optional: assert the engine's reason contains this substring. */
  reason_substring?: string;
  /** Optional: assert the engine returned a SKIP-style result (composer
   * declined to grade). Useful for "composer must SKIP, not crash" cases. */
  not_implemented_surfaces_contain?: string;
}

const fixtures = discoverGoldenFixtures();

describe("verdict-composer golden inventory", () => {
  it("has at least 10 fixtures (CA + MA basics, edge cases, regressions)", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
  });

  it("includes regression coverage for known engine bugs", () => {
    const ids = new Set(fixtures.map((f) => f.id));
    // Each historical engine bug gets a permanent fixture so a
    // regression to the old (broken) behavior fails the test.
    expect(ids.has("regression-income-missing-type")).toBe(true);
    expect(ids.has("regression-income-array-empty-base")).toBe(true);
  });

  it("covers both pilot states (CA + MA)", () => {
    const states = new Set<string>();
    for (const f of fixtures) {
      const raw = JSON.parse(readFileSync(f.inputPath, "utf8")) as GoldenInput;
      states.add(raw.state);
    }
    expect(states.has("CA")).toBe(true);
    expect(states.has("MA")).toBe(true);
  });
});

describe("verdict-composer goldens", () => {
  for (const fix of fixtures) {
    it(`${fix.flow}/${fix.id}`, () => {
      const input = JSON.parse(readFileSync(fix.inputPath, "utf8")) as GoldenInput;
      const expected = JSON.parse(readFileSync(fix.expectedPath, "utf8")) as GoldenExpected;
      const asOf = input.asOf ? new Date(input.asOf) : new Date("2026-06-01");

      const result = composeVerdict(input.facts, input.state, asOf);

      if (expected.not_implemented_surfaces_contain) {
        expect(result.not_implemented_surfaces ?? []).toContain(
          expected.not_implemented_surfaces_contain,
        );
        return;
      }

      // The composer must NEVER throw on a valid Facts shape. If we
      // reach this point and the result is a sentinel SKIP, that's a
      // test failure — the fixture expected a real verdict.
      expect(
        result.not_implemented_surfaces ?? [],
        "composer returned a SKIP-style result instead of a verdict",
      ).toEqual([]);

      expect(result.verdict).toBe(expected.verdict);
      if (expected.benefit === null) {
        expect(result.benefit ?? null).toBeNull();
      } else {
        expect(result.benefit).toBe(expected.benefit);
      }
      if (expected.reason_substring) {
        expect(result.reason ?? "").toContain(expected.reason_substring);
      }
    });
  }
});
