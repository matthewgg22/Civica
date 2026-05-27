import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import meRedemptionsRouter from "./me-redemptions.js";
import {
  TEST_ENV,
  APPLICANT,
  makeMultiTableDbClient,
  buildTestApp,
} from "../test/helpers.js";
import * as supabase from "../lib/supabase.js";
import type { Env, Variables } from "../types.js";

const OFFER_ID = "11111111-1111-1111-1111-111111111111";

const ACTIVE_OFFER = {
  offer_id: OFFER_ID,
  active: true,
  start_at: null,
  end_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  expected_savings_cents: 750,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

/**
 * Build a mock db where:
 *  - distress_flags returns the configured rows
 *  - partner_offers.maybeSingle resolves to the configured offer
 *  - .rpc('record_redemption', ...) resolves to the configured rpcResult
 *  - ops_audit_log.insert resolves silently
 */
function mockDb({
  distress,
  offer,
  rpcResult,
  rpcError,
  offerError,
}: {
  distress: Array<unknown>;
  offer: typeof ACTIVE_OFFER | null;
  rpcResult?: { redemption_id: string; total_savings_cents: number }[] | null;
  rpcError?: { message: string } | null;
  offerError?: { message: string } | null;
}) {
  const rpcSpy = vi.fn().mockResolvedValue({
    data: rpcResult ?? null,
    error: rpcError ?? null,
  });
  const auditInsertSpy = vi.fn().mockResolvedValue({ error: null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(supabase, "makeServiceClient").mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "distress_flags") {
          const qb = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            then: (res: (v: unknown) => unknown) =>
              Promise.resolve({ data: distress, error: null }).then(res),
          };
          return qb;
        }
        if (table === "partner_offers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: offer, error: offerError ?? null }),
          };
        }
        if (table === "ops_audit_log") {
          return {
            insert: vi.fn().mockReturnValue({
              then: (res: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(res),
              catch: () => null,
            }),
          };
        }
        return { insert: auditInsertSpy };
      }),
    }),
    rpc: rpcSpy,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return { rpcSpy };
}

