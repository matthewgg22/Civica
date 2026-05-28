// CaCdssAclAdapter tests.
//
// Two layers:
//   1. Pure HTML parsing — parseAclIndexHtml against fixture HTML
//      captured from the live CDSS site on 2026-05-28. These tests
//      catch parser regressions if CDSS rearranges the page.
//   2. End-to-end via the adapter — covers fetch error branches,
//      structural-failure on near-empty pages, and the NoChange path
//      when the same content returns twice.
//
// Fixtures:
//   __fixtures__/ca-cdss-acl/typical-2026.html  — real page snapshot
//   __fixtures__/ca-cdss-acl/empty.html         — minimal valid page,
//                                                  no ACL entries.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { InMemoryAuditLogWriter } from "../audit/index.js";
import {
  CaCdssAclAdapter,
  extractFirstNonEmptyTextLine,
  parseAclIndexHtml,
  parseCdssDateToIso,
  type FetchLike,
} from "./ca-cdss-acl.js";
import { FakeClock } from "./clock.js";

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__/ca-cdss-acl",
);
const fixture = (name: string): string =>
  readFileSync(join(FIXTURES_DIR, name), "utf8");

// --- Mock fetch ----------------------------------------------------------

function mockFetch(opts: {
  readonly status?: number;
  readonly statusText?: string;
  readonly body: string | Error;
  readonly bodyThrows?: boolean;
}): FetchLike {
  return async () => {
    const status = opts.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: opts.statusText ?? "",
      headers: { get: () => null },
      text: async () => {
        if (opts.bodyThrows) throw new Error("body read failed");
        if (opts.body instanceof Error) throw opts.body;
        return opts.body;
      },
    };
  };
}

const makeDeps = (fetchImpl: FetchLike, year = 2026) => ({
  auditLog: new InMemoryAuditLogWriter(),
  clock: new FakeClock(1_700_000_000_000),
  fetch: fetchImpl,
  year,
});

// --- Pure parser tests ---------------------------------------------------

