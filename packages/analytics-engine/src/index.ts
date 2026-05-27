/**
 * @civica/analytics-engine — typed query API for Tier 3 analytical data.
 *
 * Spec: docs/data-architecture.md
 *
 * Implemented (T10 phase 1):
 *   - analytics.section10105.fy29Cliff()
 *   - analytics.section10105.tierLiability({ scenario, fy })
 *   - analytics.qcMapping.* (T7)
 *
 * Implemented (T10 phase 2 — Session C):
 *   - analytics.paymentErrorRate.byState({ fy, state })
 *   - analytics.paymentErrorRate.trend({ stateCode, fyRange })
 *   - analytics.cfr273.byRelevance({ grade })
 *   - analytics.cfr273.bySection({ section })
 *   - analytics.obbbaScenarios.compare({ metric? })
 *
 * Implemented (TODO-5 — T8 shadow-mode instrumentation, 2026-05-27):
 *   - analytics.civicaEmit.qcEvaluations.byOrg({ orgId })
 *
 * Still stubbed (blocked on data Civica doesn't emit yet):
 *   - analytics.qcMicrodata.* — blocked on USDA QC public-use microdata load
 *   - analytics.stateFoia.* / federalFoia.* — blocked on FOIA inventory parser
 *
 * Every query returns `{ rows, provenance }` so consumers can render
 * citation footnotes alongside data.
 */
import { fy29Cliff, tierLiability, type TierScenario } from "./datasets/section10105";
import {
  byCategory as qcMappingByCategory,
  byCfrSection as qcMappingByCfrSection,
  coverage as qcMappingCoverage,
} from "./datasets/qcMapping";
import {
  byState as paymentErrorRateByState,
  trend as paymentErrorRateTrend,
} from "./datasets/paymentErrorRate";
import {
  byRelevance as cfr273ByRelevance,
  bySection as cfr273BySection,
} from "./datasets/cfr273";
import { compare as obbbaScenariosCompare } from "./datasets/obbbaScenarios";
import { qcEvaluationsByOrg } from "./datasets/civicaEmit";

export * from "./schemas";

const blocked = (name: string, reason: string): never => {
  throw new Error(
    `[@civica/analytics-engine] ${name}: not implemented yet — ${reason}.`,
  );
};

export const analytics = {
  paymentErrorRate: {
    byState: paymentErrorRateByState,
    trend: paymentErrorRateTrend,
  },
  section10105: {
    fy29Cliff,
    tierLiability,
  },
  qcMapping: {
    byCategory: qcMappingByCategory,
    byCfrSection: qcMappingByCfrSection,
    coverage: qcMappingCoverage,
  },
  cfr273: {
    byRelevance: cfr273ByRelevance,
    bySection: cfr273BySection,
  },
  qcMicrodata: {
    errorCausesByIncomeSource: (_opts: { years: number[] }) =>
      blocked(
        "qcMicrodata.errorCausesByIncomeSource",
        "blocked on USDA QC public-use microdata load (qc-microdata/ bucket prefix empty)",
      ),
  },
  stateFoia: {
    byState: (_opts: { stateCode: string }) =>
      blocked(
        "stateFoia.byState",
        "blocked on FOIA inventory parser (state-foia/{state}/{date}/ tree empty)",
      ),
  },
  federalFoia: {
    list: () =>
      blocked(
        "federalFoia.list",
        "blocked on FOIA inventory parser (federal-foia/ tree empty)",
      ),
  },
  obbbaScenarios: {
    compare: obbbaScenariosCompare,
  },
  civicaEmit: {
    qcEvaluations: {
      byOrg: qcEvaluationsByOrg,
    },
  },
};

export type { TierScenario };
