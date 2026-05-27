import { describe, expect, it } from "vitest";

import { InMemoryAuditLogWriter } from "../audit/index.js";
import { FakeClock } from "./clock.js";
import {
  FederalRegisterAdapter,
  hashDocuments,
  parseApiResponse,
  parseRetryAfter,
  type FederalRegisterDocument,
  type FetchLike,
} from "./federal-register.js";

// --- Test helpers ---------------------------------------------------------

interface MockResponseInit {
  readonly ok?: boolean;
  readonly status?: number;
  readonly statusText?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body: unknown; // object → JSON; string → text; Error → thrown by json()
}

function mockResponse(init: MockResponseInit): Awaited<ReturnType<FetchLike>> {
  const headers = new Map<string, string>();
  for (const [k, v] of Object.entries(init.headers ?? {})) headers.set(k.toLowerCase(), v);
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    statusText: init.statusText ?? "",
    headers: { get: (n: string) => headers.get(n.toLowerCase()) ?? null },
    json: async () => {
      if (init.body instanceof Error) throw init.body;
      if (typeof init.body === "string") return JSON.parse(init.body);
      return init.body;
    },
    text: async () => {
      if (init.body instanceof Error) return "";
      if (typeof init.body === "string") return init.body;
      return JSON.stringify(init.body);
    },
  };
}

function fetchReturning(response: Awaited<ReturnType<FetchLike>>): FetchLike {
  return async () => response;
}

function fetchThrowing(err: Error): FetchLike {
  return async () => {
    throw err;
  };
}

const SAMPLE_DOC = {
  document_number: "2026-12345",
  title: "Supplemental Nutrition Assistance Program: Annual COLA",
  type: "Rule",
  publication_date: "2026-08-15",
  effective_on: "2026-10-01",
  html_url: "https://www.federalregister.gov/d/2026-12345",
  agencies: ["food-and-nutrition-service"],
};

function makeDeps(fetchImpl: FetchLike) {
  return {
    auditLog: new InMemoryAuditLogWriter(),
    clock: new FakeClock(1_700_000_000_000),
    fetch: fetchImpl,
  };
}

// --- Tests ---------------------------------------------------------------

