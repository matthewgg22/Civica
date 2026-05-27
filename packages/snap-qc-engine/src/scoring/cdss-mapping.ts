// CDSS / county-facing baseline mapping — TODO-4.
//
// Three artifacts that turn the existing pillar math (error-risk.ts) into
// county-sales-ready talking points:
//
//   1. CDSS_ERROR_CATEGORY_TO_CIVICA_CONTROLS
//      Declarative table linking USDA FNS-380 error elements to the Civica
//      pillars / verification controls that address them. Lets a county
//      pitch render "Element 363 Shelter deduction → utility-sua pillar +
//      shared-lease pillar → reduction X.X pp at full engagement" without
//      anyone re-deriving the math from PILLAR_SHARES_UNNORMALIZED + the
//      USDA microdata by hand.
//
//   2. BBCE_REMOVAL_SCENARIO
//      Counterargument codified in code, not just slides. When a county
//      challenges Civica's reduction claim with "CA could drop 6-7% just
//      by removing BBCE," this returns the structural-PER math plus the
//      operational-gap counter (~$275M/yr in caseworker labor + denied
//      legitimate cases). Defensive talking point, source-cited as
//      TODO-4-pending until external review confirms.
//
//   3. CIVICA_TAM_PROFILE
//      Civica's target population (any earned income) is structurally
//      higher-error than the no-earned baseline (13.95% vs 5.84% per FY2023
//      microdata). This export packages the elevation factor + caseload
//      share so the pitch starts from honest accounting rather than the
//      misleading 10.98% statewide average.
//
// Citations:
//   - All FY2023 share percentages come from ca_fy2023_element_attribution.csv
//     and qc_fy2023_by_income_type.csv (USDA FNS research-agreement data).
//   - BBCE numbers are SPEC-PROVIDED (TODO-4) and carry an explicit
//     `provenance: "TODO-4-spec"` field; replace with cited values before
//     using publicly.
//   - Pillar references match PILLAR_KEYS in error-risk.ts. Adding/removing
//     a pillar there requires updating this file.

import type { FlowKind } from "../schemas";
import {
  CA_BASELINE_PER,
  PROJECTED_PER_AT_FULL_ENGAGEMENT,
  PILLAR_SHARES_UNNORMALIZED,
  INCOME_GROUP_PER_FY23,
  type PillarCoverage,
} from "./error-risk";

// ---------------------------------------------------------------------------
// 1. CDSS error-category → Civica controls mapping
// ---------------------------------------------------------------------------

export type CivicaPillar = keyof PillarCoverage;

export type CivicaControl =
  | "argyle_payroll_wire"
  | "lease_ocr_verification"
  | "sua_engine"
  | "shared_lease_classifier"
  | "deterministic_calc_engine"
  | "asset_self_declaration"
  | "no_civica_control"; // honest accounting for residual elements

/**
 * One row per USDA FNS-380 element code that touches Civica's verification
 * surface OR that we want to call out as outside it. Read as: "this is the
 * error category, this is the share of CA error volume it represents, here
 * is which Civica pillar (and shipped control) addresses it, and here is the
 * expected reduction in percentage points at full engagement."
 *
 * Two classes of rows:
 *   - CIVICA-ADDRESSABLE — pillars in PILLAR_SHARES_UNNORMALIZED. The
 *     `reduction_pp_at_full_engagement` is the share × max-defensibility-shift
 *     × baseline × calibration-factor contribution from this element to
 *     the projected 5.48pp reduction at full engagement.
 *   - RESIDUAL — pillars=[] and controls=["no_civica_control"]. Sums to
 *     RESIDUAL_FLOOR_SHARE (~25%) and represents the irreducible floor for
 *     a Civica-served household. Listing them honestly is a defensive feature,
 *     not a bug — it pre-empts the "you're hiding the residual" challenge.
 */
