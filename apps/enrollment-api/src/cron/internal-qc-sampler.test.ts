// Sampler test trio per docs/plans/error-rate-engine-falsification.md (T10 / ENG-D6):
//   - determinism: same packet_id set → same selection across calls.
//   - idempotency: a duplicate cron tick produces no double-inserts
//     (ON CONFLICT path runs).
//   - no-op:      empty submission window → zero writes.
//
// Mock pattern follows memory feedback_vitest_supabase_mock.md:
// makeQueryBuilder for thenable query chains.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase.js", () => ({
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from "../lib/supabase.js";
import {
  runInternalQcSampler,
  packetHashMatches,
  SAMPLE_MODULUS,
} from "./internal-qc-sampler.js";
import { TEST_ENV, makeQueryBuilder } from "../test/helpers.js";

beforeEach(() => {
  vi.resetAllMocks();
});

/**
 * Build a mock supabase client whose schema().from() returns different
 * query builders on successive calls. The sampler makes three queries in
 * order:
 *   1. SELECT packet_id FROM packet_qc_samples WHERE sample_stage='submission'
 *   2. SELECT ... FROM snap_packets WHERE submitted_at IS NOT NULL ...
 *   3. UPSERT INTO packet_qc_samples ... (only if any candidates selected)
 */
function mockDb(opts: {
  existingSamples: Array<{ packet_id: string }>;
  candidates: Array<{
    packet_id: string;
    applicant_id: string;
    org_id: string | null;
    submitted_at: string;
  }>;
  insertResult?: { data: Array<{ sample_id: string }> | null; error: unknown };
  insertSpy?: ReturnType<typeof vi.fn>;
}) {
  const samplesQb = makeQueryBuilder({ data: opts.existingSamples, error: null });
  const packetsQb = makeQueryBuilder({ data: opts.candidates, error: null });
  const insertQb = makeQueryBuilder(
    opts.insertResult ?? { data: [], error: null },
  );

  // Track upsert invocations so the determinism + idempotency tests can
  // assert on the row sets that were sent.
  const upsertSpy = opts.insertSpy ?? vi.fn();
  insertQb.upsert = vi.fn((rows: unknown, opts2: unknown) => {
    upsertSpy(rows, opts2);
    return insertQb;
  });

  vi.mocked(makeServiceClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(samplesQb)
        .mockReturnValueOnce(packetsQb)
        .mockReturnValue(insertQb),
    }),
  } as never);

  return { upsertSpy };
}

// ---------------------------------------------------------------------------
// Find a deterministic set of packet_ids whose hash matches / doesn't match
// the modular selector. We use plain ascending uuids and let the hash speak.
// ---------------------------------------------------------------------------

