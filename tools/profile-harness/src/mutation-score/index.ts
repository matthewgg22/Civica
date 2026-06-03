#!/usr/bin/env tsx
// Civica SNAP engine — mutation-score driver.
//
// Purpose: prove the v0.6 oracle is independent of the TS engine via SR
// 11-7-style mutation testing. For each mutation in mutations.json:
//   1. Patch the TS engine source (file find/replace)
//   2. Run the harness for the mutation's run_states (CA + KS as needed)
//   3. Diff per-profile outcomes vs baseline
//   4. Classify: caught / coverage-gap / CONTAMINATION-RED-FLAG / expected-uncaught
//   5. Revert via `git checkout HEAD -- <file>`
//
// Mutations run ONE AT A TIME. Each mutation's run state must be clean
// (no other mutations layered). Pre-flight check verifies the working
// tree is clean for mutated files.
//
// What "caught" proves:
//   - Verdict mutations: oracle's expected verdict came from CFR, not
//     from the engine. Independence proof.
//   - Benefit mutations: TS port drift from its Python twin. Twin-
//     consistency proof, not full independence (Python and TS share
//     formula + constants). PolicyEngine US offline pairing is the
//     missing piece for benefit-side independence.
//
// Usage:
//   pnpm --filter @civica/profile-harness exec tsx \
//     src/mutation-score/index.ts [--mutations path] [--out path]

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import type { ProfileResult, HarnessRunSummary, StateCode } from "../types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const HARNESS_PKG = resolve(__dirname, "../..");

interface MutationPatch {
  file: string;
  find: string;
  replace: string;
}

interface Mutation {
  id: string;
  citation: string;
  bucket: "verdict" | "benefit";
  kind: "constant" | "structural";
  description: string;
  patch: MutationPatch;
  run_states: StateCode[];
  expected_catch_legacy_ids?: string[];
  expected_uncaught?: boolean;
  red_flag_if_uncaught?: boolean;
  rationale?: string;
}

interface MutationsFile {
  version: string;
  as_of: string;
  mutations: Mutation[];
}

interface ProfileDelta {
  legacy_id: string;
  profile_id: string;
  state: string;
  baseline_kind: string;
  mutated_kind: string;
  baseline_verdict?: string | undefined;
  mutated_verdict?: string | undefined;
  baseline_benefit?: number | null | undefined;
  mutated_benefit?: number | null | undefined;
  flipped: boolean;
}

type Classification =
  | "CAUGHT"
  | "COVERAGE_GAP"
  | "CONTAMINATION_RED_FLAG"
  | "EXPECTED_UNCAUGHT"
  | "PRE_FLIGHT_FAIL";

interface MutationResult {
  id: string;
  citation: string;
  bucket: "verdict" | "benefit";
  description: string;
  baseline_totals: Record<string, { pass: number; fail: number; skip: number }>;
  mutated_totals: Record<string, { pass: number; fail: number; skip: number }>;
  flipped_profiles: ProfileDelta[];
  caught_by_legacy_ids: string[];
  /**
   * If the mutation altered an engine param the harness's
   * detectParamsMismatch() check is sensitive to (asset_limit,
   * shelter_cap, sd[size], etc.), the harness emits a PARAMS_MISMATCH
   * banner and silently disables benefit assertions for the whole run.
   * That banner IS a caught signal: the engine's params no longer match
   * the oracle's, which is exactly what the mutation injected. Track it
   * here so the classifier counts it as CAUGHT instead of falsely
   * classifying as CONTAMINATION_RED_FLAG.
   */
  params_mismatch_triggered_by_mutation: boolean;
  classification: Classification;
  notes?: string;
}

interface MutationScoreReport {
  generated_at_iso: string;
  mutations_version: string;
  mutations_as_of: string;
  baseline: Record<string, { pass: number; fail: number; skip: number; total: number }>;
  results: MutationResult[];
  summary: {
    total: number;
    caught: number;
    coverage_gap: number;
    contamination_red_flag: number;
    expected_uncaught: number;
    pre_flight_fail: number;
    mutation_score_pct: number;
  };
}

