#!/usr/bin/env tsx
// Civica SNAP profile-harness CLI.
//
// Usage:
//   pnpm --filter @civica/profile-harness run [--state CA|MA] [--engine ts|sentinel] [--verdict-only] [--out path.md]
//
// What it does:
//   1. Loads + schema-validates data-ops/sample/civica-test-profiles/v0.6.json
//   2. Runs every profile through the chosen engine adapter
//   3. Classifies each result PASS / FAIL / SKIP (per the capability manifest)
//   4. Writes a markdown report (default: stdout)
//
// What it deliberately does NOT do:
//   - Re-derive expected values from the engine (would defeat the oracle)
//   - Report any "error rate" — this is engine-vs-oracle agreement, NOT PER

import { writeFileSync } from "node:fs";
import { loadProfileSuite, DEFAULT_FIXTURE_PATH } from "./loader.ts";
import { runHarness } from "./runner.ts";
import { renderMarkdownReport } from "./report.ts";
import { SentinelAdapter } from "./adapters/sentinel.ts";
import { TsSnapRulesAdapter } from "./adapters/ts-snap-rules.ts";
import { SwiftCliAdapter } from "./adapters/swift-cli.ts";
import { TS_MANIFEST_WAVE_A, TS_MANIFEST_WAVE_B } from "./capability-manifest.ts";
import { renderDivergenceReport, runCrossEngine } from "./cross-engine.ts";
import type { CapabilityManifest, EngineAdapter } from "./types.ts";

interface ParsedArgs {
  state: string;
  engine: "ts" | "sentinel" | "swift" | "both";
  verdictOnly: boolean;
  fixturePath?: string;
  out?: string;
  skipSchema: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    state: "CA",
    engine: "ts",
    verdictOnly: false,
    skipSchema: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--state") out.state = argv[++i];
    else if (a === "--engine") {
      const v = argv[++i];
      if (v !== "ts" && v !== "sentinel" && v !== "swift" && v !== "both") {
        throw new Error(`Unknown engine: ${v}. Use ts | sentinel | swift | both`);
      }
      out.engine = v;
    }
    else if (a === "--verdict-only") out.verdictOnly = true;
    else if (a === "--fixture") out.fixturePath = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--skip-schema") out.skipSchema = true;
    else if (a === "-h" || a === "--help") {
      console.log(HELP);
      process.exit(0);
    }
  }
  return out;
}

const HELP = `
Civica SNAP profile-harness

Usage:
  pnpm --filter @civica/profile-harness run [options]

Options:
  --state <CA|MA|TX|KS|AK>    State to evaluate (default CA)
  --engine <ts|sentinel>      Engine adapter (default ts)
  --verdict-only              Skip benefit assertions (always on if PARAMS_MISMATCH)
  --fixture <path>            Override fixture JSON (default: vendored v0.6)
  --out <path>                Write report to file (default: stdout)
  --skip-schema               Skip schema validation (debug only)
  -h, --help                  This message

Examples:
  pnpm --filter @civica/profile-harness run
  pnpm --filter @civica/profile-harness run --state MA --verdict-only
  pnpm --filter @civica/profile-harness run --engine sentinel --out /tmp/report.md
`.trim();

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const { suite, fixturePath } = loadProfileSuite({
    fixturePath: args.fixturePath,
    skipValidation: args.skipSchema,
  });

  // ── --engine both: dual-run + divergence report ──────────────────────
  if (args.engine === "both") {
    const ts = new TsSnapRulesAdapter();
    const swift = new SwiftCliAdapter();
    const { tsSummary, swiftSummary, divergence } = runCrossEngine(suite, {
      state: args.state,
      tsEngine: ts,
      swiftEngine: swift,
      manifest: TS_MANIFEST_WAVE_B,
      verdictOnly: args.verdictOnly,
    });
    const dualReport =
      renderMarkdownReport(tsSummary) +
      "\n\n# ── Swift engine run ──\n\n" +
      renderMarkdownReport(swiftSummary) +
      "\n\n" +
      renderDivergenceReport(divergence);
    if (args.out) {
      writeFileSync(args.out, dualReport, "utf-8");
      process.stderr.write(
        `Report written to ${args.out}\nTS: ${tsSummary.totals.pass}/${tsSummary.totals.fail}/${tsSummary.totals.skip}  Swift: ${swiftSummary.totals.pass}/${swiftSummary.totals.fail}/${swiftSummary.totals.skip}  Divergence: ${divergence.count}\n`,
      );
    } else {
      process.stdout.write(dualReport);
    }
    process.exit(tsSummary.totals.fail > 0 || swiftSummary.totals.fail > 0 ? 1 : 0);
  }

  let engine: EngineAdapter;
  let manifest: CapabilityManifest;
  if (args.engine === "sentinel") {
    engine = new SentinelAdapter();
    manifest = TS_MANIFEST_WAVE_A;
  } else if (args.engine === "swift") {
    engine = new SwiftCliAdapter();
    manifest = TS_MANIFEST_WAVE_B;
  } else {
    engine = new TsSnapRulesAdapter();
    manifest = TS_MANIFEST_WAVE_B;
  }

  const summary = runHarness(suite, {
    state: args.state,
    engine,
    manifest,
    verdictOnly: args.verdictOnly,
  });

  const report = renderMarkdownReport(summary);
  if (args.out) {
    writeFileSync(args.out, report, "utf-8");
    // Brief stderr line so the user knows where it went without piping
    process.stderr.write(`Report written to ${args.out}\n`);
    process.stderr.write(
      `Suite: v${suite.meta.version} (${suite.profiles.length} profiles) — ${summary.totals.pass} PASS / ${summary.totals.fail} FAIL / ${summary.totals.skip} SKIP\n`,
    );
  } else {
    process.stdout.write(report);
  }

  // Exit code = 1 if any FAIL (for CI), 0 otherwise. SKIPs don't fail CI.
  process.exit(summary.totals.fail > 0 ? 1 : 0);
}

// Keep fixturePath available for diagnostics
void DEFAULT_FIXTURE_PATH;

main().catch((err) => {
  console.error("Harness failed:", err);
  process.exit(2);
});
