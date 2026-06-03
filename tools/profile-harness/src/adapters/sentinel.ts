// Sentinel adapter — returns "engine not implemented" for everything.
// Used in Wave A (scaffold) and as a fallback when the real adapter is
// disabled via --engine=sentinel. Every profile SKIPs.

import type { EngineAdapter, EngineResult, EngineParams, Facts } from "../types.ts";

export class SentinelAdapter implements EngineAdapter {
  readonly name = "sentinel";

  composeVerdict(_facts: Facts, _state: string, _asOf: Date): EngineResult {
    return {
      not_implemented_surfaces: ["__sentinel__"],
      reason: "sentinel adapter — no engine wired",
    };
  }

  getEngineParams(_state: string, _asOf: Date): EngineParams {
    // Empty params triggers PARAMS_MISMATCH on every field, which the
    // runner correctly interprets as "engine has no opinion."
    return {};
  }
}
