// CA SNAP CAPER (Case and Procedural Error Rate) — the "other" error rate.
// The payment error rate covers only approved/issued payments; CAPER covers
// NEGATIVE actions (denial, termination, suspension) — the access side. Verbatim
// from the USDA FNS FY2024 PDF, vendored at
// data-ops/sample/usda-caper/caper_fy2024.json. Static published-data facts
// (same posture as per-history.ts), cited to finding
// 2026-05-29-caper-denial-side-error. Update only when USDA publishes a new FY.

export const CA_CAPER_GROUNDING = {
  fiscalYear: 2024,
  /** Share of CA negative actions (denial/termination/suspension) with a case or procedural error. */
  caRatePct: 39.84,
  /** National CAPER. */
  usRatePct: 43.81,
  /** Massachusetts — Civica's MA-first caseworker-mode reference point. */
  maRatePct: 21.08,
  /** Date the USDA PDF was published. */
  dated: "2025-06-30",
  findingId: "2026-05-29-caper-denial-side-error",
} as const;
