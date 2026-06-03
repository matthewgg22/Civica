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

    // Worksheets: per-FAIL intermediate values. Defensible in QC review;
    // turns adjudication from session-long hand-math into 5-minute reads.
    // See integrity-fixes-v1 Fix #1.
    const failsWithTrace = s.fails.filter((r) => r.trace != null);
    if (failsWithTrace.length > 0) {
      lines.push(`### Worksheets (engine intermediate values for each failure)`);
      lines.push("");
      lines.push(
        "Per 7 CFR 273.10 + state policy. Use these to decide whether the engine's verdict is defensible against the oracle's expected verdict, without re-computing the math by hand.",
      );
      lines.push("");
      for (const r of failsWithTrace) {
        lines.push(`**${r.legacy_id} — ${r.label}**`);
        lines.push("");
        lines.push(renderWorksheet(r.trace));
        lines.push("");
      }
    }
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

// ─── Worksheet rendering ──────────────────────────────────────────────────
//
// Surfaces the engine's intermediate computation per gate. Pulls from the
// composer's trace object (see packages/snap-rules/src/verdict.ts):
//
//   trace.immigration         — { passes, eligible_member_ids, reason? }
//   trace.disqualifications   — { passes, disqualified_member_ids, reason? }
//   trace.composition         — { passes, reason? }
//   trace.categorical         — { path, skip_gross_test, skip_asset_test }
//   trace.student             — { passes, reason? }
//   trace.abawd               — { passes, reason? }
//   trace.gross_income_test   — { passes, threshold, actual, reason? }
//   trace.asset_test          — { passes, threshold, actual, waived, reason? }
//   trace.benefit_calc        — full BenefitCalcDetail with worksheet
//   trace.net_income_test     — { passes, threshold, actual, reason? }
//
// Per the integrity audit (docs/findings/2026-06-03-ma-audit-clean.md
// Fix #1), the worksheet closes the NEEDS_FACTS gap and makes every
// future audit row a 5-minute adjudication instead of session-long
// hand-math.

