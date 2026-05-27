// Coverage manifest — declares which rule paths the held-out ERE
// regression dataset exercises.
//
// The dataset itself is a T1 deliverable (~2,000 hand-curated
// historical eligibility evaluations) that hasn't landed yet. This
// module defines the SHAPE the dataset must take + the contract the
// meta-test (test/regression-coverage.test.ts) enforces:
//
//   1. The dataset declares a coverage manifest naming every rule path
//      it exercises and how many fixtures hit each one.
//   2. The meta-test enumerates rule paths from rule-paths.ts and
//      asserts every path appears in the manifest with count >= 1.
//   3. If the manifest is missing entirely (v1 state, pre-T1), the
//      meta-test SKIPS with an explicit message naming the deliverable.
//      It does not fail; failing-on-missing-manifest would block CI for
//      a deliverable that's deliberately pending.
//
// Once T1 lands, the manifest moves to "required" and missing-manifest
// becomes a hard failure. The toggle is the COVERAGE_GATE_MODE constant
// below.
//
// References:
//   - docs/designs/regops-engine.md §Architectural Decisions D9
//   - docs/regops/runbook.md §"ERE coverage regression"
//   - TODO-31 in TODOS.md (counsel-graded eval set upgrade)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const MANIFEST_FILENAME = "coverage-manifest.json";
const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(HERE, "..", "..", "eval", MANIFEST_FILENAME);

/**
 * Gate mode:
 *   - "skip-if-missing": v1 default. Meta-test skips with explicit
 *     instructions if the manifest doesn't exist. Set by T1's eval-
 *     harness deliverable when ready.
 *   - "require": meta-test fails if the manifest is missing. Switch to
 *     this once T1 lands the held-out dataset; the switch is the
 *     commit that makes coverage discipline mandatory.
 */
export type CoverageGateMode = "skip-if-missing" | "require";

export const COVERAGE_GATE_MODE: CoverageGateMode = "skip-if-missing";

/**
 * Required wire shape of `packages/snap-qc-engine/eval/coverage-manifest.json`.
 * Validated by zod at load time so a malformed manifest fails loudly.
 */
export const CoverageManifestSchema = z
  .object({
    /** Schema version; bump on breaking changes. */
    version: z.number().int().positive(),
    /** Free-form description for human readers. */
    description: z.string().min(10),
    /** SHA-256 of the canonicalized held-out dataset file(s). */
    dataset_checksum: z.string().regex(/^[0-9a-f]{64}$/),
    /** ISO-8601 timestamp the manifest was last regenerated. */
    last_regenerated_at: z.string().datetime(),
    /**
     * Map of rule path id (see rule-paths.ts) → number of fixtures
     * in the held-out set that exercise this rule path. Must be ≥ 1
     * for every rule path returned by enumerateRulePaths().
     */
    rule_path_coverage: z.record(z.string(), z.number().int().nonnegative()),
  })
  .strict();

export type CoverageManifest = z.infer<typeof CoverageManifestSchema>;

/**
 * Load + validate the coverage manifest. Returns `null` if the file
 * doesn't exist (the v1 state — meta-test handles this via
 * COVERAGE_GATE_MODE). Throws on any other failure (file present but
 * malformed, schema mismatch) so the gate can't be bypassed by
 * shipping a broken manifest.
 */
export function loadCoverageManifest(): CoverageManifest | null {
  let raw: string;
  try {
    raw = readFileSync(MANIFEST_PATH, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }
    throw new Error(
      `loadCoverageManifest: unexpected I/O error at ${MANIFEST_PATH}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `loadCoverageManifest: ${MANIFEST_PATH} is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  return CoverageManifestSchema.parse(parsed);
}

/**
 * Path the manifest must live at, exposed for test-error messages so
 * developers don't have to guess.
 */
export const COVERAGE_MANIFEST_PATH = MANIFEST_PATH;
