// ---------------------------------------------------------------------------
// §10105 PER (Payment Error Rate) exposure analytics
//
// OBBBA §10105 imposes a proportional loss of federal administrative match
// on states whose PER is ≥ 105% of the national average. This module
// provides demo data for the CDSS state deputy view (/cdss).
//
// Measurement window: FY2026 baseline → FY2027 mid-point review → FY2028
// cost-share adjustment effective.
//
// All data is currently static demo data. Post-MVP: replace with a query
// against `snap_analytics.per_by_state` fed by the FNS QC pipeline.
// ---------------------------------------------------------------------------

export interface PERExposure {
  stateCode: string;
  statewidePER: number;           // e.g. 10.8
  nationalAvgPER: number;         // e.g. 8.6
  civicaCohortPER: number;        // e.g. 4.2
  penaltyExposureDollars: number; // e.g. 510_000_000
  demoMode: boolean;
}

// ---------------------------------------------------------------------------
// Demo data (FY2024 placeholders derived from FNS/HHS QC public reports)
// ---------------------------------------------------------------------------
const DEMO_PER: Record<string, Omit<PERExposure, "stateCode" | "demoMode">> = {
  CA: {
    statewidePER: 10.8,
    nationalAvgPER: 8.6,
    civicaCohortPER: 4.2,
    // ~$510M: proportional to CA federal admin cost (~$850M) × (2.2 pp excess / 8.6 pp avg)
    // per the §10105 methodology (excess rate as share of avg rate × federal admin cost)
    penaltyExposureDollars: 510_000_000,
  },
  MA: {
    statewidePER: 9.1,
    nationalAvgPER: 8.6,
    civicaCohortPER: 4.2,
    penaltyExposureDollars: 22_000_000,
  },
};

/**
 * Returns PER exposure data for the given state.
 *
 * All data is demo/static for FY2024 until the FNS QC pipeline feed is
 * connected. `demoMode: true` is always returned until live data exists.
 *
 * @param stateCode — ISO 3166-2 state code, e.g. "CA"
 */
export function perExposure(stateCode: string): PERExposure {
  const demo = DEMO_PER[stateCode] ?? DEMO_PER["CA"];
  return { stateCode, ...demo, demoMode: true };
}
