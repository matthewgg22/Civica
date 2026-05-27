// Public barrel for the ERE regression-coverage module.
//
// Consumers:
//   - test/regression-coverage.test.ts (the v1 meta-test)
//   - future tooling that needs to enumerate rule paths or load the
//     coverage manifest (e.g., the counsel-graded eval set scoping
//     work in TODO-31)

export { FEDERAL_RULE_PATHS } from "./federal-rule-paths.js";
export type { Jurisdiction, RulePath, RulePathCategory } from "./rule-paths.js";
export {
  enumerateRulePaths,
  enumerateRulePathsByJurisdiction,
} from "./rule-paths.js";

export type { CoverageGateMode, CoverageManifest } from "./coverage-manifest.js";
export {
  COVERAGE_GATE_MODE,
  COVERAGE_MANIFEST_PATH,
  CoverageManifestSchema,
  loadCoverageManifest,
} from "./coverage-manifest.js";
