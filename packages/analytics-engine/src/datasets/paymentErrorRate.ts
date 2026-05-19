import { readParquetWithProvenance } from "../runtime/node";
import { PERSchema, PERTrendSchema, type PER, type PERTrend, type Result } from "../schemas";

const perBucketPath = (fy: number) => `per/fy=${fy}/by_state.parquet`;

/**
 * Payment Error Rate by state for a single fiscal year.
 *
 * Reads `per/fy={fy}/by_state.parquet` from Supabase Storage (or the local
 * override dir under `ANALYTICS_LOCAL_PARQUET_DIR`) and returns one row per
 * state. When `state` is provided, filters to that USPS code (case-insensitive).
 */
export async function byState(opts: {
  fy: number;
  state?: string;
}): Promise<Result<PER>> {
  const { rows, provenance } = await readParquetWithProvenance(
    perBucketPath(opts.fy),
    PERSchema.passthrough(),
  );
  const filtered = opts.state
    ? rows.filter((r) => r.state_code.toUpperCase() === opts.state!.toUpperCase())
    : rows;
  return {
    rows: filtered.map((r) => PERSchema.parse(r)),
    provenance: [provenance],
  };
}

/**
 * Payment Error Rate trend for a single state over a fiscal-year range
 * (inclusive). Reads one parquet per FY and unions them in process; if a
 * given FY's file is missing in storage, that FY is silently skipped.
 *
 * `trend_delta` is the change vs. the previous FY in the returned series
 * (null for the earliest year).
 */
export async function trend(opts: {
  stateCode: string;
  fyRange: [number, number];
}): Promise<Result<PERTrend>> {
  const [from, to] = opts.fyRange;
  if (to < from) {
    throw new Error(`[paymentErrorRate.trend] fyRange end (${to}) is before start (${from}).`);
  }
  const stateUpper = opts.stateCode.toUpperCase();
  const allRows: PER[] = [];
  const allProvenance = [];
  for (let fy = from; fy <= to; fy++) {
    try {
      const { rows, provenance } = await readParquetWithProvenance(
        perBucketPath(fy),
        PERSchema.passthrough(),
      );
      const hit = rows.find((r) => r.state_code.toUpperCase() === stateUpper);
      if (hit) {
        allRows.push(PERSchema.parse(hit));
        allProvenance.push(provenance);
      }
    } catch (err) {
      // Missing FY parquet — skip, do not poison the whole series.
      if (process.env.ANALYTICS_DEBUG) {
        console.warn(
          `[paymentErrorRate.trend] skipping FY${fy} for ${stateUpper}: ${(err as Error).message}`,
        );
      }
    }
  }
  allRows.sort((a, b) => a.fiscal_year - b.fiscal_year);
  const withDelta: PERTrend[] = allRows.map((r, i) =>
    PERTrendSchema.parse({
      ...r,
      trend_delta: i === 0 ? undefined : r.per_total - allRows[i - 1]!.per_total,
    }),
  );
  return { rows: withDelta, provenance: allProvenance };
}
