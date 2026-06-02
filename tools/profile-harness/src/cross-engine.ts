// Cross-engine orchestration. Runs TS and Swift in parallel against the
// same fixture, then walks the result lists side-by-side to surface
// disagreements.
//
// The divergence count is the audit's "two engines, no agreed verdict"
// metric. When TS and Swift (both independent ports from Python + 7 CFR)
// agree → high confidence in the regulatory encoding. When they disagree
// → bug in one of the ports, localized by which side matches the oracle.

import type {
  CapabilityManifest,
  EngineAdapter,
  HarnessRunSummary,
  ProfileResult,
  ProfileSuite,
} from "./types.ts";
import { runHarness } from "./runner.ts";
import { applyFactsPatch } from "./facts-patch.ts";
import { SwiftCliAdapter } from "./adapters/swift-cli.ts";

export interface CrossEngineOptions {
  state: string;
  tsEngine: EngineAdapter;
  swiftEngine: EngineAdapter;
  manifest: CapabilityManifest;
  verdictOnly?: boolean;
}

export interface DivergenceRow {
  profile_id: string;
  legacy_id: string;
  label: string;
  ts_verdict?: string;
  swift_verdict?: string;
  ts_benefit?: number | null;
  swift_benefit?: number | null;
  oracle_verdict?: string;
  oracle_benefit?: number | null;
  /** Which engine matches the oracle (or "neither" / "both"). */
  localized_to: "ts" | "swift" | "neither" | "both";
  error_element?: string;
  citation?: string;
}

export interface DivergenceReport {
  count: number;
  rows: DivergenceRow[];
  ts_matches_oracle: number;
  swift_matches_oracle: number;
  both_match_oracle: number;
  neither_matches_oracle: number;
}

export interface CrossEngineRunResult {
  tsSummary: HarnessRunSummary;
  swiftSummary: HarnessRunSummary;
  divergence: DivergenceReport;
}

export function runCrossEngine(
  suite: ProfileSuite,
  opts: CrossEngineOptions,
): CrossEngineRunResult {
  // Preload Swift cache with all (state, asOf, facts) tuples the runner
  // will encounter — including variant patches. One Swift invocation
  // for the entire suite.
  if (opts.swiftEngine instanceof SwiftCliAdapter) {
    const requests = buildAllRequests(suite, opts.state);
    opts.swiftEngine.preload(requests);
  }

  const tsSummary = runHarness(suite, {
    state: opts.state,
    engine: opts.tsEngine,
    manifest: opts.manifest,
    verdictOnly: opts.verdictOnly,
  });
  const swiftSummary = runHarness(suite, {
    state: opts.state,
    engine: opts.swiftEngine,
    manifest: opts.manifest,
    verdictOnly: opts.verdictOnly,
  });

  const divergence = computeDivergence(tsSummary, swiftSummary);
  return { tsSummary, swiftSummary, divergence };
}

function buildAllRequests(
  suite: ProfileSuite,
  state: string,
): Array<{ state: string; asOf: Date; facts: any }> {
  const reqs: Array<{ state: string; asOf: Date; facts: any }> = [];
  for (const p of suite.profiles) {
    if (p.expected_by_state) {
      reqs.push({
        state,
        asOf: parseAsOf(p.as_of_date),
        facts: p.facts,
      });
    } else if (p.expected?.variants) {
      for (const v of Object.values(p.expected.variants)) {
        let patched: any;
        try {
          patched = applyFactsPatch(p.facts, v.facts_patch);
        } catch {
          continue;
        }
        const asOf = parseAsOf((patched as any).as_of_date ?? p.as_of_date);
        reqs.push({ state, asOf, facts: patched });
      }
    }
  }
  return reqs;
}