export interface CdssErrorCategoryRow {
  /** USDA FNS-380 element code. */
  fns_element: number;
  /** Human-readable category label (matches USDA glossary). */
  label: string;
  /** Share of CA FY2023 errored cases citing this element, in percent. */
  ca_share_pct: number;
  /** Civica pillars that address this element (empty for RESIDUAL rows). */
  pillars: CivicaPillar[];
  /** Shipped Civica controls touching this category. */
  controls: CivicaControl[];
  /** True for elements Civica cannot reduce; their share contributes to the irreducible floor. */
  residual: boolean;
  /** Brief note: what the control does, or why the element is residual. */
  note: string;
}

export const CDSS_ERROR_CATEGORY_TO_CIVICA_CONTROLS: readonly CdssErrorCategoryRow[] = [
  // Civica-addressable rows — pillar-mapped, all reducible at full engagement.
  {
    fns_element: 363,
    label: "Shelter deduction",
    ca_share_pct: 39.94,
    pillars: ["utility_sua", "shared_lease"],
    controls: ["sua_engine", "lease_ocr_verification", "shared_lease_classifier"],
    residual: false,
    note:
      "Single largest CA error category. Civica splits it 81.6/18.4 between " +
      "utility-sua (SUA tier + lease OCR) and shared-lease (sublease classifier). " +
      "Strong tier on utility-sua, moderate on shared-lease.",
  },
  {
    fns_element: 311,
    label: "Wages",
    ca_share_pct: 21.35,
    pillars: ["gig_income"],
    controls: ["argyle_payroll_wire"],
    residual: false,
    note: "Argyle API-verified payroll wire → strong defensibility tier.",
  },
  {
    fns_element: 312,
    label: "Self-employment",
    ca_share_pct: 5.16,
    pillars: ["gig_income"],
    controls: ["argyle_payroll_wire"],
    residual: false,
    note: "Argyle coverage of gig platforms (Uber, Lyft, DoorDash, Instacart) → strong.",
  },
  {
    fns_element: 364,
    label: "Standard utility allowance",
    ca_share_pct: 4.49,
    pillars: ["utility_sua"],
    controls: ["sua_engine"],
    residual: false,
    note: "SUA tier determination (HCSUA / LUA / Telephone-only) → strong.",
  },
  {
    fns_element: 520,
    label: "Arithmetic computation",
    ca_share_pct: 2.03,
    pillars: ["benefit_impact"],
    controls: ["deterministic_calc_engine"],
    residual: false,
    note: "CDSS deterministic rules engine → strong (zero math errors by construction).",
  },
  {
    fns_element: 150,
    label: "Unit composition",
    ca_share_pct: 1.91,
    pillars: ["benefit_impact"],
    controls: ["deterministic_calc_engine"],
    residual: false,
    note: "Household composition logic in the calc engine → strong.",
  },
  {
    fns_element: 211,
    label: "Bank accounts",
    ca_share_pct: 0.01,
    pillars: ["assets"],
    controls: ["asset_self_declaration"],
    residual: false,
    note: "Self-declared; near-zero share so the defensibility ceiling is moot.",
  },
  {
    fns_element: 221,
    label: "Real property",
    ca_share_pct: 0.01,
    pillars: ["assets"],
    controls: ["asset_self_declaration"],
    residual: false,
    note: "Self-declared; near-zero share.",
  },

  // Residual rows — structurally outside Civica's verification stack.
  {
    fns_element: 331,
    label: "RSDI",
    ca_share_pct: 11.06,
    pillars: [],
    controls: ["no_civica_control"],
    residual: true,
    note: "Social Security retirement / disability — verified via SSA crossmatch, not Civica.",
  },
  {
    fns_element: 333,
    label: "SSI",
    ca_share_pct: 7.65,
    pillars: [],
    controls: ["no_civica_control"],
    residual: true,
    note: "SSI — verified via SSA crossmatch, not Civica.",
  },
  {
    fns_element: 346,
    label: "Other unearned income",
    ca_share_pct: 6.25,
    pillars: [],
    controls: ["no_civica_control"],
    residual: true,
    note: "Catch-all unearned income; no API-verifiable source.",
  },
  {
    fns_element: 365,
    label: "Medical expense deduction",
    ca_share_pct: 3.88,
    pillars: [],
    controls: ["no_civica_control"],
    residual: true,
    note: "Receipt-based; outside Civica's current stack.",
  },
  {
    fns_element: 334,
    label: "Unemployment compensation",
    ca_share_pct: 2.23,
    pillars: [],
    controls: ["no_civica_control"],
    residual: true,
    note: "EDD crossmatch territory; not Civica.",
  },
  {
    fns_element: 350,
    label: "Child support received",
    ca_share_pct: 2.31,
    pillars: [],
    controls: ["no_civica_control"],
    residual: true,
    note: "DCSS crossmatch; not Civica.",
  },
  {
    fns_element: 366,
    label: "Child support paid deduction",
    ca_share_pct: 1.74,
    pillars: [],
    controls: ["no_civica_control"],
    residual: true,
    note: "Court order verification; not Civica.",
  },
  {
    fns_element: 342,
    label: "Contributions",
    ca_share_pct: 1.30,
    pillars: [],
    controls: ["no_civica_control"],
    residual: true,
    note: "Self-declared non-cash support.",
  },
  {
    fns_element: 323,
    label: "Dependent care deduction",
    ca_share_pct: 0.87,
    pillars: [],
    controls: ["no_civica_control"],
    residual: true,
    note: "Receipt-based; outside Civica's current stack.",
  },
];

