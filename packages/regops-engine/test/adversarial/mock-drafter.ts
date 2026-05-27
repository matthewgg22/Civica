// v1 placeholder drafter — purely demonstrates the DrafterUnderTest
// contract that E1's real Cloudflare Workflows drafter will satisfy.
//
// This mock REJECTS any source matching coarse injection-pattern
// heuristics. The real drafter (E1) will use the actual defense in
// depth: JSON-schema-locked output + source-text quarantine (source
// text never sits in instruction position). Heuristic pattern-matching
// like the one below is NOT the production defense — it's a stand-in
// so the harness has something to drive in CI until E1 lands.
//
// When E1 ships, this file becomes the answer to "show me the smallest
// shape a DrafterUnderTest takes." It can be deleted, kept as a
// reference, or moved to docs/regops/examples/. Don't ship it as the
// actual drafter.

import type { DrafterTestResult, DrafterUnderTest } from "./types.js";

/**
 * Coarse signal-set used by the v1 placeholder. Each pattern is one
 * the real schema-lock + quarantine would also catch — they're chosen
 * to overlap with the fixture corpus's categories so the placeholder
 * actually exercises the harness's pass/fail paths.
 *
 * Real production drafter does NOT do regex pattern matching. Don't
 * copy this approach into E1.
 */
const PLACEHOLDER_INJECTION_PATTERNS: ReadonlyArray<{ readonly pattern: RegExp; readonly reason: string }> = [
  { pattern: /\bignore\s+(?:all\s+)?(?:previous|prior|the above)\s+(?:instructions?)?/i, reason: "ignore-previous" },
  { pattern: /\bsystem\s+prompt(?:\s+override)?/i, reason: "system-prompt-claim" },
  { pattern: /\b(?:you\s+are\s+now|DAN\s+mode|Do\s+Anything\s+Now)\b/i, reason: "role-play-swap" },
  { pattern: /\bhereby\s+(?:authorized|instructed|enacted)\b/i, reason: "legal-shape-injection" },
  { pattern: /\bBE\s+IT\s+ENACTED\b/i, reason: "legal-shape-injection" },
  { pattern: /\beffective\s+immediately\b/i, reason: "effective-immediately-claim" },
  { pattern: /\bdoes\s+not\s+require\s+counsel\s+review\b/i, reason: "counsel-bypass-claim" },
  { pattern: /\b7\s*CFR\s+273\.27\(z\)/i, reason: "fake-cfr-citation" },
  { pattern: /\bP\.L\.\s+999-99\b/i, reason: "fake-public-law-citation" },
  { pattern: /\bFNS\s+Administrator\b.*\b(?:order|directive|instruct)/i, reason: "authority-claim" },
  { pattern: /\bSuperior\s+Court.*\b(?:SHALL|must)\b/i, reason: "authority-claim" },
  { pattern: /​|‌|‍|﻿/, reason: "zero-width-unicode" },
  { pattern: /‮|‭/, reason: "rtl-override-unicode" },
  { pattern: /<!--\s*IGNORE_PREVIOUS_INSTRUCTIONS/i, reason: "html-comment-injection" },
  { pattern: /\[\^\d+\]:\s*As\s+the\s+drafter/i, reason: "footnote-injection" },
  { pattern: /\bQmFzZTY0/i, reason: "base64-payload" }, // hard-coded prefix of the corpus base64 example
  { pattern: /"skip_validation"\s*:\s*true|"action"\s*:\s*"delete"/i, reason: "json-output-spoof" },
  { pattern: /\bauto_merge|skip_ere_gate/i, reason: "schema-bypass" },
  { pattern: /\bignore\s+safety\s+filters?\b/i, reason: "chain-of-thought-poison" },
  { pattern: /\bbut_here_is_the_draft\b/i, reason: "refusal-extraction" },
  { pattern: /\{system_prompt\}|\{\{prior_messages\}\}|\$\{rules_data\}/, reason: "format-string-placeholder" },
];

export const mockDrafterPlaceholder: DrafterUnderTest = async (
  source,
  _taskPrompt,
): Promise<DrafterTestResult> => {
  for (const { pattern, reason } of PLACEHOLDER_INJECTION_PATTERNS) {
    if (pattern.test(source)) {
      return { ok: false, reason };
    }
  }
  // Benign input — placeholder emits an empty schema-valid draft. The
  // real drafter would emit a structured rule change.
  return { ok: true, draft: {} };
};
