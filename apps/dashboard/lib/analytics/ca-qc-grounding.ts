// CA SNAP QC grounding facts — derived from the REAL USDA QC FY2023 public-use
// file (CA subsample n=867), vendored at
// data-ops/sample/usda-qc-ca/ca_qc_fy2023.json and reproducible via
// tools/usda-qc-ingest/src/ca_aggregates.py. These are static published-data
// facts (same posture as per-history.ts), cited to finding
// 2026-05-29-usda-qc-ca-grounding. Update ONLY when the QC file is re-ingested.

export const CA_QC_GROUNDING = {
  fiscalYear: 2023,
  /** CA cases in the FY2023 QC public-use sample. */
  caCases: 867,
  /** Agency/operational share of CA error dollars (dollar-weighted variance). */
  operationalPct: 64.6,
  /** Client/household share. */
  clientPct: 35.4,
  /** Shelter OR wages, as a share of errored cases. */
  shelterOrWagesPct: 60.8,
  /** Max |microdata − engine| across the validated element shares (pp). */
  elementMaxDeltaPp: 1.6,
  findingId: "2026-05-29-usda-qc-ca-grounding",
} as const;
