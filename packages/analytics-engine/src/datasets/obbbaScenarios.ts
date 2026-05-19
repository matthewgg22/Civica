import { readParquetWithProvenance } from "../runtime/node";
import { ScenarioRowSchema, type ScenarioRow, type Result } from "../schemas";

const OBBBA_BUCKET_PATH = "obbba-scenarios/obbba_rollup.parquet";

/**
 * Compare conservative / mid / aggressive OBBBA scenarios. Returns one row
 * per (scenario, metric). Order is preserved as written by the parser so the
 * dashboard can render baseline → mid → aggressive without re-sorting.
 *
 * Optional `metric` filters to a single rollup metric (e.g.
 * `fy28_total_state_liability_billions`).
 */
export async function compare(opts: { metric?: string } = {}): Promise<Result<ScenarioRow>> {
  const { rows, provenance } = await readParquetWithProvenance(
    OBBBA_BUCKET_PATH,
    ScenarioRowSchema.passthrough(),
  );
  const filtered = opts.metric
    ? rows.filter((r) => r.metric === opts.metric)
    : rows;
  return {
    rows: filtered.map((r) => ScenarioRowSchema.parse(r)),
    provenance: [provenance],
  };
}
