// Barrel for the adversarial harness. Exported so E1's real drafter
// can import the same harness used by the v1 placeholder test, and so
// any downstream consumer (security audit, ad-hoc fixture replay) can
// drive the same suite.

export type {
  AdversarialCategory,
  AdversarialFixture,
  DrafterTestResult,
  DrafterUnderTest,
  FixtureRunResult,
} from "./types.js";

export { ADVERSARIAL_FIXTURES } from "./fixtures.js";
export {
  formatFailure,
  runAdversarialSuite,
  runFixture,
  type AdversarialSuiteSummary,
} from "./harness.js";
