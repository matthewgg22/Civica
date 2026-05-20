/**
 * Transforms — shape engine outputs into the prop shapes consumed by existing
 * dashboard components (KpiCard, FunnelStep, etc.).
 *
 * Keep these pure + side-effect-free so they can be unit-tested with fixture
 * data shaped like real engine output.
 *
 * Each consumer of the analytics engine should also wrap its calls in
 * `safeAnalyticsCall` so a missing-data / engine-throw failure renders a
 * degraded state instead of crashing the page (the engine throws when
 * ANALYTICS_USE_SAMPLE_DATA is unset AND no real parquet has been uploaded).
 */
import type { PER, PERTrend, ScenarioRow } from "@civica/analytics-engine";

// ---------------------------------------------------------------------------
// Safe-call wrapper — returns null on throw so pages can render a placeholder
// without try/catch noise at every callsite.
// ---------------------------------------------------------------------------
export async function safeAnalyticsCall<T>(
  fn: () => Promise<T>,
  context: string,
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        `[dashboard:analytics] ${context} failed — rendering degraded state.`,
        { error: (err as Error).message },
      );
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// §10105 PER exposure — derive the KPI numbers the /cdss page needs from a
// PER rowset for a target state.
// ---------------------------------------------------------------------------
export interface PerExposureView {
  stateCode: string;
  statewidePER: number;
  nationalAvgPER: number;
  thresholdPER: number;        // 105% of national avg
  excessPP: number;            // statewide - national (rounded 1dp)
  aboveThreshold: boolean;
}

/**
 * Given `paymentErrorRate.byState({ fy })` output (one row per state),
 * compute the statewide vs. national-average exposure for `stateCode`.
 *
 * National avg = mean of `per_total` across all rows (case-weighted means
 * aren't available in the sample shape, so we use simple mean).
 *
 * Returns `null` if the target state is not present in the row set.
 */
export function transformPerByStateToExposure(
  rows: PER[],
  stateCode: string,
): PerExposureView | null {
  if (rows.length === 0) return null;
  const target = rows.find(
    (r) => r.state_code.toUpperCase() === stateCode.toUpperCase(),
  );
  if (!target) return null;

  const nationalAvgPER = +(
    rows.reduce((sum, r) => sum + r.per_total, 0) / rows.length
  ).toFixed(2);
  const thresholdPER = +(nationalAvgPER * 1.05).toFixed(2);
  const excessPP = +(target.per_total - nationalAvgPER).toFixed(1);

  return {
    stateCode: target.state_code,
    statewidePER: +target.per_total.toFixed(2),
    nationalAvgPER,
    thresholdPER,
    excessPP,
    aboveThreshold: target.per_total >= thresholdPER,
  };
}

// ---------------------------------------------------------------------------
// OBBBA scenarios — pull a single scenario's value for a metric.
// ---------------------------------------------------------------------------
export interface ScenarioLookup {
  scenario: string;
  metric: string;
  value: number;
}

/**
 * Find a single (scenario, metric) row from a scenario rowset. Returns
 * `null` if either dimension is missing. Used to render the "FY28 state
 * liability under OBBBA full" card on /cdss and /county.
 */
export function findScenarioMetric(
  rows: ScenarioRow[],
  scenario: string,
  metric: string,
): ScenarioLookup | null {
  const hit = rows.find((r) => r.scenario === scenario && r.metric === metric);
  if (!hit) return null;
  return { scenario: hit.scenario, metric: hit.metric, value: hit.value };
}

// ---------------------------------------------------------------------------
// PER trend — derive a YoY-delta label for a state from a 2-FY range.
// ---------------------------------------------------------------------------
export interface PerTrendView {
  stateCode: string;
  latestFY: number;
  latestPER: number;
  delta: number | null;  // null when only one FY in the series
  direction: "up" | "down" | "flat" | "none";
}

export function transformPerTrendToView(rows: PERTrend[]): PerTrendView | null {
  if (rows.length === 0) return null;
  const latest = rows[rows.length - 1]!;
  const delta = latest.trend_delta ?? null;
  let direction: PerTrendView["direction"] = "none";
  if (delta === null || delta === undefined) direction = "none";
  else if (Math.abs(delta) < 0.05) direction = "flat";
  else direction = delta > 0 ? "up" : "down";
  return {
    stateCode: latest.state_code,
    latestFY: latest.fiscal_year,
    latestPER: +latest.per_total.toFixed(2),
    delta: delta === null || delta === undefined ? null : +delta.toFixed(2),
    direction,
  };
}

/**
 * Detect whether the dashboard is running against fabricated sample data.
 * Mirrors `SampleDataBanner`'s check so pages can label their reads
 * accurately even when the banner is mounted in the layout.
 */
export function isSampleDataMode(): boolean {
  const v = process.env.ANALYTICS_USE_SAMPLE_DATA;
  return v === "true" || v === "1";
}
