// ERE coverage meta-test (E8).
//
// Per /plan-eng-review D9: the ERE falsification gate is only real if
// the held-out 2k regression dataset actually exercises every rule
// path. A gate that passes vacuously because the dataset happens to
// skip federal work-requirement math is worse than no gate — it gives
// false confidence in the most regulated domain.
//
// This test enforces 100% rule-path coverage of the held-out dataset
// once the dataset's coverage manifest exists. Until T1 lands the
// dataset, the gate operates in "skip-if-missing" mode (see
// COVERAGE_GATE_MODE in src/regression/coverage-manifest.ts) — the
// rule-path enumeration is still validated, only the coverage assertion
// is conditional.
//
// References:
//   - docs/designs/regops-engine.md §Architectural Decisions D9
//   - docs/regops/runbook.md §"ERE coverage regression"

import { describe, expect, it } from "vitest";

import {
  COVERAGE_GATE_MODE,
  COVERAGE_MANIFEST_PATH,
  enumerateRulePaths,
  enumerateRulePathsByJurisdiction,
  FEDERAL_RULE_PATHS,
  loadCoverageManifest,
} from "../src/regression/index";

describe("ERE rule-path registry — always runs", () => {
  it("enumerates ≥ 20 rule paths total across federal + CA + MA", () => {
    const all = enumerateRulePaths();
    expect(all.length).toBeGreaterThanOrEqual(20);
  });

  it("every rule path has a unique id", () => {
    const all = enumerateRulePaths();
    const ids = all.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every rule path id matches the URL-safe id convention", () => {
    // Allow lowercase alphanumerics + hyphens + underscores. The
    // underscore is permitted because state document_kind values
    // (e.g. 'photo_id', 'proof_of_identity') come from snap-rules
    // data files and use Python-style snake_case.
    const all = enumerateRulePaths();
    const idPattern = /^(federal|ca|ma)(\/[a-z0-9][a-z0-9_-]*)+$/;
    for (const p of all) {
      expect(p.id, `id '${p.id}' violates the convention`).toMatch(idPattern);
    }
  });

  it("every federal rule path declares a swift_source pointer", () => {
    for (const p of FEDERAL_RULE_PATHS) {
      expect(
        p.swift_source,
        `federal rule path '${p.id}' missing swift_source — registry can't stay in sync without it`,
      ).toBeTruthy();
    }
  });

  it("every state rule path declares a json_source pointer", () => {
    const { CA, MA } = enumerateRulePathsByJurisdiction();
    for (const p of [...CA, ...MA]) {
      expect(p.json_source, `state rule path '${p.id}' missing json_source`).toBeTruthy();
    }
  });

  it("covers all three jurisdictions (federal + CA + MA) with ≥ 1 path each", () => {
    const grouped = enumerateRulePathsByJurisdiction();
    expect(grouped.federal.length).toBeGreaterThanOrEqual(10);
    expect(grouped.CA.length).toBeGreaterThanOrEqual(1);
    expect(grouped.MA.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ERE coverage gate — depends on coverage manifest", () => {
  const manifest = loadCoverageManifest();

  if (manifest === null) {
    if (COVERAGE_GATE_MODE === "require") {
      it("FAILS: no coverage manifest but gate is set to require", () => {
        expect.fail(
          `ERE coverage gate is set to 'require' but no manifest exists at\n` +
            `  ${COVERAGE_MANIFEST_PATH}\n\n` +
            `Either (a) land the held-out dataset (T1) + its manifest, OR\n` +
            `(b) flip COVERAGE_GATE_MODE back to 'skip-if-missing' in\n` +
            `packages/snap-qc-engine/src/regression/coverage-manifest.ts.`,
        );
      });
    } else {
      // Default v1 mode: skip with explicit instructions instead of
      // failing CI. The skip message names the deliverable so it's
      // discoverable from a quick `pnpm test` output scan.
      it.skip(
        `ERE coverage gate SKIPPED — no manifest at ${COVERAGE_MANIFEST_PATH} (T1 deliverable: held-out dataset)`,
        () => {
          /* intentionally empty */
        },
      );
    }
    return;
  }

  // Manifest exists — run the actual coverage assertions.
  it("manifest validates against the schema", () => {
    // loadCoverageManifest threw if validation failed; reaching this
    // point means the schema check passed. Sanity-check the basics.
    expect(manifest.version).toBeGreaterThan(0);
    expect(manifest.dataset_checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("every rule path in the registry has ≥ 1 fixture in the manifest", () => {
    const ruleIds = enumerateRulePaths().map((p) => p.id);
    const uncovered = ruleIds.filter((id) => {
      const count = manifest.rule_path_coverage[id];
      return count === undefined || count < 1;
    });
    if (uncovered.length > 0) {
      expect.fail(
        `ERE coverage gap: ${uncovered.length} rule path(s) have zero fixtures.\n` +
          uncovered.map((id) => `  - ${id}`).join("\n") +
          `\n\nThe ERE falsification gate would pass vacuously on changes that ` +
          `touch these paths. Add fixtures to the held-out dataset and ` +
          `regenerate the manifest before this gate can clear.`,
      );
    }
    expect(uncovered).toEqual([]);
  });

  it("manifest does not declare coverage for rule paths that no longer exist", () => {
    const ruleIds = new Set(enumerateRulePaths().map((p) => p.id));
    const stale = Object.keys(manifest.rule_path_coverage).filter((id) => !ruleIds.has(id));
    if (stale.length > 0) {
      expect.fail(
        `Manifest declares coverage for ${stale.length} unknown rule path(s):\n` +
          stale.map((id) => `  - ${id}`).join("\n") +
          `\n\nThese were probably removed from federal-rule-paths.ts or ` +
          `from packages/snap-rules/src/data/{ca,ma}.json. Regenerate the ` +
          `manifest to drop the stale entries.`,
      );
    }
    expect(stale).toEqual([]);
  });
});
