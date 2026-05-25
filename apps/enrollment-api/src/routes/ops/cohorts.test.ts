import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from "../../lib/supabase.js";
import cohortsRouter from "./cohorts.js";
import {
  TEST_ENV,
  APPLICANT,
  OPERATOR,
  makeMultiTableDbClient,
  buildTestApp,
} from "../../test/helpers.js";

afterEach(() => vi.resetAllMocks());

describe("GET /ops/cohorts", () => {
  it("rejects non-operator with 403", async () => {
    const app = buildTestApp(cohortsRouter, "/", APPLICANT);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it("returns empty cohorts when no packets are in window", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeMultiTableDbClient({
      snap_packets: { data: [], error: null },
    }));
    const app = buildTestApp(cohortsRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { cohorts: unknown[]; note: string };
    expect(body.cohorts).toEqual([]);
    expect(body.note).toMatch(/30\+ days/);
  });

  it("buckets packets by submitted_at month and joins active cards", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(makeMultiTableDbClient({
      snap_packets: {
        data: [
          { packet_id: "p1", submitted_at: "2026-04-15T00:00:00Z", applicant_id: "a1" },
          { packet_id: "p2", submitted_at: "2026-04-20T00:00:00Z", applicant_id: "a2" },
          { packet_id: "p3", submitted_at: "2026-05-01T00:00:00Z", applicant_id: "a3" },
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
          { user_id: "u1", last_synced_at: "2026-05-24T00:00:00Z", session_cookie_expires_at: "2030-01-01T00:00:00Z" },
          // u2 has no card → not active
          { user_id: "u3", last_synced_at: "2026-05-25T00:00:00Z", session_cookie_expires_at: "2030-01-01T00:00:00Z" },
        ],
        error: null,
      },
    }));
    const app = buildTestApp(cohortsRouter, "/", OPERATOR);
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { cohorts: Array<{ enrollment_month: string; packet_count: number; currently_active: number; active_pct: number }> };
    const april = body.cohorts.find((c) => c.enrollment_month === "2026-04");
    expect(april?.packet_count).toBe(2);
    expect(april?.currently_active).toBe(1);
    expect(april?.active_pct).toBe(50);
    const may = body.cohorts.find((c) => c.enrollment_month === "2026-05");
    expect(may?.packet_count).toBe(1);
    expect(may?.currently_active).toBe(1);
  });
});
