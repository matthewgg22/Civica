import { describe, expect, it } from "vitest";
import {
  assertNever,
  hasNewData,
  isNoChange,
  isRetryable,
  isSourceWedged,
  isStructuralFailure,
  isSuccess,
  isTransientFailure,
  type FetchResult,
} from "./types.js";

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
  error: "expected <h2 class='memo-title'>; got <h3>",
  rawDocSampleRef: "r2://regops-raw/cdss/2026-05-27.html",
};

const wedged: FetchResult<RawDoc> = {
  kind: "SourceWedged",
  lastSuccessAt: new Date("2026-05-26T00:00:00Z"),
  error: "24h continuous failure threshold reached",
};

/**
 * Exhaustive handler — the canonical switch + assertNever pattern from
 * the doc comment in types.ts. If a new variant is ever added to
 * FetchResult, removing or renaming any of these cases must fail the
 * type-check. That's the load-bearing property this test exists to
 * defend.
 */
function describeResult(r: FetchResult<RawDoc>): string {
  switch (r.kind) {
    case "Success":
      return `success: ${r.data.length} doc(s) at ${r.fetchedAt.toISOString()}`;
    case "NoChange":
      return `no change at ${r.fetchedAt.toISOString()}`;
    case "TransientFailure":
      return `transient: ${r.error}${r.retryAfterMs !== undefined ? ` retry in ${r.retryAfterMs}ms` : ""}`;
    case "StructuralFailure":
      return `structural: ${r.error} (sample: ${r.rawDocSampleRef})`;
    case "SourceWedged":
      return `wedged since ${r.lastSuccessAt.toISOString()}: ${r.error}`;
    default:
      // If a new variant is added without updating this switch, the
      // type system will reject this line at compile time. The throw
      // is defense-in-depth for runtime safety if a bogus `kind`
      // slips through deserialization.
      return assertNever(r);
  }
}

describe("FetchResult exhaustiveness", () => {
  it("handles every variant via switch + assertNever", () => {
    expect(describeResult(success)).toContain("success: 1 doc(s)");
    expect(describeResult(noChange)).toContain("no change at");
    expect(describeResult(transient)).toContain("transient: 503");
    expect(describeResult(transient)).toContain("retry in 60000ms");
    expect(describeResult(structural)).toContain("structural:");
    expect(describeResult(structural)).toContain("sample: r2://");
    expect(describeResult(wedged)).toContain("wedged since");
  });

  it("assertNever throws when reached at runtime with a bogus variant", () => {
    // Force a bogus variant past the type system to verify the runtime
    // throw still fires. This protects against deserialized JSON that
    // names a `kind` not present in the union.
    const bogus = { kind: "Unknown" } as unknown as FetchResult<RawDoc>;
    expect(() => describeResult(bogus)).toThrow(/unhandled FetchResult variant/);
  });
});

describe("FetchResult type guards", () => {
  it("isSuccess matches only Success", () => {
    expect(isSuccess(success)).toBe(true);
    expect(isSuccess(noChange)).toBe(false);
    expect(isSuccess(transient)).toBe(false);
    expect(isSuccess(structural)).toBe(false);
    expect(isSuccess(wedged)).toBe(false);
  });

  it("isNoChange matches only NoChange", () => {
    expect(isNoChange(success)).toBe(false);
    expect(isNoChange(noChange)).toBe(true);
    expect(isNoChange(transient)).toBe(false);
    expect(isNoChange(structural)).toBe(false);
    expect(isNoChange(wedged)).toBe(false);
  });

  it("isTransientFailure matches only TransientFailure", () => {
    expect(isTransientFailure(success)).toBe(false);
    expect(isTransientFailure(noChange)).toBe(false);
    expect(isTransientFailure(transient)).toBe(true);
    expect(isTransientFailure(structural)).toBe(false);
    expect(isTransientFailure(wedged)).toBe(false);
  });

  it("isStructuralFailure matches only StructuralFailure", () => {
    expect(isStructuralFailure(success)).toBe(false);
    expect(isStructuralFailure(noChange)).toBe(false);
    expect(isStructuralFailure(transient)).toBe(false);
    expect(isStructuralFailure(structural)).toBe(true);
    expect(isStructuralFailure(wedged)).toBe(false);
  });

  it("isSourceWedged matches only SourceWedged", () => {
    expect(isSourceWedged(success)).toBe(false);
    expect(isSourceWedged(noChange)).toBe(false);
    expect(isSourceWedged(transient)).toBe(false);
    expect(isSourceWedged(structural)).toBe(false);
    expect(isSourceWedged(wedged)).toBe(true);
  });
});

describe("FetchResult convenience predicates", () => {
  it("hasNewData is true only for Success", () => {
    expect(hasNewData(success)).toBe(true);
    expect(hasNewData(noChange)).toBe(false);
    expect(hasNewData(transient)).toBe(false);
    expect(hasNewData(structural)).toBe(false);
    expect(hasNewData(wedged)).toBe(false);
  });

  it("isRetryable is true only for TransientFailure", () => {
    expect(isRetryable(success)).toBe(false);
    expect(isRetryable(noChange)).toBe(false);
    expect(isRetryable(transient)).toBe(true);
    expect(isRetryable(structural)).toBe(false);
    expect(isRetryable(wedged)).toBe(false);
  });

  it("hasNewData narrows the type so downstream code can access .data", () => {
    const r: FetchResult<RawDoc> = success;
    if (hasNewData(r)) {
      // Compiles only because hasNewData is a type predicate.
      expect(r.data[0]?.id).toBe("doc-1");
    } else {
      throw new Error("expected hasNewData to narrow to Success");
    }
  });
});
