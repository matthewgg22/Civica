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
// Audit log + snapshot store selection (in order of precedence):
//   1. Test injection via options → that wins.
//   2. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY both set → Supabase
//      backends. Audit log → regops.source_audit_log (migration 20260593);
//      snapshots → regops.snapshots (migration 20260595).
//   3. Otherwise → InMemoryAuditLogWriter + JsonlSnapshotStore. Local
//      dev / unconfigured CI lands here — fetches still happen, audit
//      stays in-process, snapshots get printed to stdout for the run log
//      to capture.
//
// A single SupabaseClient is constructed once per process and shared
// between the audit log writer and the snapshot store — the client has
// internal state and creating two is wasteful.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  InMemoryAuditLogWriter,
  SupabaseAuditLogWriter,
  type AuditLogWriter,
} from "../audit/index.js";

import { ConsoleAlertEmitter } from "./alert-emitter.js";
import { pollOnce } from "./orchestrator.js";
import { defaultAdapters } from "./registry.js";
import { SentryAlertEmitter } from "./sentry-alert-emitter.js";
import { JsonlSnapshotStore, SupabaseSnapshotStore } from "./snapshot-store.js";
import type { AlertEmitter, SnapshotStore } from "./types.js";

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
  /**
   * Override the snapshot store selection (test-only). When omitted,
   * selectSnapshotStore() chooses based on stdout / SUPABASE_URL env.
   */
  readonly snapshotStore?: SnapshotStore;
  /**
   * Override the audit log writer (test-only). When omitted,
   * selectAuditLogWriter() chooses based on SUPABASE_URL env.
   */
  readonly auditLog?: AuditLogWriter;
}

/**
 * Return an exit code (0 = healthy, 1 = page-severity outcome).
 * Pure return value rather than process.exit so tests can drive it.
 */
