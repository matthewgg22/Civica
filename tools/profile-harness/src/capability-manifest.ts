// Engine capability manifest — single source of truth for "which engine
// surfaces are wired up today." The runner uses this to classify
// engine-missing surfaces as SKIP (not FAIL), per the prompt's three-way
// result discipline.
//
// SCOPE: this manifest reflects the TS `@civica/snap-rules` engine state.
// A Swift twin would maintain its own manifest. Update both when a new
// surface lands.
//
// Source of truth for surface names: data-ops/sample/civica-test-profiles/
// requires_taxonomy.json (the schema enforces `requires.items.enum`
// against the taxonomy keys, so this manifest's keys must be a subset).

export interface CapabilityManifest {
  /**
   * Engine label printed in the report.
   */
  engine: string;

  /**
   * Surfaces the engine implements TODAY. Profiles whose `requires[]` is
   * a subset of this set are runnable; any extra tag => SKIP.
   */
  implemented: Set<string>;

  /**
   * Surfaces explicitly known-missing — used to compute roadmap stats.
   * Optional; an unlisted surface still SKIPs but doesn't appear in
   * roadmap projections.
   */
  known_gaps?: Set<string>;
}

// ─── TS @civica/snap-rules manifest, Wave A ───────────────────────────────
// At Wave A the harness ships with a sentinel adapter and the engine
// composer doesn't exist yet, so `implemented` is conservative.
// Wave B (verdict.ts composer) flips most of these on.

export const TS_MANIFEST_WAVE_A: CapabilityManifest = {
  engine: "ts:snap-rules@wave-a",
  implemented: new Set<string>([
    // Wave A implements no verdict-producing surfaces; the harness
    // exists to surface the roadmap.
  ]),
  known_gaps: new Set<string>([
    "test.gross_net_fpl",
    "test.net_only",
    "eligibility.student",
    "eligibility.immigration",
    "eligibility.disqualification",
    "eligibility.categorical",
    "household.composition",
    "workreq.abawd",
    "income.wages",
    "income.unearned",
    "income.self_employment",
    "income.exclusion",
    "shelter.sua.HCSUA",
    "shelter.sua.LUA",
    "shelter.sua.phone",
    "shelter.uncapped",
    "shelter.internet",
    "shelter.homeless",
    "deductions.medical",
    "deductions.dependent_care",
    "deductions.child_support",
  ]),
};

export const TS_MANIFEST_WAVE_B: CapabilityManifest = {
  engine: "ts:snap-rules@wave-2",
  implemented: new Set<string>([
    "test.gross_net_fpl",
    "test.net_only",
    "eligibility.student",
    "eligibility.categorical",
    "eligibility.immigration",       // gates/immigration.ts (Wave 2)
    "eligibility.disqualification",  // gates/disqualifications.ts (Wave 2)
    "household.composition",         // gates/composition.ts (Wave 2)
    "shelter.sua.HCSUA",
    "shelter.sua.LUA",
    "shelter.sua.phone",
    "shelter.uncapped",
    "shelter.homeless",
    "shelter.internet",
    "deductions.medical",
    "deductions.dependent_care",
    "deductions.child_support",
    "income.wages",
    "income.unearned",
    "income.exclusion",
    "workreq.abawd",
    "income.self_employment",
  ]),
  // Wave 2 unlocks the full taxonomy. Any new surface that lands in
  // requires_taxonomy.json after this point becomes the next gap.
  known_gaps: new Set<string>([]),
};

/**
 * Returns the tags in `requires` that aren't implemented by `manifest`.
 * Empty array => profile is runnable.
 */
export function missingSurfaces(
  requires: string[],
  manifest: CapabilityManifest,
): string[] {
  return requires.filter((tag) => !manifest.implemented.has(tag));
}
