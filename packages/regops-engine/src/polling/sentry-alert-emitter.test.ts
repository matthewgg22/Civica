// SentryAlertEmitter test suite.
//
// The real @sentry/node SDK is global-singleton + network-backed; we never
// pull it into a test run. Every test injects a MockSentry that records
// init / captureMessage / flush calls so assertions are precise.
//
// What we test:
//   - DSN validation (empty/missing throws with a discoverable message)
//   - Sentry.init() is called once with the expected shape
//   - captureMessage() carries the right severity level, tags, and contexts
//   - Severity mapping (info→info, warn→warning, page→error)
//   - Metadata is preserved as a context; absent metadata omits the contexts key
//   - flush() proxies through with the configured timeout
//   - Default flush timeout is 2000ms
//   - Environment + release default to env vars when not provided

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Alert } from "./types.js";
import {
  SentryAlertEmitter,
  type SentryCaptureContext,
  type SentryLike,
} from "./sentry-alert-emitter.js";

interface InitCall {
  readonly options: Record<string, unknown>;
}

interface CaptureMessageCall {
  readonly message: string;
  readonly captureContext: SentryCaptureContext | undefined;
}

interface FlushCall {
  readonly timeout: number | undefined;
}

class MockSentry implements SentryLike {
  readonly initCalls: InitCall[] = [];
  readonly captureMessageCalls: CaptureMessageCall[] = [];
  readonly flushCalls: FlushCall[] = [];
  flushResolves = true;

  init(options: Record<string, unknown>): void {
    this.initCalls.push({ options });
  }

  captureMessage(
    message: string,
    captureContext?: SentryCaptureContext,
  ): string {
    this.captureMessageCalls.push({ message, captureContext });
    return "mock-event-id";
  }

  async flush(timeout?: number): Promise<boolean> {
    this.flushCalls.push({ timeout });
    return this.flushResolves;
  }
}

const VALID_DSN =
  "https://abc123@o4511.ingest.us.sentry.io/4511468839501824";

// Snapshot + restore process.env so individual tests don't bleed env
// state into each other.
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // Wipe the env keys SentryAlertEmitter reads, so each test sets them
  // explicitly. Avoids "passes locally, fails in CI" surprises driven
  // by who-set-NODE_ENV-first.
  delete process.env.NODE_ENV;
  delete process.env.GITHUB_SHA;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("SentryAlertEmitter — construction", () => {
  it("throws when DSN is missing", () => {
    expect(
      () =>
        new SentryAlertEmitter({
          dsn: "",
          sentry: new MockSentry(),
        }),
    ).toThrow(/non-empty DSN/);
  });

  it("throws when DSN is whitespace-only", () => {
    expect(
      () =>
        new SentryAlertEmitter({
          dsn: "   \t\n  ",
          sentry: new MockSentry(),
        }),
    ).toThrow(/non-empty DSN/);
  });

  it("error message points the operator at the right config knob", () => {
    expect(
      () =>
        new SentryAlertEmitter({
          dsn: "",
          sentry: new MockSentry(),
        }),
    ).toThrow(/SENTRY_DSN/);
  });

  it("calls Sentry.init exactly once with the provided DSN", () => {
    const mock = new MockSentry();
    new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    expect(mock.initCalls).toHaveLength(1);
    expect(mock.initCalls[0]!.options.dsn).toBe(VALID_DSN);
  });

  it("sets tracesSampleRate to 0 (short-lived cron, no transaction quota)", () => {
    const mock = new MockSentry();
    new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    expect(mock.initCalls[0]!.options.tracesSampleRate).toBe(0);
  });

  it("sets sendDefaultPii to false (safe default for ops cron)", () => {
    const mock = new MockSentry();
    new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    expect(mock.initCalls[0]!.options.sendDefaultPii).toBe(false);
  });

  it("defaults environment to 'production' when NODE_ENV unset", () => {
    const mock = new MockSentry();
    new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    expect(mock.initCalls[0]!.options.environment).toBe("production");
  });

  it("uses NODE_ENV for environment when set", () => {
    process.env.NODE_ENV = "staging";
    const mock = new MockSentry();
    new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    expect(mock.initCalls[0]!.options.environment).toBe("staging");
  });

  it("explicit environment option overrides NODE_ENV", () => {
    process.env.NODE_ENV = "staging";
    const mock = new MockSentry();
    new SentryAlertEmitter({
      dsn: VALID_DSN,
      sentry: mock,
      environment: "prod-cron",
    });

    expect(mock.initCalls[0]!.options.environment).toBe("prod-cron");
  });

  it("defaults release to 'unknown' when GITHUB_SHA unset", () => {
    const mock = new MockSentry();
    new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    expect(mock.initCalls[0]!.options.release).toBe("unknown");
  });

  it("uses GITHUB_SHA for release when set (GH Actions auto-populates this)", () => {
    process.env.GITHUB_SHA = "abc1234deadbeef";
    const mock = new MockSentry();
    new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    expect(mock.initCalls[0]!.options.release).toBe("abc1234deadbeef");
  });
});