function renderWorksheet(trace: Record<string, unknown> | undefined): string {
  if (!trace) return "_(no trace available)_";
  const out: string[] = [];
  const v = (path: string): unknown => {
    const parts = path.split(".");
    let cur: unknown = trace;
    for (const p of parts) {
      if (cur != null && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return undefined;
      }
    }
    return cur;
  };
  const dollar = (x: unknown): string => (typeof x === "number" ? `$${x}` : fmt(x));

  // Quick-glance verdict summary line at the top.
  const bc = trace.benefit_calc as Record<string, unknown> | undefined;
  if (bc) {
    out.push(
      `_Quick-glance:_ gross **${dollar(bc.gross_monthly_income)}** → adj **${dollar(
        (bc.gross_monthly_income as number) -
          (bc.earned_income_deduction as number) -
          (bc.standard_deduction as number) -
          (bc.dependent_care_deduction as number) -
          (bc.medical_deduction as number) -
          (bc.child_support_deduction as number),
      )}** → net **${dollar(bc.net_monthly_income)}** → benefit **${dollar(bc.monthly_benefit)}**`,
    );
    out.push("");
  }

  out.push("| Gate | Result | Citation |");
  out.push("|---|---|---|");

  const imm = v("immigration") as Record<string, unknown> | undefined;
  if (imm) {
    const elig = (imm.eligible_member_ids as string[] | undefined)?.length ?? 0;
    out.push(`| Immigration | ${imm.passes ? "✓" : "✗"} ${elig} eligible member(s) | 7 CFR 273.4; OBBBA §10108 |`);
  }
  const disq = v("disqualifications") as Record<string, unknown> | undefined;
  if (disq) {
    out.push(`| Disqualifications | ${disq.passes ? "✓ none" : "✗ " + (disq.reason ?? "fail")} | 7 CFR 272.17/273.11/273.16 |`);
  }
  const comp = v("composition") as Record<string, unknown> | undefined;
  if (comp) {
    out.push(`| HH composition | ${comp.passes ? "✓" : "✗ " + (comp.reason ?? "fail")} | 7 CFR 273.1 |`);
  }
  const cat = v("categorical") as Record<string, unknown> | undefined;
  if (cat) {
    const path = cat.path ?? "(none)";
    const skipNotes: string[] = [];
    if (cat.skip_gross_test) skipNotes.push("skips gross+net");
    if (cat.skip_asset_test) skipNotes.push("skips asset");
    out.push(`| Categorical eligibility | path=${path}${skipNotes.length ? " (" + skipNotes.join(", ") + ")" : ""} | 7 CFR 273.2(j) |`);
  }
  const stu = v("student") as Record<string, unknown> | undefined;
  if (stu) {
    out.push(`| Student exemption | ${stu.passes ? "✓ exempt or n/a" : "✗ " + (stu.reason ?? "fail")} | 7 CFR 273.5 |`);
  }
  const abawd = v("abawd") as Record<string, unknown> | undefined;
  if (abawd) {
    out.push(`| ABAWD | ${abawd.passes ? "✓" : "✗ " + (abawd.reason ?? "fail")} | 7 CFR 273.24 + OBBBA §10102 |`);
  }
  const gross = v("gross_income_test") as Record<string, unknown> | undefined;
  if (gross) {
    out.push(
      `| Gross income test | ${gross.passes ? "✓" : "✗"} ${dollar(gross.actual)} vs threshold ${dollar(gross.threshold)} | 7 CFR 273.9(a)(1) |`,
    );
  } else if (cat?.skip_gross_test) {
    out.push(`| Gross income test | skipped (cat-elig or E/D net-only path) | 7 CFR 273.10(e)(2)(i)(C) |`);
  }
  const asset = v("asset_test") as Record<string, unknown> | undefined;
  if (asset) {
    if (asset.waived) {
      out.push(`| Asset test | ✓ waived (${asset.reason ?? "policy"}) | 7 CFR 273.8 |`);
    } else {
      out.push(
        `| Asset test | ${asset.passes ? "✓" : "✗"} ${dollar(asset.actual)} vs limit ${dollar(asset.threshold)} | 7 CFR 273.8 |`,
      );
    }
  }
  if (bc) {
    const bcTrace = bc.trace as Record<string, unknown> | undefined;
    const homeless = bcTrace?.homeless_deduction_applied === true;
    const capped = bcTrace?.shelter_capped === true;
    const sua = bcTrace?.state_sua_value;
    out.push(
      `| EID 20% (earned-income deduction) | -${dollar(bc.earned_income_deduction)} | 7 CFR 273.9(d)(2) |`,
    );
    out.push(`| Standard deduction (by HH size) | -${dollar(bc.standard_deduction)} | 7 CFR 273.9(d)(1) |`);
    if ((bc.dependent_care_deduction as number) > 0) {
      out.push(`| Dependent care | -${dollar(bc.dependent_care_deduction)} | 7 CFR 273.9(d)(4) |`);
    }
    if ((bc.medical_deduction as number) > 0) {
      out.push(`| Medical (E/D, above $35 floor) | -${dollar(bc.medical_deduction)} | 7 CFR 273.9(d)(3) |`);
    }
    if ((bc.child_support_deduction as number) > 0) {
      out.push(`| Child support paid | -${dollar(bc.child_support_deduction)} | 7 CFR 273.9(d)(5) |`);
    }
    const shelterCite = homeless
      ? "7 CFR 273.9(d)(6)(i) homeless substitute"
      : capped
        ? "7 CFR 273.9(d)(6) (capped non-E/D)"
        : "7 CFR 273.9(d)(6)";
    const shelterNote = homeless
      ? "homeless substitute"
      : `SUA=${dollar(sua)}${capped ? ", CAPPED" : ""}`;
    out.push(
      `| Excess shelter | -${dollar(bc.excess_shelter_deduction)} (${shelterNote}) | ${shelterCite} |`,
    );
  }
  const net = v("net_income_test") as Record<string, unknown> | undefined;
  if (net) {
    out.push(
      `| Net income test | ${net.passes ? "✓" : "✗"} ${dollar(net.actual)} vs threshold ${dollar(net.threshold)} | 7 CFR 273.9(a)(2) at 100% FPL |`,
    );
  } else if (cat?.skip_gross_test) {
    out.push(
      `| Net income test | skipped (cat-elig or BBCE-conferred — gross < 200% FPL waives net) | 7 CFR 273.2(j) |`,
    );
  }
  if (bc) {
    out.push(
      `| **Final benefit formula** | max_allot ${dollar(bc.max_allotment_for_household_size)} − 30% × net ${dollar(bc.thirty_percent_of_net)} = **${dollar(bc.monthly_benefit)}/mo** | 7 CFR 273.10(e)(2)(ii)(A) |`,
    );
  }
  return out.join("\n");
}