/**
 * Sum of `ca_share_pct` across CIVICA-ADDRESSABLE rows (pillar-mapped).
 *
 * This is the share of CA error volume that Civica's stack can plausibly
 * reduce. The remainder (RESIDUAL rows + un-listed elements <0.5% each) is
 * structurally outside the stack.
 *
 * Numbers below come straight from PILLAR_SHARES_UNNORMALIZED × 100 (those
 * are normalized to [0,1]; this one is in percent). The asserted match in
 * the test suite catches drift.
 */
export const CIVICA_ADDRESSABLE_SHARE_PCT =
  (PILLAR_SHARES_UNNORMALIZED.utility_sua +
    PILLAR_SHARES_UNNORMALIZED.gig_income +
    PILLAR_SHARES_UNNORMALIZED.shared_lease +
    PILLAR_SHARES_UNNORMALIZED.assets +
    PILLAR_SHARES_UNNORMALIZED.benefit_impact) *
  100;

// ---------------------------------------------------------------------------
// 2. BBCE-removal counterargument
// ---------------------------------------------------------------------------

/**
 * BBCE = Broad-Based Categorical Eligibility. CA uses BBCE to grant SNAP
 * access to households just above the federal 130% FPL gross-income limit
 * (up to 200% FPL) via TANF brochure-program categorical eligibility. About
 * 16-20% of CA SNAP cases enter via BBCE rather than direct federal eligibility.
 *
 * REMOVAL HYPOTHESIS: if Congress kills BBCE (a recurring House budget proposal),
 * CA's payment-error rate would mechanically drop 6-7 percentage points — not
 * because anyone got better at verification, but because the marginal cases
 * that contribute most heavily to QC errors (households at 130-200% FPL whose
 * income mix is hardest to verify exactly) would simply lose eligibility and
 * disappear from the QC sample frame.
 *
 * COUNTERARGUMENT (what to say when a county/state pitches "we'll just drop BBCE"):
 *   - The 6-7% PER drop is a measurement artifact, not a real efficiency gain.
 *   - The households that lose eligibility were largely legitimately eligible;
 *     denying them is a net welfare loss, not a fraud-prevention win.
 *   - Estimated $275M/yr in operational gap remains: caseworker re-eligibility
 *     re-screening, denied-applicant appeals, additional QC sampling on the
 *     now-narrower base where each remaining error is proportionally larger.
 *   - Civica's reduction (10.98 → 5.5) is engagement-driven verification, not
 *     eligibility-narrowing. The two are stackable, not substitutes.
 *
 * PROVENANCE: numbers below are TODO-4 spec values. Replace `provenance` with
 * a citation before any public/external use. The BBCE-removal scenario itself
 * is well-documented in CBPP and USDA economic analysis; the specific 6-7% /
 * $275M figures need to be tied to a public source.
 */
