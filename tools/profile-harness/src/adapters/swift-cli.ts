// Swift adapter: shells out to the compiled snap-rules-swift-cli binary.
//
// To keep startup cost manageable across 129 profiles, the adapter
// batches the entire harness run into ONE Swift invocation via the
// preload() method, then per-call composeVerdict() returns from the
// in-memory cache keyed by (state, asOf-ISO, facts-hash).
//
// If preload() wasn't called, falls back to per-call shell-out — slower
// but correct.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import type {
  EngineAdapter,
  EngineParams,
  EngineResult,
  Facts,
} from "../types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Repo root walk-up from this file:
 *   tools/profile-harness/src/adapters/swift-cli.ts
 *     -> tools/profile-harness/src/adapters
 *     -> tools/profile-harness/src
 *     -> tools/profile-harness
 *     -> tools
 *     -> <repo root>
 */
function repoRoot(): string {
  return resolve(__dirname, "..", "..", "..", "..");
}

const SWIFT_BINARY = resolve(
  repoRoot(),
  "tools",
  "snap-rules-swift-cli",
  ".build",
  "release",
  "SnapRulesSwiftCli",
);

interface CachedKey { state: string; asOfISO: string; factsHash: string }

function keyFor(state: string, asOf: Date, facts: Facts): string {
  const asOfISO = asOf.toISOString().slice(0, 10);
  const h = createHash("sha1").update(JSON.stringify(facts)).digest("hex").slice(0, 16);
  return `${state}|${asOfISO}|${h}`;
}

export class SwiftCliAdapter implements EngineAdapter {
  readonly name = "swift:snap-rules-cli";
  private cache = new Map<string, EngineResult>();
  private binaryAvailable = false;

  constructor() {
    this.binaryAvailable = existsSync(SWIFT_BINARY);
  }

  /**
   * Preload the cache with a single Swift invocation for the entire
   * (request) array. Call this BEFORE the runner iterates profiles.
   */
  preload(requests: Array<{ state: string; asOf: Date; facts: Facts }>): void {
    if (!this.binaryAvailable) return;
    if (requests.length === 0) return;

    const batchInput = {
      asOf: "2026-06-01",
      requests: requests.map((r) => ({
        state: r.state,
        asOf: r.asOf.toISOString().slice(0, 10),
        facts: r.facts,
      })),
    };

    const tmpDir = mkdtempSync(`${tmpdir()}/snap-swift-`);
    const inPath = `${tmpDir}/in.json`;
    const outPath = `${tmpDir}/out.json`;
    writeFileSync(inPath, JSON.stringify(batchInput), "utf-8");

    const r = spawnSync(SWIFT_BINARY, ["--in", inPath, "--out", outPath], {
      encoding: "utf-8",
    });
    if (r.status !== 0) {
      process.stderr.write(
        `[swift-cli] preload failed (exit ${r.status}): ${r.stderr ?? ""}\n`,
      );
      try { unlinkSync(inPath); } catch {}
      return;
    }

    let parsed: { engine: string; responses: EngineResult[] };
    try {
      parsed = JSON.parse(readFileSync(outPath, "utf-8"));
    } catch (err) {
      process.stderr.write(`[swift-cli] preload parse error: ${err}\n`);
      return;
    }

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      const resp = parsed.responses[i];
      this.cache.set(keyFor(req.state, req.asOf, req.facts), resp);
    }

    try {
      unlinkSync(inPath);
      unlinkSync(outPath);
    } catch {}
  }

  composeVerdict(facts: Facts, state: string, asOf: Date): EngineResult {
    if (!this.binaryAvailable) {
      return {
        not_implemented_surfaces: ["__swift-binary-not-built__"],
        reason: `Swift CLI binary not found at ${SWIFT_BINARY}. Run: cd tools/snap-rules-swift-cli && swift build -c release`,
      };
    }
    const k = keyFor(state, asOf, facts);
    const cached = this.cache.get(k);
    if (cached) return cached;

    // Cache miss — fall back to per-call shell-out.
    const batchInput = {
      asOf: "2026-06-01",
      requests: [
        {
          state,
          asOf: asOf.toISOString().slice(0, 10),
          facts,
        },
      ],
    };
    const r = spawnSync(SWIFT_BINARY, [], {
      input: JSON.stringify(batchInput),
      encoding: "utf-8",
    });
    if (r.status !== 0) {
      return {
        not_implemented_surfaces: ["__swift-cli-error__"],
        reason: r.stderr ?? "Swift CLI exited non-zero",
      };
    }
    try {
      const parsed = JSON.parse(r.stdout);
      const resp = parsed.responses[0] as EngineResult;
      this.cache.set(k, resp);
      return resp;
    } catch (err) {
      return {
        not_implemented_surfaces: ["__swift-cli-parse-error__"],
        reason: (err as Error).message,
      };
    }
  }

  getEngineParams(_state: string, _asOf: Date): EngineParams {
    // The Swift CLI doesn't expose params reflectively. PARAMS_MISMATCH
    // detection runs against the TS engine; if Swift drifts, the harness
    // catches it via per-profile verdict/benefit diffs instead.
    return {};
  }
}
