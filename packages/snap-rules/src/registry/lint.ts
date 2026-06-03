#!/usr/bin/env tsx
// Verification-hyperdrive Layer 3 staleness linter.
//
// Per the spec (VERIFICATION-HYPERDRIVE-spec.md):
//   - valid_through < today → FAIL (blocking)
//   - valid_through < today + 30d → WARN
//   - valid_through == null past a review interval → WARN-FOR-REVIEW
//   - citation URLs are hygiene-checked (resolve / 200) by a separate
//     network-touching test; this lint is offline-only.
//
// CI wires this as `pnpm --filter @civica/snap-rules run lint:registry`.
// Failures block merge per the spec acceptance criterion.

import { loadRegistry } from "./load";

const WARN_WINDOW_DAYS = 30;
const NULL_VALID_THROUGH_WARN_DAYS = 365;

interface LintFinding {
  level: "FAIL" | "WARN" | "INFO";
  id: string;
  message: string;
}

export function lintRegistry(asOf: Date = new Date()): LintFinding[] {
  const findings: LintFinding[] = [];
  const today = new Date(Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth(),
    asOf.getUTCDate(),
  ));
  const warnCutoff = new Date(today.getTime() + WARN_WINDOW_DAYS * 86_400_000);

  const map = loadRegistry();
  for (const [id, entry] of map) {
    // Staleness check on valid_through.
    if (entry.valid_through !== null) {
      const expiry = new Date(entry.valid_through);
      if (Number.isNaN(expiry.getTime())) {
        findings.push({
          level: "FAIL",
          id,
          message: `Unparseable valid_through: ${entry.valid_through}`,
        });
        continue;
      }
      if (expiry < today) {
        findings.push({
          level: "FAIL",
          id,
          message: `EXPIRED ${entry.valid_through} (today ${today.toISOString().slice(0, 10)}) — refetch primary source: ${entry.source_url}`,
        });
      } else if (expiry < warnCutoff) {
        const daysLeft = Math.ceil(
          (expiry.getTime() - today.getTime()) / 86_400_000,
        );
        findings.push({
          level: "WARN",
          id,
          message: `Expires in ${daysLeft} days (${entry.valid_through}) — refresh primary source before then: ${entry.source_url}`,
        });
      }
    } else {
      // null valid_through — citation entries usually carry this (CFR
      // sections don't expire). Citations can stay null. For constants
      // and booleans with null expiry, warn after the review interval.
      if (entry.type !== "citation" && entry.effective_date !== null) {
        const effectivelyOld = new Date(entry.effective_date);
        const reviewBy = new Date(
          effectivelyOld.getTime() + NULL_VALID_THROUGH_WARN_DAYS * 86_400_000,
        );
        if (today > reviewBy) {
          findings.push({
            level: "WARN",
            id,
            message: `Non-citation entry with null valid_through past ${NULL_VALID_THROUGH_WARN_DAYS}-day review interval. Confirm or set valid_through.`,
          });
        }
      }
    }
  }
  return findings;
}

// CLI entry: print findings + exit non-zero on FAIL.
async function main(): Promise<void> {
  const findings = lintRegistry();
  for (const f of findings) {
    const icon = f.level === "FAIL" ? "✗" : f.level === "WARN" ? "⚠" : "ℹ";
    // eslint-disable-next-line no-console
    console.log(`${icon} [${f.level}] ${f.id}: ${f.message}`);
  }
  const failCount = findings.filter((f) => f.level === "FAIL").length;
  const warnCount = findings.filter((f) => f.level === "WARN").length;
  // eslint-disable-next-line no-console
  console.log(
    `\n[registry-lint] ${failCount} FAIL, ${warnCount} WARN, ${findings.length - failCount - warnCount} INFO`,
  );
  process.exit(failCount > 0 ? 1 : 0);
}

// Only run when invoked directly via tsx.
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