describe("SentryAlertEmitter — emit()", () => {
  it("calls captureMessage with name-prefixed message", async () => {
    const mock = new MockSentry();
    const emitter = new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    const alert: Alert = {
      name: "regops.source.fetch_failed",
      severity: "warn",
      sourceId: "federal-register-snap",
      message: "503 Service Unavailable",
    };
    await emitter.emit(alert);

    expect(mock.captureMessageCalls).toHaveLength(1);
    expect(mock.captureMessageCalls[0]!.message).toBe(
      "[regops.source.fetch_failed] 503 Service Unavailable",
    );
  });

  it("maps severity 'info' → Sentry level 'info'", async () => {
    const mock = new MockSentry();
    const emitter = new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    await emitter.emit({
      name: "x",
      severity: "info",
      sourceId: "s",
      message: "m",
    });

    expect(mock.captureMessageCalls[0]!.captureContext?.level).toBe("info");
  });

  it("maps severity 'warn' → Sentry level 'warning'", async () => {
    const mock = new MockSentry();
    const emitter = new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    await emitter.emit({
      name: "x",
      severity: "warn",
      sourceId: "s",
      message: "m",
    });

    expect(mock.captureMessageCalls[0]!.captureContext?.level).toBe("warning");
  });

  it("maps severity 'page' → Sentry level 'error' (the rules-pageable level)", async () => {
    const mock = new MockSentry();
    const emitter = new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    await emitter.emit({
      name: "x",
      severity: "page",
      sourceId: "s",
      message: "m",
    });

    expect(mock.captureMessageCalls[0]!.captureContext?.level).toBe("error");
  });

  it("tags alert with alert_name and source_id (indexed, filterable)", async () => {
    const mock = new MockSentry();
    const emitter = new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    await emitter.emit({
      name: "regops.source.schema_changed",
      severity: "page",
      sourceId: "ca-cdss-acl",
      message: "Index page parse failed",
    });

    expect(mock.captureMessageCalls[0]!.captureContext?.tags).toEqual({
      alert_name: "regops.source.schema_changed",
      source_id: "ca-cdss-acl",
    });
  });

  it("preserves metadata as a Sentry context under 'regops' key", async () => {
    const mock = new MockSentry();
    const emitter = new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    await emitter.emit({
      name: "regops.source.fetch_failed",
      severity: "warn",
      sourceId: "federal-register-snap",
      message: "rate limited",
      metadata: { retryAfterMs: 60_000, attempt: 3 },
    });

    expect(mock.captureMessageCalls[0]!.captureContext?.contexts).toEqual({
      regops: { retryAfterMs: 60_000, attempt: 3 },
    });
  });

  it("omits contexts key entirely when metadata is undefined", async () => {
    const mock = new MockSentry();
    const emitter = new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    await emitter.emit({
      name: "x",
      severity: "info",
      sourceId: "s",
      message: "m",
    });

    const ctx = mock.captureMessageCalls[0]!.captureContext;
    expect(ctx).toBeDefined();
    expect("contexts" in (ctx ?? {})).toBe(false);
  });

  it("does NOT flush per emit (per-emit flush would serialize the loop)", async () => {
    const mock = new MockSentry();
    const emitter = new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    await emitter.emit({
      name: "x",
      severity: "warn",
      sourceId: "s",
      message: "m",
    });
    await emitter.emit({
      name: "y",
      severity: "page",
      sourceId: "s",
      message: "m",
    });

    expect(mock.flushCalls).toHaveLength(0);
  });
});

describe("SentryAlertEmitter — flush()", () => {
  it("proxies through to Sentry.flush with default 2000ms timeout", async () => {
    const mock = new MockSentry();
    const emitter = new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    const ok = await emitter.flush();

    expect(ok).toBe(true);
    expect(mock.flushCalls).toEqual([{ timeout: 2000 }]);
  });

  it("uses configured flushTimeoutMs override", async () => {
    const mock = new MockSentry();
    const emitter = new SentryAlertEmitter({
      dsn: VALID_DSN,
      sentry: mock,
      flushTimeoutMs: 5000,
    });

    await emitter.flush();

    expect(mock.flushCalls).toEqual([{ timeout: 5000 }]);
  });

  it("returns false when Sentry flush times out (events potentially dropped)", async () => {
    const mock = new MockSentry();
    mock.flushResolves = false;
    const emitter = new SentryAlertEmitter({ dsn: VALID_DSN, sentry: mock });

    const ok = await emitter.flush();

    expect(ok).toBe(false);
  });
});
