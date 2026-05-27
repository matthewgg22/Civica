// Polling orchestrator.
//
// pollOnce() runs one tick across every registered adapter:
//   - calls fetchOnce()
//   - routes the FetchResult variant to either a snapshot, an alert,
//     or a silent log entry
//   - never throws; an adapter that throws unexpectedly is caught and
//     reported in the per-source result as "skipped-error" so the rest
//     of the loop continues. Crashing the whole loop because one
//     adapter is misbehaving would leave the others un-polled too.
//
// What this is NOT:
//   - A scheduler. The orchestrator does not sleep / wait. The caller
//     (GitHub Actions cron) decides cadence. The SourceAdapterBase rate
//     cap defends against over-polling defensively.
//   - A long-running daemon. One tick, one process. Stateless.
//   - A retry engine. TransientFailure is recorded; the next cron tick
//     will retry. The adapter base class already implements backoff
//     enrichment for the retry-soon advice value.

import { assertNever, type FetchResult } from "../sources/index.js";

import type {
  Alert,
  AlertEmitter,
  PerSourcePollResult,
  PollTickResult,
  PollableAdapter,
  SnapshotStore,
} from "./types.js";

export interface PollOnceOptions {
  readonly adapters: readonly PollableAdapter[];
  readonly snapshotStore: SnapshotStore;
  readonly alertEmitter: AlertEmitter;
  /** Test clock injection; defaults to wall time. */
  readonly now?: () => Date;
}

export async function pollOnce(options: PollOnceOptions): Promise<PollTickResult> {
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const perSource: PerSourcePollResult[] = [];

  let successes = 0;
  let noChanges = 0;
  let transientFailures = 0;
  let structuralFailures = 0;
  let wedged = 0;
  let skipped = 0;

  for (const adapter of options.adapters) {
    let result: FetchResult<unknown>;
    try {
      result = await adapter.fetchOnce();
    } catch (err) {
      // SourceAdapterBase.fetchOnce() is contracted to never throw, but
      // defense-in-depth: capture the error, emit an alert, continue.
      const message = err instanceof Error ? err.message : String(err);
      skipped += 1;
      perSource.push({
        sourceId: adapter.id,
        status: "skipped-error",
        error: message,
      });
      await safeEmit(options.alertEmitter, {
        name: "regops.adapter.unexpected_throw",
        severity: "page",
        sourceId: adapter.id,
        message: `Adapter threw from fetchOnce() (contract violation): ${message}`,
      });
      continue;
    }

    perSource.push(classifyResult(adapter.id, result));
    switch (result.kind) {
      case "Success": {
        successes += 1;
        try {
          await options.snapshotStore.record({
            sourceId: adapter.id,
            domainTag: adapter.domainTag,
            fetchedAt: result.fetchedAt,
            urlHash: result.urlHash,
            data: result.data,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await safeEmit(options.alertEmitter, {
            name: "regops.snapshot.write_failed",
            severity: "page",
            sourceId: adapter.id,
            message: `Snapshot store rejected payload: ${message}`,
          });
        }
        break;
      }
      case "NoChange": {
        noChanges += 1;
        break;
      }
      case "TransientFailure": {
        transientFailures += 1;
        await safeEmit(options.alertEmitter, {
          name: "regops.source.fetch_failed",
          severity: "warn",
          sourceId: adapter.id,
          message: result.error,
          ...(result.retryAfterMs !== undefined
            ? { metadata: { retryAfterMs: result.retryAfterMs } }
            : {}),
        });
        break;
      }
      case "StructuralFailure": {
        structuralFailures += 1;
        await safeEmit(options.alertEmitter, {
          name: "regops.source.schema_changed",
          severity: "page",
          sourceId: adapter.id,
          message: result.error,
          metadata: { rawDocSampleRef: result.rawDocSampleRef },
        });
        break;
      }
      case "SourceWedged": {
        wedged += 1;
        await safeEmit(options.alertEmitter, {
          name: "regops.source.wedged",
          severity: "page",
          sourceId: adapter.id,
          message: result.error,
          metadata: { lastSuccessAt: result.lastSuccessAt.toISOString() },
        });
        break;
      }
      default:
        assertNever(result);
    }
  }

  return {
    startedAt,
    finishedAt: now(),
    polled: options.adapters.length - skipped,
    skipped,
    successes,
    noChanges,
    transientFailures,
    structuralFailures,
    wedged,
    perSource,
  };
}

function classifyResult(
  sourceId: string,
  result: FetchResult<unknown>,
): PerSourcePollResult {
  switch (result.kind) {
    case "Success":
      return { sourceId, status: "polled-success" };
    case "NoChange":
      return { sourceId, status: "polled-no-change" };
    case "TransientFailure":
      return { sourceId, status: "polled-transient-failure", error: result.error };
    case "StructuralFailure":
      return { sourceId, status: "polled-structural-failure", error: result.error };
    case "SourceWedged":
      return { sourceId, status: "polled-wedged", error: result.error };
  }
}

/**
 * Wrap AlertEmitter.emit so a misbehaving emitter (Sentry outage,
 * misconfigured token, etc.) doesn't kill the polling loop. We log the
 * emit failure to stderr but otherwise carry on — losing one alert is
 * less bad than losing the rest of the tick.
 */
async function safeEmit(emitter: AlertEmitter, alert: Alert): Promise<void> {
  try {
    await emitter.emit(alert);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(
      `[regops] alert emitter threw for ${alert.name} (${alert.sourceId}): ${message}`,
    );
  }
}
