// Profile-harness internal types.
//
// Mirrors data-ops/sample/civica-test-profiles/v0.6.json shape. Only the
// fields the harness reads are typed; pass-through blobs (facts_patch,
// integrity payloads) stay as `unknown` so the harness doesn't lock the
// schema to one revision.

export type StateCode = "CA" | "MA" | "TX" | "KS" | "AK";

export type VerdictString = "APPROVE" | "DENY";

// ─── Profile fixture (v0.6 shape) ─────────────────────────────────────────

export interface ProfileSuite {
  meta: SuiteMeta;
  profiles: Profile[];
}

export interface SuiteMeta {
  version: string;
  fy: string;
  basis?: string;
  count: number;
  default_state: string;
  params: SuiteParams;
  tolerances: SuiteTolerances;
  how_to_use?: string;
  caveats?: string[];
}

export interface SuiteParams {
  fy: string;
  tolerance: number;
  sd: Record<string, number>;
  fpl: Record<string, number>;
  asset_limit: number;
  asset_limit_ed: number;
  homeless_ded: number;
  min_benefit: number;
  shelter_cap: number;
  sua_by_state: Record<string, Record<string, number> | null>;
  allotment_tables?: Record<string, Record<string, number>>;
}

export interface SuiteTolerances {
  verdict: string;
  benefit: string;
  snap_qc_payment_error_threshold_dollars?: number;
  note?: string;
}

export interface Profile {
  id: string;
  legacy_id: string;
  label: string;
  as_of_date?: string;
  facts: Facts;
  requires: string[];
  oracle_basis: string;
  citation: string;
  error_surface: ErrorSurface;
  negative_control?: boolean;
  must_reject?: boolean;
  paired_with?: string | null;
  integrity?: IntegrityBlock | null;
  expected_by_state?: Record<string, StateExpectation>;
  expected?: VariantBlock;
}

export interface ErrorSurface {
  mode?: "flip" | "amount";
  element?: string | null;
}

export interface StateExpectation {
  verdict: VerdictString;
  eligible?: boolean;
  benefit?: number | null;
}

export interface VariantBlock {
  variants: Record<string, Variant>;
}

export interface Variant {
  facts_patch: Record<string, unknown>;
  verdict: VerdictString;
  /**
   * Per-state override for `verdict`. Variant profiles originally carried ONE
   * verdict for every state, which silently assumes the income screen is the
   * same everywhere — it is not. BBCE runs 130% (GA), 165% (TX, IL), 200%
   * (most) and dual-pathway (NY), so a household can legitimately be approved
   * in one state and denied in another on identical facts.
   *
   * Falls back to `verdict` when a state isn't listed, so existing profiles
   * are unaffected. See #609.
   */
  verdict_by_state?: Record<string, VerdictString>;
  benefit?: number | null;
  note?: string;
}

export interface IntegrityBlock {
  qc_should_flag?: boolean;
  error_element?: string;
  reason?: string;
  correct_input?: unknown;
  agency_keyed?: unknown;
  correct_status?: string;
  correct_method?: string;
}

// ─── Facts (state-independent SNAP application) ───────────────────────────

export interface Facts {
  household: Member[];
  income: IncomeLine[];
  shelter: Shelter;
  deductions: Deductions;
  assets: number | string;
  cat_elig: string;
  expedited?: boolean;
  sponsor_income?: number | null;
  // Pseudo-field — runners may add this when applying facts_patch with
  // an explicit as_of_date override. Falls back to profile.as_of_date
  // when absent.
  as_of_date?: string;
}

export interface Member {
  member_id: string;
  age: number;
  role: string;
  disability?: boolean;
  elderly?: boolean;
  student?: string;
  immigration?: string;
  five_yr_bar?: string;
  sponsored?: boolean;
  work_class?: string;
  abawd_months_used?: number;
  disqual?: string[];
  living?: string;
}

export interface IncomeLine {
  member: string;
  type: string;
  amount: number;
  freq?: string;
  anticipation?: string;
  source_status?: string;
}

export interface Shelter {
  rent: number;
  sua_tier: "HCSUA" | "LUA" | "phone" | "none";
  sua_amount: number;
  internet?: number;
  homeless_deduction?: boolean;
}

export interface Deductions {
  dependent_care?: number;
  medical_unreimbursed?: number;
  child_support_paid?: number;
}

// ─── Harness result classification ────────────────────────────────────────

export type ResultKind = "PASS" | "FAIL" | "SKIP";

export type SkipReason =
  | "engine-surface-not-implemented"
  | "params-mismatch-benefit-skipped"
  | "ab-variant-not-supported-yet";

export interface ProfileResult {
  profile_id: string;       // semantic id
  legacy_id: string;
  label: string;
  state: string;
  kind: ResultKind;
  // Verdict shape (most profiles)
  expected_verdict?: VerdictString;
  actual_verdict?: VerdictString;
  // Benefit shape (some profiles, when params match)
  expected_benefit?: number | null;
  actual_benefit?: number | null;
  // Diagnostics
  skip_reason?: SkipReason;
  missing_surfaces?: string[];     // for SKIP
  failure_detail?: string;          // for FAIL: human-readable diff
  citation?: string;
  error_element?: string;
  negative_control?: boolean;
  must_reject?: boolean;
}

// ─── Engine adapter interface ─────────────────────────────────────────────

export interface EngineAdapter {
  /** Display name shown in the report. */
  name: string;

  /**
   * Run the engine against one (facts, state, asOf) tuple and return a
   * verdict + benefit. The adapter MUST NOT throw on facts the engine
   * can't handle — return EngineResult with `not_implemented_surfaces`
   * populated so the harness can SKIP gracefully.
   */
  composeVerdict(facts: Facts, state: string, asOf: Date): EngineResult;

  /**
   * Engine's view of params. The harness compares to oracle params and
   * raises PARAMS_MISMATCH if they diverge.
   */
  getEngineParams(state: string, asOf: Date): EngineParams;
}

export interface EngineResult {
  verdict?: VerdictString;
  benefit?: number | null;
  reason?: string;
  // When the engine can't produce a verdict because a rule surface
  // isn't implemented, list the missing tags here. Maps to SKIP.
  not_implemented_surfaces?: string[];
  trace?: Record<string, unknown>;
}

export interface EngineParams {
  // Per-HH-size lookups, keyed as strings to match the oracle shape.
  sd?: Record<string, number>;
  fpl?: Record<string, number>;
  max_allotment?: Record<string, number>;
  // Federal-state-agnostic scalars
  asset_limit?: number;
  asset_limit_ed?: number;
  shelter_cap?: number;
  min_benefit?: number;
  homeless_ded?: number;
  // Per-state-per-tier SUA
  sua?: Record<string, number>;
}

// ─── Aggregation ──────────────────────────────────────────────────────────

export interface PerElementAgg {
  element: string;
  pass: number;
  fail: number;
  skip: number;
  total: number;
}

export interface HarnessRunSummary {
  suite_version: string;
  state: string;
  engine: string;
  totals: { pass: number; fail: number; skip: number; total: number };
  per_element: PerElementAgg[];
  must_reject_results: ProfileResult[];
  negative_control_results: ProfileResult[];
  fails: ProfileResult[];
  /** All ProfileResults (used by cross-engine divergence sweep). */
  all_results: ProfileResult[];
  skip_surfaces: Map<string, number>;  // surface -> #profiles blocked
  params_mismatch?: ParamsMismatch;
  generated_at_iso: string;
}

export interface ParamsMismatch {
  state: string;
  diffs: Array<{ field: string; oracle: unknown; engine: unknown }>;
}
