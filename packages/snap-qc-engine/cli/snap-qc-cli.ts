#!/usr/bin/env tsx
/**
 * SNAP QC engine fixture harness — internal-test CLI.
 *
 * Lets internal testers drive the probability/error-rate engine end-to-end
 * with fixture inputs, without spinning up the gateway / dashboard / iOS.
 *
 * Usage:
 *   pnpm --filter @civica/snap-qc-engine cli demo
 *   pnpm --filter @civica/snap-qc-engine cli score <packet.json>
 *   pnpm --filter @civica/snap-qc-engine cli population <CA|MA> [coverage.json]
 *   pnpm --filter @civica/snap-qc-engine cli snapshot <CA|MA> [counts.json]
 *
 * Or directly:  ./cli/snap-qc-cli.ts demo
 */

import { readFileSync } from "node:fs";
import {
  scoreErrorRisk,
  computeProjectedPERForState,
  pillarContributionForState,
  perPacketGapContributionForState,
  buildErrorRateSnapshot,
  STATE_CONSTANTS,
  CA_BASELINE_PER,
  MA_BASELINE_PER,
  ENGINE_VERSION,
  type PillarCoverage,
  type SupportedState,
} from "../src/index";

// Engine's PillarCoverage uses the QC-flow-keyed schema (not generic SNAP pillars).
// See packages/snap-qc-engine/src/scoring/error-risk.ts:301.
const PILLAR_KEYS = [
  "utility_sua",
  "gig_income",
  "shared_lease",
  "assets",
  "benefit_impact",
] as const;

const HEAVY = "═".repeat(60);
const LIGHT = "─".repeat(60);

function header(label: string) {
  console.log(`\n${HEAVY}\n  ${label}\n${HEAVY}`);
}

function row(k: string, v: unknown, pad = 32) {
  console.log(`  ${k.padEnd(pad)} ${JSON.stringify(v)}`);
}

function assertSupportedState(s: string): SupportedState {
  if (s !== "CA" && s !== "MA") {
    console.error(`Error: state must be CA or MA (got "${s}")`);
    process.exit(2);
  }
  return s as SupportedState;
}

// ─── Sub-commands ───────────────────────────────────────────────────────────

function cmdScore(packetPath?: string) {
  let packet: Array<{ flow: string; defensibility_score: string }>;
  if (packetPath) {
    packet = JSON.parse(readFileSync(packetPath, "utf-8"));
  } else {
    // Built-in sample: a mixed-defensibility packet
    packet = [
      { flow: "utility-sua", defensibility_score: "moderate" },
      { flow: "gig-income", defensibility_score: "weak" },
      { flow: "shared-lease", defensibility_score: "strong" },
    ];
  }

  header(`scoreErrorRisk — per-packet error risk`);
  console.log("  Input flows:");
  for (const f of packet) {
    console.log(`    - ${f.flow.padEnd(28)} ${f.defensibility_score}`);
  }

  const result = scoreErrorRisk(
    packet as Array<{ flow: any; defensibility_score: any }>,
  );

  console.log(LIGHT);
  row("tier", result.tier);
  row("score (0–100)", result.score);
  row("factors", result.factors);
  row("engine_version", result.engine_version);
  console.log(LIGHT);

  // Map per-packet score → population gap contribution for each state
  console.log("  Gap contribution if every packet had this score:");
  for (const st of ["CA", "MA"] as const) {
    const gap = perPacketGapContributionForState(result.score, st);
    console.log(`    ${st}: +${gap?.toFixed(2)} pp reduction at full engagement`);
  }
}

function cmdPopulation(stateArg?: string, coveragePath?: string) {
  const state = assertSupportedState(stateArg ?? "CA");
  const sc = STATE_CONSTANTS[state];

  let coverage: PillarCoverage;
  if (coveragePath) {
    coverage = JSON.parse(readFileSync(coveragePath, "utf-8"));
  } else {
    // Built-in sample: realistic mid-engagement profile across the 5 QC pillars
    coverage = {
      utility_sua: 0.5,
      gig_income: 0.6,
      shared_lease: 0.4,
      assets: 0.3,
      benefit_impact: 0.5,
    };
  }

  header(`computeProjectedPERForState — ${state} population PER`);
  row("state", state);
  row("baseline PER (FY24 published)", `${sc.baselinePer}%`);
  row("baseline fiscal year", sc.baselineFiscalYear);
  console.log(`  Pillar coverage input:`);
  for (const k of PILLAR_KEYS) {
    console.log(`    ${k.padEnd(28)} ${(coverage[k] * 100).toFixed(0)}%`);
  }

  console.log(LIGHT);
  console.log(`  Per-pillar PER reduction (pp):`);
  let total = 0;
  for (const k of PILLAR_KEYS) {
    const c = pillarContributionForState(k, coverage[k], state);
    total += c;
    console.log(`    ${k.padEnd(28)} -${c.toFixed(3)}pp`);
  }
  console.log(`    ${"TOTAL reduction".padEnd(28)} -${total.toFixed(3)}pp`);

  const projected = computeProjectedPERForState(coverage, state);
  console.log(LIGHT);
  row(`projected PER (${state})`, `${projected.toFixed(2)}%`);
  row(`baseline → projected delta`, `-${(sc.baselinePer - projected).toFixed(2)}pp`);
}

