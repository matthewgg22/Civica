// Regression: #830 — BBCE-conferred households always skipped the net
// income test, which is correct for most BBCE states but WRONG for a real
// minority (TN/CT/KY confirmed) whose own manuals keep a net-income
// ceiling ON TOP of the (possibly raised) BBCE gross screen instead of
// waiving it. See the `bbce_net_ceiling_pct` axis on `StatePolicy`
// (packages/snap-rules/src/constants/states.ts) and its wiring in
// `composeVerdict` (packages/snap-rules/src/verdict.ts).
//
// Household: MX4-bbce-max-income-with-any-benefit, the exact profile
// v0.6.json's oracle already uses to demonstrate this gap (HH3, $4,440/mo
// wages, HCSUA=$663, rent=$800). Gross clears every 200%-BBCE state's
// raised screen; net income (after the deduction stack) exceeds the
// ordinary 100% FPL net ceiling.
//
// Pre-fix behavior (what this test guards against regressing to): CT's
// `bbceConferred` flag suppressed the net test entirely once the $4,440
// gross cleared CT's 200% screen, producing an incorrect APPROVE. CT DSS's
// own ECE-excluded-factors list never excludes the net income limit (only
// RCE's list does) — CT's real policy is DENY here, which the fix restores.
//
// CA is the negative control: CA has no net-ceiling quirk
// (`bbce_net_ceiling_pct` is unset/null, the default for all states except
// TN/CT/KY), so the SAME household must still APPROVE under CA — proving
// the fix is additive and does not touch any state that didn't opt in.

import { describe, expect, it } from "vitest";
import { composeVerdict } from "../src/verdict";
import type { Facts } from "../src/facts";

const AS_OF = new Date(Date.UTC(2026, 5, 1)); // 2026-06-01, matches MX4's as_of_date

const MX4_FACTS: Facts = {
  household: [
    {
      member_id: "m1",
      age: 35,
      role: "head",
      immigration: "citizen",
      work_class: "gen_work_subject",
    },
    { member_id: "m2", age: 8, role: "child", immigration: "citizen" },
    { member_id: "m3", age: 10, role: "child", immigration: "citizen" },
  ],
  income: [{ member: "m1", type: "wages", amount: 4440, freq: "monthly" }],
  shelter: {
    rent: 800,
    sua_tier: "HCSUA",
    sua_amount: 663,
    internet: 0,
    homeless_deduction: false,
  },
  deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
  assets: 500,
  cat_elig: "NPA",
} as Facts;

describe("#830 — BBCE dual gross+net ceiling (TN/CT/KY)", () => {
  it("CT: MX4 DENIES — net income exceeds CT's 100% FPL ceiling despite clearing the 200% BBCE gross screen", () => {
    const result = composeVerdict(MX4_FACTS, "CT", AS_OF);
    expect(result.verdict).toBe("DENY");
    expect(result.trace?.net_income_test).toBeTruthy();
    expect((result.trace?.net_income_test as any).passes).toBe(false);
  });

  it("CA: the SAME household still APPROVEs — bbce_net_ceiling_pct is unset for CA, so behavior is unchanged (regression guard for the additive default)", () => {
    const result = composeVerdict(MX4_FACTS, "CA", AS_OF);
    expect(result.verdict).toBe("APPROVE");
    // CA is a plain BBCE state with no net-ceiling quirk — the net test
    // must never even run for a BBCE-conferred CA household.
    expect(result.trace?.net_income_test).toBeUndefined();
  });

  it("KY: net ceiling enforcement is wired (trace.net_income_test present for a BBCE-conferred household) but changes no currently-authored KY oracle verdict", () => {
    // KY's BBCE gross threshold is only 130% (not 200%), so MX4's $4,440
    // gross fails KY's gross screen outright — DENY here is a gross-test
    // DENY, not evidence of the net-ceiling fix. Use a smaller household
    // that clears KY's 130% screen instead, to prove the net-ceiling
    // enforcement mechanism itself runs and passes cleanly.
    const kyFacts: Facts = {
      ...MX4_FACTS,
      income: [{ member: "m1", type: "wages", amount: 1200, freq: "monthly" }],
    };
    const result = composeVerdict(kyFacts, "KY", AS_OF);
    expect(result.trace?.net_income_test).toBeTruthy();
    expect((result.trace?.net_income_test as any).passes).toBe(true);
    expect(result.verdict).toBe("APPROVE");
  });
});
