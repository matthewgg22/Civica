import type { StateCode, SuaTier, UtilityIntake } from "@/types/verification";

// SUA tier rules vary by state. The federal framework provides four
// tiers (HCSUA / LUA / IUA-or-TUA / none) and each state sets which
// utilities qualify and what the minimum count is.
//
// CA  (CDSS MPP 63-503.43):
//   - HCSUA when the household pays heating OR cooling (CA explicitly
//     includes air conditioning, so paying electricity for AC qualifies).
//   - LUA when paying ≥ 2 non-heat/cool utilities.
//   - TUA when phone/internet is the only utility paid.
//
// MA  (DTA Field Operations Memo 2024-XX):
//   - HCSUA for primary heating expense.
//   - LUA when paying ≥ 1 non-heating utility.
//   - TUA when phone/internet is the only utility.
//
// Tier amounts (heating-cooling, limited, telephone) are state-published
// and change annually. We surface the latest published amount on the
// package for caseworker context; the determination itself only emits
// the tier name.

export interface StateSuaRule {
  state: StateCode;
  heating_qualifying_utilities: Array<keyof UtilityIntake["utilities_paid_by_applicant"]>;
  limited_min_non_heat_count: number;
  /** FY2026 published monthly amounts; surfaced for context only. */
  amounts_usd: { full: number; limited: number; telephone: number };
  citation: string;
}

export const STATE_SUA_RULES: Record<StateCode, StateSuaRule> = {
  CA: {
    state: "CA",
    heating_qualifying_utilities: ["heat_gas", "electricity", "cooling"],
    limited_min_non_heat_count: 2,
    amounts_usd: { full: 670, limited: 159, telephone: 23 },
    citation: "CA CDSS MPP 63-503.43 (HCSUA includes A/C in CA climate zones)",
  },
  MA: {
    state: "MA",
    heating_qualifying_utilities: ["heat_gas"],
    limited_min_non_heat_count: 1,
    amounts_usd: { full: 745, limited: 488, telephone: 38 },
    citation: "MA DTA Field Operations Memo 2024 / 106 CMR 364.400",
  },
};

export function determineSuaTier(intake: UtilityIntake): SuaTier {
  const rules = STATE_SUA_RULES[intake.state_code];
  const u = intake.utilities_paid_by_applicant;

  if (u.none) return "none";

  // Heating/cooling tier: any qualifying utility makes the household
  // eligible for the highest SUA (HCSUA).
  if (rules.heating_qualifying_utilities.some((k) => u[k])) return "full";

  // Phone/internet alone → TUA (telephone tier), regardless of state.
  if (u.phone_internet && !u.water) return "telephone";

  // Non-heating count must meet the state's minimum for LUA.
  const nonHeatCount = (u.water ? 1 : 0) + (u.phone_internet ? 1 : 0);
  if (nonHeatCount >= rules.limited_min_non_heat_count) return "limited";

  return "none";
}
