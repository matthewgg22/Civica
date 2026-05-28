// Pure transform for the /qc per-slice error-rate panel.
//
// Turns raw rows from snap_enrollment.v_qc_error_rate_by_slice (migration
// 20260596, A1) into display-ready groups with a Wilson 95% confidence band
// per slice. The band math is NOT recomputed here — it is delegated to the
// engine's wilsonInterval (packages/snap-qc-engine), the single source of
// truth, mirroring the view's "engine owns the formula" contract.
//
// This module is deliberately Supabase-free and React-free so the grouping /
// sorting / clamping logic is unit-testable without mocking a DB client or
// rendering a component. The async section component
// (components/qc/sections/SliceErrorRatesSection.tsx) is the only place that
// touches Supabase; it hands the raw rows straight to buildSliceGroups.

import { wilsonInterval } from "@civica/snap-qc-engine";

/** One row exactly as returned by v_qc_error_rate_by_slice. */
export interface SliceViewRow {
  slice_dim: string;
  slice_value: string;
  // bigint columns arrive as number at QC volumes (PostgREST), but tolerate
  // string just in case a very large count is serialized that way.
  n: number | string;
  errors: number | string;
}

/** A single slice value with its computed Wilson band (rates in [0, 1]). */
export interface SliceRow {
  sliceValue: string;
  n: number;
  errors: number;
  rate: number;
  lower: number;
  upper: number;
}

/** All slices for one dimension, sorted most-sampled first. */
export interface SliceGroup {
  dim: string;
  label: string;
  rows: SliceRow[];
}

// Dimensions surfaced in the UI, in display order. `county_fips` is
// intentionally omitted: it mirrors `county` 1:1 and is kept in the view only
// for joins/export, so showing it would just duplicate the county rows.
export const DISPLAY_DIMS: { dim: string; label: string }[] = [
  { dim: "error_type", label: "By error category" },
  { dim: "county", label: "By county" },
  { dim: "language", label: "By preferred language" },
];

// Cap rows per group so a long county tail can't blow out the panel. The
// section sorts most-sampled first, so the cut keeps the highest-evidence
// slices.
export const ROWS_PER_GROUP = 10;

// Below this n, a slice's rate is treated as low-confidence in the UI (the
// Wilson band is already wide; this just lets the view mute it + tag it).
export const MIN_CONFIDENT_N = 5;

const toNum = (v: number | string): number =>
  typeof v === "number" ? v : Number(v);

/**
 * Group raw view rows by dimension, attach a Wilson band to each slice, sort
 * most-sampled first (tiebreak: higher rate floats up, since that's the more
 * concerning slice), and cap each group at ROWS_PER_GROUP.
 *
 * `errors` is clamped to `n` defensively: the view guarantees errors <= n
 * (errors is a FILTERed COUNT of the same population n counts), but a clamp
 * keeps a malformed row from throwing out of wilsonInterval and taking down
 * the whole Suspense boundary.
 */
export function buildSliceGroups(rows: SliceViewRow[]): SliceGroup[] {
  return DISPLAY_DIMS.map(({ dim, label }) => {
    const groupRows: SliceRow[] = rows
      .filter((r) => r.slice_dim === dim)
      .map((r) => {
        const n = Math.max(0, Math.trunc(toNum(r.n)));
        const errors = Math.min(n, Math.max(0, Math.trunc(toNum(r.errors))));
        const w = wilsonInterval(errors, n);
        return {
          sliceValue: r.slice_value,
          n,
          errors,
          rate: w.rate,
          lower: w.lower,
          upper: w.upper,
        };
      })
      .sort((a, b) => b.n - a.n || b.rate - a.rate)
      .slice(0, ROWS_PER_GROUP);
    return { dim, label, rows: groupRows };
  });
}
