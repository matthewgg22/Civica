/**
 * @civica/analytics-engine — typed query API for Tier 3 analytical data.
 *
 * Spec: docs/data-architecture.md
 *
 * Implemented (T10 phase 1):
 *   - analytics.section10105.fy29Cliff()
 *   - analytics.section10105.tierLiability({ scenario, fy })
 *
 * Stubbed (T10 phase 2):
 *   - everything else; throws with a // TODO: T10 phase 2 marker.
 *
 * Every query returns `{ rows, provenance }` so consumers can render
 * citation footnotes alongside data.
 */
import { fy29Cliff, tierLiability, type TierScenario } from "./datasets/section10105.js";

export * from "./schemas.js";

const todo = (name: string): never => {
  // TODO: T10 phase 2 — wire to data-ops parser output.
  throw new Error(`[@civica/analytics-engine] ${name}: not implemented yet (T10 phase 2).`);
};

export const analytics = {
  paymentErrorRate: {
    byState: (_opts: { fy: number; state?: string }) => todo("paymentErrorRate.byState"),
    trend: (_opts: { stateCode: string; fyRange: [number, number] }) =>
      todo("paymentErrorRate.trend"),
  },
  section10105: {
    fy29Cliff,
    tierLiability,
  },
  cfr273: {
    byRelevance: (_opts: { grade: "HIGH" | "MEDIUM" | "LOW" }) => todo("cfr273.byRelevance"),
    bySection: (_opts: { section: string }) => todo("cfr273.bySection"),
  },
  qcMicrodata: {
    errorCausesByIncomeSource: (_opts: { years: number[] }) =>
      todo("qcMicrodata.errorCausesByIncomeSource"),
  },
  stateFoia: {
    byState: (_opts: { stateCode: string }) => todo("stateFoia.byState"),
  },
  federalFoia: {
    list: () => todo("federalFoia.list"),
  },
  obbbaScenarios: {
    compare: () => todo("obbbaScenarios.compare"),
  },
  civicaEmit: {
    qcEvaluations: {
      byOrg: (_opts: { orgId: string }) => todo("civicaEmit.qcEvaluations.byOrg"),
    },
  },
};

export type { TierScenario };
