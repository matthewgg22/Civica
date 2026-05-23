import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock("../../middleware/actorContext.js", () => ({
  withActorContext: vi.fn(),
}));

import { makeServiceClient } from "../../lib/supabase.js";
import notificationsRouter from "./notifications.js";
import {
  TEST_ENV,
  APPLICANT,
  NAVIGATOR,
  BUDDY,
  makeDbClient,
  buildTestApp,
  JSON_HEADERS,
} from "../../test/helpers.js";

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

const HEX_TOKEN = "deadbeefcafef00d".repeat(4); // 64-char hex

// ─── POST /register ───────────────────────────────────────────────────────

describe("POST /ebt/notifications/register", () => {
  it("rejects non-applicant actors (buddy) with 403", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const res = await buildTestApp(notificationsRouter, "/", BUDDY).request(
      "/register",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ apns_token: HEX_TOKEN, platform: "ios" }) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it("rejects non-applicant actors (navigator) with 403", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const res = await buildTestApp(notificationsRouter, "/", NAVIGATOR).request(
      "/register",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ apns_token: HEX_TOKEN, platform: "ios" }) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it("422 (zod) when apns_token is non-hex", async () => {
    const res = await buildTestApp(notificationsRouter, "/", APPLICANT).request(
      "/register",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ apns_token: "not-hex!!!".padEnd(32, "x"), platform: "ios" }) },
      TEST_ENV,
    );
    // hono/zod-validator returns 400 by default for bad json body
    expect([400, 422]).toContain(res.status);
  });

  it("422 (zod) when apns_token shorter than 32 chars", async () => {
    const res = await buildTestApp(notificationsRouter, "/", APPLICANT).request(
      "/register",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ apns_token: "deadbeef", platform: "ios" }) },
      TEST_ENV,
    );
    expect([400, 422]).toContain(res.status);
  });

  it("422 (zod) when platform != 'ios'", async () => {
    const res = await buildTestApp(notificationsRouter, "/", APPLICANT).request(
      "/register",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ apns_token: HEX_TOKEN, platform: "android" }) },
      TEST_ENV,
    );
    expect([400, 422]).toContain(res.status);
  });

  it("201 on happy path; upserts with onConflict=apns_token (token rotation)", async () => {
    const upsertCalls: unknown[][] = [];
    const upsertFn = vi.fn().mockImplementation((row, opts) => {
      upsertCalls.push([row, opts]);
      return Promise.resolve({ data: null, error: null });
    });
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ upsert: upsertFn }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await buildTestApp(notificationsRouter, "/", APPLICANT).request(
      "/register",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ apns_token: HEX_TOKEN, platform: "ios" }) },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);

    expect(upsertCalls).toHaveLength(1);
    const [row, opts] = upsertCalls[0]!;
    expect((row as { user_id: string }).user_id).toBe(APPLICANT.id);
    expect((row as { apns_token: string }).apns_token).toBe(HEX_TOKEN.toLowerCase());
    expect((row as { platform: string }).platform).toBe("ios");
    expect((opts as { onConflict: string }).onConflict).toBe("apns_token");
  });

  it("lowercases mixed-case tokens before upsert", async () => {
    const upsertFn = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ upsert: upsertFn }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const mixed = "DEADBEEF".repeat(8);
    await buildTestApp(notificationsRouter, "/", APPLICANT).request(
      "/register",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ apns_token: mixed, platform: "ios" }) },
      TEST_ENV,
    );
    expect(upsertFn.mock.calls[0]![0].apns_token).toBe(mixed.toLowerCase());
  });

  it("500 when database upsert errors", async () => {
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await buildTestApp(notificationsRouter, "/", APPLICANT).request(
      "/register",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ apns_token: HEX_TOKEN, platform: "ios" }) },
      TEST_ENV,
    );
    expect(res.status).toBe(500);
  });
});

// ─── POST /prefs ──────────────────────────────────────────────────────────

describe("POST /ebt/notifications/prefs", () => {
  const validBody = {
    deposit_on: true,
    low_balance_on: false,
    perks_on: true,
    recert_on: true,
    quiet_start_minutes: 21 * 60,
    quiet_end_minutes: 8 * 60,
  };

  it("rejects non-applicant with 403", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const res = await buildTestApp(notificationsRouter, "/", BUDDY).request(
      "/prefs",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(validBody) },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it("422 when quiet_start_minutes >= 24*60", async () => {
    const res = await buildTestApp(notificationsRouter, "/", APPLICANT).request(
      "/prefs",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ ...validBody, quiet_start_minutes: 24 * 60 }) },
      TEST_ENV,
    );
    expect([400, 422]).toContain(res.status);
  });

  it("422 when a toggle is missing", async () => {
    const { deposit_on: _omit, ...incomplete } = validBody;
    const res = await buildTestApp(notificationsRouter, "/", APPLICANT).request(
      "/prefs",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(incomplete) },
      TEST_ENV,
    );
    expect([400, 422]).toContain(res.status);
  });

  it("200 on happy path; upserts with onConflict=user_id", async () => {
    const upsertFn = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ upsert: upsertFn }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await buildTestApp(notificationsRouter, "/", APPLICANT).request(
      "/prefs",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(validBody) },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);

    expect(upsertFn).toHaveBeenCalledTimes(1);
    const [row, opts] = upsertFn.mock.calls[0]!;
    expect((row as { user_id: string }).user_id).toBe(APPLICANT.id);
    expect((row as { deposit_on: boolean }).deposit_on).toBe(true);
    expect((row as { low_balance_on: boolean }).low_balance_on).toBe(false);
    expect((opts as { onConflict: string }).onConflict).toBe("user_id");
  });

  it("500 on db error", async () => {
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await buildTestApp(notificationsRouter, "/", APPLICANT).request(
      "/prefs",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(validBody) },
      TEST_ENV,
    );
    expect(res.status).toBe(500);
  });
});

// ─── GET /prefs ───────────────────────────────────────────────────────────

describe("GET /ebt/notifications/prefs", () => {
  it("rejects non-applicant with 403", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const res = await buildTestApp(notificationsRouter, "/", BUDDY).request("/prefs", {}, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it("returns persisted row when one exists", async () => {
    const stored = {
      deposit_on: false,
      low_balance_on: true,
      perks_on: false,
      recert_on: true,
      quiet_start_minutes: 22 * 60,
      quiet_end_minutes: 7 * 60,
    };
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: stored, error: null }));
    const res = await buildTestApp(notificationsRouter, "/", APPLICANT).request("/prefs", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(stored);
  });

  it("returns plan-default prefs when no row exists (new user)", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: null }));
    const res = await buildTestApp(notificationsRouter, "/", APPLICANT).request("/prefs", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.deposit_on).toBe(true);
    expect(body.low_balance_on).toBe(true);
    expect(body.perks_on).toBe(true);
    expect(body.recert_on).toBe(true);
    expect(body.quiet_start_minutes).toBe(21 * 60);
    expect(body.quiet_end_minutes).toBe(8 * 60);
  });

  it("500 on db error", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeDbClient({ data: null, error: { message: "boom" } }));
    const res = await buildTestApp(notificationsRouter, "/", APPLICANT).request("/prefs", {}, TEST_ENV);
    expect(res.status).toBe(500);
  });
});
