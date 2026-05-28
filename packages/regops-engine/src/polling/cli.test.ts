import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DomainTag } from "../sources/index.js";
import type { FetchResult } from "../sources/index.js";

import { ConsoleAlertEmitter } from "./alert-emitter.js";
import { runCli, selectAlertEmitter } from "./cli.js";
import { SentryAlertEmitter } from "./sentry-alert-emitter.js";
import type { PollableAdapter } from "./types.js";

class StubAdapter implements PollableAdapter {
  constructor(
    readonly id: string,
    readonly domainTag: DomainTag,
    private readonly result: FetchResult<unknown>,
  ) {}
  async fetchOnce(): Promise<FetchResult<unknown>> {
    return this.result;
  }
}

describe("runCli", () => {
  it("exit code 0 + success snapshot on stdout + summary on stderr", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const adapter = new StubAdapter("a", "eligibility", {
      kind: "Success",
      data: [{ doc: 1 }],
      fetchedAt: new Date("2026-05-27T12:00:00Z"),
      urlHash: "abc",
    });
    const code = await runCli({
      adapters: [adapter],
      stdout: (l) => stdout.push(l),
      stderr: (l) => stderr.push(l),
    });
    expect(code).toBe(0);
    expect(stdout).toHaveLength(1);
    expect(JSON.parse(stdout[0]!).source_id).toBe("a");
    // One summary line on stderr
    const summary = stderr.map((l) => JSON.parse(l)).find((x) => x.$type === "regops.poll.summary");
    expect(summary?.successes).toBe(1);
  });

  it("exit code 1 when a structural failure occurs", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const adapter = new StubAdapter("a", "eligibility", {
      kind: "StructuralFailure",
      error: "schema drift",
      rawDocSampleRef: "ref",
    });
    const code = await runCli({
      adapters: [adapter],
      stdout: (l) => stdout.push(l),
      stderr: (l) => stderr.push(l),
    });
    expect(code).toBe(1);
    // No snapshot
    expect(stdout).toHaveLength(0);
    // Alert + summary on stderr
    const alertLine = stderr.map((l) => JSON.parse(l)).find((x) => x.$type === "regops.alert");
    expect(alertLine?.name).toBe("regops.source.schema_changed");
  });

  it("exit code 0 when only transient failures occur (next tick will retry)", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const adapter = new StubAdapter("a", "eligibility", {
      kind: "TransientFailure",
      error: "503",
    });
    const code = await runCli({
      adapters: [adapter],
      stdout: (l) => stdout.push(l),
      stderr: (l) => stderr.push(l),
    });
    expect(code).toBe(0);
  });

  it("flushes the alert emitter before returning when flush is defined", async () => {
    let flushCalls = 0;
    const stdout: string[] = [];
    const stderr: string[] = [];
    const adapter = new StubAdapter("a", "eligibility", {
      kind: "TransientFailure",
      error: "rate limited",
    });
    const flushingEmitter = {
      alerts: [] as unknown[],
      async emit(alert: unknown): Promise<void> {
        this.alerts.push(alert);
      },
      async flush(): Promise<boolean> {
        flushCalls += 1;
        return true;
      },
    };
    const code = await runCli({
      adapters: [adapter],
      stdout: (l) => stdout.push(l),
      stderr: (l) => stderr.push(l),
      alertEmitter: flushingEmitter,
    });
    expect(code).toBe(0);
    expect(flushCalls).toBe(1);
  });

  it("logs a flush-timeout diagnostic when flush returns false", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const adapter = new StubAdapter("a", "eligibility", {
      kind: "TransientFailure",
      error: "rate limited",
    });
    const flakyEmitter = {
      alerts: [] as unknown[],
      async emit(alert: unknown): Promise<void> {
        this.alerts.push(alert);
      },
      async flush(): Promise<boolean> {
        return false; // simulate timeout
      },
    };
    await runCli({
      adapters: [adapter],
      stdout: (l) => stdout.push(l),
      stderr: (l) => stderr.push(l),
      alertEmitter: flakyEmitter,
    });
    const diag = stderr
      .map((l) => JSON.parse(l))
      .find((x) => x.$type === "regops.alert_emitter.flush_timeout");
    expect(diag).toBeDefined();
  });
});

describe("selectAlertEmitter", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns ConsoleAlertEmitter when stderr capture is provided (test mode wins)", () => {
    process.env.SENTRY_DSN =
      "https://abc@o4511.ingest.us.sentry.io/4511468839501824";
    const emitter = selectAlertEmitter({ stderr: () => undefined });
    expect(emitter).toBeInstanceOf(ConsoleAlertEmitter);
  });

  it("returns SentryAlertEmitter when SENTRY_DSN is set and no stderr override", () => {
    process.env.SENTRY_DSN =
      "https://abc@o4511.ingest.us.sentry.io/4511468839501824";
    const emitter = selectAlertEmitter({});
    expect(emitter).toBeInstanceOf(SentryAlertEmitter);
  });

  it("returns ConsoleAlertEmitter as the unconfigured fallback", () => {
    const emitter = selectAlertEmitter({});
    expect(emitter).toBeInstanceOf(ConsoleAlertEmitter);
  });

  it("treats empty / whitespace SENTRY_DSN as unset (falls back to console)", () => {
    process.env.SENTRY_DSN = "   ";
    const emitter = selectAlertEmitter({});
    expect(emitter).toBeInstanceOf(ConsoleAlertEmitter);
  });
});
