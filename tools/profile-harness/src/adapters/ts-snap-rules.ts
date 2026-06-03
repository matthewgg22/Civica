// TS adapter: wraps @civica/snap-rules behind the EngineAdapter interface.
//
// The composer is `composeVerdict(facts, state, asOf)` in
// packages/snap-rules/src/verdict.ts. Engine params surface for
// PARAMS_MISMATCH detection comes from `getEngineParams(state, asOf)`.

import { composeVerdict, getEngineParams } from "@civica/snap-rules";
import type {
  EngineAdapter,
  EngineParams,
  EngineResult,
  Facts,
} from "../types.ts";

export class TsSnapRulesAdapter implements EngineAdapter {
  readonly name = "ts:snap-rules";

  composeVerdict(facts: Facts, state: string, asOf: Date): EngineResult {
    try {
      const r = composeVerdict(facts as any, state, asOf);
      return {
        verdict: r.verdict,
        benefit: r.benefit ?? null,
        reason: r.reason,
        not_implemented_surfaces: r.not_implemented_surfaces,
        trace: r.trace,
      };
    } catch (err) {
      return {
        not_implemented_surfaces: ["__composer-threw__"],
        reason: (err as Error).message,
      };
    }
  }

  getEngineParams(state: string, asOf: Date): EngineParams {
    try {
      return getEngineParams(state, asOf);
    } catch {
      return {};
    }
  }
}
