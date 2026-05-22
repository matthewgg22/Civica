import { describe, it, expect, vi } from "vitest";
import {
  StubUsdaRetailerFetcher,
  syncUsdaRetailers,
  type SyncDeps,
  type UsdaRetailerFetcher,
  type UsdaRetailerRecord,
} from "./usda-retailer-sync.js";

// Hand-rolled supabase-client mock. Records every `.from(table).<verb>...`
// chain so tests can assert against the call shape. Verbs all return
// `{ error: null }` (or a configurable error) and the chain object so
// `.eq()` after `.update()` resolves naturally.
function makeSupabaseMock(options: { upsertError?: { message: string } } = {}) {
  const calls: Array<{ table: string; op: string; payload: unknown }> = [];
  function chain(table: string) {
    const c = {
      update(payload: unknown) {
        calls.push({ table, op: "update", payload });
        return c;
      },
      upsert(rows: unknown, opts?: unknown) {
        calls.push({ table, op: "upsert", payload: { rows, opts } });
        return Promise.resolve({ error: options.upsertError ?? null });
      },
      eq(column: string, value: unknown) {
        calls.push({ table, op: "eq", payload: { column, value } });
        return Promise.resolve({ error: null });
      },
    };
    return c;
  }
  return {
    from(table: string) {
      return chain(table);
    },
    _calls: calls,
  };
}

function makeLog() {
  const entries: Array<{ level: string; msg: string; extra?: unknown }> = [];
  return {
    log: (level: string, msg: string, extra?: unknown) =>
      entries.push({ level, msg, extra }),
    entries,
  };
}

const fixedNow = new Date("2026-05-22T03:00:00.000Z");

function buildDeps(
  fetcher: UsdaRetailerFetcher,
  options: { upsertError?: { message: string } } = {},
): { deps: SyncDeps; supabase: ReturnType<typeof makeSupabaseMock>; log: ReturnType<typeof makeLog> } {
  const supabase = makeSupabaseMock(options);
  const log = makeLog();
  return {
    deps: {
      fetcher,
      // The shape we use is a small subset of SupabaseClient; cast through
      // unknown is enough for these tests.
      supabase: supabase as unknown as SyncDeps["supabase"],
      log: log.log as SyncDeps["log"],
      now: () => fixedNow,
    },
    supabase,
    log,
  };
}

describe("syncUsdaRetailers", () => {
  it("reports stub mode and zero records when the stub fetcher is used", async () => {
    const { deps, supabase, log } = buildDeps(new StubUsdaRetailerFetcher());
    const result = await syncUsdaRetailers(deps);

    expect(result.mode).toBe("stub");
    expect(result.attempted).toBe(0);
    expect(result.upserted).toBe(0);
    expect(result.errored).toBe(0);

    const sourceUpdates = supabase._calls.filter(
      (c) => c.table === "find_help_sources" && c.op === "update",
    );
    expect(sourceUpdates.length).toBeGreaterThanOrEqual(2);
    // Final update marks success.
    const finalUpdate = sourceUpdates.at(-1);
    expect(finalUpdate).toBeDefined();
    const final = finalUpdate!.payload as {
      last_succeeded_at?: string;
      last_error: unknown;
    };
    expect(final.last_succeeded_at).toBe(fixedNow.toISOString());
    expect(final.last_error).toBeNull();

    expect(log.entries.some((e) => e.msg.includes("zero records"))).toBe(true);
  });

  it("upserts records into find_help_locations and reports counts", async () => {
    class TwoRecordFetcher implements UsdaRetailerFetcher {
      async fetchAll(): Promise<UsdaRetailerRecord[]> {
        return [
          {
            usdaAuthorizationNumber: "USDA-001",
            storeName: "Test Market #1",
            addressLine1: "100 Main St",
            city: "Sacramento",
            state: "CA",
            zip: "95814",
            latitude: 38.5816,
            longitude: -121.4944,
          },
          {
            usdaAuthorizationNumber: "USDA-002",
            storeName: "Test Market #2",
            addressLine1: "200 K St",
            city: "Sacramento",
            state: "CA",
            zip: "95816",
            latitude: 38.5749,
            longitude: -121.4789,
          },
        ];
      }
    }

    const { deps, supabase } = buildDeps(new TwoRecordFetcher());
    const result = await syncUsdaRetailers(deps);

    expect(result.mode).toBe("live");
    expect(result.attempted).toBe(2);
    expect(result.upserted).toBe(2);
    expect(result.errored).toBe(0);

    const upsertCalls = supabase._calls.filter(
      (c) => c.table === "find_help_locations" && c.op === "upsert",
    );
    expect(upsertCalls).toHaveLength(1);
    const payload = upsertCalls[0]!.payload as { rows: unknown[]; opts: unknown };
    expect(payload.rows).toHaveLength(2);
    expect(payload.opts).toEqual({ onConflict: "source,external_id" });

    const firstRow = (payload.rows as Array<Record<string, unknown>>)[0]!;
    expect(firstRow.external_id).toBe("USDA-001");
    expect(firstRow.source).toBe("usda");
    expect(firstRow.service_types).toEqual(["ebt_retailer"]);
    expect(firstRow.state).toBe("CA");
    expect(firstRow.active).toBe(true);
  });

  it("records error state when fetch throws and does not upsert", async () => {
    class ThrowingFetcher implements UsdaRetailerFetcher {
      async fetchAll(): Promise<UsdaRetailerRecord[]> {
        throw new Error("network down");
      }
    }

    const { deps, supabase, log } = buildDeps(new ThrowingFetcher());
    const result = await syncUsdaRetailers(deps);

    expect(result.attempted).toBe(0);
    expect(result.errored).toBe(0);

    const upsertCalls = supabase._calls.filter((c) => c.op === "upsert");
    expect(upsertCalls).toHaveLength(0);

    const errorUpdate = supabase._calls.find(
      (c) =>
        c.table === "find_help_sources" &&
        c.op === "update" &&
        (c.payload as { last_error?: string }).last_error === "network down",
    );
    expect(errorUpdate).toBeDefined();

    expect(log.entries.some((e) => e.level === "error" && e.msg.includes("fetch failed"))).toBe(true);
  });

  it("counts upsert-batch errors but does not throw", async () => {
    class OneRecordFetcher implements UsdaRetailerFetcher {
      async fetchAll(): Promise<UsdaRetailerRecord[]> {
        return [
          {
            usdaAuthorizationNumber: "USDA-666",
            storeName: "Doomed Market",
            state: "CA",
            latitude: 34.05,
            longitude: -118.24,
          },
        ];
      }
    }
    const { deps, supabase } = buildDeps(new OneRecordFetcher(), {
      upsertError: { message: "RLS rejected" },
    });

    const result = await syncUsdaRetailers(deps);
    expect(result.errored).toBe(1);
    expect(result.upserted).toBe(0);

    // Sources update at end marks failure (last_succeeded_at is null).
    const sourceUpdates = supabase._calls.filter(
      (c) => c.table === "find_help_sources" && c.op === "update",
    );
    const finalSourcesPayload = sourceUpdates.at(-1)!.payload as {
      last_succeeded_at: unknown;
      last_error: string;
    };
    expect(finalSourcesPayload.last_succeeded_at).toBeNull();
    expect(finalSourcesPayload.last_error).toContain("1 of 1 records failed");
  });
});
