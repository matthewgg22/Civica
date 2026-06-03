// Swift-iOS adapter — reads the JSON results produced by the iOS test
// target's `Wave4HarnessTest.dumpIosProductionVerdicts` test.
//
// The iOS production composer (`SNAPLocalEligibilityEvaluator.evaluate`)
// runs INSIDE the iOS test target. It can't be invoked directly from
// Node.js, so the test writes its verdicts to a JSON file and this
// adapter looks each profile up.
//
// To refresh the data file before running the harness:
//
//   xcodebuild test -project Civica.xcodeproj -scheme Civica \
//     -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
//     -only-testing:CivicaTests/Wave4HarnessTest \
//     CODE_SIGNING_ALLOWED=NO ENABLE_USER_SCRIPT_SANDBOXING=NO
//
// Then run:
//
//   pnpm --filter @civica/profile-harness run run -- --engine swift-ios

import { readFileSync, existsSync } from "node:fs";
import type {
  EngineAdapter,
  EngineParams,
  EngineResult,
  Facts,
} from "../types.ts";

const DEFAULT_RESULTS_PATH = "/tmp/civica-ios-prod-results.json";

interface IosResultRow {
  profile_id: string;
  legacy_id: string;
  state: string;
  verdict?: "APPROVE" | "DENY";
  benefit?: number | null;
  reason?: string;
  expedited_eligible?: boolean;
}

interface IosResultsFile {
  engine: string;
  generated_at_iso: string;
  results: IosResultRow[];
}

export class SwiftIosAdapter implements EngineAdapter {
  readonly name = "swift-ios:prod-evaluator";
  /** Keyed by `${legacy_id}::${state}`. */
  private byKey = new Map<string, IosResultRow>();
  private fileAvailable = false;

  constructor(resultsPath: string = DEFAULT_RESULTS_PATH) {
    if (!existsSync(resultsPath)) {
      this.fileAvailable = false;
      return;
    }
    try {
      const raw = JSON.parse(readFileSync(resultsPath, "utf-8")) as IosResultsFile;
      for (const r of raw.results) {
        this.byKey.set(`${r.legacy_id}::${r.state}`, r);
      }
      this.fileAvailable = true;
    } catch {
      this.fileAvailable = false;
    }
  }

  /**
   * The iOS results file is keyed by legacy_id (e.g. "A01" or
   * "M14[pre_2025-11-01]"). The runner has access to the legacy_id
   * for each (profile, variant) tuple but not at the composeVerdict()
   * call site — the EngineAdapter interface only passes Facts + state.
   *
   * Workaround: the runner pre-stamps a `__legacy_id__` pseudo-field
   * onto Facts before calling composeVerdict, and we read it back here.
   * (See runner.ts.)
   */
  composeVerdict(facts: Facts, state: string, _asOf: Date): EngineResult {
    if (!this.fileAvailable) {
      return {
        not_implemented_surfaces: ["__ios-results-file-missing__"],
        reason: `iOS results file not found. Run the Wave4HarnessTest xcodebuild step to generate it.`,
      };
    }
    const legacy = (facts as any).__legacy_id__ as string | undefined;
    if (!legacy) {
      return {
        not_implemented_surfaces: ["__no-legacy-id-stamp__"],
        reason: "runner must stamp __legacy_id__ onto facts before calling SwiftIosAdapter",
      };
    }
    const row = this.byKey.get(`${legacy}::${state}`);
    if (!row) {
      return {
        not_implemented_surfaces: ["__ios-result-missing-for-profile__"],
        reason: `no iOS result for ${legacy} in state ${state}`,
      };
    }
    return {
      verdict: row.verdict,
      benefit: row.benefit ?? null,
      reason: row.reason,
    };
  }

  getEngineParams(_state: string, _asOf: Date): EngineParams {
    // iOS production engine doesn't expose params to the harness;
    // the params are baked into the snap_eligibility_*.json profiles
    // it ships. PARAMS_MISMATCH detection runs against the TS engine.
    return {};
  }
}
