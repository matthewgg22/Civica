import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { InMemoryAuditLogWriter } from "../audit/index.js";
import { FakeClock } from "./clock.js";
import type { FetchLike } from "./federal-register.js";
import {
  UsdaFnsColaAdapter,
  hashColaLinks,
  inferFiscalYear,
  inferKind,
  inferRegion,
  parseColaIndexHtml,
} from "./usda-fns-cola.js";

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__/usda-fns-cola",
);
const fixture = (name: string) => readFileSync(join(FIXTURES_DIR, name), "utf8");

// --- Mock fetch ----------------------------------------------------------

function mockFetch(opts: {
  readonly status?: number;
  readonly statusText?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body: string | Error;
  readonly bodyThrows?: boolean;
}): FetchLike {
  return async () => {
    const headers = new Map<string, string>();
    for (const [k, v] of Object.entries(opts.headers ?? {})) headers.set(k.toLowerCase(), v);
    const status = opts.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: opts.statusText ?? "",
      headers: { get: (n: string) => headers.get(n.toLowerCase()) ?? null },
      json: async () => {
        throw new Error("not implemented for these tests");
      },
      text: async () => {
        if (opts.bodyThrows) throw new Error("body read failed");
        if (opts.body instanceof Error) throw opts.body;
        return opts.body;
      },
    };
  };
}

const makeDeps = (fetchImpl: FetchLike) => ({
  auditLog: new InMemoryAuditLogWriter(),
  clock: new FakeClock(1_700_000_000_000),
  fetch: fetchImpl,
});

// --- HTML parsing --------------------------------------------------------

describe("parseColaIndexHtml", () => {
  it("extracts all FY-tagged COLA PDFs from the typical index", () => {
    const links = parseColaIndexHtml(fixture("typical-index.html"));
    // Picks up: 5 FY 2026 region memos + 2 FY 2025 region memos +
    // 1 standard deduction memo + 1 general SNAP policy ref.
    // Does NOT pick up the unrelated/WIC PDFs at the bottom.
    expect(links.length).toBeGreaterThanOrEqual(8);
    const hrefs = links.map((l) => l.href);
    expect(hrefs.some((h) => h.includes("FY-2026-COLA-Memo-48-States-DC.pdf"))).toBe(true);
    expect(hrefs.some((h) => h.includes("FY-2026-COLA-Memo-Hawaii.pdf"))).toBe(true);
    expect(hrefs.some((h) => h.includes("FY-2025-COLA-Memo-Alaska.pdf"))).toBe(true);
    expect(hrefs.every((h) => !h.includes("wic-information"))).toBe(true);
    expect(hrefs.every((h) => !h.includes("something-unrelated"))).toBe(true);
  });

  it("infers fiscal year + region + kind on a representative row", () => {
    const links = parseColaIndexHtml(fixture("typical-index.html"));
    const hawaii26 = links.find((l) => l.href.endsWith("FY-2026-COLA-Memo-Hawaii.pdf"));
    expect(hawaii26).toBeDefined();
    expect(hawaii26?.inferredFiscalYear).toBe(2026);
    expect(hawaii26?.inferredRegion).toBe("hi");
    expect(hawaii26?.inferredKind).toBe("max-allotment");
  });

  it("dedups by href", () => {
    const html = `
      <a href="https://x/y.pdf">FY 2026 SNAP Allotment</a>
      <a href="https://x/y.pdf">FY 2026 SNAP Allotment (duplicate)</a>
    `;
    const links = parseColaIndexHtml(html);
    expect(links).toHaveLength(1);
  });

  it("skips PDFs whose link text has no COLA-relevant keywords", () => {
    const html = `<a href="https://x/random.pdf">Annual Report on Operations</a>`;
    expect(parseColaIndexHtml(html)).toHaveLength(0);
  });

  it("matches keyword in href even when link text is bare", () => {
    const html = `<a href="https://x/cola-2026.pdf">Memo</a>`;
    const links = parseColaIndexHtml(html);
    expect(links).toHaveLength(1);
  });
});

// --- Inference helpers --------------------------------------------------

describe("inferFiscalYear", () => {
  it("parses FY 2024 / FY2024 / FY-2024", () => {
    expect(inferFiscalYear("FY 2024 SNAP Allotment", "")).toBe(2024);
    expect(inferFiscalYear("FY2024", "")).toBe(2024);
    expect(inferFiscalYear("Cost-of-Living", "/cola/fy-2024.pdf")).toBe(2024);
  });

  it("parses FY24 / fy-24 (2-digit) and expands to 20XX", () => {
    expect(inferFiscalYear("FY24 Allotment", "")).toBe(2024);
  });

  it("returns null when nothing plausible matches", () => {
    expect(inferFiscalYear("Some Random Memo", "/foo/bar.pdf")).toBeNull();
  });

  it("rejects years outside the sane range", () => {
    expect(inferFiscalYear("FY 1999 Allotment", "")).toBeNull();
    expect(inferFiscalYear("FY 2999 Allotment", "")).toBeNull();
  });
});

describe("inferRegion", () => {
  it("recognizes the five region patterns", () => {
    expect(inferRegion("48 Contiguous States", "")).toBe("us-48");
    expect(inferRegion("Alaska memo", "")).toBe("ak");
    expect(inferRegion("Hawaii memo", "")).toBe("hi");
    expect(inferRegion("Guam memo", "")).toBe("guam");
    expect(inferRegion("U.S. Virgin Islands memo", "")).toBe("usvi");
  });

  it("returns unknown for unclassified text", () => {
    expect(inferRegion("Generic COLA memo", "")).toBe("unknown");
  });
});

