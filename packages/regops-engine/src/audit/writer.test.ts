import { describe, expect, it } from "vitest";

import type { FetchResult } from "../sources/types.js";
import { entryFromFetchResult } from "./types.js";
import { InMemoryAuditLogWriter, NullAuditLogWriter } from "./writer.js";

interface RawDoc {
  readonly id: string;
}

const success: FetchResult<RawDoc> = {
  kind: "Success",
  data: [{ id: "doc-1" }],
  fetchedAt: new Date("2026-05-27T00:00:00Z"),
  urlHash: "sha256:abc",
};
const noChange: FetchResult<RawDoc> = {
  kind: "NoChange",
  fetchedAt: new Date("2026-05-27T00:00:00Z"),
  urlHash: "sha256:abc",
};
const transient: FetchResult<RawDoc> = {
  kind: "TransientFailure",
  error: "503 Service Unavailable",
  retryAfterMs: 60_000,
};
const structural: FetchResult<RawDoc> = {
  kind: "StructuralFailure",
  error: "schema changed",
  rawDocSampleRef: "r2://regops-raw/cdss/2026-05-27.html",
};
const wedged: FetchResult<RawDoc> = {
  kind: "SourceWedged",
  lastSuccessAt: new Date("2026-05-26T00:00:00Z"),
  error: "24h continuous failure",
};

describe("entryFromFetchResult", () => {
  it("maps Success to {url_hash, no error}", () => {
    const entry = entryFromFetchResult({
      sourceId: "usda-fns-cola",
      url: "https://www.fns.usda.gov/snap/allotment/cola",
      result: success,
      httpStatus: 200,
    });
    expect(entry.source_id).toBe("usda-fns-cola");
    expect(entry.result_kind).toBe("Success");
    expect(entry.url_hash).toBe("sha256:abc");
    expect(entry.http_status).toBe(200);
    expect(entry.error).toBeUndefined();
  });

  it("maps NoChange to {url_hash, no error}", () => {
    const entry = entryFromFetchResult({
      sourceId: "ca-cdss-acl",
      url: "https://www.cdss.ca.gov/x",
      result: noChange,
    });
    expect(entry.result_kind).toBe("NoChange");
    expect(entry.url_hash).toBe("sha256:abc");
    expect(entry.error).toBeUndefined();
  });

  it("maps TransientFailure to {error, empty url_hash}", () => {
    const entry = entryFromFetchResult({
      sourceId: "ma-dta-charts",
      url: "https://www.mass.gov/x",
      result: transient,
      httpStatus: 503,
    });
    expect(entry.result_kind).toBe("TransientFailure");
    expect(entry.error).toBe("503 Service Unavailable");
    expect(entry.url_hash).toBe("");
    expect(entry.http_status).toBe(503);
  });

  it("maps StructuralFailure to {error, body_ref defaults to rawDocSampleRef}", () => {
    const entry = entryFromFetchResult({
      sourceId: "ca-cdss-acl",
      url: "https://www.cdss.ca.gov/x",
      result: structural,
    });
    expect(entry.result_kind).toBe("StructuralFailure");
    expect(entry.error).toBe("schema changed");
    expect(entry.body_ref).toBe("r2://regops-raw/cdss/2026-05-27.html");
  });

  it("StructuralFailure: caller's body_ref overrides result.rawDocSampleRef", () => {
    const entry = entryFromFetchResult({
      sourceId: "ca-cdss-acl",
      url: "https://www.cdss.ca.gov/x",
      result: structural,
      bodyRef: "r2://override/path.html",
    });
    expect(entry.body_ref).toBe("r2://override/path.html");
  });

  it("maps SourceWedged to {error, empty url_hash}", () => {
    const entry = entryFromFetchResult({
      sourceId: "usda-fns-cola",
      url: "https://www.fns.usda.gov/x",
      result: wedged,
    });
    expect(entry.result_kind).toBe("SourceWedged");
    expect(entry.error).toBe("24h continuous failure");
    expect(entry.url_hash).toBe("");
  });

  it("passes through metadata + response_headers unchanged", () => {
    const headers = { "content-type": "application/pdf" } as const;
    const meta = { pageCount: 12, docTitle: "FY26 COLA Memo" } as const;
    const entry = entryFromFetchResult({
      sourceId: "usda-fns-cola",
      url: "https://www.fns.usda.gov/x",
      result: success,
      responseHeaders: headers,
      metadata: meta,
    });
    expect(entry.response_headers).toEqual(headers);
    expect(entry.metadata).toEqual(meta);
  });
});

describe("InMemoryAuditLogWriter", () => {
  it("records entries in insertion order with synthetic logIds", async () => {
    const writer = new InMemoryAuditLogWriter();

    const r1 = await writer.record(
      entryFromFetchResult({
        sourceId: "usda-fns-cola",
        url: "https://x",
        result: success,
      }),
    );
    const r2 = await writer.record(
      entryFromFetchResult({
        sourceId: "ca-cdss-acl",
        url: "https://y",
        result: transient,
      }),
    );

    expect(r1).toEqual({ ok: true, logId: "mem-1" });
    expect(r2).toEqual({ ok: true, logId: "mem-2" });
    expect(writer.all()).toHaveLength(2);
    expect(writer.all()[0]?.source_id).toBe("usda-fns-cola");
    expect(writer.all()[1]?.source_id).toBe("ca-cdss-acl");
  });

  it("filter() narrows by sourceId + resultKind", async () => {
    const writer = new InMemoryAuditLogWriter();
    await writer.record(entryFromFetchResult({ sourceId: "a", url: "u", result: success }));
    await writer.record(entryFromFetchResult({ sourceId: "a", url: "u", result: transient }));
    await writer.record(entryFromFetchResult({ sourceId: "b", url: "u", result: success }));

    expect(writer.filter({ sourceId: "a" })).toHaveLength(2);
    expect(writer.filter({ sourceId: "b" })).toHaveLength(1);
    expect(writer.filter({ resultKind: "Success" })).toHaveLength(2);
    expect(writer.filter({ sourceId: "a", resultKind: "TransientFailure" })).toHaveLength(1);
  });

  it("clear() empties the entries array", async () => {
    const writer = new InMemoryAuditLogWriter();
    await writer.record(entryFromFetchResult({ sourceId: "a", url: "u", result: success }));
    expect(writer.all()).toHaveLength(1);
    writer.clear();
    expect(writer.all()).toHaveLength(0);
  });
});

describe("NullAuditLogWriter", () => {
  it("accepts entries and reports ok without recording them anywhere", async () => {
    const writer = new NullAuditLogWriter();
    const result = await writer.record(
      entryFromFetchResult({ sourceId: "a", url: "u", result: success }),
    );
    expect(result).toEqual({ ok: true });
  });
});