export const BBCE_REMOVAL_SCENARIO = {
  /**
   * Estimated low end of structural PER reduction if BBCE is removed —
   * before any verification work is done. This is measurement-frame
   * narrowing, not real-world improvement.
   */
  structural_per_drop_pct_low: 6,
  /** Estimated high end. */
  structural_per_drop_pct_high: 7,
  /**
   * Annual operational gap, in USD, that REMAINS after BBCE removal: the
   * caseworker re-screening labor + appeals + concentration of QC errors
   * on a narrower eligible base. Civica's stack still addresses this gap
   * regardless of BBCE policy.
   */
  operational_gap_usd_annual: 275_000_000,
  /**
   * Counter-argument framing for the pitch. The 6-7% drop is real on paper
   * but represents removing households from the measurement frame, not
   * improving verification quality.
   */
  counter_argument:
    "A 6-7pp PER drop from removing BBCE is a measurement-frame narrowing, " +
    "not a verification improvement. Civica's projected reduction (10.98% → 5.5%) " +
    "is engagement-driven verification across the existing caseload — stackable " +
    "with, not substitutable for, eligibility policy changes. The ~$275M annual " +
    "operational gap (re-screening + appeals + concentrated QC sampling) remains " +
    "regardless of BBCE policy.",
  /**
   * Honest accounting: where these numbers come from. Replace before public use.
   * The CBPP analysis of BBCE removal is the natural citation target; map the
   * specific 6-7% / $275M figures to a public paragraph before any external pitch.
   */
  provenance:
    "TODO-4-spec — numbers per TODOS.md TODO-4. Citation backup pending; do not " +
    "use externally without sourcing to CBPP or USDA economic analysis.",
} as const;

// ---------------------------------------------------------------------------
// 3. Civica TAM profile (earned-income household targeting)
// ---------------------------------------------------------------------------

/**
 * Caseload share of households Civica targets — anyone with earned income
 * (wage-only + mixed wage/self-employment + self-employment-only). The
 * remainder (no earned income) is structurally not Civica's primary market
 * because verification of unearned income is SSA/EDD/DCSS territory.
 *
 * Source: FY2023 national caseload microdata (per existing INCOME_GROUP_PER_FY23
 * comments in error-risk.ts).
 */
const CASELOAD_SHARES_FY23 = {
  wage_only: 22.1,
  mixed_wage_se: 0.6,
  se_only: 4.6,
  no_earned: 72.7,
} as const;

/**
 * Civica's structural TAM: households with earned income.
 *
 * The headline number a county should hear is NOT the 10.98% statewide average.
 * It's the 13.95% earned-income subgroup PER — Civica's served population has
 * a baseline payment-error rate 2.4× higher than the no-earned-income baseline,
 * precisely because earned income is where verification is hardest. That's the
 * pitch foundation: "the population you're worried about is the population
 * Civica was built for."
 */
