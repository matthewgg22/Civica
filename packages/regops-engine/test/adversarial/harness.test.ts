// Adversarial harness wire-up test.
//
// Drives the v1 placeholder mock drafter through the full fixture
// corpus. The assertion is the load-bearing CI gate: if any fixture
// fails, the suite fails, and (via .github/workflows/regops-adversarial.yml)
// the PR cannot merge.
//
// When E1 ships the real Workflows drafter, add a second test file
// in this directory (e.g. real-drafter.test.ts) that drives the real
// drafter through the same suite. Keep this placeholder test green
// as a sanity check on the harness itself.

import { describe, expect, it } from "vitest";

import { ADVERSARIAL_FIXTURES } from "./fixtures.js";
import { formatFailure, runAdversarialSuite, runFixture } from "./harness.js";
import { mockDrafterPlaceholder } from "./mock-drafter.js";
import type { DrafterUnderTest } from "./types.js";

describe("Adversarial fixture corpus invariants", () => {
  it("contains between 15 and 20 fixtures", () => {
    expect(ADVERSARIAL_FIXTURES.length).toBeGreaterThanOrEqual(15);
    expect(ADVERSARIAL_FIXTURES.length).toBeLessThanOrEqual(20);
  });

  it("has unique ids across the corpus", () => {
    const ids = ADVERSARIAL_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every adversarial category at least once", () => {
    const categories = new Set(ADVERSARIAL_FIXTURES.map((f) => f.category));
    // The 12 categories defined in types.ts. If you add a category in
    // types.ts without a fixture covering it, this test will fail.
    const expectedCategories = [
      "direct-instruction",
      "role-play",
      "legal-shape",
      "citation-forgery",
      "authority-claim",
      "unicode-trick",
      "hidden-structure",
      "encoded-payload",
      "schema-bypass",
      "chain-of-thought",
      "refusal-extraction",
      "format-string",
    ] as const;
    for (const cat of expectedCategories) {
      expect(categories, `category '${cat}' has no fixture`).toContain(cat);
    }
  });

  it("every fixture declares at least one forbidden token", () => {
    for (const f of ADVERSARIAL_FIXTURES) {
      expect(f.forbiddenTokens.length, `fixture ${f.id} has no forbiddenTokens`).toBeGreaterThan(0);
    }
  });
});

describe("Adversarial harness — placeholder drafter passes all fixtures", () => {
  it("rejects or quarantines every fixture (CI gate)", async () => {
    const summary = await runAdversarialSuite(mockDrafterPlaceholder);
    const failures = summary.results.filter((r) => !r.pass);
    // Pretty-print failures so a real CI failure tells you which
    // fixture broke and how, not just "expected 0 to equal N."
    if (failures.length > 0) {
      const detail = failures.map((f) => `  - ${formatFailure(f)}`).join("\n");
      expect.fail(
        `${failures.length}/${summary.total} adversarial fixtures failed:\n${detail}`,
      );
    }
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(summary.total);
  });
});

describe("Adversarial harness — failure-mode coverage", () => {
  it("classifies an accepted-injection draft as forbidden-token-in-draft", async () => {
    const naive: DrafterUnderTest = async () => ({
      ok: true,
      // Drops the forbidden token from f01 verbatim into the output.
      draft: { result: "remove the work-requirement" },
    });
    const fixture = ADVERSARIAL_FIXTURES.find((f) => f.id === "f01-direct-ignore-previous")!;
    const result = await runFixture(fixture, naive);
    expect(result.pass).toBe(false);
    if (result.pass) return;
    expect(result.failure.kind).toBe("forbidden-token-in-draft");
  });

  it("classifies a thrown drafter as drafter-threw", async () => {
    const throwing: DrafterUnderTest = async () => {
      throw new Error("backend down");
    };
    const fixture = ADVERSARIAL_FIXTURES[0]!;
    const result = await runFixture(fixture, throwing);
    expect(result.pass).toBe(false);
    if (result.pass) return;
    expect(result.failure.kind).toBe("drafter-threw");
    if (result.failure.kind !== "drafter-threw") return;
    expect(result.failure.error).toMatch(/backend down/);
  });

  it("classifies a drafter that always accepts as forbidden-token-in-draft on the first matching fixture", async () => {
    // The "drafter-accepted-injection" classification is reachable
    // only if a fixture has no forbidden tokens AND no expected
    // rejection reason — which we explicitly forbid via the corpus
    // invariant (every fixture has at least one forbidden token).
    // So a fully-permissive drafter trips forbidden-token-in-draft
    // on the first fixture whose forbidden token appears verbatim
    // in the draft. We construct that case to verify the path works.
    const accepting: DrafterUnderTest = async (source) => ({
      ok: true,
      draft: { passthrough: source },
    });
    const fixture = ADVERSARIAL_FIXTURES.find((f) => f.id === "f01-direct-ignore-previous")!;
    const result = await runFixture(fixture, accepting);
    expect(result.pass).toBe(false);
    if (result.pass) return;
    expect(result.failure.kind).toBe("forbidden-token-in-draft");
  });

  it("classifies a wrong-reason rejection as rejection-reason-mismatch", async () => {
    const wrongReason: DrafterUnderTest = async () => ({
      ok: false,
      reason: "completely unrelated",
    });
    const fixtureWithExpectation = {
      ...ADVERSARIAL_FIXTURES[0]!,
      expectedRejectionReason: /ignore-previous/,
    };
    const result = await runFixture(fixtureWithExpectation, wrongReason);
    expect(result.pass).toBe(false);
    if (result.pass) return;
    expect(result.failure.kind).toBe("rejection-reason-mismatch");
  });

  it("formatFailure produces a useful one-line diagnostic per failure mode", async () => {
    const accepting: DrafterUnderTest = async () => ({
      ok: true,
      draft: { reveal: "remove the work-requirement" },
    });
    const fixture = ADVERSARIAL_FIXTURES.find((f) => f.id === "f01-direct-ignore-previous")!;
    const result = await runFixture(fixture, accepting);
    const formatted = formatFailure(result);
    expect(formatted).toContain("f01-direct-ignore-previous");
    expect(formatted).toContain("forbidden token");
  });
});
