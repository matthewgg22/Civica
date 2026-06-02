// Runner — iterates profiles, classifies each as PASS / FAIL / SKIP,
// aggregates by error_surface.element, surfaces must_reject + negative
// control results separately (they're safety-critical).

import type {
  EngineAdapter,
  Facts,
  HarnessRunSummary,
  ParamsMismatch,
  PerElementAgg,
  Profile,
  ProfileResult,
  ProfileSuite,
  ResultKind,
  StateExpectation,
  Variant,
} from "./types.ts";
import { applyFactsPatch } from "./facts-patch.ts";
import { type CapabilityManifest, missingSurfaces } from "./capability-manifest.ts";

export interface RunOptions {
  state: string;
  engine: EngineAdapter;
  manifest: CapabilityManifest;
  /**
   * When true, assert verdict only — skip benefit assertions even when
   * params match. Useful while ports stabilize.
   */
  verdictOnly?: boolean;
}

export function runHarness(
  suite: ProfileSuite,
  opts: RunOptions,
): HarnessRunSummary {
  const { state, engine, manifest } = opts;

  // PARAMS_MISMATCH check — once per run, against the state's params.
  const params_mismatch = detectParamsMismatch(suite, state, engine);
  const benefitsAllowed = !opts.verdictOnly && params_mismatch == null;

  const results: ProfileResult[] = [];

  for (const profile of suite.profiles) {
    const missing = missingSurfaces(profile.requires, manifest);
    if (missing.length > 0) {
      // Engine can't drive this profile — SKIP, surface the gap.
      // We still emit one result entry per profile so the
      // per-element aggregator sees it.
      results.push(buildSkipResult(profile, state, missing));
      continue;
    }

    if (profile.expected_by_state) {
      const exp = profile.expected_by_state[state];
      if (!exp) {
        // Profile doesn't ship an expectation for this state; SKIP.
        results.push(buildSkipResult(profile, state, ["no-expectation-for-state"]));
        continue;
      }
      results.push(runStatefulProfile(profile, exp, state, engine, benefitsAllowed));
    } else if (profile.expected?.variants) {
      // A/B variant rows — one result per variant. Each variant applies
      // its facts_patch to a deep-cloned base, then runs the composer.
      for (const [variantKey, variant] of Object.entries(profile.expected.variants)) {
        results.push(
          runVariantProfile(profile, variantKey, variant, state, engine, benefitsAllowed),
        );
      }
    } else {
      // Profile has neither shape — fixture authoring bug.
      results.push({
        profile_id: profile.id,
        legacy_id: profile.legacy_id,
        label: profile.label,
        state,
        kind: "SKIP",
        skip_reason: "engine-surface-not-implemented",
        failure_detail: "profile has neither expected_by_state nor expected.variants",
        citation: profile.citation,
      });
    }
  }

  return summarize(suite, state, engine.name, results, params_mismatch ?? undefined);
}

// ─── Per-profile execution ────────────────────────────────────────────────

