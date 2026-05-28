// Wilson score interval for a binomial proportion.
//
// Single source of truth for the per-slice QC error-rate confidence band
// (docs/plans/error-attribution-ledger.md — "Considered simpler alternative",
// chosen as the Wilson-first v1 over the full Beta-Binomial ledger).
//
// The companion SQL view snap_enrollment.v_qc_error_rate_by_slice returns ONLY
// raw counts (n, errors) per slice — it deliberately does NOT compute the
// interval in SQL. The math lives here so it is unit-tested and reused
// identically by every consumer, mirroring the v_qc_pillar_coverage pattern
// (view returns raw rates; engine owns the formula).
//
// Why Wilson and not normal-approximation (Wald): Wald collapses to a
// zero-width interval at p̂ = 0 or 1 (e.g. 0/10 "errors" would read as a
// certain 0% rate). Wilson keeps an honest band at the extremes and at small
// n — exactly the regime a QC leaderboard lives in. A 1/1 slice reads as
// rate = 100% but interval ≈ [0.21, 1.0], which is the correct "we have
// almost no evidence" signal.

export interface WilsonInterval {
  /** Number of QC-confirmed errors in the slice (numerator). */
  errors: number;
  /** Number of completed QC reviews in the slice (denominator). */
  n: number;
  /** Point estimate errors/n, in [0, 1]. 0 when n = 0. */
  rate: number;
  /** Wilson lower bound, clamped to [0, 1]. */
  lower: number;
  /** Wilson upper bound, clamped to [0, 1]. */
  upper: number;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Wilson score interval for the proportion errors/n.
 *
 * @param errors confirmed errors (numerator); must be 0 <= errors <= n
 * @param n      completed reviews (denominator); n >= 0
 * @param z      standard-normal quantile for the desired coverage
 *               (default 1.96 ≈ 95%). 1.6449 ≈ 90%, 2.5758 ≈ 99%.
 *
 * For n = 0 the proportion is undefined; we return rate 0 with the maximally
 * uncertain interval [0, 1] and leave display suppression (e.g. "—" or a
 * min-N gate) to the caller, which can branch on `n`.
 */
export function wilsonInterval(errors: number, n: number, z = 1.96): WilsonInterval {
  if (!Number.isFinite(errors) || !Number.isFinite(n) || n < 0 || errors < 0) {
    throw new RangeError(`wilsonInterval: invalid input errors=${errors}, n=${n}`);
  }
  if (errors > n) {
    throw new RangeError(`wilsonInterval: errors (${errors}) cannot exceed n (${n})`);
  }
  if (n === 0) {
    return { errors: 0, n: 0, rate: 0, lower: 0, upper: 1 };
  }

  const pHat = errors / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (pHat + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((pHat * (1 - pHat)) / n + z2 / (4 * n * n))) / denom;

  return {
    errors,
    n,
    rate: pHat,
    lower: clamp01(center - margin),
    upper: clamp01(center + margin),
  };
}
