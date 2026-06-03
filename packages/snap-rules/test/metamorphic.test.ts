// Verification-hyperdrive Layer 1a — metamorphic relations.
//
// Per the spec: tests prove the engine is self-consistent under
// transformation. They do NOT prove correctness. An engine using a
// wrong SUA table can still be monotone. Absolute correctness is
// covered by Layer 2 (PolicyEngine pairing) + worked-example goldens.
//
// What this suite gives: a fast, oracle-free check that catches the
// recurring bug classes (monotonicity violations, nondeterminism) that
// have bitten this engine in prior sessions.
//
// Relations in v0:
//   M1 — Unearned-income monotonicity (raise unearned → benefit non-increasing)
//   M2 — Earned > unearned signature (equal gross, earned ≥ unearned)
//   M3 — Determinism / idempotence (same input twice → identical output)

import { describe, expect, it } from "vitest";
import { composeVerdict } from "../src/verdict";
import type { Facts } from "../src/facts";

// ─── Seed corpus (G1: in-model, schema-valid) ─────────────────────────────
//
// Hand-authored base profiles spanning HH size + composition + state.
// Each transformation is applied to every base; that gives us
// (relations × bases × variants) assertions per run without the
// twin-consistency leak of generating from the engine's Zod schema.

interface SeedBase {
  label: string;
  state: "CA" | "MA";
  asOf: Date;
  facts: Facts;
}

const ASOF = new Date(Date.UTC(2026, 5, 1));

const SEED_BASES: SeedBase[] = [
  {
    label: "ca_hh1_earned_only",
    state: "CA",
    asOf: ASOF,
    facts: {
      household: [
        { member_id: "m1", age: 30, role: "head", immigration: "citizen", work_class: "gen_work_subject" },
      ],
      income: [{ member: "m1", type: "wages", amount: 1000, freq: "monthly" }],
      shelter: { rent: 700, sua_tier: "HCSUA", sua_amount: 663, internet: 0, homeless_deduction: false },
      deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
      assets: 200,
      cat_elig: "NPA",
    } as Facts,
  },
  {
    label: "ca_hh3_earned_low",
    state: "CA",
    asOf: ASOF,
    facts: {
      household: [
        { member_id: "m1", age: 35, role: "head", immigration: "citizen", work_class: "gen_work_subject" },
        { member_id: "m2", age: 8, role: "child", immigration: "citizen" },
        { member_id: "m3", age: 10, role: "child", immigration: "citizen" },
      ],
      income: [{ member: "m1", type: "wages", amount: 1500, freq: "monthly" }],
      shelter: { rent: 1000, sua_tier: "HCSUA", sua_amount: 663, internet: 0, homeless_deduction: false },
      deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
      assets: 300,
      cat_elig: "NPA",
    } as Facts,
  },
  {
    label: "ma_hh2_earned",
    state: "MA",
    asOf: ASOF,
    facts: {
      household: [
        { member_id: "m1", age: 40, role: "head", immigration: "citizen", work_class: "gen_work_subject" },
        { member_id: "m2", age: 38, role: "spouse", immigration: "citizen", work_class: "gen_work_subject" },
      ],
      income: [{ member: "m1", type: "wages", amount: 1800, freq: "monthly" }],
      shelter: { rent: 1100, sua_tier: "HCSUA", sua_amount: 914, internet: 0, homeless_deduction: false },
      deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
      assets: 500,
      cat_elig: "NPA",
    } as Facts,
  },
  {
    label: "ca_hh2_mixed_low_income",
    state: "CA",
    asOf: ASOF,
    facts: {
      household: [
        { member_id: "m1", age: 30, role: "head", immigration: "citizen", work_class: "gen_work_subject" },
        { member_id: "m2", age: 4, role: "child", immigration: "citizen" },
      ],
      income: [{ member: "m1", type: "wages", amount: 800, freq: "monthly" }],
      shelter: { rent: 600, sua_tier: "HCSUA", sua_amount: 663, internet: 0, homeless_deduction: false },
      deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
      assets: 100,
      cat_elig: "NPA",
    } as Facts,
  },
];

