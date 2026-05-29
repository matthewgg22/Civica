import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));
vi.mock("../../middleware/actorContext.js", () => ({
  withActorContext: vi.fn(),
}));

import { makeServiceClient } from "../../lib/supabase.js";
import { withActorContext } from "../../middleware/actorContext.js";
import confirmRouter from "./confirm.js";
import { Hono } from "hono";
import { TEST_ENV, makeMultiTableDbClient, JSON_HEADERS } from "../../test/helpers.js";
import { sha256Hex } from "../../lib/device-token.js";
import type { Env } from "../../types.js";

afterEach(() => vi.resetAllMocks());

const PACKET_ID = "p0000000-0000-0000-0000-000000000001";
const BEARER = "ext-token-secret";
const DEVICE_ACCESS_TOKEN = "device-access-token-confirm";

const ENV: Env = { ...TEST_ENV, EXTENSION_BEARER_TOKEN: BEARER };

function buildApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/v1/enrollment/extension", confirmRouter);
  return app;
}

// See payload.test.ts for the rationale. withActorContext is the DB-client
// source the route consumes; makeServiceClient is still mocked because some
// code paths (e.g., lib/supabase imports) read it at module load.
function mockClient(client: ReturnType<typeof makeMultiTableDbClient>): void {
  vi.mocked(makeServiceClient).mockReturnValue(client);
  vi.mocked(withActorContext).mockResolvedValue(client);
}

const VALID_BODY = JSON.stringify({
  benefitscal_confirmation_number: "BC-12345678",
  benefitscal_application_id: "APP-9876",
});

describe("POST /v1/enrollment/extension/packets/:packetId/confirm — auth gating", () => {
  it("returns 503 when EXTENSION_BEARER_TOKEN is not configured", async () => {
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/confirm`,
      { method: "POST", headers: { Authorization: `Bearer ${BEARER}`, ...JSON_HEADERS }, body: VALID_BODY },
      { ...TEST_ENV, EXTENSION_BEARER_TOKEN: undefined },
    );
    expect(res.status).toBe(503);
  });

  it("returns 401 when Authorization is missing", async () => {
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/confirm`,
      { method: "POST", headers: JSON_HEADERS, body: VALID_BODY },
      ENV,
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /v1/enrollment/extension/packets/:packetId/confirm — body validation", () => {
  it("returns 400 when benefitscal_confirmation_number is missing", async () => {
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/confirm`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${BEARER}`, ...JSON_HEADERS },
        body: JSON.stringify({}),
      },
      ENV,
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /v1/enrollment/extension/packets/:packetId/confirm — behavior", () => {
  it("returns 404 when the packet does not exist", async () => {
    mockClient(
      makeMultiTableDbClient({
        snap_packets: { data: null, error: { code: "PGRST116", message: "no rows" } },
      }),
    );
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/confirm`,
      { method: "POST", headers: { Authorization: `Bearer ${BEARER}`, ...JSON_HEADERS }, body: VALID_BODY },
      ENV,
    );
    expect(res.status).toBe(404);
  });

  it("returns 422 when the packet has no assigned org_id (A3 fix)", async () => {
    mockClient(
      makeMultiTableDbClient({
        snap_packets: {
          data: { packet_id: PACKET_ID, org_id: null },
          error: null,
        },
      }),
    );
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/confirm`,
      { method: "POST", headers: { Authorization: `Bearer ${BEARER}`, ...JSON_HEADERS }, body: VALID_BODY },
      ENV,
    );
    expect(res.status).toBe(422);
    // Hono's HTTPException returns the message as plaintext, not JSON.
    const text = await res.text();
    expect(text).toMatch(/no assigned org/i);
  });

  it("updates an existing in-flight submission row to succeeded with the confirmation number", async () => {
    const existingRow = { submission_id: "sub-1", status: "queued" };
    const updatedRow = {
      submission_id: "sub-1",
      status: "succeeded",
      benefitscal_confirmation_number: "BC-12345678",
      submitted_at: new Date().toISOString(),
    };
    let invocations = 0;
    const dynamicMock = makeMultiTableDbClient({});
    dynamicMock.schema = vi.fn().mockReturnValue({
      from: vi.fn((table: string) => {
        // Auth resolver looks up extension_device_tokens first; legacy shared
        // token path wants this to miss so it falls through to the env compare.
        if (table === "extension_device_tokens") {
          return makeFromMock({ data: null, error: null });
        }
        if (table === "snap_packets") {
          return makeFromMock({ data: { packet_id: PACKET_ID, org_id: "org-001" }, error: null });
        }
        invocations++;
        return makeFromMock({
          data: invocations === 1 ? existingRow : updatedRow,
          error: null,
        });
      }),
    });
    mockClient(dynamicMock);
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/confirm`,
      { method: "POST", headers: { Authorization: `Bearer ${BEARER}`, ...JSON_HEADERS }, body: VALID_BODY },
      ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("succeeded");
    expect(body.benefitscal_confirmation_number).toBe("BC-12345678");
    expect(body.idempotent).toBe(false);
  });

  it("defensively inserts a succeeded row when no prior submission exists", async () => {
    const insertedRow = {
      submission_id: "sub-new",
      status: "succeeded",
      benefitscal_confirmation_number: "BC-12345678",
      submitted_at: new Date().toISOString(),
    };
    let calls = 0;
    const mock = makeMultiTableDbClient({});
    mock.schema = vi.fn().mockReturnValue({
      from: vi.fn((table: string) => {
        // Auth resolver looks up extension_device_tokens first; miss → legacy
        // shared token path.
        if (table === "extension_device_tokens") {
          return makeFromMock({ data: null, error: null });
        }
        if (table === "snap_packets") {
          return makeFromMock({ data: { packet_id: PACKET_ID, org_id: "org-001" }, error: null });
        }
        calls++;
        return makeFromMock({
          data: calls === 1 ? null : insertedRow,
          error: null,
        });
      }),
    });
    mockClient(mock);
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/confirm`,
      { method: "POST", headers: { Authorization: `Bearer ${BEARER}`, ...JSON_HEADERS }, body: VALID_BODY },
      ENV,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.defensive_insert).toBe(true);
    expect(body.benefitscal_confirmation_number).toBe("BC-12345678");
  });
});

