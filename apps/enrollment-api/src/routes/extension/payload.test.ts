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
import payloadRouter from "./payload.js";
import { Hono } from "hono";
import { TEST_ENV, makeMultiTableDbClient } from "../../test/helpers.js";
import type { Env } from "../../types.js";

afterEach(() => vi.resetAllMocks());

const PACKET_ID = "p0000000-0000-0000-0000-000000000001";
const BEARER = "ext-token-secret";

const packetRow = {
  packet_id: PACKET_ID,
  status: "Ready for Handoff",
  state_code: "CA",
  org_id: "org-001",
  county: "Alameda",
  submitted_at: null,
  applicants: {
    applicant_id: "a0000000-0000-0000-0000-000000000001",
    full_name_ciphertext: "snap_v1::xxx",
    date_of_birth_ciphertext: "snap_v1::yyy",
    phone_ciphertext: null,
    address_ciphertext: null,
    preferred_language: "en",
  },
};

const ENV: Env = { ...TEST_ENV, EXTENSION_BEARER_TOKEN: BEARER };

function buildApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/v1/enrollment/extension", payloadRouter);
  return app;
}

// Per /plan-eng-review A2: the route reads its DB client from withActorContext
// (not makeServiceClient directly) so audit triggers attribute writes to
// 'extension'. Tests mock both — withActorContext returns the same mock client
// makeServiceClient would have produced, since the production path also
// constructs the client from c.env.
function mockClient(client: ReturnType<typeof makeMultiTableDbClient>): void {
  vi.mocked(makeServiceClient).mockReturnValue(client);
  vi.mocked(withActorContext).mockResolvedValue(client);
}

describe("GET /v1/enrollment/extension/packets/:packetId/payload — auth gating", () => {
  it("returns 503 when EXTENSION_BEARER_TOKEN is not configured", async () => {
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/payload`,
      { headers: { Authorization: `Bearer ${BEARER}` } },
      { ...TEST_ENV, EXTENSION_BEARER_TOKEN: undefined },
    );
    expect(res.status).toBe(503);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/payload`,
      {},
      ENV,
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when bearer token does not match", async () => {
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/payload`,
      { headers: { Authorization: "Bearer wrong-token" } },
      ENV,
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /v1/enrollment/extension/packets/:packetId/payload — happy path", () => {
  it("returns 404 when the packet does not exist (PGRST116)", async () => {
    mockClient(
      makeMultiTableDbClient({
        snap_packets: { data: null, error: { code: "PGRST116", message: "no rows" } },
      }),
    );
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/payload`,
      { headers: { Authorization: `Bearer ${BEARER}` } },
      ENV,
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 with the full payload shape including ciphertext PII markers", async () => {
    mockClient(
      makeMultiTableDbClient({
        snap_packets: { data: packetRow, error: null },
        packet_answers: {
          data: [
            { question_key: "income_type", applicant_answer: "wages", navigator_confirmed_value: null },
          ],
          error: null,
        },
        uploaded_documents: {
          data: [{ document_id: "doc-1", document_kind: "paystub", processing_status: "extracted" }],
          error: null,
        },
      }),
    );
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/payload`,
      { headers: { Authorization: `Bearer ${BEARER}` } },
      ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.packet_id).toBe(PACKET_ID);
    expect(body.state_code).toBe("CA");
    expect(body.county).toBe("Alameda");
    expect(body.full_name_ciphertext).toBe("snap_v1::xxx");
    expect(body.pii_decryption_status).toBe("deferred_to_phase_2");
    expect(Array.isArray(body.answers)).toBe(true);
    expect(Array.isArray(body.document_urls)).toBe(true);
    expect((body.document_urls as Array<{ type: string; url: string }>)[0]?.url).toContain("example.com");
  });

  it("excludes rejected documents from the document_urls list", async () => {
    mockClient(
      makeMultiTableDbClient({
        snap_packets: { data: packetRow, error: null },
        packet_answers: { data: [], error: null },
        uploaded_documents: {
          data: [
            { document_id: "doc-1", document_kind: "paystub", processing_status: "extracted" },
            { document_id: "doc-2", document_kind: "photo_id", processing_status: "rejected" },
          ],
          error: null,
        },
      }),
    );
    const app = buildApp();
    const res = await app.request(
      `/v1/enrollment/extension/packets/${PACKET_ID}/payload`,
      { headers: { Authorization: `Bearer ${BEARER}` } },
      ENV,
    );
    const body = (await res.json()) as { document_urls: Array<{ type: string; url: string }> };
    expect(body.document_urls).toHaveLength(1);
    expect(body.document_urls[0]?.type).toBe("paystub");
  });
});