function runVariantProfile(
  profile: Profile,
  variantKey: string,
  variant: Variant,
  state: string,
  engine: EngineAdapter,
  benefitsAllowed: boolean,
): ProfileResult {
  // Deep clone + apply patch. The applier accepts `as_of_date` as a
  // pseudo-field on Facts, which the composer reads when threading asOf.
  let patchedFacts: Facts;
  try {
    patchedFacts = applyFactsPatch(profile.facts, variant.facts_patch);
  } catch (err) {
    return {
      profile_id: `${profile.id}[${variantKey}]`,
      legacy_id: `${profile.legacy_id}[${variantKey}]`,
      label: `${profile.label} · ${variantKey}${variant.note ? " — " + variant.note : ""}`,
      state,
      kind: "FAIL",
      failure_detail: `facts_patch apply error: ${(err as Error).message}`,
      citation: profile.citation,
      error_element: profile.error_surface.element ?? undefined,
      negative_control: profile.negative_control,
      must_reject: profile.must_reject,
    };
  }

  // Variant may override as_of_date.
  const asOf = parseAsOf(
    (patchedFacts as any).as_of_date ?? profile.as_of_date,
  );
  const result = engine.composeVerdict(patchedFacts, state, asOf);

  if (result.not_implemented_surfaces && result.not_implemented_surfaces.length > 0) {
    return {
      ...buildSkipResult(profile, state, result.not_implemented_surfaces),
      profile_id: `${profile.id}[${variantKey}]`,
      legacy_id: `${profile.legacy_id}[${variantKey}]`,
      label: `${profile.label} · ${variantKey}`,
    };
  }

  const verdictOk = result.verdict === variant.verdict;
  let benefitOk: boolean | null = null;
  if (benefitsAllowed && variant.benefit != null) {
    benefitOk = result.benefit === variant.benefit;
  }

  let kind: ResultKind;
  if (!verdictOk) kind = "FAIL";
  else if (benefitOk === false) kind = "FAIL";
  else kind = "PASS";

  return {
    profile_id: `${profile.id}[${variantKey}]`,
    legacy_id: `${profile.legacy_id}[${variantKey}]`,
    label: `${profile.label} · ${variantKey}${variant.note ? " — " + variant.note : ""}`,
    state,
    kind,
    expected_verdict: variant.verdict,
    actual_verdict: result.verdict,
    expected_benefit: variant.benefit,
    actual_benefit: result.benefit ?? null,
    failure_detail: buildFailDetail(
      verdictOk,
      benefitOk,
      { verdict: variant.verdict, benefit: variant.benefit ?? null } as any,
      result,
      result.reason,
    ),
    citation: profile.citation,
    error_element: profile.error_surface.element ?? undefined,
    negative_control: profile.negative_control,
    must_reject: profile.must_reject,
  };
}

function runStatefulProfile(
  profile: Profile,
  expected: StateExpectation,
  state: string,
  engine: EngineAdapter,
  benefitsAllowed: boolean,
): ProfileResult {
  const asOf = parseAsOf(profile.as_of_date);
  const result = engine.composeVerdict(profile.facts, state, asOf);

  if (result.not_implemented_surfaces && result.not_implemented_surfaces.length > 0) {
    return buildSkipResult(profile, state, result.not_implemented_surfaces);
  }

  const verdictOk = result.verdict === expected.verdict;
  let benefitOk: boolean | null = null;
  if (benefitsAllowed && expected.benefit != null) {
    benefitOk = result.benefit === expected.benefit;
  }

  let kind: ResultKind;
  if (!verdictOk) {
    kind = "FAIL";
  } else if (benefitOk === false) {
    kind = "FAIL";
  } else {
    kind = "PASS";
  }

  return {
    profile_id: profile.id,
    legacy_id: profile.legacy_id,
    label: profile.label,
    state,
    kind,
    expected_verdict: expected.verdict,
    actual_verdict: result.verdict,
    expected_benefit: expected.benefit,
    actual_benefit: result.benefit ?? null,
    failure_detail: buildFailDetail(verdictOk, benefitOk, expected, result, result.reason),
    citation: profile.citation,
    error_element: profile.error_surface.element ?? undefined,
    negative_control: profile.negative_control,
    must_reject: profile.must_reject,
  };
}

function buildFailDetail(
  verdictOk: boolean,
  benefitOk: boolean | null,
  expected: StateExpectation,
  result: { verdict?: string; benefit?: number | null; reason?: string },
  reason: string | undefined,
): string | undefined {
  if (verdictOk && benefitOk !== false) return undefined;
  const parts: string[] = [];
  if (!verdictOk) {
    parts.push(`verdict expected=${expected.verdict} got=${result.verdict ?? "?"}`);
  }
  if (benefitOk === false) {
    parts.push(`benefit expected=${expected.benefit} got=${result.benefit ?? "?"}`);
  }
  if (reason) parts.push(`reason=${reason}`);
  return parts.join("; ");
}

function buildSkipResult(
  profile: Profile,
  state: string,
  missing: string[],
): ProfileResult {
  return {
    profile_id: profile.id,
    legacy_id: profile.legacy_id,
    label: profile.label,
    state,
    kind: "SKIP",
    skip_reason: "engine-surface-not-implemented",
    missing_surfaces: missing,
    citation: profile.citation,
    error_element: profile.error_surface.element ?? undefined,
    negative_control: profile.negative_control,
    must_reject: profile.must_reject,
  };
}