describe("POST /me/redemptions — happy path", () => {
  it("writes redemption + bumps tally atomically; returns 200 with totals", async () => {
    const { rpcSpy } = mockDb({
      distress: [],
      offer: ACTIVE_OFFER,
      rpcResult: [{ redemption_id: "r-001", total_savings_cents: 4750 }],
    });
    const app = buildTestApp(
      meRedemptionsRouter as Hono<{ Bindings: Env; Variables: Variables }>,
      "/me/redemptions",
      APPLICANT,
    );
    const res = await app.request(
      "/me/redemptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: OFFER_ID, method: "self_attest", savings_cents: 500 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown> & { offers?: Array<Record<string, any>>; free_resources?: any; meta?: any; offer?: any; status?: string; redemption_id?: string; total_savings_cents?: number; savings_cents?: number; capped?: boolean };
    expect(body.status).toBe("ok");
    expect(body.redemption_id).toBe("r-001");
    expect(body.total_savings_cents).toBe(4750);
    expect(body.capped).toBe(false);
    expect(rpcSpy).toHaveBeenCalledWith(
      "record_redemption",
      expect.objectContaining({
        p_user_id: APPLICANT.id,
        p_offer_id: OFFER_ID,
        p_method: "self_attest",
        p_savings_cents: 500,
      }),
    );
  });
});

describe("POST /me/redemptions — anti-inflation cap", () => {
  it("caps savings_cents at offer.expected_savings_cents server-side", async () => {
    const { rpcSpy } = mockDb({
      distress: [],
      offer: ACTIVE_OFFER, // cap = 750
      rpcResult: [{ redemption_id: "r-002", total_savings_cents: 750 }],
    });
    const app = buildTestApp(
      meRedemptionsRouter as Hono<{ Bindings: Env; Variables: Variables }>,
      "/me/redemptions",
      APPLICANT,
    );
    const res = await app.request(
      "/me/redemptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: OFFER_ID, method: "self_attest", savings_cents: 5000 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown> & { offers?: Array<Record<string, any>>; free_resources?: any; meta?: any; offer?: any; status?: string; redemption_id?: string; total_savings_cents?: number; savings_cents?: number; capped?: boolean };
    expect(body.savings_cents).toBe(750); // capped
    expect(body.capped).toBe(true);
    expect(rpcSpy).toHaveBeenCalledWith(
      "record_redemption",
      expect.objectContaining({ p_savings_cents: 750 }),
    );
  });
});

describe("POST /me/redemptions — distress race-condition (REGRESSION, plan T-coverage-2)", () => {
  it("silently no-ops + returns 200 + does NOT call rpc when user is distressed", async () => {
    const { rpcSpy } = mockDb({
      distress: [{ flag_id: "f1" }],
      offer: ACTIVE_OFFER,
      rpcResult: [{ redemption_id: "r-003", total_savings_cents: 0 }],
    });
    const app = buildTestApp(
      meRedemptionsRouter as Hono<{ Bindings: Env; Variables: Variables }>,
      "/me/redemptions",
      APPLICANT,
    );
    const res = await app.request(
      "/me/redemptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: OFFER_ID, method: "self_attest", savings_cents: 500 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200); // appears successful to the user (silent honor)
    expect(rpcSpy).not.toHaveBeenCalled(); // no write happened
    const body = (await res.json()) as Record<string, unknown> & { offers?: Array<Record<string, any>>; free_resources?: any; meta?: any; offer?: any; status?: string; redemption_id?: string; total_savings_cents?: number; savings_cents?: number; capped?: boolean };
    expect(body.status).toBe("ok"); // user cannot tell they were suppressed
  });
});

describe("POST /me/redemptions — offer-state re-checks", () => {
  it("rejects expired offer", async () => {
    const expired = { ...ACTIVE_OFFER, end_at: new Date(Date.now() - 60_000).toISOString() };
    mockDb({ distress: [], offer: expired, rpcResult: null });
    const app = buildTestApp(
      meRedemptionsRouter as Hono<{ Bindings: Env; Variables: Variables }>,
      "/me/redemptions",
      APPLICANT,
    );
    const res = await app.request(
      "/me/redemptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: OFFER_ID, method: "self_attest", savings_cents: 100 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(410);
    const body = (await res.json()) as Record<string, unknown> & { offers?: Array<Record<string, any>>; free_resources?: any; meta?: any; offer?: any; status?: string; redemption_id?: string; total_savings_cents?: number; savings_cents?: number; capped?: boolean };
    expect(body.status).toBe("OFFER_EXPIRED");
  });

  it("rejects deactivated offer", async () => {
    mockDb({ distress: [], offer: { ...ACTIVE_OFFER, active: false }, rpcResult: null });
    const app = buildTestApp(
      meRedemptionsRouter as Hono<{ Bindings: Env; Variables: Variables }>,
      "/me/redemptions",
      APPLICANT,
    );
    const res = await app.request(
      "/me/redemptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: OFFER_ID, method: "self_attest", savings_cents: 100 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(410);
  });

  it("rejects missing offer", async () => {
    mockDb({ distress: [], offer: null });
    const app = buildTestApp(
      meRedemptionsRouter as Hono<{ Bindings: Env; Variables: Variables }>,
      "/me/redemptions",
      APPLICANT,
    );
    const res = await app.request(
      "/me/redemptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: OFFER_ID, method: "self_attest", savings_cents: 100 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(410);
    const body = (await res.json()) as Record<string, unknown> & { offers?: Array<Record<string, any>>; free_resources?: any; meta?: any; offer?: any; status?: string; redemption_id?: string; total_savings_cents?: number; savings_cents?: number; capped?: boolean };
    expect(body.status).toBe("OFFER_NOT_FOUND");
  });
});

describe("POST /me/redemptions — validation", () => {
  it("rejects ocr method in v1 (feature-flag gated until v1.1)", async () => {
    const app = buildTestApp(
      meRedemptionsRouter as Hono<{ Bindings: Env; Variables: Variables }>,
      "/me/redemptions",
      APPLICANT,
    );
    const res = await app.request(
      "/me/redemptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: OFFER_ID, method: "ocr", savings_cents: 500 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it("rejects negative savings_cents", async () => {
    const app = buildTestApp(
      meRedemptionsRouter as Hono<{ Bindings: Env; Variables: Variables }>,
      "/me/redemptions",
      APPLICANT,
    );
    const res = await app.request(
      "/me/redemptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: OFFER_ID, method: "self_attest", savings_cents: -50 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it("rejects implausible $10K+ savings_cents", async () => {
    const app = buildTestApp(
      meRedemptionsRouter as Hono<{ Bindings: Env; Variables: Variables }>,
      "/me/redemptions",
      APPLICANT,
    );
    const res = await app.request(
      "/me/redemptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: OFFER_ID, method: "self_attest", savings_cents: 2_000_000 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it("rejects malformed offer_id", async () => {
    const app = buildTestApp(
      meRedemptionsRouter as Hono<{ Bindings: Env; Variables: Variables }>,
      "/me/redemptions",
      APPLICANT,
    );
    const res = await app.request(
      "/me/redemptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: "not-a-uuid", method: "self_attest", savings_cents: 100 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /me/redemptions — concurrent UPSERT regression (Lane D T-coverage-1)", () => {
  /**
   * The DB-level guarantee is that ON CONFLICT (user_id) DO UPDATE makes
   * the tally bump atomic — the stored function `record_redemption` runs
   * each call in its own transaction. At the route level we cannot truly
   * simulate concurrent PG transactions, but we CAN verify the route never
   * mutates tally state outside of the rpc call (i.e., it doesn't compute
   * the new total in TS before calling rpc and pass it as an argument —
   * that pattern would lose updates).
   *
   * The signature of the rpc call only includes the DELTA (p_savings_cents),
   * never the total. The DB UPSERT does `total = total + EXCLUDED.total`
   * which is concurrency-safe. This test guards that signature.
   */
  it("rpc call only passes the savings delta, never a pre-computed total (UPSERT-safe)", async () => {
    const { rpcSpy } = mockDb({
      distress: [],
      offer: ACTIVE_OFFER,
      rpcResult: [{ redemption_id: "r-conc", total_savings_cents: 1500 }],
    });
    const app = buildTestApp(
      meRedemptionsRouter as Hono<{ Bindings: Env; Variables: Variables }>,
      "/me/redemptions",
      APPLICANT,
    );
    await app.request(
      "/me/redemptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: OFFER_ID, method: "self_attest", savings_cents: 250 }),
      },
      TEST_ENV,
    );
    expect(rpcSpy).toHaveBeenCalledTimes(1);
    const args = rpcSpy.mock.calls[0]![1] as Record<string, unknown>;
    // The DELTA flows to PG; PG does the safe `total = total + EXCLUDED.total`.
    expect(args.p_savings_cents).toBe(250);
    // Belt-and-suspenders: no field named `total` (or similar) leaks into the rpc call.
    expect(args).not.toHaveProperty("p_total_savings_cents");
    expect(args).not.toHaveProperty("p_total");
  });
});
