// SourceAdapterBase — the abstract class every concrete adapter extends.
//
// The base class owns the *policy* layer:
//   - hourly polling cap (override requires explicit acknowledgedReason)
//   - exponential backoff schedule on consecutive failures
//   - identifying User-Agent injected into performFetch context
//   - wedged-threshold escalation after 24h continuous failure
//   - audit-log write on every fetch attempt (regardless of outcome)
//
// Subclasses own the *mechanism*: how to actually fetch from their
// specific source, how to parse the result, and how to diff snapshots.
// Subclasses implement performFetch(); they MUST NOT bypass this class
// by exposing their own public fetch().
//
// This separation matters because the policy layer is what closes the
// liability gaps from the eng review (audit log, wedged detection,
// hygiene). If an adapter could route around it, those guarantees
// become aspirational.
//
// References:
//   - docs/designs/regops-engine.md §Architectural Decisions D6, D10
//   - docs/regops/source-adapters.md §"Adapter contract"
//   - docs/regops/runbook.md §"Source wedged"

import {
  entryFromFetchResult,
  type AuditLogWriter,
} from "../audit/index.js";
import { SystemClock, type Clock } from "./clock.js";
import type { FetchResult } from "./types.js";

/**
 * Domain tag — coarse classification of what the source affects.
 * Drives counsel routing (eligibility → state/federal counsel; ftc →
 * marketing counsel) and the cost/SLA targets per domain.
 */
export type DomainTag = "eligibility" | "copy" | "ftc";

/**
 * Identifying User-Agent. Government sites have variable tolerance for
 * scrapers; a friendly UA with a contact email gives admins a path to
 * reach out instead of silently blocking us. Bumped via release.
 */
export const REGOPS_USER_AGENT = "Civica-RegOps/1.0 (regops@civica.app)";

/**
 * The polite floor: no source is polled more than once per hour by
 * default. Override per-adapter requires an explicit acknowledgedReason
 * so the override shows up in code review.
 */
export const DEFAULT_POLL_INTERVAL_MS = 3_600_000; // 1 hour

/**
 * After this much continuous failure time, the base class converts the
 * latest failure variant into SourceWedged and emits a page-severity
 * alert. Matches the threshold documented in the runbook.
 */
export const DEFAULT_WEDGED_THRESHOLD_MS = 24 * 3_600_000; // 24 hours

/**
 * Exponential backoff schedule. Returned as a TransientFailure's
 * retryAfterMs when the source didn't supply its own Retry-After. The
 * polling loop respects this as advice for the *next* fetch call.
 *
 * Index 0 = first consecutive failure, index 1 = second, etc. Caps at
 * the final entry (4h) for any further failures, then SourceWedged
 * kicks in at the 24h mark.
 */
export const BACKOFF_SCHEDULE_MS: readonly number[] = [
  60_000, //  1 min — first failure
  5 * 60_000, //  5 min
  15 * 60_000, // 15 min
  60 * 60_000, //  1 h
  4 * 60 * 60_000, //  4 h — cap
];

/**
 * What the base class passes into the subclass's performFetch() call.
 * Subclasses use these values when constructing their HTTP request so
 * the polite-scraper policy (UA, abort signal for timeouts) is uniform
 * across adapters.
 */
export interface FetchContext {
  /** Identifying User-Agent the subclass MUST set on its HTTP request. */
  readonly userAgent: string;
  /**
   * Wall-clock time (UTC ms) the fetch attempt started. Subclasses use
   * this to stamp their FetchResult's `fetchedAt` field. Reading from
   * the context (rather than `new Date()`) keeps tests deterministic.
   */
  readonly attemptStartedAtMs: number;
}

/**
 * Wiring a base-class instance needs at construction time. Tests inject
 * a FakeClock and InMemoryAuditLogWriter; production uses SystemClock
 * and SupabaseAuditLogWriter.
 */
export interface SourceAdapterBaseDeps {
  readonly auditLog: AuditLogWriter;
  readonly clock?: Clock;
}

/**
 * Override knobs an adapter subclass may set. The defaults are the
 * polite floor; overrides require justification visible in code review.
 */
export interface SourceAdapterPolicyOverrides {
  /**
   * Minimum gap between fetch() calls, in ms. Defaults to 1 hour. Must
   * be paired with `acknowledgedReason` to override.
   */
  readonly pollIntervalMs?: number;

  /**
   * Required only when `pollIntervalMs` is below DEFAULT_POLL_INTERVAL_MS.
   * A short human-readable reason that surfaces in code review —
   * something like "fy_refresh_active=true; USDA publishes the COLA
   * memo at variable times during the third week of August."
   */
  readonly acknowledgedReason?: string;

  /**
   * Override the wedged threshold. Mostly for tests; production
   * adapters should leave the 24h default.
   */
  readonly wedgedThresholdMs?: number;
}

/**
 * Public surface returned to the polling loop. The polling loop calls
 * fetchOnce() on a schedule; the base class enforces rate cap +
 * backoff + audit + wedged escalation; the subclass's performFetch()
 * does the actual work.
 */