function parseAsOf(iso?: string): Date {
  if (!iso) return new Date(Date.UTC(2026, 5, 1));
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(Date.UTC(2026, 5, 1));
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function computeDivergence(
  ts: HarnessRunSummary,
  swift: HarnessRunSummary,
): DivergenceReport {
  // Match by legacy_id (includes variant key for A/B rows).
  const tsByID = new Map<string, ProfileResult>();
  for (const r of ts.all_results) tsByID.set(r.legacy_id, r);

  const swiftByID = new Map<string, ProfileResult>();
  for (const r of swift.all_results) swiftByID.set(r.legacy_id, r);

  const rows: DivergenceRow[] = [];
  let tsMatches = 0, swiftMatches = 0, bothMatch = 0, neitherMatch = 0;

  const ids = new Set<string>([...tsByID.keys(), ...swiftByID.keys()]);
  for (const id of ids) {
    const t = tsByID.get(id);
    const s = swiftByID.get(id);
    if (!t || !s) continue;
    // Skip if either is a SKIP — we want PASS/FAIL comparison
    if (t.kind === "SKIP" || s.kind === "SKIP") continue;

    const tVerdict = t.actual_verdict;
    const sVerdict = s.actual_verdict;
    const tBenefit = t.actual_benefit ?? null;
    const sBenefit = s.actual_benefit ?? null;
    const oracleV = t.expected_verdict;
    const oracleB = t.expected_benefit ?? null;

    const sameVerdict = tVerdict === sVerdict;
    const sameBenefit = tBenefit === sBenefit;
    if (sameVerdict && sameBenefit) {
      if (t.kind === "PASS") bothMatch++;
      else neitherMatch++;
      continue;
    }

    // Disagreement — localize
    const tsOK = tVerdict === oracleV && tBenefit === oracleB;
    const swiftOK = sVerdict === oracleV && sBenefit === oracleB;
    let localized: DivergenceRow["localized_to"];
    if (tsOK && swiftOK) { localized = "both"; bothMatch++; }
    else if (tsOK) { localized = "ts"; tsMatches++; }
    else if (swiftOK) { localized = "swift"; swiftMatches++; }
    else { localized = "neither"; neitherMatch++; }

    rows.push({
      profile_id: t.profile_id,
      legacy_id: t.legacy_id,
      label: t.label,
      ts_verdict: tVerdict,
      swift_verdict: sVerdict,
      ts_benefit: tBenefit,
      swift_benefit: sBenefit,
      oracle_verdict: oracleV,
      oracle_benefit: oracleB,
      localized_to: localized,
      error_element: t.error_element,
      citation: t.citation,
    });
  }

  return {
    count: rows.length,
    rows,
    ts_matches_oracle: tsMatches,
    swift_matches_oracle: swiftMatches,
    both_match_oracle: bothMatch,
    neither_matches_oracle: neitherMatch,
  };
}

export function renderDivergenceReport(d: DivergenceReport): string {
  const lines: string[] = [];
  lines.push("# ── Cross-engine divergence ──");
  lines.push("");
  lines.push(
    `The audit metric: how often do **two independently-ported encodings of 7 CFR 273** (TS + Swift, both from Python source) disagree on the same profile?`,
  );
  lines.push("");
  lines.push(`- Profiles compared (passing/failing both, no SKIPs): ${d.both_match_oracle + d.ts_matches_oracle + d.swift_matches_oracle + d.neither_matches_oracle}`);
  lines.push(`- **TS and Swift agree (both match oracle):** ${d.both_match_oracle}`);
  lines.push(`- **Disagreements (divergence rows):** ${d.count}`);
  lines.push(`  - TS matches oracle, Swift doesn't: ${d.ts_matches_oracle}`);
  lines.push(`  - Swift matches oracle, TS doesn't: ${d.swift_matches_oracle}`);
  lines.push(`  - Neither matches oracle: ${d.neither_matches_oracle}`);
  lines.push("");

  if (d.rows.length === 0) {
    lines.push("**No divergences in the compared set.** TS and Swift agree on every profile both engines run.");
    lines.push("");
    return lines.join("\n") + "\n";
  }

  lines.push("## Divergence detail");
  lines.push("");
  lines.push("| ID | TS | Swift | Oracle | Localizes to | Citation |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of d.rows.slice(0, 30)) {
    const tsCell = `${r.ts_verdict ?? ""}${r.ts_benefit != null ? ` $${r.ts_benefit}` : ""}`;
    const swCell = `${r.swift_verdict ?? ""}${r.swift_benefit != null ? ` $${r.swift_benefit}` : ""}`;
    const orCell = `${r.oracle_verdict ?? ""}${r.oracle_benefit != null ? ` $${r.oracle_benefit}` : ""}`;
    lines.push(`| \`${r.legacy_id}\` | \`${tsCell}\` | \`${swCell}\` | \`${orCell}\` | **${r.localized_to.toUpperCase()}** | ${r.citation ?? ""} |`);
  }
  if (d.rows.length > 30) {
    lines.push(`| _(${d.rows.length - 30} more rows)_ |  |  |  |  |  |`);
  }
  lines.push("");
  return lines.join("\n") + "\n";
}
