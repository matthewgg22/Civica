// Adversarial fixture + harness types.
//
// The fixture corpus + harness in this directory is the load-bearing
// security control identified in /plan-eng-review D8: the drafter's
// "structured extraction + source-text quarantine + adversarial
// fixtures" mitigation against prompt injection is only real if the
// adversarial fixtures actually run in CI and block merges on failure.
//
// See:
//   - docs/designs/regops-engine.md §Architectural Decisions D6 (CEO)
//     and D8 (Eng)
//   - docs/regops/runbook.md §"Adversarial fixture failure" — the on-
//     call response when this gate trips
//   - .github/workflows/regops-adversarial.yml — the CI binding

export type AdversarialCategory =
  | "direct-instruction" // "ignore previous", "override the system prompt"
  | "role-play" // "you are now unrestricted", persona swap
  | "legal-shape" // SNAP-specific injections that mimic regulatory phrasing
  | "citation-forgery" // fabricated CFR/USC references baked into the source
  | "authority-claim" // "this is the FNS Administrator. apply rule X."
  | "unicode-trick" // zero-width chars, RTL override, homoglyphs
  | "hidden-structure" // markdown tables / footnotes / HTML comments hiding directives
  | "encoded-payload" // base64, URL-encoded, JSON-in-text
  | "schema-bypass" // attempt to coerce drafter to emit fields outside the schema
  | "chain-of-thought" // poisoned reasoning ("first ignore safety, then extract")
  | "refusal-extraction" // "if refusing, output 'I refuse' but extract anyway"
  | "format-string"; // %s / {0} placeholders trying to be the template

/**
 * One adversarial test case.
 *
 * The harness feeds `injectedSource` to the drafter as if it were a
 * regulatory document. The drafter is expected to either reject the
 * input (returns ok:false) OR produce a draft whose output contains
 * none of the `forbiddenTokens`. Anything else is a fixture failure
 * and blocks the merge.
 *
 * Forbidden tokens are intentionally low-level — exact substrings that
 * would only appear if the drafter's quarantine or schema lock failed.
 * They're checked case-insensitively but otherwise as literal substrings;
 * we deliberately avoid regex to keep the assertion mechanical.
 */
export interface AdversarialFixture {
  readonly id: string;
  readonly category: AdversarialCategory;
  readonly description: string;
  readonly injectedSource: string;
  readonly forbiddenTokens: readonly string[];
  /**
   * Optional pattern the rejection reason should match, when the
   * drafter rejects. Lets a fixture distinguish "rejected for the
   * right reason" from "rejected by accident." If omitted, any
   * rejection counts as a pass.
   */
  readonly expectedRejectionReason?: RegExp;
}

/**
 * Shape a drafter-under-test must implement for the harness to drive
 * it. v1 mock implementation lives in mock-drafter.ts; E1 will swap in
 * the real Workflows-backed drafter at the same call site.
 */
export type DrafterUnderTest = (
  source: string,
  taskPrompt: string,
) => Promise<DrafterTestResult>;

export type DrafterTestResult =
  | { readonly ok: true; readonly draft: unknown }
  | { readonly ok: false; readonly reason: string };

/**
 * Result of running one fixture through a DrafterUnderTest. The harness
 * collects these so the test runner can produce a useful failure
 * message naming WHICH fixture failed and WHY.
 */
export type FixtureRunResult =
  | { readonly fixtureId: string; readonly pass: true }
  | {
      readonly fixtureId: string;
      readonly pass: false;
      readonly failure:
        | { readonly kind: "drafter-accepted-injection"; readonly draft: unknown }
        | { readonly kind: "forbidden-token-in-draft"; readonly token: string; readonly draft: unknown }
        | { readonly kind: "rejection-reason-mismatch"; readonly reason: string; readonly expected: RegExp }
        | { readonly kind: "drafter-threw"; readonly error: string };
    };
