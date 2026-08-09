// ABAWD work requirement gate (7 CFR 273.24, as amended by OBBBA §10102).
//
// The v0.6 fixture encodes ABAWD status in the member's `work_class`:
//   "gen_work_subject"                — not ABAWD-subject
//   "abawd_subject"                   — subject, no exemption
//   "abawd_exempt:<reason>"           — subject category but exempt
//      common reasons:
//        disabled, caregiver_incapacitated, veteran_homeless (pre-OBBBA only)
//   "exempt:<reason>"                 — not subject for non-ABAWD reasons
//      e.g. exempt:caregiver_incapacitated
//
// And the time-limit clock in `abawd_months_used` (0-3). Subject members
// who have used ≥3 of 36 months without meeting the 80-hour rule are
// disqualified for the remainder of the cycle.
//
// OBBBA §10102 effective 2025-11-01 (the M14 variant key):
//   - veteran_homeless exemption REMOVED
//   - age cap raised 54→64 (handled in age check below)
//   - Tribal exemption introduced (handled via work_class:abawd_exempt:tribal)

import type { Facts } from "../facts";
import { statePolicyFor } from "../constants/states";
import { waiverCountiesFor } from "../work-requirements/waiver-counties";

// Exemption reasons that rest on the member's AREA being waived rather than on
// anything personal (7 CFR 273.24(f) — waivers for areas with insufficient
// jobs). These are the only reasons state waiver availability can invalidate.
const WAIVER_EXEMPTION_REASONS = new Set(["waiver", "waiver_county", "waived_area"]);

/**
 * True only when we AFFIRMATIVELY know the household's specific AREA holds
 * no ABAWD waiver — the precise, county-level answer (#614).
 *
 * Two-tier resolution, in order:
 *   1. County-level: if `county_fips` is given AND the state has an authored
 *      county-waiver set (currently CA and MA — see waiverCountiesFor), the
 *      real answer is "is this exact county in that set." This is the only
 *      path that can say "true" for a household in one of CA's 51
 *      non-waived counties without also wrongly denying the 7 that ARE
 *      waived — a state-level boolean cannot express that distinction.
 *   2. State-level fallback: no county given, or the state has no county
 *      data authored — falls back to the original abawd_waiver_avail
 *      boolean, UNCHANGED from before this field existed.
 *
 * Direction of error is still deliberate at every tier: anything we can't
 * affirmatively resolve returns false, so the exemption stands. Stripping
 * an exemption denies food, and we will not do that on an unresolved case.
 */
function areaOffersNoWaiver(state: string | undefined, countyFips: string | undefined): boolean {
  if (!state) return false;
  const countySet = waiverCountiesFor(state);
  if (countyFips && countySet) {
    // We have BOTH the household's county AND this state's real waiver
    // geography — the county-level answer is authoritative, full stop. Does
    // not fall through to the state-level boolean even when it disagrees;
    // that boolean exists precisely because it CAN'T express this.
    return !countySet.has(countyFips);
  }
  try {
    return statePolicyFor(state).abawd_waiver_avail === false;
  } catch {
    return false; // UnknownStateError — stay conservative
  }
}

export interface AbawdResult {
  passes: boolean;
  /** "subject", "exempt", "not_subject", "time_exhausted" */
  status: "subject" | "exempt" | "not_subject" | "time_exhausted";
  reason?: string;
}

const OBBBA_EFFECTIVE = new Date(Date.UTC(2025, 10, 1));

/**
 * Per-member ABAWD evaluation. The gate is satisfied iff every household
 * applicant either is not ABAWD-subject OR is exempt OR has not exhausted
 * the 3-month clock. Any single applicant who has exhausted with no
 * exemption fails the gate.
 *
 * Federal age bands per OBBBA §10102(a) (eff. 2025-07-04):
 *   - pre-OBBBA: ABAWD ages 18-49 (federal default) → 50-54 also subject under prior amendments
 *   - post-2025-07-04: ABAWD ages 18-64
 */
export function evaluateAbawd(facts: Facts, asOf: Date, state?: string): AbawdResult {
  // A waiver exemption is only real where the household's actual AREA holds
  // a waiver (7 CFR 273.24(f)). Optional + fail-open: omit `state` (and/or
  // county_fips), or pass a state that isn't registered, and nothing
  // changes. See #608, #614.
  const noWaiverHere = areaOffersNoWaiver(state, facts.county_fips);
  // Post-OBBBA the veteran_homeless exemption is gone.
  const veteranHomelessExempt = asOf < OBBBA_EFFECTIVE;
  // Post-OBBBA the age ceiling is 64 (was 49/54 prior).
  const ceiling = asOf < OBBBA_EFFECTIVE ? 49 : 64;

  for (const m of facts.household) {
    // Heads-only ABAWD evaluation for single-applicant profiles; multi-
    // member needs richer model (Wave 2). For now, evaluate any
    // explicitly-ABAWD-subject member.
    const wc = m.work_class ?? "";

    if (wc === "gen_work_subject" || wc.startsWith("exempt:")) {
      // Not ABAWD-subject by classification.
      continue;
    }

    if (wc.startsWith("abawd_exempt:")) {
      // Specific exemptions; veteran_homeless is the OBBBA-removed one.
      const reason = wc.slice("abawd_exempt:".length);
      if (reason === "veteran_homeless" && !veteranHomelessExempt) {
        // Post-OBBBA: exemption removed → member is now subject.
        // Continue to time-limit check below.
      } else if (WAIVER_EXEMPTION_REASONS.has(reason) && noWaiverHere) {
        // Area-based exemption claimed in a state that holds no waiver — the
        // premise can't hold, so the member stays subject to the time limit.
        // Personal exemptions (disability, tribal, caretaker…) are untouched:
        // they don't depend on where the household lives.
      } else {
        // Exemption still applies → member doesn't count against gate.
        continue;
      }
    }

    if (wc !== "abawd_subject" && !wc.startsWith("abawd_exempt:")) {
      // Unknown work_class — be conservative, treat as not subject.
      continue;
    }

    // Age bracket: under 18 or over ceiling → not subject.
    if (m.age < 18 || m.age > ceiling) continue;

    // Time-limit check: subject + months_used ≥ 3 in 36-month window.
    const used = m.abawd_months_used ?? 0;
    if (used >= 3) {
      return {
        passes: false,
        status: "time_exhausted",
        reason: `abawd_time_limit_exhausted [7 CFR 273.24]: ${m.member_id} used ${used} months`,
      };
    }
  }
  return { passes: true, status: "not_subject" };
}