describe("inferKind", () => {
  it("classifies each kind from typical labels", () => {
    expect(inferKind("Maximum Allotments and Income Limits")).toBe("max-allotment");
    expect(inferKind("Gross Income Limits FY 2026")).toBe("income-limit");
    expect(inferKind("Standard Deduction Update")).toBe("deduction");
    expect(inferKind("Excess Shelter Cap")).toBe("shelter-cap");
    expect(inferKind("General SNAP Policy Reference")).toBe("other");
  });
});

// --- hashColaLinks ------------------------------------------------------

describe("hashColaLinks", () => {
  const a = {
    href: "https://x/a.pdf",
    linkText: "FY 2026 A",
    inferredFiscalYear: 2026,
    inferredRegion: "us-48" as const,
    inferredKind: "max-allotment" as const,
  };
  const b = { ...a, href: "https://x/b.pdf", linkText: "FY 2026 B" };

  it("is order-independent", () => {
    expect(hashColaLinks([a, b])).toBe(hashColaLinks([b, a]));
  });

  it("changes when linkText changes", () => {
    expect(hashColaLinks([a])).not.toBe(hashColaLinks([{ ...a, linkText: "different" }]));
  });
});

// --- Adapter end-to-end -------------------------------------------------

describe("UsdaFnsColaAdapter", () => {
  it("returns Success with parsed links on the typical index", async () => {
    const adapter = new UsdaFnsColaAdapter(
      makeDeps(mockFetch({ body: fixture("typical-index.html") })),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("Success");
    if (result.kind === "Success") {
      expect(result.data.length).toBeGreaterThanOrEqual(8);
      expect(result.urlHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("emits StructuralFailure when the page has zero COLA links", async () => {
    const adapter = new UsdaFnsColaAdapter(
      makeDeps(mockFetch({ body: fixture("empty-index.html") })),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("StructuralFailure");
    if (result.kind === "StructuralFailure") {
      expect(result.error).toMatch(/Found only 0 plausible COLA PDF link/);
    }
  });

  it("emits NoChange on a repeat fetch with identical content", async () => {
    const clock = new FakeClock(1_700_000_000_000);
    const adapter = new UsdaFnsColaAdapter({
      auditLog: new InMemoryAuditLogWriter(),
      clock,
      fetch: mockFetch({ body: fixture("typical-index.html") }),
    });
    const first = await adapter.fetchOnce();
    expect(first.kind).toBe("Success");
    clock.advance(2 * 3_600_000);
    const second = await adapter.fetchOnce();
    expect(second.kind).toBe("NoChange");
  });

  it("maps 5xx → TransientFailure", async () => {
    const adapter = new UsdaFnsColaAdapter(
      makeDeps(mockFetch({ status: 503, statusText: "Service Unavailable", body: "" })),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("TransientFailure");
  });

  it("maps 429 → TransientFailure", async () => {
    const adapter = new UsdaFnsColaAdapter(
      makeDeps(mockFetch({ status: 429, statusText: "Too Many Requests", body: "" })),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("TransientFailure");
  });

  it("maps 4xx (non-429) → StructuralFailure (URL moved)", async () => {
    const adapter = new UsdaFnsColaAdapter(
      makeDeps(mockFetch({ status: 404, statusText: "Not Found", body: "moved" })),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("StructuralFailure");
  });

  it("network throw → TransientFailure", async () => {
    const adapter = new UsdaFnsColaAdapter(
      makeDeps(async () => {
        throw new Error("ECONNRESET");
      }),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("TransientFailure");
  });

  it("AbortSignal.timeout error → TransientFailure with timeout-specific message", async () => {
    const adapter = new UsdaFnsColaAdapter(
      makeDeps(async () => {
        const err = new Error("aborted");
        err.name = "TimeoutError";
        throw err;
      }),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("TransientFailure");
    if (result.kind === "TransientFailure") {
      expect(result.error).toMatch(/timed out after 30s/);
    }
  });

  it("writes one audit log entry per fetch", async () => {
    const audit = new InMemoryAuditLogWriter();
    const adapter = new UsdaFnsColaAdapter({
      auditLog: audit,
      clock: new FakeClock(1_700_000_000_000),
      fetch: mockFetch({ body: fixture("typical-index.html") }),
    });
    await adapter.fetchOnce();
    expect(audit.all()).toHaveLength(1);
    expect(audit.all()[0]?.source_id).toBe("usda-fns-cola");
    expect(audit.all()[0]?.result_kind).toBe("Success");
  });

  it("identifying User-Agent reaches the underlying fetch", async () => {
    let capturedUA: string | undefined;
    const adapter = new UsdaFnsColaAdapter({
      auditLog: new InMemoryAuditLogWriter(),
      clock: new FakeClock(1_700_000_000_000),
      fetch: async (_url, init) => {
        capturedUA = init?.headers?.["User-Agent"];
        return {
          ok: true,
          status: 200,
          statusText: "",
          headers: { get: () => null },
          json: async () => null,
          text: async () => fixture("typical-index.html"),
        };
      },
    });
    await adapter.fetchOnce();
    expect(capturedUA).toMatch(/^Civica-RegOps\/1\.0/);
  });
});
