// `bun run regops:poll` entrypoint.
//
// Invoked by .github/workflows/regops-poll.yml on cron schedule.
// Stays minimal:
//   - construct production adapters (registry.ts)
//   - run one pollOnce tick
//   - print a one-line summary to stdout (after any per-snapshot JSONL)
//   - exit non-zero if any source produced StructuralFailure or
//     SourceWedged (both are page-severity per the runbook; failing the
//     workflow makes them impossible to ignore)
//
// Alert emitter selection (in order of precedence):
//   1. Test code passing `stderr` writer → ConsoleAlertEmitter(stderr)
//      preserves the existing cli.test.ts capture pattern.
//   2. process.env.SENTRY_DSN set → SentryAlertEmitter (production cron).
//      The DSN comes from the GH Actions workflow's env passthrough of
//      ${{ secrets.SENTRY_DSN }}.
//   3. Otherwise → ConsoleAlertEmitter() writing to process.stderr.
//      Local dev / unconfigured CI lands here — alerts still appear in
//      logs, just don't reach Sentry.
//
// In v1 the audit log writes to an InMemoryAuditLogWriter — the cron
// process is single-shot, so there's nothing to retain across runs.
// When the regops_audit_log Supabase table is wired in production,
// swap to SupabaseAuditLogWriter here.

import { InMemoryAuditLogWriter } from "../audit/index.js";

import { ConsoleAlertEmitter } from "./alert-emitter.js";
import { pollOnce } from "./orchestrator.js";
import { defaultAdapters } from "./registry.js";
import { SentryAlertEmitter } from "./sentry-alert-emitter.js";
import { JsonlSnapshotStore } from "./snapshot-store.js";
import type { AlertEmitter } from "./types.js";

export interface RunCliOptions {
  /** Override the registry for tests. */
  readonly adapters?: ReturnType<typeof defaultAdapters>;
  /** Stdout writer for snapshots (tests). */
  readonly stdout?: (line: string) => void;
  /** Stderr writer for alerts + summary (tests). */
  readonly stderr?: (line: string) => void;
  /**
   * Override the alert emitter selection (test-only). When omitted, the
   * production path in selectAlertEmitter() applies.
   */
  readonly alertEmitter?: AlertEmitter;
}

/**
 * Return an exit code (0 = healthy, 1 = page-severity outcome).
 * Pure return value rather than process.exit so tests can drive it.
 */
export async function runCli(options: RunCliOptions = {}): Promise<number> {
  const auditLog = new InMemoryAuditLogWriter();
  const adapters = options.adapters ?? defaultAdapters({ auditLog });
  const snapshotStore = new JsonlSnapshotStore(options.stdout);
  const alertEmitter = options.alertEmitter ?? selectAlertEmitter(options);

  const writeErr =
    options.stderr ?? ((l: string) => process.stderr.write(`${l}\n`));

  const tick = await pollOnce({ adapters, snapshotStore, alertEmitter });

  const summary = {
    $type: "regops.poll.summary",
    started_at: tick.startedAt.toISOString(),
    finished_at: tick.finishedAt.toISOString(),
    polled: tick.polled,
    successes: tick.successes,
    no_changes: tick.noChanges,
    transient_failures: tick.transientFailures,
    structural_failures: tick.structuralFailures,
    wedged: tick.wedged,
    skipped: tick.skipped,
  };
  writeErr(JSON.stringify(summary));

  // Drain network-backed emitters (Sentry) before the process exits.
  // Without this, the GH Actions runner can exit before the SDK's
  // transport queue flushes and we lose the alerts we just generated.
  // Console / in-memory emitters have no flush() method and skip this.
  if (alertEmitter.flush !== undefined) {
    const flushed = await alertEmitter.flush();
    if (!flushed) {
      writeErr(
        JSON.stringify({
          $type: "regops.alert_emitter.flush_timeout",
          message:
            "Alert emitter flush() did not complete within its timeout — " +
            "some alerts may have been dropped on process exit.",
        }),
      );
    }
  }

  // Page-severity outcomes fail the CI run. Transient failures don't —
  // they're expected and the next tick will retry.
  if (tick.structuralFailures > 0 || tick.wedged > 0 || tick.skipped > 0) {
    return 1;
  }
  return 0;
}

/**
 * Decide which AlertEmitter the polling tick should use.
 *
 * Exported for cli.test.ts so the decision logic itself is testable
 * (separate from the integration test that drives runCli end-to-end).
 */
export function selectAlertEmitter(options: RunCliOptions): AlertEmitter {
  // Test capture mode wins — preserves the existing cli.test.ts contract.
  if (options.stderr !== undefined) {
    return new ConsoleAlertEmitter(options.stderr);
  }

  const dsn = process.env.SENTRY_DSN;
  if (dsn !== undefined && dsn.trim().length > 0) {
    return new SentryAlertEmitter({ dsn });
  }

  return new ConsoleAlertEmitter();
}
