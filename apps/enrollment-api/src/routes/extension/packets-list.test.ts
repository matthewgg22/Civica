/**
 * GET /v1/enrollment/extension/packets — device-token-scoped picker.
 *
 * Security focus: cross-org isolation. A device token for org A must never see
 * org B's packets. We assert this by seeding a token row scoped to org-A and a
 * query mock that records the org_id filter the route applied.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { Hono } from "hono";
import { makeServiceClient } from "../../lib/supabase.js";
import packetsListRouter from "./packets-list.js";
import { TEST_ENV } from "../../test/helpers.js";
import { sha256Hex } from "../../lib/device-token.js";
import type { Env } from "../../types.js";

afterEach(() => vi.resetAllMocks());

const ENV: Env = { ...TEST_ENV, EXTENSION_BEARER_TOKEN: "legacy-shared-secret" };

const ACCESS_TOKEN = "device-access-token-plaintext";
const ORG_A = "org-aaaa";

const PACKET_ROWS = [
  {
    packet_id: "p-1",
    status: "Ready for Handoff",
    county: "Alameda",
    updated_at: "2026-05-28T00:00:00.000Z",
    applicants: { full_name_ciphertext: "snap_v1::name1" },
  },
  {
    packet_id: "p-2",
    status: "Handed Off",
    county: "Fresno",
    updated_at: "2026-05-27T00:00:00.000Z",
    applicants: { full_name_ciphertext: "snap_v1::name2" },
  },
];

function buildApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/v1/enrollment/extension", packetsListRouter);
  return app;
}

/**
 * Builds a service-client mock that:
 *   - resolves the device access token to an org-A scope (extension_device_tokens)
 *   - records the org_id passed to the snap_packets query (.eq('org_id', X))
 *   - returns PACKET_ROWS for the packet list and [] for packet_error_risk
 */
function makeMock(opts: {
  tokenRow: Record<string, unknown> | null;
  capturedOrgId: { value: unknown };
  packets?: Array<Record<string, unknown>>;
}) {
  const tableFrom = (table: string) => {
    if (table === "extension_device_tokens") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: opts.tokenRow, error: null }),
          }),
        }),
      };
    }
    if (table === "snap_packets") {
      // chain: .select().eq('org_id', X).in().is().order()  (thenable)
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = chain;
      builder.eq = (col: string, val: unknown) => {
        if (col === "org_id") opts.capturedOrgId.value = val;
        return builder;
      };
      builder.in = chain;
      builder.is = chain;
      builder.order = chain;
      (builder as { then: unknown }).then = (res: (v: unknown) => unknown) =>
        Promise.resolve({ data: opts.packets ?? PACKET_ROWS, error: null }).then(res);
      return builder;
    }
    if (table === "packet_error_risk") {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = chain;
      builder.in = chain;
      builder.order = chain;
      (builder as { then: unknown }).then = (res: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(res);
      return builder;
    }
    throw new Error(`unexpected table ${table}`);
  };

  return {
    schema: vi.fn().mockReturnValue({ from: vi.fn(tableFrom) }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

async function liveTokenRow(orgId: string) {
  return {
    token_id: "t-1",
    family_id: "f-1",
    org_id: orgId,
    staff_id: "staff-1",
    access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    rotated_at: null,
    revoked_at: null,
    access_token_hash: await sha256Hex(ACCESS_TOKEN),
  };
}

describe("GET /v1/enrollment/extension/packets — auth gating", () => {
  it("401s when no credential is presented", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeMock({ tokenRow: null, capturedOrgId: { value: undefined } }) as never,
    );
    const app = buildApp();
    const res = await app.request("/v1/enrollment/extension/packets", {}, ENV);
    expect(res.status).toBe(401);
  });

  it("403s when authenticated with the LEGACY shared token (picker is per-CBO only)", async () => {
    vi.mocked(makeServiceClient).mockReturnValue(
      makeMock({ tokenRow: null, capturedOrgId: { value: undefined } }) as never,
    );
    const app = buildApp();
    const res = await app.request(
      "/v1/enrollment/extension/packets",
      { headers: { Authorization: "Bearer legacy-shared-secret" } },
      ENV,
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /v1/enrollment/extension/packets — device-token scope", () => {
  it("returns the org's submittable packets and scopes the query to the token's org", async () => {
    const capturedOrgId = { value: undefined as unknown };
    vi.mocked(makeServiceClient).mockReturnValue(
      makeMock({ tokenRow: await liveTokenRow(ORG_A), capturedOrgId }) as never,
    );
    const app = buildApp();
    const res = await app.request(
      "/v1/enrollment/extension/packets",
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } },
      ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      org_id: string;
      packets: Array<{ id: string; applicant_name_ciphertext: string; status: string }>;
    };

    // ISOLATION: the query was filtered to exactly the token's org.
    expect(capturedOrgId.value).toBe(ORG_A);
    expect(body.org_id).toBe(ORG_A);
    expect(body.packets).toHaveLength(2);
    expect(body.packets[0]!.id).toBe("p-1");
    expect(body.packets[0]!.applicant_name_ciphertext).toBe("snap_v1::name1");
    expect(body.packets[0]!.status).toBe("Ready for Handoff");
  });

  it("401s when the device token is revoked (no scope resolved)", async () => {
    const revoked = { ...(await liveTokenRow(ORG_A)), revoked_at: new Date().toISOString() };
    vi.mocked(makeServiceClient).mockReturnValue(
      makeMock({ tokenRow: revoked, capturedOrgId: { value: undefined } }) as never,
    );
    const app = buildApp();
    const res = await app.request(
      "/v1/enrollment/extension/packets",
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } },
      ENV,
    );
    expect(res.status).toBe(401);
  });

  it("401s when the device token's access half has expired", async () => {
    const expired = {
      ...(await liveTokenRow(ORG_A)),
      access_expires_at: new Date(Date.now() - 1000).toISOString(),
    };
    vi.mocked(makeServiceClient).mockReturnValue(
      makeMock({ tokenRow: expired, capturedOrgId: { value: undefined } }) as never,
    );
    const app = buildApp();
    const res = await app.request(
      "/v1/enrollment/extension/packets",
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } },
      ENV,
    );
    expect(res.status).toBe(401);
  });
});