async function pickHashes(count: number, want: "match" | "miss"): Promise<string[]> {
  const out: string[] = [];
  let i = 0;
  while (out.length < count && i < 100_000) {
    // Use a stable UUID-shaped string so the hash is deterministic across runs.
    const id = `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
    const hit = await packetHashMatches(id);
    if ((want === "match" && hit) || (want === "miss" && !hit)) {
      out.push(id);
    }
    i += 1;
  }
  if (out.length < count) {
    throw new Error(`could not find ${count} ${want} packet_ids within budget`);
  }
  return out;
}

function candidate(id: string, orgIdx = 1) {
  return {
    packet_id: id,
    applicant_id: `a0000000-0000-0000-0000-${id.slice(-12)}`,
    org_id: `01010101-0000-0000-0000-${String(orgIdx).padStart(12, "0")}`,
    submitted_at: "2026-05-27T10:00:00.000Z",
  };
}

describe("packetHashMatches", () => {
  it("is deterministic across calls", async () => {
    const id = "11111111-2222-3333-4444-555555555555";
    const a = await packetHashMatches(id);
    const b = await packetHashMatches(id);
    expect(a).toBe(b);
  });

  it(`selects roughly 1/${SAMPLE_MODULUS} of inputs over a large sample`, async () => {
    const N = 500;
    let hits = 0;
    for (let i = 0; i < N; i++) {
      // eslint-disable-next-line no-await-in-loop
      if (await packetHashMatches(`pkt-${i}`)) hits += 1;
    }
    // Loose bounds — we just want to catch obvious bias (always-0, always-1,
    // off-by-one mod). ~10% expected; allow 3-18% to keep this stable.
    expect(hits).toBeGreaterThanOrEqual(N * 0.03);
    expect(hits).toBeLessThanOrEqual(N * 0.18);
  });
});

describe("runInternalQcSampler", () => {
  // -------------------------------------------------------------------------
  // T10.3 — no-op: empty submission window → zero writes.
  // -------------------------------------------------------------------------
  it("returns zero counts and never calls upsert when no candidates exist", async () => {
    const { upsertSpy } = mockDb({
      existingSamples: [],
      candidates: [],
    });

    const result = await runInternalQcSampler(TEST_ENV);

    expect(result).toEqual({
      candidates: 0,
      selected: 0,
      inserted: 0,
      skipped_no_org: 0,
    });
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // T10.1 — determinism: same packet_id set → same selection across calls.
  // -------------------------------------------------------------------------
  it("selects the same packet_ids across repeated invocations", async () => {
    const matchIds = await pickHashes(3, "match");
    const missIds = await pickHashes(3, "miss");
    const all = [...matchIds, ...missIds].map((id) => candidate(id));

    // First run
    const spy1 = vi.fn();
    mockDb({ existingSamples: [], candidates: all, insertSpy: spy1 });
    const r1 = await runInternalQcSampler(TEST_ENV);

    // Second run with the same candidate set
    const spy2 = vi.fn();
    mockDb({ existingSamples: [], candidates: all, insertSpy: spy2 });
    const r2 = await runInternalQcSampler(TEST_ENV);

    expect(r1.selected).toBe(matchIds.length);
    expect(r2.selected).toBe(matchIds.length);

    // Pull the packet_ids that each run handed to upsert; assert identical.
    const ids1 = (spy1.mock.calls[0]?.[0] as Array<{ packet_id: string }>).map((r) => r.packet_id).sort();
    const ids2 = (spy2.mock.calls[0]?.[0] as Array<{ packet_id: string }>).map((r) => r.packet_id).sort();
    expect(ids1).toEqual(matchIds.sort());
    expect(ids2).toEqual(matchIds.sort());
    expect(ids1).toEqual(ids2);
  });

  // -------------------------------------------------------------------------
  // T10.2 — idempotency: duplicate cron tick → no double-inserts.
  // The ON CONFLICT (packet_id, sample_stage) DO NOTHING contract is delegated
  // to Postgres via supabase-js upsert(..., { ignoreDuplicates: true }). Test
  // verifies the SUT actually requests that semantic AND that a second tick
  // (with the same packet already in packet_qc_samples) flows through with
  // zero candidates re-selected.
  // -------------------------------------------------------------------------
  it("requests upsert with ignoreDuplicates so a re-tick is idempotent", async () => {
    const matchIds = await pickHashes(2, "match");
    const candidates = matchIds.map((id) => candidate(id));

    const spy = vi.fn();
    mockDb({ existingSamples: [], candidates, insertSpy: spy });

    await runInternalQcSampler(TEST_ENV);

    expect(spy).toHaveBeenCalledTimes(1);
    const [rows, opts] = spy.mock.calls[0]!;
    expect(opts).toEqual({ onConflict: "packet_id,sample_stage", ignoreDuplicates: true });
    expect(Array.isArray(rows)).toBe(true);
    // Every row written must be tagged with sample_stage='submission'.
    for (const row of rows as Array<{ sample_stage: string }>) {
      expect(row.sample_stage).toBe("submission");
    }
  });

  it("skips packets already sampled at submission stage (idempotent across ticks)", async () => {
    const matchIds = await pickHashes(2, "match");
    const candidates = matchIds.map((id) => candidate(id));

    // Tick 2: both candidates are already sampled. Expect zero new selections.
    const spy = vi.fn();
    mockDb({
      existingSamples: matchIds.map((packet_id) => ({ packet_id })),
      candidates,
      insertSpy: spy,
    });

    const result = await runInternalQcSampler(TEST_ENV);

    expect(result).toEqual({
      candidates: 0, // pre-filtered out before hashing
      selected: 0,
      inserted: 0,
      skipped_no_org: 0,
    });
    expect(spy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Defensive: packets missing org_id (nullable on snap_packets, NOT NULL on
  // packet_qc_samples) are counted into skipped_no_org and never inserted.
  // -------------------------------------------------------------------------
  it("drops packets missing org_id and surfaces the count", async () => {
    const matchIds = await pickHashes(2, "match");
    const candidates = [
      { ...candidate(matchIds[0]!), org_id: null },
      candidate(matchIds[1]!),
    ];

    const spy = vi.fn();
    mockDb({ existingSamples: [], candidates, insertSpy: spy });

    const result = await runInternalQcSampler(TEST_ENV);

    expect(result.selected).toBe(1);
    expect(result.skipped_no_org).toBe(1);
    const rows = spy.mock.calls[0]?.[0] as Array<{ org_id: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.org_id).not.toBeNull();
  });
});
