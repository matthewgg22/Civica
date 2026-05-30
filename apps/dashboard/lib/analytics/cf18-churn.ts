// CA SNAP retention — CDSS CF-18 procedural churn. Eligible CalFresh households
// that lose benefits at a reporting moment (SAR 7 semi-annual report / RRR
// recertification) because the paperwork came in late. Derived from the vendored
// artifacts data-ops/sample/cdss-cf18/{cf18_churn_statewide,cf18_churn_by_county}.json
// (reproducible via tools/cdss-cf18). Cited to finding 2026-05-29-cdss-cf18-churn.
// Static published CA state data — same posture as per-history.ts.

export const CF18_CHURN = {
  latestFy: "FY2024-25",
  priorFy: "FY2023-24",
  findingId: "2026-05-29-cdss-cf18-churn",
  statewide: {
    rrrLossPct: 5.2,
    sar7LossPct: 8.5,
    rrrLossPctPrior: 3.8,
    eventsWithLoss: 330_331,
  },
  county: {
    nCounties: 36,
    minRrr: 1.3,
    maxRrr: 10.6,
    losAngelesRrr: 5.9,
  },
  worstCounties: [
    { county: "Yuba", rrr: 10.6, sar7: 11.5 },
    { county: "San Francisco", rrr: 9.9, sar7: 7.9 },
    { county: "Ventura", rrr: 8.2, sar7: 12.2 },
    { county: "San Joaquin", rrr: 7.7, sar7: 10.2 },
    { county: "Stanislaus", rrr: 7.7, sar7: 8.3 },
    { county: "Tulare", rrr: 7.7, sar7: 8.2 },
  ],
  bestCounties: [
    { county: "Riverside", rrr: 1.3, sar7: 4.5 },
    { county: "Santa Clara", rrr: 1.5, sar7: 1.9 },
    { county: "Monterey", rrr: 2.3, sar7: 6.7 },
  ],
} as const;
