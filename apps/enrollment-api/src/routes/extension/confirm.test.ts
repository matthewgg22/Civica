import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  makeAnonClient: vi.fn(),
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from "../../lib/supabase.js";
import confirmRouter from "./confirm.js";
import { Hono } from "hono";
import { TEST_ENV, makeMultiTableDbClient, JSON_HEADERS } from "../../test/helpers.js";
import type { Env } from "../../types.js";

afterEach(() => vi.resetAllMocks());

const PACKET_ID = "p0000000-0000-0000-0000-000000000001";
const BEARER = "ext-token-secret";

const ENV: Env = { ...TEST_ENV, EXTENSION_BEARER_TOKEN: BEARER };

function buildApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/v1/enrollment/extension", confirmRouter);
  return app;
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
    vi.mocked(makeServiceClient).mockReturnValue(
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

  it("updates an existing in-flight submission row to succeeded with the confirmation number", async () => {
    const existingRow = { submission_id: "sub-1", status: "queued" };
    const updatedRow = {
      submission_id: "sub-1",
      status: "succeeded",
      benefitscal_confirmation_number: "BC-12345678",
      submitted_at: new Date().toISOString(),
    };
    vi.mocked(makeServiceClient).mockReturnValue(
      makeMultiTableDbClient({
        snap_packets: {
          data: { packet_id: PACKET_ID, org_id: "org-001" },
          error: null,
        },
        // Sequential reads share one mock entry per table; the update path
        // returns the updated row from a chained .single() call.
        benefitscal_submissions: { data: existingRow, error: null },
      }),
    );
    // The update path goes: select(maybeSingle) → update(single). The mock's
    // shared query builder returns the same data for both, but the second
    // call needs to return the *updated* row. Override the second invocation.
    let invocations = 0;
    const dynamicMock = makeMultiTableDbClient({});
    dynamicMock.schema = vi.fn().mockReturnValue({
      from: vi.fn((table: string) => {
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
    vi.mocked(makeServiceClient).mockReturnValue(dynamicMock);
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
    // benefitscal_submissions select returns null (no in-flight row); next
    // call (insert) returns the new row.
    let calls = 0;
    const mock = makeMultiTableDbClient({});
    mock.schema = vi.fn().mockReturnValue({
      from: vi.fn((table: string) => {
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
    vi.mocked(makeServiceClient).mockReturnValue(mock);
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