function assertCleanWorkingTree(file: string): void {
  const status = execSync(`git status --porcelain "${file}"`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();
  if (status) {
    throw new Error(
      `Pre-flight failed: working tree not clean for ${file}\n  git status: ${status}\n  Commit or stash before running mutation-score.`,
    );
  }
}

function applyPatch(patch: MutationPatch): void {
  const abs = join(REPO_ROOT, patch.file);
  if (!existsSync(abs)) throw new Error(`Mutation target not found: ${abs}`);
  const before = readFileSync(abs, "utf8");
  if (!before.includes(patch.find)) {
    throw new Error(
      `Mutation patch did not match — `.padEnd(40) +
        `\n  file: ${patch.file}` +
        `\n  find substring: ${JSON.stringify(patch.find.slice(0, 120))}${patch.find.length > 120 ? "..." : ""}`,
    );
  }
  const after = before.replace(patch.find, patch.replace);
  if (after === before) {
    throw new Error(`Mutation patch produced no change (replace == find?) for ${patch.file}`);
  }
  writeFileSync(abs, after, "utf8");
}

function revertPatch(file: string): void {
  execSync(`git checkout HEAD -- "${file}"`, { cwd: REPO_ROOT });
}

/**
 * Run the harness via a fresh child process so Node's ESM module cache
 * picks up the patched engine source on every call. Calling `runHarness`
 * in-process would silently re-use the first-loaded engine module no
 * matter how many times we patched the file on disk. Spawning per run
 * costs ~1-2 sec but is the only correct way to do mutation testing
 * with module-level constants in ESM.
 */
function runHarnessFor(state: StateCode, tmpDir: string): HarnessRunSummary {
  const outPath = join(tmpDir, `harness-${state}-${Math.random().toString(36).slice(2)}.json`);
  try {
    execSync(
      `pnpm --filter @civica/profile-harness exec tsx src/cli.ts --state ${state} --json --out "${outPath}"`,
      {
        cwd: HARNESS_PKG,
        stdio: ["ignore", "ignore", "pipe"],
        env: { ...process.env, NO_COLOR: "1" },
      },
    );
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? "";
    throw new Error(`Harness child process failed for state ${state}: ${stderr.slice(0, 400)}`);
  }
  const raw = JSON.parse(readFileSync(outPath, "utf8")) as HarnessRunSummary & {
    skip_surfaces: [string, number][];
  };
  // The JSON serializer flattened the Map to entries; restore for type compatibility.
  return { ...raw, skip_surfaces: new Map(raw.skip_surfaces) };
}

function diffProfiles(
  baseline: HarnessRunSummary,
  mutated: HarnessRunSummary,
): ProfileDelta[] {
  const baselineMap = new Map<string, ProfileResult>();
  for (const p of baseline.all_results) {
    baselineMap.set(p.profile_id, p);
  }
  const deltas: ProfileDelta[] = [];
  for (const m of mutated.all_results) {
    const b = baselineMap.get(m.profile_id);
    if (!b) continue;
    const verdictChanged = b.actual_verdict !== m.actual_verdict;
    const benefitChanged = b.actual_benefit !== m.actual_benefit;
    const kindChanged = b.kind !== m.kind;
    if (verdictChanged || benefitChanged || kindChanged) {
      deltas.push({
        legacy_id: m.legacy_id,
        profile_id: m.profile_id,
        state: m.state,
        baseline_kind: b.kind,
        mutated_kind: m.kind,
        baseline_verdict: b.actual_verdict,
        mutated_verdict: m.actual_verdict,
        baseline_benefit: b.actual_benefit,
        mutated_benefit: m.actual_benefit,
        flipped: b.kind === "PASS" && m.kind === "FAIL",
      });
    }
  }
  return deltas;
}

function classify(
  mutation: Mutation,
  caughtIds: string[],
  paramsMismatchTriggered: boolean,
): { classification: Classification; notes?: string } {
  if (mutation.expected_uncaught && caughtIds.length === 0 && !paramsMismatchTriggered) {
    return {
      classification: "EXPECTED_UNCAUGHT",
      notes: mutation.rationale,
    };
  }
  if (caughtIds.length > 0) {
    return { classification: "CAUGHT" };
  }
  if (paramsMismatchTriggered) {
    // The mutation altered an engine param that detectParamsMismatch
    // checks — the harness emitted a PARAMS_MISMATCH banner. That IS
    // the oracle catching the engine's drift; benefits were skipped
    // run-wide but the param-block delta itself is the caught signal.
    return {
      classification: "CAUGHT",
      notes:
        `Caught via PARAMS_MISMATCH banner (engine params block diverged from oracle's expected params; benefit assertions were skipped run-wide as a defensive measure).`,
    };
  }
  if (mutation.red_flag_if_uncaught) {
    return {
      classification: "CONTAMINATION_RED_FLAG",
      notes:
        `Determinative mutation survived (${mutation.rationale ?? "no rationale"}). ` +
        `Investigate: did the oracle's expected values track the engine?`,
    };
  }
  return {
    classification: "COVERAGE_GAP",
    notes: `No profile was determinative on this mutation. Add a fixture profile that exercises ${mutation.citation}.`,
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const mutationsPath =
    args[args.indexOf("--mutations") + 1] !== undefined && args.includes("--mutations")
      ? args[args.indexOf("--mutations") + 1]!
      : join(__dirname, "mutations.json");
  const outPath =
    args.includes("--out") ? args[args.indexOf("--out") + 1]! : undefined;

  const mutFile = JSON.parse(readFileSync(mutationsPath, "utf8")) as MutationsFile;
  console.error(`[mutation-score] Loaded ${mutFile.mutations.length} mutations from ${mutationsPath}`);
  console.error(`[mutation-score] Engine: TS port only (canonical)`);
  console.error(`[mutation-score] As of: ${mutFile.as_of}\n`);

  // Pre-flight: assert clean working tree for every file we'll mutate.
  const files = new Set(mutFile.mutations.map((m) => m.patch.file));
  for (const f of files) assertCleanWorkingTree(f);
  console.error(`[mutation-score] Pre-flight clean — ${files.size} target file(s)\n`);

  // Tmp dir for harness JSON output (each child writes its own file).
  const tmpDir = mkdtempSync(join(tmpdir(), "mutation-score-"));

  // Baseline runs per state (so we don't re-run for each mutation).
  const allStates = new Set<StateCode>();
  for (const m of mutFile.mutations) for (const s of m.run_states) allStates.add(s);
  const baselineByState = new Map<StateCode, HarnessRunSummary>();
  for (const st of allStates) {
    console.error(`[mutation-score] Baseline ${st}...`);
    const r = runHarnessFor(st, tmpDir);
    baselineByState.set(st, r);
    console.error(
      `  ${st}: PASS ${r.totals.pass} / FAIL ${r.totals.fail} / SKIP ${r.totals.skip}`,
    );
  }
  console.error();

  // Per-mutation: apply → run → revert → classify.
  const results: MutationResult[] = [];
  for (const mut of mutFile.mutations) {
    console.error(`[${mut.id}] ${mut.description}`);
    let result: MutationResult;
    try {
      applyPatch(mut.patch);

      const baselineTotals: MutationResult["baseline_totals"] = {};
      const mutatedTotals: MutationResult["mutated_totals"] = {};
      const allDeltas: ProfileDelta[] = [];
      let paramsMismatchTriggered = false;
      for (const st of mut.run_states) {
        const baseline = baselineByState.get(st)!;
        const mutated = runHarnessFor(st, tmpDir);
        baselineTotals[st] = {
          pass: baseline.totals.pass,
          fail: baseline.totals.fail,
          skip: baseline.totals.skip,
        };
        mutatedTotals[st] = {
          pass: mutated.totals.pass,
          fail: mutated.totals.fail,
          skip: mutated.totals.skip,
        };
        const deltas = diffProfiles(baseline, mutated);
        allDeltas.push(...deltas);
        // PARAMS_MISMATCH was triggered by this mutation if the mutated
        // run has one but the baseline didn't (or it grew).
        const baselineHas = baseline.params_mismatch != null;
        const mutatedHas = mutated.params_mismatch != null;
        if (mutatedHas && !baselineHas) paramsMismatchTriggered = true;
      }

      const caughtIds = Array.from(
        new Set(allDeltas.filter((d) => d.flipped).map((d) => d.legacy_id)),
      );
      const { classification, notes } = classify(mut, caughtIds, paramsMismatchTriggered);

      result = {
        id: mut.id,
        citation: mut.citation,
        bucket: mut.bucket,
        description: mut.description,
        baseline_totals: baselineTotals,
        mutated_totals: mutatedTotals,
        flipped_profiles: allDeltas,
        caught_by_legacy_ids: caughtIds,
        params_mismatch_triggered_by_mutation: paramsMismatchTriggered,
        classification,
        ...(notes ? { notes } : {}),
      };
    } catch (err) {
      result = {
        id: mut.id,
        citation: mut.citation,
        bucket: mut.bucket,
        description: mut.description,
        baseline_totals: {},
        mutated_totals: {},
        flipped_profiles: [],
        caught_by_legacy_ids: [],
        params_mismatch_triggered_by_mutation: false,
        classification: "PRE_FLIGHT_FAIL",
        notes: err instanceof Error ? err.message : String(err),
      };
    } finally {
      try {
        revertPatch(mut.patch.file);
      } catch {
        // Best effort. Pre-flight on next mutation will catch dirty state.
      }
    }

    const icon = {
      CAUGHT: "✓",
      COVERAGE_GAP: "○",
      CONTAMINATION_RED_FLAG: "!!!",
      EXPECTED_UNCAUGHT: "(expected uncaught)",
      PRE_FLIGHT_FAIL: "✗",
    }[result.classification];
    console.error(
      `  ${icon} ${result.classification} ` +
        (result.caught_by_legacy_ids.length
          ? `(${result.caught_by_legacy_ids.length} profiles flipped: ${result.caught_by_legacy_ids.slice(0, 5).join(", ")}${result.caught_by_legacy_ids.length > 5 ? "..." : ""})`
          : result.classification === "PRE_FLIGHT_FAIL"
            ? `(${result.notes?.slice(0, 80) ?? "?"})`
            : ""),
    );
    results.push(result);
  }

  // Build report.
  const baselineRecord: MutationScoreReport["baseline"] = {};
  for (const [st, r] of baselineByState) {
    baselineRecord[st] = {
      pass: r.totals.pass,
      fail: r.totals.fail,
      skip: r.totals.skip,
      total: r.totals.total,
    };
  }
  const summary = {
    total: results.length,
    caught: results.filter((r) => r.classification === "CAUGHT").length,
    coverage_gap: results.filter((r) => r.classification === "COVERAGE_GAP").length,
    contamination_red_flag: results.filter((r) => r.classification === "CONTAMINATION_RED_FLAG").length,
    expected_uncaught: results.filter((r) => r.classification === "EXPECTED_UNCAUGHT").length,
    pre_flight_fail: results.filter((r) => r.classification === "PRE_FLIGHT_FAIL").length,
    mutation_score_pct: 0,
  };
  const scorable = summary.total - summary.expected_uncaught - summary.pre_flight_fail;
  summary.mutation_score_pct =
    scorable > 0 ? Math.round((summary.caught / scorable) * 1000) / 10 : 0;

  const report: MutationScoreReport = {
    generated_at_iso: new Date().toISOString(),
    mutations_version: mutFile.version,
    mutations_as_of: mutFile.as_of,
    baseline: baselineRecord,
    results,
    summary,
  };

  console.error(`\n[mutation-score] === SUMMARY ===`);
  console.error(`  Total mutations:        ${summary.total}`);
  console.error(`  ✓ Caught:               ${summary.caught}`);
  console.error(`  ○ Coverage gap:         ${summary.coverage_gap}`);
  console.error(`  !!! Contamination flag: ${summary.contamination_red_flag}`);
  console.error(`  (expected uncaught):    ${summary.expected_uncaught}`);
  console.error(`  ✗ Pre-flight fail:      ${summary.pre_flight_fail}`);
  console.error(`  Mutation score:         ${summary.mutation_score_pct}% (of scorable)`);
  if (summary.contamination_red_flag > 0) {
    console.error(
      `\n  !!! CONTAMINATION ALARM: ${summary.contamination_red_flag} red-flag mutation(s) survived. ` +
        `Investigate immediately.`,
    );
  }

  const json = JSON.stringify(report, null, 2);
  if (outPath) {
    writeFileSync(outPath, json, "utf8");
    console.error(`\n[mutation-score] Wrote report to ${outPath}`);
  } else {
    process.stdout.write(json);
  }

  // Cleanup tmp dir.
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
}

try {
  main();
} catch (err) {
  console.error(`[mutation-score] FATAL: ${err}`);
  process.exit(1);
}
