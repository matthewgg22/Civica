import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  InMemoryAuditLogWriter,
  SupabaseAuditLogWriter,
} from "../audit/index.js";
import type { DomainTag } from "../sources/index.js";
import type { FetchResult } from "../sources/index.js";

import { ConsoleAlertEmitter } from "./alert-emitter.js";
import {
  createSupabaseClientIfConfigured,
  runCli,
  selectAlertEmitter,
  selectAuditLogWriter,
  selectSnapshotStore,
} from "./cli.js";
import { SentryAlertEmitter } from "./sentry-alert-emitter.js";
import {
  JsonlSnapshotStore,
  SupabaseSnapshotStore,
} from "./snapshot-store.js";
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

// ---------------------------------------------------------------------------
// Supabase env helper — must wipe BOTH vars per test so individual cases
// don't bleed env state across each other. Reused by the next three blocks.
// ---------------------------------------------------------------------------

function wipeSupabaseEnv(): void {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// Truthy fake — not a real Supabase client; we only need a non-null
// reference to thread through the selector signatures.
const FAKE_SUPABASE = {} as unknown as SupabaseClient;

describe("createSupabaseClientIfConfigured", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    wipeSupabaseEnv();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns null when both env vars are missing", () => {
    expect(createSupabaseClientIfConfigured()).toBeNull();
  });

  it("returns null when only SUPABASE_URL is set", () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    expect(createSupabaseClientIfConfigured()).toBeNull();
  });

  it("returns null when only SUPABASE_SERVICE_ROLE_KEY is set", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-token";
    expect(createSupabaseClientIfConfigured()).toBeNull();
  });

  it("returns null when either var is empty / whitespace", () => {
    process.env.SUPABASE_URL = "   ";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-token";
    expect(createSupabaseClientIfConfigured()).toBeNull();

    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    expect(createSupabaseClientIfConfigured()).toBeNull();
  });

  it("returns a SupabaseClient when both env vars are set", () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-token";
    const client = createSupabaseClientIfConfigured();
    expect(client).not.toBeNull();
    // Smoke: the real client exposes a `from()` method. We don't call it
    // (would hit the network); just confirm the shape.
    expect(typeof (client as unknown as { from: unknown }).from).toBe(
      "function",
    );
  });
});

describe("selectAuditLogWriter", () => {
  it("returns SupabaseAuditLogWriter when a client is provided", () => {
    const writer = selectAuditLogWriter(FAKE_SUPABASE);
    expect(writer).toBeInstanceOf(SupabaseAuditLogWriter);
  });

  it("returns InMemoryAuditLogWriter as the null-client fallback", () => {
    const writer = selectAuditLogWriter(null);
    expect(writer).toBeInstanceOf(InMemoryAuditLogWriter);
  });
});

describe("selectSnapshotStore", () => {
  it("returns JsonlSnapshotStore when test stdout writer present (test mode wins)", () => {
    const store = selectSnapshotStore(
      { stdout: () => undefined },
      FAKE_SUPABASE,
    );
    expect(store).toBeInstanceOf(JsonlSnapshotStore);
  });

  it("returns SupabaseSnapshotStore when client provided and no stdout override", () => {
    const store = selectSnapshotStore({}, FAKE_SUPABASE);
    expect(store).toBeInstanceOf(SupabaseSnapshotStore);
  });

  it("returns JsonlSnapshotStore as the null-client unconfigured fallback", () => {
    const store = selectSnapshotStore({}, null);
    expect(store).toBeInstanceOf(JsonlSnapshotStore);
  });
});
