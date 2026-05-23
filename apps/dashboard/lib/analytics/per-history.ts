// Historical SNAP Payment Error Rates — CA + National.
//
// Source: USDA FNS official annual QC Payment Error Rate publications.
// Each entry is the TOTAL PER (overpayment + underpayment), the metric
// §10105 measures against the 105%-of-national-average threshold.
//
//   FY2024  — https://fns-prod.azureedge.us/sites/default/files/resource-files/snap-fy24QC-PER.pdf
//             (published 2025-06-30)
//   FY2023  — https://fns-prod.azureedge.us/sites/default/files/resource-files/snap-fy23-qc-payment-error-rate.pdf
//   FY2020–FY2021 — FNS suspended national + state PER measurement due to
//                   COVID-19 disruptions; no comparable figure exists.
//                   See https://www.fns.usda.gov/snap/qc/per for context.
//   FY2018–FY2019 — pre-pandemic baseline; not currently included pending
//                   verification of CA + National TOTAL PER (overpay-only
//                   summary numbers are publicly cited but the total PER
//                   requires extracting from the original FNS PDFs).
//
// Usage: the CDSS leaderboard's optional state-PER trend ribbon reads
// from `caStatePerSeries()` / `nationalAvgSeries()`. When a new fiscal
// year publishes, append a new row to PER_HISTORY and update the URL
// citation block above.

export interface PERPoint {
  /** Federal fiscal year (e.g. 2024 for the period Oct 2023 – Sep 2024). */
  fy: number;
  /** Total state-level PER (% of issued benefits). Overpay + underpay. */
  caTotalPER: number;
  /** National average total PER for the same FY. */
  nationalTotalPER: number;
  /** §10105 threshold = 105% × national avg. Pre-computed for renderers. */
  thresholdPER: number;
}

const PER_HISTORY: ReadonlyArray<PERPoint> = [
  {
    fy: 2023,
    caTotalPER: 13.40,
    nationalTotalPER: 11.67, // 10.03 overpay + 1.64 underpay
    thresholdPER: +(11.67 * 1.05).toFixed(2),
  },
  {
    fy: 2024,
    caTotalPER: 10.98,
    nationalTotalPER: 10.93, // 9.26 overpay + 1.67 underpay
    thresholdPER: +(10.93 * 1.05).toFixed(2),
  },
];

/** All available history points in chronological order (FY ascending). */
export function perHistory(): ReadonlyArray<PERPoint> {
  return PER_HISTORY;
}

/** Earliest FY for which CA + National PER data is available. */
export function earliestFiscalYear(): number {
  return PER_HISTORY[0]!.fy;
}

/** Most recent FY for which CA + National PER data is available. */
export function latestFiscalYear(): number {
  return PER_HISTORY[PER_HISTORY.length - 1]!.fy;
}

/** CA state PER series for a sparkline (CA total PER per FY). */
export function caStatePerSeries(): ReadonlyArray<{ fy: number; per: number }> {
  return PER_HISTORY.map(({ fy, caTotalPER }) => ({ fy, per: caTotalPER }));
}

/** National-average PER series for a comparison overlay. */
export function nationalAvgSeries(): ReadonlyArray<{ fy: number; per: number }> {
  return PER_HISTORY.map(({ fy, nationalTotalPER }) => ({
    fy,
    per: nationalTotalPER,
  }));
}
