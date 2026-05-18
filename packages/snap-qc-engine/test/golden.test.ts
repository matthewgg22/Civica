import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { qcEngine, ENGINE_VERSION } from "../src/index.js";
import { discoverGoldenFixtures } from "./golden/_discover.js";

const fixtures = discoverGoldenFixtures();

// Sanity guard: T4 contract requires ≥24 fixtures (4 flows × 2 states × 3+).
// If somebody deletes fixtures without explicit review, fail loudly.
describe("golden fixture inventory", () => {
  it("has at least 24 fixtures (3+ per flow × 4 flows × 2 states)", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(24);
  });

  it("covers all four flows", () => {
    const flowsSeen = new Set(fixtures.map((f) => f.flow));
    expect(flowsSeen).toEqual(
      new Set(["utility-sua", "shared-lease", "gig-income", "assets"]),
    );
  });

  it("has at least 3 fixtures per (flow, state) pair where engine supports the score range", () => {
    // Engine constraint: CA has no asset test, so CA-assets cannot produce a
    // "weak" score; we still require ≥3 CA-assets fixtures (any mix of strong
    // + moderate). Same idea for every other (flow, state).
    const counts: Record<string, number> = {};
    for (const f of fixtures) {
      const input = JSON.parse(readFileSync(f.inputPath, "utf8")) as {
        state: string;
      };
      const key = `${f.flow}/${input.state}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    for (const [key, n] of Object.entries(counts)) {
      expect(n, `expected ≥3 fixtures for ${key}, got ${n}`).toBeGreaterThanOrEqual(3);
    }
  });
});

// Per-fixture frozen contract.
describe.each(fixtures.map((f) => [`${f.flow}/${f.id}`, f] as const))(
  "golden: %s",
  (_label, fixture) => {
    const input = JSON.parse(readFileSync(fixture.inputPath, "utf8"));
    const expected = JSON.parse(readFileSync(fixture.expectedPath, "utf8"));

    it("engine_version recorded in expected.json is compatible with current ENGINE_VERSION", () => {
      // Permitted: patch or minor bumps of the same major.
      // Disallowed: cross-major drift — that requires regenerate-goldens.ts.
      const [expectMajor] = (expected.engine_version as string).split(".");
      const [currentMajor] = ENGINE_VERSION.split(".");
      expect(currentMajor).toBe(expectMajor);
    });

    it("defensibility_score, factors, citations, and warnings match frozen expected output", async () => {
      const actual = await qcEngine.evaluate(input);

      // Strict equality on the fields that define the product contract.
      expect(actual.defensibility_score).toBe(expected.defensibility_score);
      expect(actual.defensibility_factors).toEqual(expected.defensibility_factors);
      expect(actual.citations).toEqual(expected.citations);
      expect(actual.warnings).toEqual(expected.warnings);

      // Evidence-package contents are also frozen, except `generated_at`
      // (timestamp) which is non-deterministic at test time.
      const stripGen = <T extends { generated_at?: string }>(p: T): Omit<T, "generated_at"> => {
        const { generated_at: _g, ...rest } = p;
        return rest;
      };
      expect(stripGen(actual.evidence_package)).toEqual(
        stripGen(expected.evidence_package),
      );

      // flow + state passthrough.
      expect(actual.flow).toBe(expected.flow);
      expect(actual.state).toBe(expected.state);
    });
  },
);