function benefit(state: string, asOf: Date, facts: Facts): number | null {
  const result = composeVerdict(facts, state, asOf);
  return result.verdict === "APPROVE" ? (result.benefit ?? null) : 0;
}

// ─── M1 — Unearned-income monotonicity ────────────────────────────────────

describe("M1 — Unearned-income monotonicity", () => {
  for (const base of SEED_BASES) {
    it(`raising unearned income never increases benefit (${base.label})`, () => {
      const factsLower = JSON.parse(JSON.stringify(base.facts)) as Facts;
      factsLower.income.push({
        member: "m1",
        type: "unearned_rsdi",
        amount: 200,
        freq: "monthly",
      });
      const factsHigher = JSON.parse(JSON.stringify(base.facts)) as Facts;
      factsHigher.income.push({
        member: "m1",
        type: "unearned_rsdi",
        amount: 400,
        freq: "monthly",
      });
      const bLower = benefit(base.state, base.asOf, factsLower);
      const bHigher = benefit(base.state, base.asOf, factsHigher);
      expect(bLower).not.toBeNull();
      expect(bHigher).not.toBeNull();
      // benefit non-increasing as unearned rises
      expect(bHigher!).toBeLessThanOrEqual(bLower!);
    });
  }
});

// ─── M2 — Earned > unearned signature ─────────────────────────────────────
//
// Equal gross. All-earned should produce benefit ≥ all-unearned because
// of the 20% earned-income deduction (7 CFR 273.9(d)(2)). Most
// distinctive SNAP arithmetic — explicitly test it.

describe("M2 — Earned vs unearned signature (equal gross)", () => {
  for (const base of SEED_BASES) {
    it(`equal-gross earned-only benefit >= unearned-only benefit (${base.label})`, () => {
      const grossAmount = 1200; // standardize for comparability
      const factsEarned = JSON.parse(JSON.stringify(base.facts)) as Facts;
      factsEarned.income = [
        { member: "m1", type: "wages", amount: grossAmount, freq: "monthly" },
      ];
      const factsUnearned = JSON.parse(JSON.stringify(base.facts)) as Facts;
      factsUnearned.income = [
        { member: "m1", type: "unearned_rsdi", amount: grossAmount, freq: "monthly" },
      ];
      const bEarned = benefit(base.state, base.asOf, factsEarned);
      const bUnearned = benefit(base.state, base.asOf, factsUnearned);
      expect(bEarned).not.toBeNull();
      expect(bUnearned).not.toBeNull();
      // Earned-income deduction (20%) means equal-gross earned-only
      // produces a smaller adjusted income → smaller net → larger benefit.
      expect(bEarned!).toBeGreaterThanOrEqual(bUnearned!);
    });
  }
});

// ─── M3 — Determinism / idempotence ───────────────────────────────────────

describe("M3 — Determinism", () => {
  for (const base of SEED_BASES) {
    it(`same input twice → identical verdict + benefit (${base.label})`, () => {
      const first = composeVerdict(base.facts, base.state, base.asOf);
      const second = composeVerdict(
        JSON.parse(JSON.stringify(base.facts)) as Facts,
        base.state,
        base.asOf,
      );
      expect(second.verdict).toBe(first.verdict);
      expect(second.benefit).toBe(first.benefit);
      // Also: as_of-only mutation: same date passed twice yields same
      // verdict regardless of Date object identity.
      const third = composeVerdict(
        JSON.parse(JSON.stringify(base.facts)) as Facts,
        base.state,
        new Date(base.asOf.getTime()),
      );
      expect(third.verdict).toBe(first.verdict);
      expect(third.benefit).toBe(first.benefit);
    });
  }
});
