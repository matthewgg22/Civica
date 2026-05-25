import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from "../../lib/supabase.js";
import ttfdRouter from "./ttfd.js";
import {
  TEST_ENV,
  APPLICANT,
  OPERATOR,
  makeMultiTableDbClient,
  buildTestApp,
} from "../../test/helpers.js";

afterEach(() => vi.resetAllMocks());

describe("GET /ops/ttfd", () => {
  it("rejects non-operator with 403", async () => {
    const app = buildTestApp(ttfdRouter, "/", APPLICANT);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it("returns null median when no packets are submitted", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeMultiTableDbClient({
      snap_packets: { data: [], error: null },
    }));
    const app = buildTestApp(ttfdRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { median_days: number | null; county_trend: unknown[]; note: string };
    expect(body.median_days).toBeNull();
    expect(body.county_trend).toEqual([]);
  });

  it("computes median TTFD and per-county trend across packets with deposits", async () => {
    const submittedAt = "2026-05-01T00:00:00Z";
    vi.mocked(makeServiceClient).mockReturnValue(makeMultiTableDbClient({
      snap_packets: {
        data: [
          { packet_id: "p1", submitted_at: submittedAt, applicant_id: "a1", county_fips: "06001" },
          { packet_id: "p2", submitted_at: submittedAt, applicant_id: "a2", county_fips: "06001" },
          { packet_id: "p3", submitted_at: submittedAt, applicant_id: "a3", county_fips: "06067" },
        ],
        error: null,
      },
      applicants: {
        data: [
          { applicant_id: "a1", auth_uid: "u1" },
          { applicant_id: "a2", auth_uid: "u2" },
          { applicant_id: "a3", auth_uid: "u3" },
        ],
        error: null,
      },
      ebt_cards: {
        data: [
          { id: "c1", user_id: "u1" },
          { id: "c2", user_id: "u2" },
          { id: "c3", user_id: "u3" },
        ],
        error: null,
      },
      ebt_deposits: {
        data: [
          { card_id: "c1", posted_at: "2026-05-04T00:00:00Z" }, // 3 days
          { card_id: "c2", posted_at: "2026-05-09T00:00:00Z" }, // 8 days
          { card_id: "c3", posted_at: "2026-05-11T00:00:00Z" }, // 10 days
        ],
        error: null,
      },
    }));
    const app = buildTestApp(ttfdRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      median_days: number;
      n: number;
      county_trend: Array<{ county_fips: string; n: number; median_days: number }>;
    };
    expect(body.n).toBe(3);
    expect(body.median_days).toBe(8);
    const alameda = body.county_trend.find((c) => c.county_fips === "06001");
    expect(alameda?.n).toBe(2);
    expect(alameda?.median_days).toBe(5.5);
  });

  it("skips packets whose applicant has no deposit", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeMultiTableDbClient({
      snap_packets: {
        data: [{ packet_id: "p1", submitted_at: "2026-05-01T00:00:00Z", applicant_id: "a1", county_fips: "06001" }],
        error: null,
      },
      applicants: { data: [{ applicant_id: "a1", auth_uid: "u1" }], error: null },
      ebt_cards: { data: [{ id: "c1", user_id: "u1" }], error: null },
      ebt_deposits: { data: [], error: null },
    }));
    const app = buildTestApp(ttfdRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { median_days: number | null; n: number };
    expect(body.median_days).toBeNull();
    expect(body.n).toBe(0);
  });
});