describe("parseAclIndexHtml — typical 2026 fixture", () => {
  it("extracts the expected number of ACL entries from the live page", () => {
    const entries = parseAclIndexHtml(fixture("typical-2026.html"));
    // 33 ACLs in the page as captured 2026-05-28 (26-01 through 26-33).
    expect(entries.length).toBe(33);
  });

  it("extracts ACL 26-29 with full metadata", () => {
    const entries = parseAclIndexHtml(fixture("typical-2026.html"));
    const acl29 = entries.find((e) => e.aclNumber === "26-29");
    expect(acl29).toBeDefined();
    expect(acl29?.publishedDate).toBe("2026-04-15");
    expect(acl29?.publishedDateText).toBe("April 15, 2026");
    expect(acl29?.title).toContain("Able-Bodied Adults Without Dependents");
    expect(acl29?.title).toContain("Handbook");
    expect(acl29?.url).toContain("/Portals/9/");
    expect(acl29?.url).toContain("26-29.pdf");
    expect(acl29?.url.startsWith("https://www.cdss.ca.gov")).toBe(true);
    expect(acl29?.type).toBe("ACL");
  });

  it("dedups when an ACL appears in multiple page sections", () => {
    const entries = parseAclIndexHtml(fixture("typical-2026.html"));
    const numbers = entries.map((e) => e.aclNumber);
    const unique = new Set(numbers);
    expect(numbers.length).toBe(unique.size);
  });

  it("all ACLs from the fixture have well-formed ISO dates", () => {
    const entries = parseAclIndexHtml(fixture("typical-2026.html"));
    for (const e of entries) {
      expect(e.publishedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("absolute URLs include the cdss.ca.gov host", () => {
    const entries = parseAclIndexHtml(fixture("typical-2026.html"));
    for (const e of entries) {
      expect(e.url.startsWith("https://www.cdss.ca.gov")).toBe(true);
    }
  });
});

describe("parseAclIndexHtml — edge cases", () => {
  it("returns empty array on a page with no ACL anchors", () => {
    expect(parseAclIndexHtml(fixture("empty.html"))).toEqual([]);
  });

  it("returns empty array on empty input", () => {
    expect(parseAclIndexHtml("")).toEqual([]);
  });
});

// --- Helper parsers ------------------------------------------------------

describe("parseCdssDateToIso", () => {
  it("parses CDSS canonical date format", () => {
    expect(parseCdssDateToIso("April 15, 2026")).toBe("2026-04-15");
    expect(parseCdssDateToIso("May 1, 2026")).toBe("2026-05-01");
    expect(parseCdssDateToIso("January 31, 2025")).toBe("2025-01-31");
    expect(parseCdssDateToIso("December 9, 2024")).toBe("2024-12-09");
  });

  it("returns empty string on unparseable input", () => {
    expect(parseCdssDateToIso("")).toBe("");
    expect(parseCdssDateToIso("not a date")).toBe("");
    expect(parseCdssDateToIso("Mayy 1, 2026")).toBe("");
    expect(parseCdssDateToIso("2026-04-15")).toBe(""); // wrong format
  });
});

describe("extractFirstNonEmptyTextLine", () => {
  it("strips HTML and returns trimmed text", () => {
    expect(
      extractFirstNonEmptyTextLine(
        "<p>  Some <b>title</b> text  </p>",
      ),
    ).toBe("Some title text");
  });

  it("decodes basic HTML entities", () => {
    expect(extractFirstNonEmptyTextLine("AT&amp;T &nbsp; rules")).toBe(
      "AT&T rules",
    );
  });

  it("stops at the next anchor tag (avoids leaking into next entry)", () => {
    const html = "  First entry title  <a href='x'>Next ACL</a>";
    expect(extractFirstNonEmptyTextLine(html)).toBe("First entry title");
  });

  it("stops at headings too", () => {
    const html = "  Title here  <h2>Next Section</h2>";
    expect(extractFirstNonEmptyTextLine(html)).toBe("Title here");
  });

  it("returns empty string for tag-only input", () => {
    expect(extractFirstNonEmptyTextLine("<br/><span></span>")).toBe("");
  });
});

// --- Adapter end-to-end --------------------------------------------------

describe("CaCdssAclAdapter — fetch behavior", () => {
  it("returns Success with parsed entries on a healthy 200 response", async () => {
    const adapter = new CaCdssAclAdapter(
      makeDeps(mockFetch({ body: fixture("typical-2026.html") })),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("Success");
    if (result.kind === "Success") {
      expect(result.data.length).toBe(33);
      expect(result.urlHash).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("returns NoChange on a second identical fetch", async () => {
    // Adapter base enforces a rate cap (1h floor); advance the clock so
    // the second fetchOnce isn't TransientFailure-on-rate-limit.
    const clock = new FakeClock(1_700_000_000_000);
    const adapter = new CaCdssAclAdapter({
      auditLog: new InMemoryAuditLogWriter(),
      clock,
      fetch: mockFetch({ body: fixture("typical-2026.html") }),
      year: 2026,
    });
    const first = await adapter.fetchOnce();
    expect(first.kind).toBe("Success");
    clock.advance(2 * 3_600_000); // > poll interval
    const second = await adapter.fetchOnce();
    expect(second.kind).toBe("NoChange");
  });

  it("returns TransientFailure on 503", async () => {
    const adapter = new CaCdssAclAdapter(
      makeDeps(
        mockFetch({
          status: 503,
          statusText: "Service Unavailable",
          body: "",
        }),
      ),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("TransientFailure");
    if (result.kind === "TransientFailure") {
      expect(result.error).toContain("503");
    }
  });

  it("returns TransientFailure on 429", async () => {
    const adapter = new CaCdssAclAdapter(
      makeDeps(
        mockFetch({ status: 429, statusText: "Too Many Requests", body: "" }),
      ),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("TransientFailure");
  });

  it("returns StructuralFailure on 404 (URL pattern moved)", async () => {
    const adapter = new CaCdssAclAdapter(
      makeDeps(
        mockFetch({ status: 404, statusText: "Not Found", body: "" }),
      ),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("StructuralFailure");
    if (result.kind === "StructuralFailure") {
      expect(result.error).toContain("URL pattern may have moved");
    }
  });

  it("returns StructuralFailure on a page with zero ACL entries", async () => {
    const adapter = new CaCdssAclAdapter(
      makeDeps(mockFetch({ body: fixture("empty.html") })),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("StructuralFailure");
    if (result.kind === "StructuralFailure") {
      expect(result.error).toContain("Page layout likely changed");
    }
  });

  it("returns TransientFailure when fetch throws", async () => {
    const adapter = new CaCdssAclAdapter(
      makeDeps((async () => {
        throw new Error("ENETUNREACH");
      }) as unknown as FetchLike),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("TransientFailure");
    if (result.kind === "TransientFailure") {
      expect(result.error).toContain("Network error");
    }
  });

  it("returns TransientFailure when body read fails", async () => {
    const adapter = new CaCdssAclAdapter(
      makeDeps(mockFetch({ body: "x", bodyThrows: true })),
    );
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("TransientFailure");
    if (result.kind === "TransientFailure") {
      expect(result.error).toContain("Failed to read");
    }
  });
});

describe("CaCdssAclAdapter — URL construction", () => {
  it("uses current UTC year by default", () => {
    const adapter = new CaCdssAclAdapter({
      auditLog: new InMemoryAuditLogWriter(),
      clock: new FakeClock(1_700_000_000_000),
      fetch: mockFetch({ body: "" }),
    });
    const currentYear = new Date().getUTCFullYear();
    expect(adapter.url).toContain(`${currentYear}-all-county-letters`);
  });

  it("uses the year override when provided", () => {
    const adapter = new CaCdssAclAdapter(
      makeDeps(mockFetch({ body: "" }), 2024),
    );
    expect(adapter.url).toContain("2024-all-county-letters");
  });

  it("URL hits the cdss.ca.gov letters-and-notices path", () => {
    const adapter = new CaCdssAclAdapter(
      makeDeps(mockFetch({ body: "" }), 2026),
    );
    expect(adapter.url).toBe(
      "https://www.cdss.ca.gov/inforesources/letters-regulations/" +
        "letters-and-notices/all-county-letters/2026-all-county-letters",
    );
  });
});

describe("CaCdssAclAdapter — identity", () => {
  it("has source_id 'ca-cdss-acl' (maps to CA domain via source_id_to_domain)", () => {
    const adapter = new CaCdssAclAdapter(makeDeps(mockFetch({ body: "" })));
    expect(adapter.id).toBe("ca-cdss-acl");
  });

  it("has domainTag 'eligibility' (content domain, not jurisdiction)", () => {
    const adapter = new CaCdssAclAdapter(makeDeps(mockFetch({ body: "" })));
    expect(adapter.domainTag).toBe("eligibility");
  });
});
