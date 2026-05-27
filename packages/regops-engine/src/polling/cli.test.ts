import { describe, expect, it } from "vitest";

import type { DomainTag } from "../sources/index.js";
import type { FetchResult } from "../sources/index.js";

import { runCli } from "./cli.js";
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
});
