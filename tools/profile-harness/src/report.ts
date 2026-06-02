// Markdown report writer. The report's headline is per-element pass-rate
// (not an aggregate — that hides which rule area regressed). Safety
// sections (must_reject, negative_control) get their own headers.

import type { HarnessRunSummary, ProfileResult } from "./types.ts";

export function renderMarkdownReport(s: HarnessRunSummary): string {
  const lines: string[] = [];

  lines.push(`# Civica SNAP profile-harness report`);
  lines.push("");
  lines.push(`- Suite: v${s.suite_version}`);
  lines.push(`- State: \`${s.state}\``);
  lines.push(`- Engine: \`${s.engine}\``);
  lines.push(`- Generated: ${s.generated_at_iso}`);
  lines.push("");

  // ─── PARAMS_MISMATCH banner ───────────────────────────────────────────
  if (s.params_mismatch) {
    lines.push(`## ⚠ PARAMS_MISMATCH`);
    lines.push("");
    lines.push(
      "Engine constants do NOT match the oracle's `meta.params`. Benefit assertions were SKIPPED for this run; verdicts only.",
    );
    lines.push("");
    lines.push("| Field | Oracle | Engine |");
    lines.push("|---|---|---|");
    for (const d of s.params_mismatch.diffs.slice(0, 20)) {
      lines.push(`| \`${d.field}\` | \`${fmt(d.oracle)}\` | \`${fmt(d.engine)}\` |`);
    }
    if (s.params_mismatch.diffs.length > 20) {
      lines.push(
        `| _(${s.params_mismatch.diffs.length - 20} more diffs)_ |  |  |`,
      );
    }
    lines.push("");
  }

  // ─── Totals ───────────────────────────────────────────────────────────
  lines.push(`## Totals`);
  lines.push("");
  lines.push(
    `${pad("PASS", 6)} ${pad("FAIL", 6)} ${pad("SKIP", 6)} ${pad("TOTAL", 6)}`,
  );
  lines.push(
    `${pad(String(s.totals.pass), 6)} ${pad(String(s.totals.fail), 6)} ${pad(String(s.totals.skip), 6)} ${pad(String(s.totals.total), 6)}`,
  );
  lines.push("");

  // ─── Per-element pass-rate (the headline) ─────────────────────────────
  lines.push(`## Per-element pass rate (the headline)`);
  lines.push("");
  lines.push("`element` is the USDA QC element each profile exercises. An aggregate % hides which rule area regressed; this table doesn't.");
  lines.push("");
  lines.push("| Element | PASS | FAIL | SKIP | Total | Pass rate (of run) |");
  lines.push("|---|---:|---:|---:|---:|---:|");
  for (const e of s.per_element) {
    const ran = e.pass + e.fail;
    const rate = ran > 0 ? `${Math.round((100 * e.pass) / ran)}%` : "—";
    lines.push(
      `| \`${e.element}\` | ${e.pass} | ${e.fail} | ${e.skip} | ${e.total} | ${rate} |`,
    );
  }
  lines.push("");

  // ─── Must-reject (safety) ─────────────────────────────────────────────
  if (s.must_reject_results.length > 0) {
    lines.push(`## must_reject scenarios — engine MUST return DENY`);
    lines.push("");
    lines.push(`A miss here is high-severity (the engine approved someone it should have rejected).`);
    lines.push("");
    renderResultList(s.must_reject_results, lines);
  }

  // ─── Negative controls ────────────────────────────────────────────────
  if (s.negative_control_results.length > 0) {
    lines.push(`## negative_control scenarios — engine MUST NOT count excluded inputs`);
    lines.push("");
    renderResultList(s.negative_control_results, lines);
  }

  // ─── Fails ────────────────────────────────────────────────────────────
  if (s.fails.length > 0) {
    lines.push(`## Failures (engine ≠ oracle)`);
    lines.push("");
    lines.push(`| ID | Element | Expected | Actual | Detail | Citation |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const r of s.fails) {
      lines.push(
        `| \`${r.legacy_id}\` ${r.label} | \`${r.error_element ?? ""}\` | \`${r.expected_verdict ?? ""}\`${r.expected_benefit != null ? ` $${r.expected_benefit}` : ""} | \`${r.actual_verdict ?? ""}\`${r.actual_benefit != null ? ` $${r.actual_benefit}` : ""} | ${r.failure_detail ?? ""} | ${r.citation ?? ""} |`,
      );
    }
    lines.push("");
  }

  // ─── Roadmap: surfaces blocking the most profiles ─────────────────────
  if (s.skip_surfaces.size > 0) {
    lines.push(`## Engine completion roadmap`);
    lines.push("");
    lines.push(
      "Each row = an engine surface that, if implemented, unlocks N currently-SKIPped profiles.",
    );
    lines.push("");
    lines.push(`| Surface | Profiles blocked |`);
    lines.push(`|---|---:|`);
    const sorted = [...s.skip_surfaces.entries()].sort((a, b) => b[1] - a[1]);
    for (const [surface, count] of sorted.slice(0, 20)) {
      lines.push(`| \`${surface}\` | ${count} |`);
    }
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

function renderResultList(rs: ProfileResult[], lines: string[]): void {
  lines.push(`| ID | Verdict (expected→actual) | Result | Citation |`);
  lines.push(`|---|---|---|---|`);
  for (const r of rs) {
    const verdict = r.expected_verdict
      ? `${r.expected_verdict} → ${r.actual_verdict ?? "?"}`
      : "—";
    lines.push(
      `| \`${r.legacy_id}\` ${r.label} | ${verdict} | ${r.kind} | ${r.citation ?? ""} |`,
    );
  }
  lines.push("");
}

function pad(s: string, w: number): string {
  return s.padEnd(w);
}

function fmt(v: unknown): string {
  if (v === undefined) return "(not set)";
  if (v === null) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
