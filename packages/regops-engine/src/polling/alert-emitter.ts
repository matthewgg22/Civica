// AlertEmitter implementations.
//
// v1 ships two:
//   - InMemoryAlertEmitter   — tests assert against the captured array.
//   - ConsoleAlertEmitter    — what the GH Actions cron uses today.
//     Writes a structured JSON line per alert to stderr (stdout is
//     reserved for snapshots). Operators tail stderr and route to
//     Sentry out-of-band in v1. Real SentryAlertEmitter lands when
//     SENTRY_DSN is wired in CI; the interface is intentionally
//     identical so the swap is one line.

import type { Alert, AlertEmitter } from "./types.js";

export class InMemoryAlertEmitter implements AlertEmitter {
  readonly alerts: Alert[] = [];

  async emit(alert: Alert): Promise<void> {
    this.alerts.push(alert);
  }

  byName(name: string): readonly Alert[] {
    return this.alerts.filter((a) => a.name === name);
  }

  bySeverity(severity: Alert["severity"]): readonly Alert[] {
    return this.alerts.filter((a) => a.severity === severity);
  }
}

export type ErrLineWriter = (line: string) => void;

export class ConsoleAlertEmitter implements AlertEmitter {
  private readonly writer: ErrLineWriter;

  constructor(writer?: ErrLineWriter) {
    this.writer =
      writer ??
      ((line: string) => {
        process.stderr.write(`${line}\n`);
      });
  }

  async emit(alert: Alert): Promise<void> {
    this.writer(
      JSON.stringify({
        $type: "regops.alert",
        name: alert.name,
        severity: alert.severity,
        source_id: alert.sourceId,
        message: alert.message,
        ...(alert.metadata !== undefined ? { metadata: alert.metadata } : {}),
      }),
    );
  }
}