export async function runCli(options: RunCliOptions = {}): Promise<number> {
  // One Supabase client per process, shared by audit log writer +
  // snapshot store. Returns null when env is unconfigured; the selector
  // helpers handle the fallback.
  const supabase = createSupabaseClientIfConfigured();

  // TEMPORARY DEBUG (revert in follow-up PR): probe PostgREST directly
  // with a raw fetch to verify (a) what URL the cron is actually hitting
  // and (b) what schemas PostgREST really reports as exposed. Helps
  // diagnose the persistent "Invalid schema: regops" error that survived
  // every standard fix (dashboard re-toggle, restart, NOTIFY, explicit
  // grants, both key formats). Only runs when env is configured AND in
  // production (no options.stderr override).
  if (
    options.stderr === undefined &&
    process.env.SUPABASE_URL !== undefined &&
    process.env.SUPABASE_SERVICE_ROLE_KEY !== undefined
  ) {
    await debugProbePostgrest(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  }

  const auditLog = options.auditLog ?? selectAuditLogWriter(supabase);
  const adapters = options.adapters ?? defaultAdapters({ auditLog });
  const snapshotStore =
    options.snapshotStore ?? selectSnapshotStore(options, supabase);
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

/**
 * Decide which AuditLogWriter the polling tick should use. Supabase
 * wins when configured; otherwise in-memory. Local dev / tests / forks
 * without secrets get the in-memory path — audit entries vanish at
 * process exit, which is acceptable for non-prod.
 *
 * Exported for cli.test.ts.
 */
export function selectAuditLogWriter(
  supabase: SupabaseClient | null,
): AuditLogWriter {
  if (supabase !== null) {
    return new SupabaseAuditLogWriter(supabase);
  }
  return new InMemoryAuditLogWriter();
}

/**
 * Decide which SnapshotStore the polling tick should use. Precedence:
 *   1. Test stdout writer present → JsonlSnapshotStore(writer)
 *      preserves the existing cli.test.ts contract where snapshots
 *      land in a captured array.
 *   2. Supabase client configured → SupabaseSnapshotStore (production).
 *   3. Otherwise → JsonlSnapshotStore() to process.stdout. Local dev /
 *      unconfigured CI lands here; snapshots appear in the GH Actions
 *      run log but are NOT queryable after the retention window.
 *
 * Exported for cli.test.ts.
 */
export function selectSnapshotStore(
  options: RunCliOptions,
  supabase: SupabaseClient | null,
): SnapshotStore {
  if (options.stdout !== undefined) {
    return new JsonlSnapshotStore(options.stdout);
  }
  if (supabase !== null) {
    return new SupabaseSnapshotStore(supabase);
  }
  return new JsonlSnapshotStore();
}

/**
 * Build a SupabaseClient if both URL + service-role-key env vars are
 * set; otherwise return null. The service-role key is required because
 * the regops.* tables' RLS policies only allow service_role to INSERT
 * (counsel gets domain-scoped SELECT, but the cron writes, doesn't read).
 *
 * Misconfiguration is handled by returning null rather than throwing —
 * the cron gracefully falls back to in-memory + JSONL so a missing-secret
 * deploy doesn't take down the polling loop. The fallback shows up in
 * the run log as JSONL snapshot lines instead of Supabase writes, which
 * operators notice quickly.
 *
 * Exported for cli.test.ts.
 */
/**
 * TEMPORARY DEBUG (revert in follow-up PR).
 *
 * Hit PostgREST directly with raw fetch — bypasses the Supabase SDK so
 * we see exactly what the API returns. Logs:
 *   - URL last 30 chars (to verify which project the cron talks to;
 *     GH Actions masks the full secret but substrings pass through)
 *   - Service-role key format (legacy "eyJ..." JWT vs new "sb_secret_*"
 *     vs unknown) — tells us if the SDK is using the format PostgREST
 *     expects
 *   - HTTP status + first 600 chars of response body for two probes:
 *       1. GET /rest/v1/  with apikey header → returns OpenAPI spec,
 *          which lists exposed schemas in the `tags` array
 *       2. GET /rest/v1/source_audit_log?select=count with
 *          Accept-Profile: regops → returns either rows or the exact
 *          PostgREST error the SDK is hitting
 *
 * Nothing about this function is correct for production; it's a probe
 * only. The next PR removes it.
 */
async function debugProbePostgrest(url: string, key: string): Promise<void> {
  const log = (msg: string): void => {
    process.stderr.write(`[regops:debug] ${msg}\n`);
  };

  try {
    log(`URL length: ${url.length}`);
    log(`URL last 30: ${url.slice(-30)}`);
    const keyFormat = key.startsWith("eyJ")
      ? "legacy-jwt"
      : key.startsWith("sb_secret_")
        ? "new-secret"
        : "unknown";
    log(`KEY format: ${keyFormat}`);
    log(`KEY length: ${key.length}`);

    // Probe 1: root → OpenAPI spec lists exposed schemas.
    const root = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    log(`root status: ${root.status} ${root.statusText}`);
    const rootBody = (await root.text()).slice(0, 600);
    log(`root body[0:600]: ${rootBody.replace(/\n/g, " ")}`);

    // Probe 2: regops.source_audit_log → reveals the real PostgREST error.
    const r = await fetch(
      `${url}/rest/v1/source_audit_log?select=count`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Accept-Profile": "regops",
        },
      },
    );
    log(`regops probe status: ${r.status} ${r.statusText}`);
    const body = (await r.text()).slice(0, 600);
    log(`regops probe body[0:600]: ${body.replace(/\n/g, " ")}`);
  } catch (err) {
    log(`probe threw: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function createSupabaseClientIfConfigured(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url === undefined || url.trim().length === 0) {
    return null;
  }
  if (key === undefined || key.trim().length === 0) {
    return null;
  }
  return createClient(url, key, {
    auth: {
      // One-shot cron — no user sessions to persist or refresh.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