function parseAsOf(iso?: string): Date {
  if (!iso) return new Date(Date.UTC(2026, 5, 1));
  // Treat date as midnight UTC to dodge TZ-month rollover quirks.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(Date.UTC(2026, 5, 1));
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

// ─── PARAMS_MISMATCH ──────────────────────────────────────────────────────

function detectParamsMismatch(
  suite: ProfileSuite,
  state: string,
  engine: EngineAdapter,
): ParamsMismatch | null {
  // Only check params for the state being run.
  const oracle = suite.meta.params;
  const eng = engine.getEngineParams(state, new Date(Date.UTC(2026, 5, 1)));

  const diffs: Array<{ field: string; oracle: unknown; engine: unknown }> = [];

  pushIfDiffer(diffs, "asset_limit", oracle.asset_limit, eng.asset_limit);
  pushIfDiffer(diffs, "asset_limit_ed", oracle.asset_limit_ed, eng.asset_limit_ed);
  pushIfDiffer(diffs, "shelter_cap", oracle.shelter_cap, eng.shelter_cap);
  pushIfDiffer(diffs, "min_benefit", oracle.min_benefit, eng.min_benefit);
  pushIfDiffer(diffs, "homeless_ded", oracle.homeless_ded, eng.homeless_ded);

  // SD by size — compare each
  if (eng.sd) {
    for (const size of Object.keys(oracle.sd)) {
      pushIfDiffer(diffs, `sd[${size}]`, oracle.sd[size], eng.sd[size]);
    }
  } else {
    diffs.push({ field: "sd", oracle: oracle.sd, engine: undefined });
  }

  // SUA per tier — only the per-state values
  const oracleSua = oracle.sua_by_state[state];
  if (oracleSua) {
    if (eng.sua) {
      for (const tier of Object.keys(oracleSua)) {
        pushIfDiffer(diffs, `sua[${tier}]`, oracleSua[tier], eng.sua[tier]);
      }
    } else {
      diffs.push({ field: `sua_by_state[${state}]`, oracle: oracleSua, engine: undefined });
    }
  }

  return diffs.length > 0 ? { state, diffs } : null;
}

function pushIfDiffer(
  arr: Array<{ field: string; oracle: unknown; engine: unknown }>,
  field: string,
  oracle: unknown,
  engine: unknown,
): void {
  if (oracle === engine) return;
  if (typeof oracle === "number" && typeof engine === "number") {
    if (Math.abs(oracle - engine) < 1e-6) return;
  }
  arr.push({ field, oracle, engine });
}

// ─── Summary aggregation ──────────────────────────────────────────────────

function summarize(
  suite: ProfileSuite,
  state: string,
  engineName: string,
  results: ProfileResult[],
  params_mismatch?: ParamsMismatch,
): HarnessRunSummary {
  const totals = { pass: 0, fail: 0, skip: 0, total: results.length };
  for (const r of results) {
    if (r.kind === "PASS") totals.pass++;
    else if (r.kind === "FAIL") totals.fail++;
    else totals.skip++;
  }

  // Per element aggregation
  const elementMap = new Map<string, PerElementAgg>();
  for (const r of results) {
    const elem = r.error_element ?? "(none)";
    let agg = elementMap.get(elem);
    if (!agg) {
      agg = { element: elem, pass: 0, fail: 0, skip: 0, total: 0 };
      elementMap.set(elem, agg);
    }
    agg.total++;
    if (r.kind === "PASS") agg.pass++;
    else if (r.kind === "FAIL") agg.fail++;
    else agg.skip++;
  }
  const per_element = [...elementMap.values()].sort((a, b) =>
    a.element.localeCompare(b.element),
  );

  const must_reject_results = results.filter((r) => r.must_reject === true);
  const negative_control_results = results.filter((r) => r.negative_control === true);
  const fails = results.filter((r) => r.kind === "FAIL");

  // Roadmap: surfaces blocking the most profiles
  const skip_surfaces = new Map<string, number>();
  for (const r of results) {
    if (r.kind === "SKIP" && r.missing_surfaces) {
      for (const s of r.missing_surfaces) {
        skip_surfaces.set(s, (skip_surfaces.get(s) ?? 0) + 1);
      }
    }
  }

  return {
    suite_version: suite.meta.version,
    state,
    engine: engineName,
    totals,
    per_element,
    must_reject_results,
    negative_control_results,
    fails,
    all_results: results,
    skip_surfaces,
    params_mismatch,
    generated_at_iso: new Date().toISOString(),
  };
}
