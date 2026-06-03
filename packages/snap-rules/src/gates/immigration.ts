// Immigration eligibility (7 CFR 273.4; FNA 6(f); OBBBA §10108).
//
// Per-member status dispatch:
//   citizen                         → eligible (always)
//   lpr + five_yr_bar exempt        → eligible (40-quarter or humanitarian exemption)
//   lpr + five_yr_bar "n/a"         → eligible (no bar applies — already 5+ years)
//   lpr + five_yr_bar numeric       → ineligible during bar window
//   cofa                            → eligible (Compact of Free Association — retained post-OBBBA §10108)
//   refugee                         → eligible (pre-OBBBA classification)
//   removed_status:refugee          → ineligible (OBBBA §10108 removed humanitarian retention pre-LPR adjustment)
//   undocumented                    → ineligible
//
// HH-level: if NO member is eligible → DENY. If SOME (mixed-status, e.g. M18)
// → APPROVE; the ineligible member's income is counted in full per 7 CFR
// 273.11(c)(3)(i) — "the State agency must count all... of the ineligible
// alien's income." That section permits a count-all-but-pro-rata-share
// alternative at state discretion; CA's CalFresh handbook §63-503.481
// elects count-all (verified via the v0.6 fixture M18: oracle $591 only
// matches a count-all + full-HH-size benefit calc). HH size for max
// allotment and standard deduction is `facts.household.length` — the
// ineligible alien remains a household member for shelter/SUA/HH-size
// purposes; only their *participant* status is removed. If a state-option
// pro-rata election is added later, branch in benefit-calc on
// `policy.alien_income_treatment`.
//
// Sponsor deeming: if `member.sponsored === true` AND `facts.sponsor_income`
// is set, the sponsor income is deemed to the household — implemented in
// aggregateIncome via composer hook (verdict.ts).

import type { Facts, Member } from "../facts";

export interface ImmigrationResult {
  passes: boolean;
  /** Member IDs that are eligible (used by proration math; v1 just counts). */
  eligible_member_ids: string[];
  reason?: string;
}

export function memberImmigrationEligible(m: Member, asOf: Date): boolean {
  const imm = m.immigration ?? "citizen";
  if (imm === "citizen") return true;
  if (imm === "cofa") return true;
  if (imm === "lpr") {
    const bar = m.five_yr_bar ?? "n/a";
    if (bar === "n/a") return true;
    if (bar.startsWith("exempt:")) return true;
    // Numeric: years remaining of 5-yr bar.
    if (/^\d+(\.\d+)?$/.test(bar)) {
      // Member is in their bar window → ineligible.
      return false;
    }
    // Default conservative: eligible (5+ years assumed).
    return true;
  }
  if (imm === "refugee") {
    // OBBBA P.L. 119-21 §10108: refugees in refugee status (pre-LPR
    // adjustment) are no longer eligible for SNAP. Effective date is
    // ENACTMENT (2025-07-04), per FNS implementing memo dated
    // 2025-10-31. Verbatim from the memo's Attachment 1:
    //   "Refugees | Post-OBBB Eligibility: Not eligible."
    // Source URL: https://www.fns.usda.gov/snap/obbb-alien-eligibility
    // Verified 2026-06-03 via outside reviewer fetch.
    //
    // PRIOR BUG: cutoff was set to 2025-11-01 (the 120-day FNS
    // hold-harmless window deadline). That date is when state agencies
    // were required to fully implement, not when the rule took effect.
    // The statutory effective date is 2025-07-04.
    //
    // NUANCE: a member who entered as a refugee but ADJUSTED to LPR
    // status is still eligible with no 5-year wait, per the PRWORA
    // 5-year-bar exemptions preserved by OBBBA (FNS clarification
    // dated 2025-12-09). Such members are encoded as `lpr` with
    // `five_yr_bar = "exempt:humanitarian"` or similar (see profile
    // A10 "Refugee adjusted to LPR" — verified APPROVE post-fix);
    // they hit the `imm === "lpr"` branch above, not this one.
    const obbbaCutoff = new Date(Date.UTC(2025, 6, 4));
    return asOf < obbbaCutoff;
  }
  if (imm.startsWith("removed_status:")) return false;
  if (imm === "undocumented") return false;
  // Unknown → conservatively ineligible.
  return false;
}

export function evaluateImmigration(facts: Facts, asOf: Date): ImmigrationResult {
  const eligible = facts.household.filter((m) => memberImmigrationEligible(m, asOf));
  if (eligible.length === 0) {
    return {
      passes: false,
      eligible_member_ids: [],
      reason: "no_eligible_household_member [7 CFR 273.4; FNA 6(f)]",
    };
  }
  return {
    passes: true,
    eligible_member_ids: eligible.map((m) => m.member_id),
  };
}

/** True if any member is sponsored — composer adds sponsor_income then. */
export function anySponsored(facts: Facts): boolean {
  return facts.household.some((m) => m.sponsored === true);
}
