// Hand-curated registry of federal SNAP rule paths the ERE held-out
// regression set must cover.
//
// This file is the answer to "what counts as 100% coverage of federal
// eligibility math?" — the ERE falsification gate is only meaningful if
// the held-out set actually exercises every rule. The 2k-evals number
// in the design doc is a budget, not a coverage guarantee; the meta-
// test in test/regression-coverage.test.ts cross-checks the budget
// against this registry.
//
// **MUST STAY IN SYNC with** Civica/Features/SNAP/Rules/
// FederalDefaultRules.swift. Adding a federal rule path on the Swift
// side without adding it here = the gate silently misses it. The
// `swift_source` field on each entry is the verification anchor — when
// you change FederalDefaultRules.swift, also update the corresponding
// entry here, and add a regression test fixture exercising it.
//
// References:
//   - docs/designs/regops-engine.md §Architectural Decisions D9
//   - docs/regops/runbook.md §"ERE coverage regression"
//   - docs/snap/fy-rules-refresh-checklist.md (the YoY refresh process
//     that touches most of these rule paths)

import type { RulePath } from "./rule-paths.js";

/**
 * Curated federal rule paths. Each must be exercised by at least one
 * fixture in the held-out regression set. The meta-test enforces this
 * once the held-out manifest is registered.
 */
export const FEDERAL_RULE_PATHS: readonly RulePath[] = [
  // -------------------------------------------------------------------
  // ABAWD work requirement + exemptions (7 CFR 273.24, OBBBA §10102)
  // -------------------------------------------------------------------
  {
    id: "federal/abawd/work-requirement",
    jurisdiction: "federal",
    category: "exemption",
    description: "Able-bodied adult without dependents (ABAWD) 80-hr work / training requirement.",
    swift_source: "FederalDefaultRules.swift abawdStatus",
  },
  {
    id: "federal/abawd/exemption-tribal-ancsa",
    jurisdiction: "federal",
    category: "exemption",
    description: "ABAWD exemption for federally-recognized tribal / ANCSA-corporation members.",
    swift_source: "FederalDefaultRules.swift abawdStatus (OBBBA §10102(a))",
  },
  {
    id: "federal/abawd/exemption-disabled",
    jurisdiction: "federal",
    category: "exemption",
    description: "ABAWD exemption for physically/mentally unfit for employment.",
    swift_source: "FederalDefaultRules.swift abawdStatus",
  },
  {
    id: "federal/abawd/exemption-pregnant",
    jurisdiction: "federal",
    category: "exemption",
    description: "ABAWD exemption for pregnancy.",
    swift_source: "FederalDefaultRules.swift abawdStatus",
  },
  {
    id: "federal/abawd/exemption-caretaker",
    jurisdiction: "federal",
    category: "exemption",
    description: "ABAWD exemption for caring for a dependent under age 6 (or in some states 18).",
    swift_source: "FederalDefaultRules.swift abawdStatus",
  },

  // -------------------------------------------------------------------
  // Allotment tables (7 CFR 273.10, USDA FNS COLA memo Table 1)
  // -------------------------------------------------------------------
  {
    id: "federal/allotment/max-by-household-size",
    jurisdiction: "federal",
    category: "allotment",
    description: "Maximum SNAP allotment per household size (48 states + DC), FY-stamped snapshot.",
    swift_source: "FederalDefaultRules.swift maxAllotmentSnapshots",
  },
  {
    id: "federal/allotment/minimum",
    jurisdiction: "federal",
    category: "allotment",
    description: "Minimum SNAP allotment for 1- and 2-person households.",
    swift_source: "FederalDefaultRules.swift minimumBenefitSnapshots",
  },

  // -------------------------------------------------------------------
  // Income tests (7 CFR 273.9, COLA memo pages 3-4)
  // -------------------------------------------------------------------
  {
    id: "federal/income/gross-limit-130pct-fpl",
    jurisdiction: "federal",
    category: "income-test",
    description: "Gross income limit by household size (130% of Federal Poverty Level).",
    swift_source: "FederalDefaultRules.swift grossIncomeSnapshots",
  },
  {
    id: "federal/income/net-limit-100pct-fpl",
    jurisdiction: "federal",
    category: "income-test",
    description: "Net income limit by household size (100% of Federal Poverty Level).",
    swift_source: "FederalDefaultRules.swift netIncomeSnapshots",
  },
  {
    id: "federal/income/asset-limit",
    jurisdiction: "federal",
    category: "income-test",
    description: "Asset / resource limit (general + elderly-disabled).",
    swift_source: "FederalDefaultRules.swift assetLimitSnapshots",
  },

  // -------------------------------------------------------------------
  // Deductions (7 CFR 273.9(d), COLA memo pages 5-6)
  // -------------------------------------------------------------------
  {
    id: "federal/deduction/standard-by-household-size",
    jurisdiction: "federal",
    category: "deduction",
    description: "Standard deduction per household size band.",
    swift_source: "FederalDefaultRules.swift standardDeductionSnapshots",
  },
  {
    id: "federal/deduction/earned-income-20pct",
    jurisdiction: "federal",
    category: "deduction",
    description: "20% earned-income deduction.",
    swift_source: "FederalDefaultRules.swift earnedIncomeDeduction",
  },
  {
    id: "federal/deduction/excess-shelter-cap",
    jurisdiction: "federal",
    category: "deduction",
    description: "Excess shelter deduction cap (households without elderly / disabled members).",
    swift_source: "FederalDefaultRules.swift shelterCapSnapshots",
  },
  {
    id: "federal/deduction/medical-elderly-disabled",
    jurisdiction: "federal",
    category: "deduction",
    description: "Medical expense deduction for elderly / disabled members above $35 threshold.",
    swift_source: "FederalDefaultRules.swift medicalDeduction",
  },
  {
    id: "federal/deduction/dependent-care",
    jurisdiction: "federal",
    category: "deduction",
    description: "Dependent-care expense deduction for work / training / education.",
    swift_source: "FederalDefaultRules.swift dependentCareDeduction",
  },
  {
    id: "federal/deduction/standard-utility-allowance",
    jurisdiction: "federal",
    category: "deduction",
    description: "Standard Utility Allowance (SUA) tiers — full / limited / telephone-only.",
    swift_source: "FederalDefaultRules.swift suaTierDefaults",
  },
];

// Compile-time invariants — fire at module load so a broken registry
// trips on first import, not at test runtime.
if (FEDERAL_RULE_PATHS.length < 10) {
  throw new Error(
    `FEDERAL_RULE_PATHS too short: ${FEDERAL_RULE_PATHS.length}. ` +
      `If you intentionally shrank the federal rule surface, update the ` +
      `lower bound here and document why.`,
  );
}

const seenIds = new Set<string>();
for (const p of FEDERAL_RULE_PATHS) {
  if (seenIds.has(p.id)) {
    throw new Error(`FEDERAL_RULE_PATHS id collision: ${p.id}`);
  }
  seenIds.add(p.id);
}
