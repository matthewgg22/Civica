import type { StateCode, SuaTier, UtilityIntake } from "./types";

export interface StateSuaRule {
  state: StateCode;
  heating_qualifying_utilities: Array<keyof UtilityIntake["utilities_paid_by_applicant"]>;
  limited_min_non_heat_count: number;
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
  if (rules.heating_qualifying_utilities.some((k) => u[k])) return "full";
  if (u.phone_internet && !u.water) return "telephone";

  const nonHeatCount = (u.water ? 1 : 0) + (u.phone_internet ? 1 : 0);
  if (nonHeatCount >= rules.limited_min_non_heat_count) return "limited";

  return "none";
}
