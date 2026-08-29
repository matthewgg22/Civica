import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MaeAuditRecord } from "@civica/demeter-engine";

// When the mae_query_log insert fails, publicAuditSink falls back to the
// console so the failure is visible (a real 12-day outage was invisible until
// that line existed). But answer + questionRedacted live in the table behind
// RLS and the retention sweep; server logs have neither. The fallback must log
// the row's STRUCTURED shape, never its content.

const insert = vi.hoisted(() => vi.fn());

vi.mock("../supabase-server", () => ({
  supabaseAdmin: () => ({
    schema: () => ({ from: () => ({ insert }) }),
  }),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { publicAuditSink } from "../demeter-audit-sink";

const REC: MaeAuditRecord = {
  staffUserId: null,
  questionRedacted: "QUESTION_SENTINEL about my situation",
  answer: "ANSWER_SENTINEL — generated policy text a reader saw",
  citations: [],
  unrecognizedCount: 0,
  piiRedactions: 0,
  model: "claude-sonnet-5",
  corpusDate: "2026-06-02",
  scopeState: "CA",
  lang: "en",
};

describe("publicAuditSink console fallback", () => {
  beforeEach(() => {
    insert.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the structured shape but omits answer + question content on insert failure", async () => {
    insert.mockResolvedValue({ error: { message: "column does not exist" } });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    await publicAuditSink(REC);

    const logged = info.mock.calls.map((c) => c.join(" ")).join("\n");
    // Content must NOT reach the log...
    expect(logged).not.toContain("ANSWER_SENTINEL");
    expect(logged).not.toContain("QUESTION_SENTINEL");
    // ...but the diagnostic shape must: length markers + structured fields.
    expect(logged).toContain("chars omitted");
    expect(logged).toContain("CA"); // scope_state survives — it is not content
    // And the failure still rang (the whole point of the fallback).
    expect(err).toHaveBeenCalled();
  });

  it("never throws, even when the store is down", async () => {
    insert.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(publicAuditSink(REC)).resolves.toBeUndefined();
  });
});