export interface SourceAdapter<TRaw> {
  readonly id: string;
  readonly domainTag: DomainTag;
  fetchOnce(): Promise<FetchResult<TRaw>>;
}

export abstract class SourceAdapterBase<TRaw> implements SourceAdapter<TRaw> {
  abstract readonly id: string;
  abstract readonly domainTag: DomainTag;
  /**
   * The canonical URL the adapter polls. Stored on every audit log
   * entry. Subclasses with multiple URLs (e.g. an index page that
   * leads to per-document URLs) use this as the "front door" — the
   * downstream URLs are recorded in audit metadata.
   */
  abstract readonly url: string;

  /**
   * Subclass-supplied raw fetch. Returns a FetchResult; never throws.
   * If the subclass needs to express a failure mode that isn't covered
   * by the four failure variants, it should pick the closest one and
   * put detail in the error/metadata.
   *
   * Subclasses MUST set the User-Agent header to ctx.userAgent on
   * any outbound HTTP request.
   */
  protected abstract performFetch(ctx: FetchContext): Promise<FetchResult<TRaw>>;

  // ---- Policy state (per-process, in-memory) ----------------------------

  private readonly auditLog: AuditLogWriter;
  private readonly clock: Clock;

  /** Resolved policy values (defaults overlaid with subclass overrides). */
  private readonly pollIntervalMs: number;
  private readonly wedgedThresholdMs: number;
  private readonly overrideReason: string | undefined;

  /**
   * Last-attempted-fetch timestamp. Used to enforce pollIntervalMs.
   * Updated on every attempt, regardless of outcome — a failed fetch
   * still counts as a poll attempt for rate-limit purposes.
   */
  private lastAttemptAtMs: number | undefined;

  /** Last time fetchOnce() returned a Success (not NoChange). */
  private lastSuccessAtMs: number | undefined;

  /**
   * Consecutive failure count since the last Success. NoChange does
   * not reset this — only a real Success indicates the source is
   * healthy.
   */
  private consecutiveFailures = 0;

  /** Wall-clock time of the first failure in the current streak. */
  private firstFailureInStreakAtMs: number | undefined;

  constructor(deps: SourceAdapterBaseDeps, overrides: SourceAdapterPolicyOverrides = {}) {
    this.auditLog = deps.auditLog;
    this.clock = deps.clock ?? new SystemClock();

    const requestedInterval = overrides.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    if (requestedInterval < DEFAULT_POLL_INTERVAL_MS && !overrides.acknowledgedReason) {
      // Loud throw: the override is structural enough to require code
      // review, not a runtime flag. Better to fail loud at construction
      // than silently let a faster cadence slip into production.
      throw new Error(
        `SourceAdapter pollIntervalMs override below ${DEFAULT_POLL_INTERVAL_MS}ms ` +
          `(got ${requestedInterval}ms) requires an acknowledgedReason. ` +
          `See SourceAdapterPolicyOverrides docstring.`,
      );
    }
    this.pollIntervalMs = requestedInterval;
    this.overrideReason = overrides.acknowledgedReason;
    this.wedgedThresholdMs = overrides.wedgedThresholdMs ?? DEFAULT_WEDGED_THRESHOLD_MS;
  }

  // -----------------------------------------------------------------------
  // Public entry point
  // -----------------------------------------------------------------------