async function liveDeviceTokenRow(orgId: string) {
  return {
    token_id: "t-1",
    family_id: "f-1",
    org_id: orgId,
    staff_id: "staff-1",
    access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    rotated_at: null,
    revoked_at: null,
    access_token_hash: await sha256Hex(DEVICE_ACCESS_TOKEN),
  };
}

describe("POST confirm — per-CBO device-token auth", () => {
  it("accepts a valid in-org device token and records the confirmation", async () => {
    const updatedRow = {
      submission_id: "sub-1",
      status: "succeeded",
      benefitscal_confirmation_number: "BC-12345678",
      submitted_at: new Date().toISOString(),
    };
    const mock = makeMultiTableDbClient({});
    let subCalls = 0;
    const liveRow = await liveDeviceTokenRow("org-001");
    mock.schema = vi.fn().mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "extension_device_tokens") {
          return makeFromMock({ data: liveRow, error: null });
        }
        if (table === "snap_packets") {
          return makeFromMock({ data: { packet_id: PACKET_ID, org_id: "org-001" }, error: null });
        }
        subCalls++;
        return makeFromMock({
          data: subCalls === 1 ? { submission_id: "sub-1", status: "queued" } : updatedRow,
          error: null,
        });
      }),
    });
    mockClient(mock);
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/confirm`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${DEVICE_ACCESS_TOKEN}`, ...JSON_HEADERS },
        body: VALID_BODY,
      },
      ENV,
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as Record<string, unknown>).status).toBe("succeeded");
  });

  it("404s on CROSS-ORG access — token org-ZZZ cannot confirm an org-001 packet", async () => {
    const liveRow = await liveDeviceTokenRow("org-ZZZ");
    const mock = makeMultiTableDbClient({});
    let wrote = false;
    mock.schema = vi.fn().mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "extension_device_tokens") {
          return makeFromMock({ data: liveRow, error: null });
        }
        if (table === "snap_packets") {
          return makeFromMock({ data: { packet_id: PACKET_ID, org_id: "org-001" }, error: null });
        }
        // Any write to benefitscal_submissions would be a leak — flag it.
        wrote = true;
        return makeFromMock({ data: null, error: null });
      }),
    });
    mockClient(mock);
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/confirm`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${DEVICE_ACCESS_TOKEN}`, ...JSON_HEADERS },
        body: VALID_BODY,
      },
      ENV,
    );
    expect(res.status).toBe(404);
    expect(wrote).toBe(false); // never touched the submissions table
  });
});

// Local helper: build a fresh query-builder shaped mock for a single .from() call.
function makeFromMock(result: { data: unknown; error: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qb: Record<string, any> = {};
  for (const m of [
    "select", "eq", "is", "order", "limit", "insert", "upsert",
    "update", "delete", "in", "filter", "single", "maybeSingle",
  ]) {
    qb[m] = vi.fn().mockReturnValue(qb);
  }
  qb.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return qb;
}
