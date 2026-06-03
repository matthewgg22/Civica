// Verification context preflight for /profile-simulation.
//
// Runs the Layer 3 registry linter and the Layer 1a metamorphic suite
// before the harness, so the operator sees all three verification
// surfaces (registry hygiene + engine self-consistency + engine-vs-
// oracle agreement) in a single output. Each surface proves something
// DISTINCT — the preflight surfaces all three without conflating them.

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lintRegistry } from "@civica/snap-rules/server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");

export interface PreflightSummary {
  registry: {
    fail: number;
    warn: number;
    info: number;
    status: "PASS" | "WARN" | "FAIL";
  };
  metamorphic: {
    passed: number;
    failed: number;
    total: number;
    status: "PASS" | "FAIL" | "SKIPPED" | "ERROR";
    note?: string | undefined;
  };
  duration_ms: number;
}

export function runPreflight(opts: { skipMetamorphic?: boolean } = {}): PreflightSummary {
  const start = Date.now();

  // ── Layer 3: registry lint (synchronous, fast) ──────────────────
  const findings = lintRegistry();
  const fail = findings.filter((f) => f.level === "FAIL").length;
  const warn = findings.filter((f) => f.level === "WARN").length;
  const info = findings.filter((f) => f.level === "INFO").length;
  const regStatus: "PASS" | "WARN" | "FAIL" = fail > 0 ? "FAIL" : warn > 0 ? "WARN" : "PASS";

  // ── Layer 1a: metamorphic relations ──────────────────────────────
  // Spawn vitest as a subprocess so the harness doesn't have to depend
  // on vitest at runtime. Adds ~1-2s; --skip-metamorphic suppresses.
  let metamorphic: PreflightSummary["metamorphic"] = {
    passed: 0,
    failed: 0,
    total: 0,
    status: "SKIPPED",
    note: "Skipped — pass --skip-metamorphic=false or run `pnpm --filter @civica/snap-rules run test:metamorphic` directly.",
  };
  if (!opts.skipMetamorphic) {
    try {
      const out = execSync(
        "pnpm --filter @civica/snap-rules exec vitest run test/metamorphic.test.ts --reporter=basic",
        { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      // Parse vitest's basic-reporter totals line:
      //   "Tests  12 passed (12)" or "Tests  N failed | M passed (N+M)"
      const m = out.match(/Tests\s+(?:(\d+) failed\s*\|\s*)?(\d+) passed\s*\((\d+)\)/);
      if (m) {
        const failed = m[1] ? parseInt(m[1], 10) : 0;
        const passed = parseInt(m[2]!, 10);
        const total = parseInt(m[3]!, 10);
        metamorphic = {
          passed,
          failed,
          total,
          status: failed === 0 ? "PASS" : "FAIL",
        };
      } else {
        metamorphic = {
          passed: 0,
          failed: 0,
          total: 0,
          status: "ERROR",
          note: "Could not parse vitest totals line",
        };
      }
    } catch (err) {
      const stderr = (err as { stderr?: Buffer | string }).stderr;
      const stdout = (err as { stdout?: Buffer | string }).stdout;
      const blob = String(stdout ?? "") + String(stderr ?? "");
      const m = blob.match(/Tests\s+(?:(\d+) failed\s*\|\s*)?(\d+) passed\s*\((\d+)\)/);
      if (m) {
        const failed = m[1] ? parseInt(m[1], 10) : 0;
        const passed = parseInt(m[2]!, 10);
        const total = parseInt(m[3]!, 10);
        metamorphic = {
          passed,
          failed,
          total,
          status: failed === 0 ? "PASS" : "FAIL",
        };
      } else {
        metamorphic = {
          passed: 0,
          failed: 0,
          total: 0,
          status: "ERROR",
          note: `Vitest subprocess error: ${String(err).slice(0, 160)}`,
        };
      }
    }
  }

  return {
    registry: { fail, warn, info, status: regStatus },
    metamorphic,
    duration_ms: Date.now() - start,
  };
}

export function renderPreflightMarkdown(p: PreflightSummary): string {
  const regIcon = p.registry.status === "PASS" ? "✓" : p.registry.status === "WARN" ? "⚠" : "✗";
  const mmIcon =
    p.metamorphic.status === "PASS"
      ? "✓"
      : p.metamorphic.status === "SKIPPED"
        ? "—"
        : p.metamorphic.status === "ERROR"
          ? "?"
          : "✗";
  const mmText =
    p.metamorphic.status === "SKIPPED"
      ? "skipped"
      : p.metamorphic.status === "ERROR"
        ? "error"
        : `${p.metamorphic.passed}/${p.metamorphic.total}`;
  return `## Verification context (preflight, ${p.duration_ms}ms)

| Layer | Status | Detail |
|---|---|---|
| Registry lint (Layer 3 — constants hygiene) | ${regIcon} ${p.registry.status} | ${p.registry.fail} FAIL · ${p.registry.warn} WARN · ${p.registry.info} INFO |
| Metamorphic relations (Layer 1a — engine self-consistency) | ${mmIcon} ${p.metamorphic.status} | ${mmText} |
| Harness (Layer 0 — engine vs oracle) | ↓ below | see Totals + per-element table |

> Each layer proves something **distinct**: the registry lint catches stale or unowned constants before they propagate; the metamorphic suite catches engine non-monotonicity / nondeterminism on a hand-authored seed corpus; the harness catches engine drift from the v0.6 oracle on 129 specific profiles. Twin-consistency vs independence distinctions per \`docs/findings/2026-06-03-verification-hyperdrive-v0.md\`.

`;
}