function cmdSnapshot(stateArg?: string, countsPath?: string) {
  const state = assertSupportedState(stateArg ?? "CA");
  const sc = STATE_CONSTANTS[state];

  const counts = countsPath
    ? JSON.parse(readFileSync(countsPath, "utf-8"))
    : undefined;

  header(`buildErrorRateSnapshot — ${state} canonical truth-point rows`);
  if (counts) {
    row("measured counts input", counts);
  } else {
    console.log("  No measured counts provided — measured row will be null/gated.");
  }

  const inputs = {
    state,
    baselinePer: sc.baselinePer,
    baselineFiscalYear: sc.baselineFiscalYear,
    projectedPer: computeProjectedPERForState(
      {
        utility_sua: 0.5,
        gig_income: 0.6,
        shared_lease: 0.4,
        assets: 0.3,
        benefit_impact: 0.5,
      },
      state,
    ),
    measured: counts,
    computedAt: new Date().toISOString(),
  } as any;

  try {
    const rows = buildErrorRateSnapshot(inputs);
    console.log(LIGHT);
    console.log(`  Returned ${Array.isArray(rows) ? rows.length : 1} row(s):`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.log(LIGHT);
    console.log("  buildErrorRateSnapshot threw — likely missing required input.");
    console.log(`  ${(err as Error).message}`);
    console.log("  Provide a counts.json with measured numerator/denominator to test the measured row.");
  }
}

function cmdDemo() {
  header(`SNAP QC engine demo — v${ENGINE_VERSION}`);
  console.log(`  CA baseline PER (FY24): ${CA_BASELINE_PER}%`);
  console.log(`  MA baseline PER (FY24): ${MA_BASELINE_PER}%`);
  console.log(`  Supported states: ${Object.keys(STATE_CONSTANTS).join(", ")}`);

  cmdScore();
  cmdPopulation("CA");
  cmdPopulation("MA");

  header("Run individual subcommands for more:");
  console.log("    cli score [packet.json]");
  console.log("    cli population <CA|MA> [coverage.json]");
  console.log("    cli snapshot   <CA|MA> [counts.json]");
}

function help() {
  console.log(`
SNAP QC engine — fixture harness CLI (engine version ${ENGINE_VERSION})

Usage:
  cli demo                              Run all entry points with built-in fixtures
  cli score [packet.json]               Score one packet (per-flow defensibility)
  cli population <CA|MA> [coverage.json]   Project population PER for a state
  cli snapshot   <CA|MA> [counts.json]     Build canonical error-rate-snapshot rows

Fixture file formats:
  packet.json   = [{"flow": "utility-sua", "defensibility_score": "moderate"}, ...]
                  flow ∈ {utility-sua,gig-income,shared-lease,assets,benefit-impact-projection}
                  defensibility_score ∈ {strong,moderate,weak}
  coverage.json = {"income":0.5, "shelter_utility":0.5, "household_composition":0.5,
                   "resources":0.5, "deductions":0.5, "elections":0.5}
  counts.json   = {"numerator": <n_errored>, "denominator": <n_total>}

Examples:
  pnpm --filter @civica/snap-qc-engine cli demo
  pnpm --filter @civica/snap-qc-engine cli population MA
  pnpm --filter @civica/snap-qc-engine cli score cli/fixtures/strong-packet.json
`);
}

// ─── Entry point ────────────────────────────────────────────────────────────

const [, , subcmd, ...rest] = process.argv;

switch (subcmd) {
  case "demo":
    cmdDemo();
    break;
  case "score":
    cmdScore(rest[0]);
    break;
  case "population":
    cmdPopulation(rest[0], rest[1]);
    break;
  case "snapshot":
    cmdSnapshot(rest[0], rest[1]);
    break;
  case "-h":
  case "--help":
  case "help":
  case undefined:
    help();
    break;
  default:
    console.error(`Unknown subcommand: ${subcmd}`);
    help();
    process.exit(2);
}
