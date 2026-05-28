// SentryAlertEmitter — Sentry-backed alert delivery for the polling loop.
//
// Wired by cli.ts when process.env.SENTRY_DSN is set; otherwise the cron
// falls back to ConsoleAlertEmitter (alerts visible in the GH Actions
// run log but not paged anywhere).
//
// Lifecycle for the short-lived GH Actions process:
//
//   1. Constructor calls Sentry.init() with the provided DSN. Init is
//      idempotent across SentryAlertEmitter instances in the same process,
//      but we never construct more than one in production.
//
//   2. emit() calls Sentry.captureMessage(). It does NOT flush per emit;
//      flushing is a synchronous network wait of up to flushTimeoutMs and
//      doing it per-alert would serialize the polling loop on Sentry's
//      ingest endpoint. Capture is fire-and-forget at this layer.
//
//   3. cli.ts MUST call flush() before the process exits. Without an
//      explicit flush, the Node process exits before Sentry's transport
//      drains its queue and the events are silently dropped. This is the
//      #1 footgun for Sentry in short-lived processes; see
//      https://docs.sentry.io/platforms/node/configuration/draining/.
//
// Severity mapping:
//   info -> "info"     (logged, no email/page by default)
//   warn -> "warning"  (logged, alert rules can elevate)
//   page -> "error"    (default Sentry alert rules page on these)
//
// Tags vs contexts:
//   - alert_name + source_id are TAGS — indexed, filterable in Sentry UI.
//   - metadata is a CONTEXT — searchable but not indexed, free-form shape.
//
// References:
//   - docs/regops/runbook.md "Quick reference" for the alert names this
//     layer receives (per types.ts AlertEmitter contract)
//   - packages/regops-engine/src/polling/alert-emitter.ts for the
//     ConsoleAlertEmitter sibling impl

import * as Sentry from "@sentry/node";

import type { Alert, AlertEmitter, AlertSeverity } from "./types.js";

/**
 * Minimal slice of the Sentry SDK surface we depend on. Lets tests
 * inject a mock without pulling in the real SDK or hitting the network.
 *
 * Method shapes mirror @sentry/node v8 but stay structural so a future
 * SDK rev doesn't force a test rewrite (as long as these three calls
 * keep the same signature).
 */
export interface SentryLike {
  init(options: Sentry.NodeOptions): void;
  captureMessage(message: string, captureContext?: SentryCaptureContext): string;
  flush(timeout?: number): Promise<boolean>;
}

/**
 * Subset of Sentry's CaptureContext we use. Kept narrow so the mock
 * surface stays small.
 */
export interface SentryCaptureContext {
  readonly level?: "fatal" | "error" | "warning" | "log" | "info" | "debug";
  readonly tags?: Readonly<Record<string, string>>;
  readonly contexts?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

export interface SentryAlertEmitterOptions {
  /**
   * Sentry DSN. Required. Throws on missing/empty so misconfigured
   * cron runs fail loud rather than silently dropping alerts.
   */
  readonly dsn: string;

  /**
   * Override the Sentry SDK surface for tests. Production omits this
   * and uses the real @sentry/node module.
   */
  readonly sentry?: SentryLike;

  /**
   * How long flush() waits for queued events to ship before giving up.
   * Default 2000ms — matches Sentry's recommended floor for short-lived
   * processes. Increase if the cron runs in a region with high latency
   * to Sentry's ingest endpoint.
   */
  readonly flushTimeoutMs?: number;

  /**
   * Environment tag. Defaults to process.env.NODE_ENV or "production".
   * Lets staging cron runs (if we ever wire one) land in a separate
   * Sentry environment without alert rules paging.
   */
  readonly environment?: string;

  /**
   * Release identifier. Defaults to process.env.GITHUB_SHA (set by
   * GH Actions automatically) or "unknown". Lets Sentry group events
   * by release and surface "introduced in" / "regressed in" links.
   */
  readonly release?: string;
}

export class SentryAlertEmitter implements AlertEmitter {
  private readonly sentry: SentryLike;
  private readonly flushTimeoutMs: number;

  constructor(options: SentryAlertEmitterOptions) {
    if (!options.dsn || options.dsn.trim().length === 0) {
      throw new Error(
        "SentryAlertEmitter requires a non-empty DSN. Did you forget to set " +
          "SENTRY_DSN in the GH Actions workflow secrets?",
      );
    }

    this.sentry = options.sentry ?? (Sentry as unknown as SentryLike);
    this.flushTimeoutMs = options.flushTimeoutMs ?? 2000;

    this.sentry.init({
      dsn: options.dsn,
      environment: options.environment ?? process.env.NODE_ENV ?? "production",
      release: options.release ?? process.env.GITHUB_SHA ?? "unknown",
      // Short-lived cron: no transaction sampling, no profiling. We only
      // use captureMessage; turning these off keeps the SDK's footprint
      // minimal and avoids spending event quota on noise.
      tracesSampleRate: 0,
      // PII for an internal ops cron is just URLs + HTTP status codes
      // (no user data passes through the polling loop). Defaults off
      // is the safe choice — we'd rather opt in explicitly if needed.
      sendDefaultPii: false,
    });
  }

  async emit(alert: Alert): Promise<void> {
    const captureContext: SentryCaptureContext = {
      level: severityToSentryLevel(alert.severity),
      tags: {
        alert_name: alert.name,
        source_id: alert.sourceId,
      },
      ...(alert.metadata !== undefined
        ? { contexts: { regops: alert.metadata } }
        : {}),
    };

    // Prefix message with the alert name so the Sentry issue list is
    // legible at a glance. The alert_name tag is the canonical filter
    // key; the prefix is just human ergonomics.
    this.sentry.captureMessage(`[${alert.name}] ${alert.message}`, captureContext);

    // No await on flush here — flushing per emit serializes the polling
    // loop on Sentry's ingest endpoint. cli.ts is responsible for one
    // tick-end flush. See file header for why.
  }

  /**
   * Wait for queued alerts to be transmitted before the process exits.
   * Returns true if all events flushed within the timeout; false
   * indicates some events may have been dropped (which is logged to
   * stderr by the caller).
   */
  async flush(): Promise<boolean> {
    return this.sentry.flush(this.flushTimeoutMs);
  }
}

function severityToSentryLevel(s: AlertSeverity): "info" | "warning" | "error" {
  switch (s) {
    case "info":
      return "info";
    case "warn":
      return "warning";
    case "page":
      return "error";
  }
}
