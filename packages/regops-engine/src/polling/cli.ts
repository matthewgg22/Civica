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
// In v1 the audit log writes to an InMemoryAuditLogWriter — the cron
// process is single-shot, so there's nothing to retain across runs.
// When the regops_audit_log Supabase table is wired in production,
// swap to SupabaseAuditLogWriter here.

import { InMemoryAuditLogWriter } from "../audit/index.js";

import { ConsoleAlertEmitter } from "./alert-emitter.js";
import { pollOnce } from "./orchestrator.js";
import { defaultAdapters } from "./registry.js";
import { JsonlSnapshotStore } from "./snapshot-store.js";

export interface RunCliOptions {
  /** Override the registry for tests. */
  readonly adapters?: ReturnType<typeof defaultAdapters>;
  /** Stdout writer for snapshots (tests). */
  readonly stdout?: (line: string) => void;
  /** Stderr writer for alerts + summary (tests). */
  readonly stderr?: (line: string) => void;
}

/**
 * Return an exit code (0 = healthy, 1 = page-severity outcome).
 * Pure return value rather than process.exit so tests can drive it.
 */
export async function runCli(options: RunCliOptions = {}): Promise<number> {
  const auditLog = new InMemoryAuditLogWriter();
  const adapters = options.adapters ?? defaultAdapters({ auditLog });
  const snapshotStore = new JsonlSnapshotStore(options.stdout);
  const alertEmitter = new ConsoleAlertEmitter(options.stderr);

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
  const writeErr = options.stderr ?? ((l: string) => process.stderr.write(`${l}\n`));
  writeErr(JSON.stringify(summary));

  // Page-severity outcomes fail the CI run. Transient failures don't —
  // they're expected and the next tick will retry.
  if (tick.structuralFailures > 0 || tick.wedged > 0 || tick.skipped > 0) {
    return 1;
  }
  return 0;
}