describe("FederalRegisterAdapter", () => {
  describe("happy path", () => {
    it("returns Success on a well-formed response", async () => {
      const adapter = new FederalRegisterAdapter(
        makeDeps(fetchReturning(mockResponse({ body: { results: [SAMPLE_DOC] } }))),
      );
      const result = await adapter.fetchOnce();
      expect(result.kind).toBe("Success");
      if (result.kind === "Success") {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.document_number).toBe("2026-12345");
        expect(result.urlHash).toMatch(/^[0-9a-f]{64}$/);
        expect(result.fetchedAt.getTime()).toBe(1_700_000_000_000);
      }
    });

    it("accepts agencies as {slug} objects (alternate API shape)", async () => {
      const adapter = new FederalRegisterAdapter(
        makeDeps(
          fetchReturning(
            mockResponse({
              body: {
                results: [
                  {
                    ...SAMPLE_DOC,
                    agencies: [{ slug: "food-and-nutrition-service", name: "FNS" }],
                  },
                ],
              },
            }),
          ),
        ),
      );
      const result = await adapter.fetchOnce();
      expect(result.kind).toBe("Success");
      if (result.kind === "Success") {
        expect(result.data[0]?.agencies).toEqual(["food-and-nutrition-service"]);
      }
    });

    it("accepts null effective_on (notices, some proposed rules)", async () => {
      const adapter = new FederalRegisterAdapter(
        makeDeps(
          fetchReturning(
            mockResponse({
              body: { results: [{ ...SAMPLE_DOC, type: "Notice", effective_on: null }] },
            }),
          ),
        ),
      );
      const result = await adapter.fetchOnce();
      expect(result.kind).toBe("Success");
      if (result.kind === "Success") {
        expect(result.data[0]?.effective_on).toBeNull();
      }
    });
  });

  describe("change detection", () => {
    it("emits NoChange when content hash matches the prior fetch", async () => {
      // Need the SECOND fetch to clear the rate limit, so advance the clock.
      const clock = new FakeClock(1_700_000_000_000);
      const body = { results: [SAMPLE_DOC] };
      const adapter = new FederalRegisterAdapter({
        auditLog: new InMemoryAuditLogWriter(),
        clock,
        fetch: fetchReturning(mockResponse({ body })),
      });

      const first = await adapter.fetchOnce();
      expect(first.kind).toBe("Success");

      clock.advance(2 * 3_600_000); // > poll interval
      const second = await adapter.fetchOnce();
      expect(second.kind).toBe("NoChange");
    });

    it("emits Success again when content changes", async () => {
      const clock = new FakeClock(1_700_000_000_000);
      let payload: unknown = { results: [SAMPLE_DOC] };
      const adapter = new FederalRegisterAdapter({
        auditLog: new InMemoryAuditLogWriter(),
        clock,
        fetch: async () => mockResponse({ body: payload }),
      });

      await adapter.fetchOnce();
      clock.advance(2 * 3_600_000);
      payload = { results: [SAMPLE_DOC, { ...SAMPLE_DOC, document_number: "2026-99999" }] };
      const second = await adapter.fetchOnce();
      expect(second.kind).toBe("Success");
    });
  });

  describe("failure variants", () => {
    it("maps 500 → TransientFailure", async () => {
      const adapter = new FederalRegisterAdapter(
        makeDeps(
          fetchReturning(
            mockResponse({ ok: false, status: 503, statusText: "Service Unavailable", body: "" }),
          ),
        ),
      );
      const result = await adapter.fetchOnce();
      expect(result.kind).toBe("TransientFailure");
    });

    it("maps 429 → TransientFailure and honors Retry-After (delta-seconds)", async () => {
      const adapter = new FederalRegisterAdapter(
        makeDeps(
          fetchReturning(
            mockResponse({
              ok: false,
              status: 429,
              statusText: "Too Many Requests",
              headers: { "Retry-After": "120" },
              body: "",
            }),
          ),
        ),
      );
      const result = await adapter.fetchOnce();
      expect(result.kind).toBe("TransientFailure");
      if (result.kind === "TransientFailure") {
        expect(result.retryAfterMs).toBe(120_000);
      }
    });

    it("maps 4xx (non-429) → StructuralFailure with body sample", async () => {
      const adapter = new FederalRegisterAdapter(
        makeDeps(
          fetchReturning(
            mockResponse({
              ok: false,
              status: 404,
              statusText: "Not Found",
              body: "endpoint moved",
            }),
          ),
        ),
      );
      const result = await adapter.fetchOnce();
      expect(result.kind).toBe("StructuralFailure");
      if (result.kind === "StructuralFailure") {
        expect(result.rawDocSampleRef).toContain("endpoint moved");
      }
    });

    it("network throw → TransientFailure", async () => {
      const adapter = new FederalRegisterAdapter(
        makeDeps(fetchThrowing(new Error("ECONNRESET"))),
      );
      const result = await adapter.fetchOnce();
      expect(result.kind).toBe("TransientFailure");
      if (result.kind === "TransientFailure") {
        expect(result.error).toMatch(/ECONNRESET/);
      }
    });

    it("malformed JSON → StructuralFailure", async () => {
      const adapter = new FederalRegisterAdapter(
        makeDeps(fetchReturning(mockResponse({ body: new Error("invalid token") }))),
      );
      const result = await adapter.fetchOnce();
      expect(result.kind).toBe("StructuralFailure");
    });

    it("missing 'results' field → StructuralFailure", async () => {
      const adapter = new FederalRegisterAdapter(
        makeDeps(fetchReturning(mockResponse({ body: { wrong_envelope: [] } }))),
      );
      const result = await adapter.fetchOnce();
      expect(result.kind).toBe("StructuralFailure");
    });

    it("row missing required field → StructuralFailure pinpointing the index", async () => {
      const broken = { ...SAMPLE_DOC, title: undefined };
      const adapter = new FederalRegisterAdapter(
        makeDeps(fetchReturning(mockResponse({ body: { results: [SAMPLE_DOC, broken] } }))),
      );
      const result = await adapter.fetchOnce();
      expect(result.kind).toBe("StructuralFailure");
      if (result.kind === "StructuralFailure") {
        expect(result.error).toMatch(/results\[1\]/);
        expect(result.error).toMatch(/title/);
      }
    });

    it("unrecognized document type → StructuralFailure", async () => {
      const adapter = new FederalRegisterAdapter(
        makeDeps(
          fetchReturning(
            mockResponse({ body: { results: [{ ...SAMPLE_DOC, type: "FakeType" }] } }),
          ),
        ),
      );
      const result = await adapter.fetchOnce();
      expect(result.kind).toBe("StructuralFailure");
    });
  });

  describe("policy layer integration", () => {
    it("identifying User-Agent reaches the underlying fetch", async () => {
      let capturedHeaders: Readonly<Record<string, string>> | undefined;
      const adapter = new FederalRegisterAdapter({
        auditLog: new InMemoryAuditLogWriter(),
        clock: new FakeClock(1_700_000_000_000),
        fetch: async (_url, init) => {
          capturedHeaders = init?.headers;
          return mockResponse({ body: { results: [] } });
        },
      });
      await adapter.fetchOnce();
      expect(capturedHeaders?.["User-Agent"]).toMatch(/^Civica-RegOps\/1\.0/);
      expect(capturedHeaders?.["Accept"]).toBe("application/json");
    });

    it("writes one audit log entry per fetch", async () => {
      const audit = new InMemoryAuditLogWriter();
      const adapter = new FederalRegisterAdapter({
        auditLog: audit,
        clock: new FakeClock(1_700_000_000_000),
        fetch: fetchReturning(mockResponse({ body: { results: [SAMPLE_DOC] } })),
      });
      await adapter.fetchOnce();
      const entries = audit.all();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.source_id).toBe("federal-register-snap");
      expect(entries[0]?.result_kind).toBe("Success");
    });
  });

  describe("constructor validation", () => {
    it("throws when no fetch is available", () => {
      const originalFetch = globalThis.fetch;
      // @ts-expect-error — clearing fetch for the test
      delete globalThis.fetch;
      try {
        expect(
          () =>
            new FederalRegisterAdapter({
              auditLog: new InMemoryAuditLogWriter(),
              clock: new FakeClock(0),
              // no fetch provided
            }),
        ).toThrow(/no fetch implementation/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

// --- Pure-helper tests ---------------------------------------------------

describe("parseRetryAfter", () => {
  it("parses delta-seconds", () => {
    expect(parseRetryAfter("60")).toBe(60_000);
  });

  it("parses HTTP-date", () => {
    const future = new Date(Date.now() + 30_000).toUTCString();
    const ms = parseRetryAfter(future);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(30_000);
  });

  it("returns undefined for null / empty / garbage", () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("")).toBeUndefined();
    expect(parseRetryAfter("nonsense")).toBeUndefined();
  });

  it("returns undefined for negative delta-seconds", () => {
    // Number("-1") is finite >= 0 is false, so -> undefined
    expect(parseRetryAfter("-1")).toBeUndefined();
  });
});

describe("hashDocuments", () => {
  const a: FederalRegisterDocument = {
    document_number: "A",
    title: "A title",
    type: "Rule",
    publication_date: "2026-01-01",
    effective_on: "2026-02-01",
    html_url: "https://x/A",
    agencies: ["food-and-nutrition-service"],
  };
  const b: FederalRegisterDocument = { ...a, document_number: "B", title: "B title" };

  it("is order-independent (sorting absorbs API reorderings)", () => {
    expect(hashDocuments([a, b])).toBe(hashDocuments([b, a]));
  });

  it("changes when a title changes", () => {
    expect(hashDocuments([a])).not.toBe(hashDocuments([{ ...a, title: "different" }]));
  });

  it("changes when effective_on changes", () => {
    expect(hashDocuments([a])).not.toBe(hashDocuments([{ ...a, effective_on: "2027-01-01" }]));
  });
});

describe("parseApiResponse", () => {
  it("rejects non-object responses", () => {
    const r = parseApiResponse([1, 2, 3]);
    expect(r.ok).toBe(false);
  });

  it("rejects missing results", () => {
    const r = parseApiResponse({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/results/);
  });

  it("accepts empty results", () => {
    const r = parseApiResponse({ results: [] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.documents).toHaveLength(0);
  });
});
