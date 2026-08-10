// Per-model thinking configuration.
//
// Thinking is MODEL-GATED and the two families take incompatible shapes:
//
//   adaptive families (Sonnet 5, Opus 4.6+, Fable/Mythos 5)
//       { type: "adaptive" }            — the model decides depth
//   older families (Haiku 4.5, Sonnet 4.5 and earlier)
//       { type: "enabled", budget_tokens: N }
//       adaptive is REJECTED with 400 "adaptive thinking is not supported on
//       this model"; budget_tokens must be strictly LESS than max_tokens.
//
// Production never needed this — one pinned model, one shape. It exists so a
// #602 comparison run can score a candidate the way that candidate would
// actually run, rather than erroring on every case and reporting a model as
// unusable when the request shape was simply wrong for it.
//
// Deliberately a DENYLIST of older families rather than an allowlist of newer
// ones: a model released after this file was written should default to
// adaptive (the current shape) instead of silently falling back to a
// deprecated one. Wrong here fails loudly with a 400 on the first case, which
// is the direction we want — a silent fallback would score the new model on a
// worse configuration and look like a capability difference.

import type Anthropic from "@anthropic-ai/sdk";

/** Budget for the older shape. Must stay < ANSWER_LIMITS.MAX_OUTPUT_TOKENS
 *  (4096) — the API rejects budget_tokens >= max_tokens, and leaving room for
 *  the answer itself matters more than deep reasoning on a grounded lookup. */
export const LEGACY_THINKING_BUDGET_TOKENS = 2_048;

/** Model families that predate adaptive thinking. Matched by prefix so dated
 *  snapshot ids (claude-haiku-4-5-20251001) resolve the same as the alias. */
const LEGACY_THINKING_PREFIXES = [
  "claude-haiku-4-5",
  "claude-haiku-3",
  "claude-sonnet-4-5",
  "claude-3-",
];

export function usesLegacyThinking(model: string): boolean {
  return LEGACY_THINKING_PREFIXES.some((p) => model.startsWith(p));
}

/** The thinking block to send for `model`. */
export function thinkingConfigFor(model: string): Anthropic.Messages.ThinkingConfigParam {
  return usesLegacyThinking(model)
    ? { type: "enabled", budget_tokens: LEGACY_THINKING_BUDGET_TOKENS }
    : { type: "adaptive" };
}
