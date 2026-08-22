// The retention job (#926). What these pin, in order of how badly it would
// hurt to get wrong:
//
//   1. the job uses the SAME windows the policy states (a job purging at 90
//      under a policy promising 7 is the failure the claims test exists for,
//      and it cannot see a number written independently here);
//   2. it expires TEXT, not rows — the accuracy dataset survives;
//   3. flagged rows get the longer window;
//   4. it does not rewrite rows it already expired.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RETENTION_DAYS } from "../legal/types";

const calls = vi.hoisted(() => ({ log: [] as Array<Record<string, unknown>> }));

vi.mock("../supabase-server", () => {
  // Mirrors the real call order: select()/update() first, filters after.
  const filterChain = (state: Record<string, unknown>, terminal: "count" | "update") => {
    const chain: Record<string, unknown> = {
      lt: (_c: string, v: unknown) => { state.cutoff = v; return chain; },
      neq: (_c: string, v: unknown) => { state.skipTombstone = v; return chain; },
      gt: () => { state.flagged = true; return chain; },
      eq: () => { state.flagged = false; return chain; },
      select: async () => { calls.log.push({ ...state }); return { data: [{ id: "1" }], error: null }; },
      then: (res: (v: unknown) => unknown) => {
        calls.log.push({ ...state });
        return Promise.resolve(
          terminal === "count" ? { count: 3, error: null } : { data: [{ id: "1" }], error: null },
        ).then(res);
      },
    };
    return chain;
  };
  const table = {
    select: () => filterChain({ head: true }, "count"),
    update: (patch: Record<string, unknown>) => filterChain({ patch }, "update"),
  };
  return { supabaseAdmin: () => ({ schema: () => ({ from: () => table }) }) };
});

import { runRetentionPurge, cutoffISO, EXPIRED_TOMBSTONE } from "../retention-purge";

beforeEach(() => { calls.log = []; });

const NOW = new Date("2026-08-22T12:00:00.000Z");

describe("the job enforces the windows the policy states", () => {
  it("uses RETENTION_DAYS, not numbers of its own", async () => {
    await runRetentionPurge({ now: NOW });
    const [ordinary, flagged] = calls.log;
    expect(ordinary!.cutoff).toBe(cutoffISO(RETENTION_DAYS.questionText, NOW));
    expect(flagged!.cutoff).toBe(cutoffISO(RETENTION_DAYS.flaggedRow, NOW));
  });

  it("gives flagged rows the longer window — they are the ones somebody may still need", () => {
    expect(RETENTION_DAYS.flaggedRow).toBeGreaterThan(RETENTION_DAYS.questionText);
  });
});

describe("what it destroys, and what it must not", () => {
  it("blanks only the two text columns", async () => {
    await runRetentionPurge({ now: NOW });
    for (const call of calls.log) {
      expect(Object.keys(call.patch as object).sort()).toEqual(["answer", "question_redacted"]);
    }
  });

  it("leaves the accuracy dataset alone — no row deletion anywhere in the job", async () => {
    // citations, certainty, verifier outcome and token counts are what the
    // grounded-rate work runs on, and none of them is personal information.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../retention-purge.ts", import.meta.url), "utf8"),
    );
    expect(src).not.toMatch(/\.delete\(/);
  });

  it("marks expired text with a tombstone rather than NULL", async () => {
    await runRetentionPurge({ now: NOW });
    expect((calls.log[0]!.patch as Record<string, unknown>).question_redacted).toBe(EXPIRED_TOMBSTONE);
  });

  it("skips rows it already expired, so a daily run touches only what newly crossed", async () => {
    await runRetentionPurge({ now: NOW });
    for (const call of calls.log) expect(call.skipTombstone).toBe(EXPIRED_TOMBSTONE);
  });
});

describe("dry run", () => {
  it("counts without writing", async () => {
    const res = await runRetentionPurge({ dryRun: true, now: NOW });
    expect(res.dryRun).toBe(true);
    expect(res.total).toBe(6);
    for (const call of calls.log) expect(call.patch).toBeUndefined();
  });
});
