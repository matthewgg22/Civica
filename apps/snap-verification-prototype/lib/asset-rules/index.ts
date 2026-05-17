import type { StateCode } from "@/types/verification";

// SNAP resource/asset test rules by state.
//
// Federal baseline (7 CFR 273.8):
//   - Gross asset limit: $2,750 for most households; $4,250 if any member
//     is 60+ or has a disability.
//   - Excluded: home, primary vehicle (equity above trade-in value counted
//     in some states), retirement accounts (some), tools of trade.
//
// CA (abolished general asset test, SB 1090, effective Jan 2020):
//   - No asset test for most households.
//   - ABAWD gross income test still applies; assets not counted for eligibility.
//
// MA (106 CMR 365.180):
//   - Standard federal limits apply: $2,750 / $4,250.
//   - Primary vehicle fully excluded (MA state option).
//   - Retirement accounts excluded.

export interface StateAssetRule {
  state: StateCode;
  asset_test_applies: boolean;
  standard_limit_usd: number;
  elderly_disabled_limit_usd: number;
  primary_vehicle_excluded: boolean;
  retirement_excluded: boolean;
  citations: string[];
}

export const STATE_ASSET_RULES: Record<StateCode, StateAssetRule> = {
  CA: {
    state: "CA",
    asset_test_applies: false,
    standard_limit_usd: 0,
    elderly_disabled_limit_usd: 0,
    primary_vehicle_excluded: true,
    retirement_excluded: true,
    citations: [
      "CA SB 1090 (2019) — eliminated general resource test effective Jan 2020",
      "7 CFR 273.8 (federal baseline, superseded in CA)",
    ],
  },
  MA: {
    state: "MA",
    asset_test_applies: true,
    standard_limit_usd: 2750,
    elderly_disabled_limit_usd: 4250,
    primary_vehicle_excluded: true,
    retirement_excluded: true,
    citations: [
      "106 CMR 365.180 — Massachusetts resource limits",
      "7 CFR 273.8 — Federal resource test",
    ],
  },
};

export const SHELTER_CITATIONS: Record<StateCode, string[]> = {
  CA: [
    "7 CFR 273.2(f)(1)(vi) — verification of shelter expenses",
    "CA CDSS MPP 63-503.312 — shelter deduction documentation",
  ],
  MA: [
    "7 CFR 273.2(f)(1)(vi) — verification of shelter expenses",
    "106 CMR 364.400 — MA shelter deduction",
  ],
};

export const INCOME_CITATIONS: Record<StateCode, string[]> = {
  CA: [
    "7 CFR 273.10(c) — calculation of household income",
    "7 CFR 273.2(f)(1)(ii) — verification of earned income",
    "CA CDSS MPP 63-503.211 — self-employment income",
  ],
  MA: [
    "7 CFR 273.10(c) — calculation of household income",
    "7 CFR 273.2(f)(1)(ii) — verification of earned income",
    "106 CMR 363.110 — MA earned income policy",
  ],
};
