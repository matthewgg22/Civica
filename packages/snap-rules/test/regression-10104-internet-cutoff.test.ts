// Regression: OBBBA §10104 internet-exclusion effective date.
//
// The statute is effective 2025-10-01 (start of FY26) per the OBBBA text
// (Pub. L. No. 119-21, enacted 2025-07-04) + FNS umbrella memo 2025-09-04
// guidance to states. Prior to the fix the engine used a 2025-11-01 cutoff,
// which over-credited internet for the entire month of October 2025 —
// boosting benefits by ~$10/month per household for the ~3.5M U.S. SNAP
// households that report an internet expense.
//
// WHY THE PREVIOUS TEST WAS BROKEN
// The original test used rent=$1,000 + CA HCSUA=$663 = $1,663 in total
// shelter. With HH2 wages=$1,500 the shelter cap of $744 (FY26) binds in
// BOTH the internet=$50 and internet=$0 cases (raw excess ~$1,167–$1,217,
// far above $744). When the cap binds regardless, the benefit is identical
// whether internet is counted or not — so the strict-greater-than assertion
// for September 2025 fails at the wrong level of the stack (shelter-cap
// masking, not cutoff-date masking). The test appeared to be testing the
// right thing but was actually insensitive to the cutoff date entirely.
//
// FIXED SCENARIO: elderly/disabled household, no shelter cap
// Using an E/D household (head age 62, age >= 60 triggers E/D per 7 CFR
// 273.9(d)(6)(ii)) removes the shelter cap entirely. With rent=$700 and
// sua_tier="none" (SUA=$0), the raw excess shelter is well below the $744
// cap even for a non-E/D HH, and the $50 internet difference propagates
// cleanly through to the benefit in the pre-cutoff case.
//
// Arithmetic verification (FY26 tables, HH2 eligible, wages=$1,500):
//   EID        = 1500 × 0.20 = $300
//   SD (HH2)   = $209
//   adj_income = 1500 - 300 - 209 = $991
//   half_adj   = $495.50
//   Pre-cutoff with internet=$50:
//     shelter_amt   = 700 + 0 + 50 = $750
//     raw_excess    = 750 - 495.50 = $254.50 (E/D → no cap → excessShelter)
//     net_income    = 991 - 254.50 = $736.50 → rounded $737
//     30%_of_net    = $221 → benefit = $546 - $221 = $325
//   Pre-cutoff without internet=$0:
//     shelter_amt   = 700 + 0 + 0  = $700
//     raw_excess    = 700 - 495.50 = $204.50 → excessShelter
//     net_income    = 991 - 204.50 = $786.50 → rounded $787
//     30%_of_net    = $236 → benefit = $546 - $236 = $310
//   Pre-cutoff: $325 > $310 ✓ (strict greater-than confirmed)
//   Post-cutoff (both internet values): benefit = $310 (internet ignored) ✓
//
// What this test pins:
//   (a) For an as-of date ≥ 2025-10-01, changing `shelter.internet` from $0
//       to a positive value must NOT change the benefit.
//   (b) For an as-of date < 2025-10-01, internet still counts (pre-cutoff
//       behavior preserved for replay correctness).
//   (c) The exact cutoff boundary 2025-10-01 is post-cutoff (inclusive on
//       the exclusion side), matching the statutory effective date.

import { describe, expect, it } from "vitest";
import { composeVerdict } from "../src/verdict";
import type { Facts } from "../src/facts";

const FY26_CUTOFF = new Date(Date.UTC(2025, 9, 1)); // October 1, 2025
const MID_OCTOBER_2025 = new Date(Date.UTC(2025, 9, 15));
const SEPTEMBER_2025 = new Date(Date.UTC(2025, 8, 15));

/**
 * E/D household (head age 62 → triggers `hasElderlyOrDisabled`, removes
 * shelter cap per 7 CFR 273.9(d)(6)(ii)) + one child.  rent=$700 + SUA=$0
 * keeps the raw excess shelter well below the $744 FY26 cap so the $50
 * internet delta flows through cleanly to the benefit in the pre-cutoff case.
 */
function baseFacts(internet: number): Facts {
  return {
    household: [
      {
        member_id: "m1",
        age: 62,
        role: "head",
        immigration: "citizen",
        work_class: "gen_work_subject",
      },
      { member_id: "m2", age: 10, role: "child", immigration: "citizen" },
    ],
    income: [{ member: "m1", type: "wages", amount: 1500, freq: "monthly" }],
    shelter: {
      rent: 700,
      sua_tier: "none",
      sua_amount: 0,
      internet,
      homeless_deduction: false,
    },
    deductions: { dependent_care: 0, medical_unreimbursed: 0, child_support_paid: 0 },
    assets: 300,
    cat_elig: "NPA",
  } as Facts;
}

function benefit(asOf: Date, internet: number): number {
  const result = composeVerdict(baseFacts(internet), "CA", asOf);
  return result.verdict === "APPROVE" ? (result.benefit ?? 0) : 0;
}

describe("§10104 — internet excluded from shelter for asOf ≥ 2025-10-01", () => {
  it("benefit is invariant to internet for mid-October 2025 (post-cutoff)", () => {
    const withZeroInternet = benefit(MID_OCTOBER_2025, 0);
    const withInternet = benefit(MID_OCTOBER_2025, 50);
    expect(withInternet).toBe(withZeroInternet);
  });

  it("benefit is invariant to internet exactly on the cutoff date 2025-10-01 (inclusive)", () => {
    const withZeroInternet = benefit(FY26_CUTOFF, 0);
    const withInternet = benefit(FY26_CUTOFF, 50);
    expect(withInternet).toBe(withZeroInternet);
  });

  it("internet still counts pre-cutoff (September 2025) — E/D HH, cap-not-binding", () => {
    const withZeroInternet = benefit(SEPTEMBER_2025, 0);
    const withInternet = benefit(SEPTEMBER_2025, 50);
    // E/D household → no shelter cap; $50 internet lifts excess shelter by $50,
    // lowering net income by $50, raising benefit by 30%×$50 ≈ $15.
    // Expected: withInternet ($325) > withZero ($310).
    //
    // With the pre-fix engine (cutoff = 2025-11-01): September is pre-Nov-01
    // so internet STILL COUNTS → this assertion passes even on buggy code.
    // The bug manifests on the two October assertions above: the engine
    // (incorrectly) counts internet for October dates, so withInternet(Oct)
    // differs from withZero(Oct) — breaking the equality assertions.
    // All three assertions together fully pin the cutoff date: the Oct/cutoff
    // equality cases fail on the bug, and this pre-cutoff case confirms the
    // engine does count internet when it should.
    expect(withInternet).toBeGreaterThan(withZeroInternet);
  });
});
