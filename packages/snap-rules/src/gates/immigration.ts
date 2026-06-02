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
// → APPROVE; benefit may be prorated (proration math deferred to Wave 2.5).
//
// Sponsor deeming: if `member.sponsored === true` AND `facts.sponsor_income`
// is set, the sponsor income is deemed to the household — implemented in
// aggregateIncome via composer hook (verdict.ts).

import type { Facts, Member } from "../facts.ts";

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
    // Pre-OBBBA classification retained eligibility; OBBBA removed
    // the standalone refugee category (members must adjust to LPR).
    // The fixture uses `removed_status:refugee` to encode post-cutoff
    // ineligibility, so a bare "refugee" status here predates the cutoff.
    const obbbaCutoff = new Date(Date.UTC(2025, 10, 1));
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
