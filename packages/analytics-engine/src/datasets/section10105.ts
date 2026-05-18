import { readParquetWithProvenance } from "../runtime/node.js";
import {
  CliffEntrySchema,
  LiabilityScenarioSchema,
  type CliffEntry,
  type LiabilityScenario,
  type Result,
} from "../schemas.js";

const FY24_PATH = "section-10105/fy=2024/state_liability.parquet";
const FY28_PATH = "section-10105/fy=2028/state_liability_adjusted.parquet";

export type TierScenario = "baseline" | "mid" | "aggressive";

/**
 * States whose FY24 PER × 1.5 ≥ 20% are delayed to FY29 (§10105(B)(iii)).
 * Returns the cliff cohort — the wedge Civica's pitch leans on.
 */
export async function fy29Cliff(): Promise<Result<CliffEntry>> {
  const { rows, provenance } = await readParquetWithProvenance(
    FY24_PATH,
    CliffEntrySchema.passthrough(),
  );
  const cliff = rows.filter((r) => r.delayed_to_fy29);
  return { rows: cliff.map((r) => CliffEntrySchema.parse(r)), provenance: [provenance] };
}

/**
 * State-by-state liability under a chosen scenario for a given fiscal year.
 * For fy 2024: only `baseline` is meaningful (returns the FY24 baseline columns).
 * For fy 2028: scenario picks among conservative/mid/aggressive denominators.
 */
export async function tierLiability(opts: {
  scenario: TierScenario;
  fy: 2024 | 2028;
}): Promise<Result<LiabilityScenario | (Omit<LiabilityScenario, never> & { scenario: TierScenario })>> {
  if (opts.fy === 2024) {
    // FY24 baseline doesn't carry scenario columns; return rows widened with NaN
    // so callers don't need to special-case the year.
    const { rows, provenance } = await readParquetWithProvenance(
      FY24_PATH,
      LiabilityScenarioSchema.partial().passthrough(),
    );
    return {
      rows: rows.map((r) =>
        LiabilityScenarioSchema.parse({
          ...r,
          fy28_benefits_conservative_millions: Number(r.fy28_benefits_conservative_millions ?? 0),
          fy28_liability_conservative_millions: Number(
            r.fy28_liability_conservative_millions ?? 0,
          ),
          fy29_annualized_conservative_millions: Number(
            r.fy29_annualized_conservative_millions ?? 0,
          ),
          fy28_benefits_mid_millions: Number(r.fy28_benefits_mid_millions ?? 0),
          fy28_liability_mid_millions: Number(r.fy28_liability_mid_millions ?? 0),
          fy29_annualized_mid_millions: Number(r.fy29_annualized_mid_millions ?? 0),
          fy28_benefits_aggressive_millions: Number(r.fy28_benefits_aggressive_millions ?? 0),
          fy28_liability_aggressive_millions: Number(r.fy28_liability_aggressive_millions ?? 0),
          fy29_annualized_aggressive_millions: Number(
            r.fy29_annualized_aggressive_millions ?? 0,
          ),
        }),
      ),
      provenance: [provenance],
    };
  }

  const { rows, provenance } = await readParquetWithProvenance(
    FY28_PATH,
    LiabilityScenarioSchema,
  );
  return { rows, provenance: [provenance] };
}
