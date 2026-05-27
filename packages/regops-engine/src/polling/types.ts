// Polling-loop types.
//
// The orchestrator is intentionally tiny: it owns variant routing (which
// result kinds become snapshots vs. alerts vs. silent no-ops), and
// nothing else. Persistence and alerting are interfaces (SnapshotStore,
// AlertEmitter) so the same orchestrator runs in tests with in-memory
// fakes, in CI with a JSONL writer, and eventually in production with
// Supabase + Sentry. See docs/regops/runbook.md "Quick reference" for
// the alert names this layer emits.

import type { DomainTag, SourceAdapter } from "../sources/index.js";

/**
 * One successful fetch worth persisting. The store is append-only:
 * each Success becomes a new row; we never overwrite. Diff + supersession
 * walking are downstream concerns.
 */
export interface SnapshotRecord<TRaw = unknown> {
  readonly sourceId: string;
  readonly domainTag: DomainTag;
  readonly fetchedAt: Date;
  readonly urlHash: string;
  readonly data: readonly TRaw[];
}

export interface SnapshotStore {
  record(snapshot: SnapshotRecord): Promise<void>;
}

/**
 * Severity matches the runbook's three tiers. `info` = "happened, no
 * action required"; `warn` = "investigate but don't page"; `page` =
 * "wake somebody up."
 */
export type AlertSeverity = "info" | "warn" | "page";

export interface Alert {
  readonly name: string;
  readonly severity: AlertSeverity;
  readonly sourceId: string;
  readonly message: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AlertEmitter {
  emit(alert: Alert): Promise<void>;
}

/**
 * What a single poll-loop tick produced. The CLI prints a summary;
 * tests assert against the shape. Counts use `polled` for "fetchOnce
 * was called" — distinct from "the source actually returned new data."
 */
export interface PollTickResult {
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly polled: number;
  readonly skipped: number;
  readonly successes: number;
  readonly noChanges: number;
  readonly transientFailures: number;
  readonly structuralFailures: number;
  readonly wedged: number;
  readonly perSource: readonly PerSourcePollResult[];
}

export interface PerSourcePollResult {
  readonly sourceId: string;
  readonly status:
    | "polled-success"
    | "polled-no-change"
    | "polled-transient-failure"
    | "polled-structural-failure"
    | "polled-wedged"
    | "skipped-error";
  readonly error?: string;
}

/**
 * An adapter the polling loop knows how to call. We deliberately keep
 * this loose (id + domainTag + fetchOnce) — anything implementing the
 * public SourceAdapter contract works, no constructor/dependency leakage.
 */
export type PollableAdapter = SourceAdapter<unknown>;
