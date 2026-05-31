// CA procedural-denial panel — loader for the ICPSR 39331 county-month regression.
//
// Produced by tools/ca-churn-regression on the real CA county-month panel
// (58 counties, 2016–2024). Two results: the operational variation in the
// procedural-denial rate under identical statewide rules (headline), and the
// EA-cliff interrupted-time-series (secondary). READS + SHAPES only; the Python
// harness owns the numbers. NOTE: the outcome is APPLICATION-side procedural
// denial, not the dollar PER and not recert/SAR-7 churn (CF-18).

import artifact from "./ca-churn-results.json";

export interface CaChurnReport {
  sourceKind: string;
  scope: string;
  outcome: string;
  panel: { unit: string; nObs: number; nCounties: number; period: string };
  /** Volume-weighted mean procedural-denial rate (% of applications). */
  weightedMeanProcRatePct: number;
  operational: {
    betweenCountyR2: number;
    timeR2: number;
    p10Pct: number;
    medianPct: number;
    p90Pct: number;
    maxPct: number;
    maxCounty: string;
    nCountiesAdequate: number;
    interpretation: string;
  };
  eaCliff: {
    cliffMonth: string;
    postCoefPp: number;
    ciLowPp: number;
    ciHighPp: number;
    pValue: number;
    significant: boolean;
    nPostMonths: number;
    design: string;
  };
  notes: string[];
}

export function getCaChurnReport(): CaChurnReport {
  const a = artifact as unknown as {
    source_kind: string;
    scope: string;
    outcome: string;
    panel: { unit: string; n_obs: number; n_counties: number; period: string };
    headline: { weighted_mean_proc_rate_pct: number };
    operational: {
      between_county_r2: number;
      time_r2: number;
      spread: {
        p10_pct: number;
        median_pct: number;
        p90_pct: number;
        max_pct: number;
        max_county: string;
        n_counties_adequate: number;
      };
      interpretation: string;
    };
    ea_cliff: {
      cliff_month: string;
      post_coef_pp: number;
      ci_low_pp: number;
      ci_high_pp: number;
      p_value: number;
      significant: boolean;
      n_post_months: number;
      design: string;
    };
    notes: string[];
  };

  return {
    sourceKind: a.source_kind,
    scope: a.scope,
    outcome: a.outcome,
    panel: {
      unit: a.panel.unit,
      nObs: a.panel.n_obs,
      nCounties: a.panel.n_counties,
      period: a.panel.period,
    },
    weightedMeanProcRatePct: a.headline.weighted_mean_proc_rate_pct,
    operational: {
      betweenCountyR2: a.operational.between_county_r2,
      timeR2: a.operational.time_r2,
      p10Pct: a.operational.spread.p10_pct,
      medianPct: a.operational.spread.median_pct,
      p90Pct: a.operational.spread.p90_pct,
      maxPct: a.operational.spread.max_pct,
      maxCounty: a.operational.spread.max_county,
      nCountiesAdequate: a.operational.spread.n_counties_adequate,
      interpretation: a.operational.interpretation,
    },
    eaCliff: {
      cliffMonth: a.ea_cliff.cliff_month,
      postCoefPp: a.ea_cliff.post_coef_pp,
      ciLowPp: a.ea_cliff.ci_low_pp,
      ciHighPp: a.ea_cliff.ci_high_pp,
      pValue: a.ea_cliff.p_value,
      significant: a.ea_cliff.significant,
      nPostMonths: a.ea_cliff.n_post_months,
      design: a.ea_cliff.design,
    },
    notes: a.notes,
  };
}