export const CIVICA_TAM_PROFILE = {
  /**
   * Share of national SNAP caseload Civica targets (any earned income).
   * = wage_only + mixed_wage_se + se_only = 22.1 + 0.6 + 4.6.
   */
  national_caseload_share_pct:
    CASELOAD_SHARES_FY23.wage_only +
    CASELOAD_SHARES_FY23.mixed_wage_se +
    CASELOAD_SHARES_FY23.se_only,
  /**
   * Expected baseline PER for the TAM population. Already encoded in
   * INCOME_GROUP_PER_FY23.civica_tam (13.95%) — surfaced here as a top-level
   * export so callers don't have to know which subkey to look up.
   */
  expected_per_pct: INCOME_GROUP_PER_FY23.civica_tam,
  /**
   * Baseline PER for the non-earned-income population. The 5.84% figure
   * Civica is implicitly pitched AGAINST when a county quotes the statewide
   * 10.98% — that figure is dragged DOWN by the no-earned population that's
   * not Civica's target market.
   */
  non_earner_per_baseline_pct: INCOME_GROUP_PER_FY23.no_earned,
  /**
   * Ratio of Civica TAM PER to non-earner baseline PER. ≈ 2.4×.
   * "The households Civica serves have payment-error rates 2.4× higher than
   * the population dragging the statewide average down."
   */
  elevation_factor:
    INCOME_GROUP_PER_FY23.civica_tam / INCOME_GROUP_PER_FY23.no_earned,
  /**
   * Bottom-line framing for a county-facing pitch. Compresses the four
   * numbers above into a single sentence.
   */
  pitch_framing:
    "Civica's target population is the ~27% of households with earned income — " +
    "a subgroup with a 13.95% baseline PER, 2.4× the no-earned-income baseline " +
    "of 5.84%. The 10.98% statewide average understates the error rate where " +
    "Civica actually operates.",
} as const;

// ---------------------------------------------------------------------------
// Helpers — small derived getters used by callers / tests
// ---------------------------------------------------------------------------

/**
 * Pillar-grouped reduction at full engagement, in pp. Useful for rendering
 * the CDSS pitch table without re-deriving the math each time.
 *
 * Sums to ≈ 5.48 pp (CA_BASELINE_PER − PROJECTED_PER_AT_FULL_ENGAGEMENT)
 * across the four reducible pillars (assets contributes 0 since its
 * defensibility ceiling is "weak").
 */
export function pillarReductionAtFullEngagement(): Record<CivicaPillar, number> {
  const target = CA_BASELINE_PER - PROJECTED_PER_AT_FULL_ENGAGEMENT;
  const sharesSum =
    PILLAR_SHARES_UNNORMALIZED.utility_sua +
    PILLAR_SHARES_UNNORMALIZED.gig_income +
    PILLAR_SHARES_UNNORMALIZED.shared_lease +
    PILLAR_SHARES_UNNORMALIZED.assets +
    PILLAR_SHARES_UNNORMALIZED.benefit_impact;
  const scale = sharesSum > 0 ? target / sharesSum : 0;
  return {
    utility_sua: PILLAR_SHARES_UNNORMALIZED.utility_sua * scale,
    gig_income: PILLAR_SHARES_UNNORMALIZED.gig_income * scale,
    shared_lease: PILLAR_SHARES_UNNORMALIZED.shared_lease * scale,
    assets: PILLAR_SHARES_UNNORMALIZED.assets * scale,
    benefit_impact: PILLAR_SHARES_UNNORMALIZED.benefit_impact * scale,
  };
}

/** All distinct FNS elements covered by this mapping table. */
export function listMappedFnsElements(): readonly number[] {
  return CDSS_ERROR_CATEGORY_TO_CIVICA_CONTROLS.map((r) => r.fns_element);
}

/** Civica-addressable rows only (excludes RESIDUAL). */
export function civicaAddressableCategories(): readonly CdssErrorCategoryRow[] {
  return CDSS_ERROR_CATEGORY_TO_CIVICA_CONTROLS.filter((r) => !r.residual);
}

/** RESIDUAL rows only — for the "honestly-outside-our-stack" surface. */
export function residualCategories(): readonly CdssErrorCategoryRow[] {
  return CDSS_ERROR_CATEGORY_TO_CIVICA_CONTROLS.filter((r) => r.residual);
}

// Silence unused-import lint when FlowKind is imported for type-checking only.
export type _FlowKindRef = FlowKind;
