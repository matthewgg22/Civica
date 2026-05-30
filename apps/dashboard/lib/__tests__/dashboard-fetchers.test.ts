/**
 * Tests for the /dashboard streaming fetchers — focused on the demo-fallback
 * lockstep, the one subtle correctness property of the per-section refactor.
 *
 * The monolithic page derived `useDemoFallback` ONCE (DEMO_FALLBACK flag on
 * AND live packets empty) and swapped all six datasources together. The
 * streaming version reproduces this via fetchPackets() as the single
 * authority: it returns { packets, isDemo }, and every other fetcher reads
 * isDemo from it (cached) to swap in lockstep.
 *
 * Each case uses vi.resetModules() + dynamic import so React.cache() starts
 * fresh (no memoized result bleeding across cases).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIsDemoEnabled = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));

vi.mock("../supabase", () => ({
  createServerClientFromCookies: vi.fn(() => ({
    schema: () => ({ from: mockFrom }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  })),
}));

vi.mock("../demo-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../demo-data")>();
  return { ...actual, isDemoFallbackEnabled: mockIsDemoEnabled };
});

/**
 * Thenable query builder: every chain method returns itself; awaiting (or
 * maybeSingle) resolves to { data, error: null }. `from(table)` routes the
 * data by table name so each fetcher gets its own live result.
 */
function wireTables(dataByTable: Record<string, unknown[]>) {
  mockFrom.mockImplementation((table: string) => {
    const data = dataByTable[table] ?? [];
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "is", "eq", "order", "limit", "gte"]) {
      builder[m] = () => builder;
    }
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
    builder.then = (resolve: (v: unknown) => void) =>
      resolve({ data, error: null });
    return builder;
  });
}

const LIVE_PACKET = {
  packet_id: "live-1",
  status: "Draft",
  state_code: "CA",
  county: "Fresno",
  county_fips: "06019",
  submitted_at: null,
  handed_off_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  applicants: null,
};

async function loadFetchers() {
  vi.resetModules();
  return import("../dashboard-fetchers");
}

describe("dashboard-fetchers — demo-fallback lockstep", () => {
  beforeEach(() => {
    mockIsDemoEnabled.mockReset();
    mockFrom.mockReset();
  });

  it("isDemo=true when flag on AND live packets empty; returns demo fixtures", async () => {
    mockIsDemoEnabled.mockReturnValue(true);
    wireTables({ snap_packets: [] });
    const f = await loadFetchers();

    const { packets, isDemo } = await f.fetchPackets();
    expect(isDemo).toBe(true);
    expect(packets.length).toBeGreaterThan(0); // demo fixtures
  });

  it("isDemo=false when live packets present, even with flag on", async () => {
    mockIsDemoEnabled.mockReturnValue(true);
    wireTables({ snap_packets: [LIVE_PACKET] });
    const f = await loadFetchers();

    const { packets, isDemo } = await f.fetchPackets();
    expect(isDemo).toBe(false);
    expect(packets).toEqual([LIVE_PACKET]);
  });

  it("isDemo=false when flag off, even with live empty", async () => {
    mockIsDemoEnabled.mockReturnValue(false);
    wireTables({ snap_packets: [] });
    const f = await loadFetchers();

    const { packets, isDemo } = await f.fetchPackets();
    expect(isDemo).toBe(false);
    expect(packets).toEqual([]);
  });

  it("fetchHistory swaps to demo fixtures in lockstep when packets isDemo", async () => {
    mockIsDemoEnabled.mockReturnValue(true);
    // History live query would return [] but isDemo short-circuits to fixtures.
    wireTables({ snap_packets: [], packet_status_history: [] });
    const f = await loadFetchers();

    const history = await f.fetchHistory();
    // DEMO_HISTORY is non-empty; lockstep means history came back as fixtures
    // despite the live history query being empty.
    expect(history.length).toBeGreaterThan(0);
  });

  it("fetchHistory uses live data (not fixtures) when packets are live", async () => {
    mockIsDemoEnabled.mockReturnValue(true);
    const liveHistory = [
      {
        history_id: "h1",
        packet_id: "live-1",
        from_status: "Draft",
        to_status: "Submitted for Review",
        occurred_at: "2026-01-02T00:00:00Z",
      },
    ];
    wireTables({ snap_packets: [LIVE_PACKET], packet_status_history: liveHistory });
    const f = await loadFetchers();

    const history = await f.fetchHistory();
    expect(history).toEqual(liveHistory);
  });

  it("fetchMineToday returns zeros for an unauthenticated user", async () => {
    mockIsDemoEnabled.mockReturnValue(false);
    wireTables({ snap_packets: [] });
    const f = await loadFetchers();

    const mine = await f.fetchMineToday();
    expect(mine).toEqual({ transitions: 0, notes: 0, touchedPackets: 0 });
  });
});