  /**
   * One fetch attempt under the policy layer. The polling loop calls
   * this on its schedule; this method enforces every cross-cutting
   * concern (rate cap, audit, backoff, wedged) so subclasses can't
   * accidentally skip them.
   */
  async fetchOnce(): Promise<FetchResult<TRaw>> {
    const nowMs = this.clock.now();

    // 1. Rate-limit check. If called sooner than pollIntervalMs after
    //    the last attempt, return TransientFailure with retryAfterMs.
    //    This is defensive — the polling loop should also enforce the
    //    schedule, but defense-in-depth keeps a misconfigured loop
    //    from melting the source.
    if (this.lastAttemptAtMs !== undefined) {
      const elapsedSinceLast = nowMs - this.lastAttemptAtMs;
      if (elapsedSinceLast < this.pollIntervalMs) {
        const retryAfterMs = this.pollIntervalMs - elapsedSinceLast;
        const result: FetchResult<TRaw> = {
          kind: "TransientFailure",
          error: `Rate-limited: ${elapsedSinceLast}ms since last attempt (interval ${this.pollIntervalMs}ms)`,
          retryAfterMs,
        };
        await this.writeAudit(result, { rateLimited: true });
        return result;
      }
    }

    this.lastAttemptAtMs = nowMs;

    // 2. Delegate to subclass. Never throws (contract); but defensive
    //    catch in case a subclass violates the contract — convert into
    //    StructuralFailure so the audit + wedged logic still applies.
    let result: FetchResult<TRaw>;
    try {
      result = await this.performFetch({
        userAgent: REGOPS_USER_AGENT,
        attemptStartedAtMs: nowMs,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result = {
        kind: "StructuralFailure",
        error: `performFetch threw (contract violation): ${message}`,
        rawDocSampleRef: "",
      };
    }

    // 3. Apply backoff enrichment + wedged escalation to the raw result.
    result = this.applyFailureBookkeeping(result, nowMs);

    // 4. Write audit. record() returns ok:false rather than throwing on
    //    backend failure; we log the gap to console but do NOT alter
    //    the fetch result — the polling loop must still see the real
    //    outcome.
    await this.writeAudit(result, {});

    return result;
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private applyFailureBookkeeping(
    result: FetchResult<TRaw>,
    nowMs: number,
  ): FetchResult<TRaw> {
    switch (result.kind) {
      case "Success": {
        this.lastSuccessAtMs = nowMs;
        this.consecutiveFailures = 0;
        this.firstFailureInStreakAtMs = undefined;
        return result;
      }
      case "NoChange": {
        // NoChange means we successfully checked and nothing's new.
        // Treat as a non-failure: reset the failure streak so a long
        // run of NoChange + one real failure doesn't auto-wedge.
        this.consecutiveFailures = 0;
        this.firstFailureInStreakAtMs = undefined;
        return result;
      }
      case "TransientFailure":
      case "StructuralFailure": {
        this.consecutiveFailures += 1;
        this.firstFailureInStreakAtMs ??= nowMs;

        // Wedged check: has the failure streak exceeded the threshold?
        const streakStarted = this.firstFailureInStreakAtMs;
        if (nowMs - streakStarted >= this.wedgedThresholdMs) {
          return {
            kind: "SourceWedged",
            lastSuccessAt: new Date(this.lastSuccessAtMs ?? streakStarted),
            error: `Continuous failure for ${nowMs - streakStarted}ms (threshold ${this.wedgedThresholdMs}ms). Latest error: ${result.error}`,
          };
        }

        // Not wedged yet: enrich TransientFailure with our backoff
        // schedule if the subclass didn't supply a retryAfterMs.
        // StructuralFailure is not retried on a schedule — it needs
        // human attention — so we leave it untouched.
        if (result.kind === "TransientFailure" && result.retryAfterMs === undefined) {
          return {
            ...result,
            retryAfterMs: this.computeBackoffMs(this.consecutiveFailures),
          };
        }
        return result;
      }
      case "SourceWedged": {
        // Subclass-emitted SourceWedged is respected as-is; bookkeeping
        // catches up so future success can recover.
        this.consecutiveFailures += 1;
        this.firstFailureInStreakAtMs ??= nowMs;
        return result;
      }
    }
  }

  /**
   * Map consecutive failure count to a backoff delay. n=1 → first
   * entry (1 min), n=5+ → cap (4 h). Exported as a static so tests
   * can assert against the schedule without instantiating an adapter.
   */
  static computeBackoffMs(consecutiveFailures: number): number {
    if (consecutiveFailures <= 0) {
      return 0;
    }
    const idx = Math.min(consecutiveFailures - 1, BACKOFF_SCHEDULE_MS.length - 1);
    // Safe because idx is bounded by BACKOFF_SCHEDULE_MS.length - 1.
    return BACKOFF_SCHEDULE_MS[idx]!;
  }

  /** Instance method form for use from within the class. */
  private computeBackoffMs(consecutiveFailures: number): number {
    return SourceAdapterBase.computeBackoffMs(consecutiveFailures);
  }

  private async writeAudit(
    result: FetchResult<TRaw>,
    extraMetadata: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    const metadata: Record<string, unknown> = {
      consecutive_failures: this.consecutiveFailures,
      ...extraMetadata,
    };
    if (this.overrideReason !== undefined) {
      metadata["poll_interval_override_reason"] = this.overrideReason;
    }

    const entry = entryFromFetchResult({
      sourceId: this.id,
      url: this.url,
      result,
      metadata,
    });
    const writeResult = await this.auditLog.record(entry);
    if (!writeResult.ok) {
      // Audit-log write failures are alert-worthy but MUST NOT change
      // the fetch outcome the polling loop sees. Use console.error so
      // the standard log scraping picks it up; production wiring will
      // also route to Sentry via the runbook's regops.audit_log_write_failed
      // alert. We don't throw because the fetch DID happen — losing the
      // audit row is a gap to remediate, not a reason to skip the diff.
      // eslint-disable-next-line no-console
      console.error(
        `[regops] audit log write failed for source=${this.id}: ${writeResult.error}`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Test-only introspection (NOT in the SourceAdapter interface)
  // -----------------------------------------------------------------------

  /**
   * For unit tests: read the consecutive-failure count without
   * exposing it to production callers. Returns 0 on a clean adapter.
   */
  getConsecutiveFailuresForTest(): number {
    return this.consecutiveFailures;
  }

  getLastAttemptAtMsForTest(): number | undefined {
    return this.lastAttemptAtMs;
  }
}
