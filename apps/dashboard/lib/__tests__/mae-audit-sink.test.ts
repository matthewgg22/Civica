import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.hoisted(() => vi.fn());

vi.mock("../supabase", () => ({
  createServiceClient: vi.fn(() => ({
    schema: () => ({ from: () => ({ insert: mockInsert }) }),
  })),
}));

import { supabaseAuditSink } from "../mae-audit-sink";
import type { MaeAuditRecord } from "@civica/demeter-engine";

const REC: MaeAuditRecord = {
  staffUserId: "u1",
  questionRedacted: "What is the shelter cap?",
  answer: "The cap is $744.",
  citations: [{ citation: "7 CFR 273.9(d)(6)", status: "in_sources" }],
  unrecognizedCount: 0,
  piiRedactions: 2,
  model: "test-model",
  corpusDate: "2026-06-02",
  mode: "general",
  scopeState: "CA",
  scopeRef: null,
  verifierOutcome: "clean",
};

describe("supabaseAuditSink (dashboard persistence for engine audit records)", () => {
  beforeEach(() => mockInsert.mockReset());

  it("inserts the snake_case row into snap_enrollment.mae_query_log", async () => {
    mockInsert.mockResolvedValue({ error: null });
    await supabaseAuditSink(REC);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        staff_user_id: "u1",
        question_redacted: REC.questionRedacted,
        unrecognized_count: 0,
        pii_redactions: 2,
        scope_state: "CA",
      }),
    );
  });

  it("never throws when the insert fails (audit must not break answers)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    mockInsert.mockResolvedValue({ error: new Error("table missing") });
    await expect(supabaseAuditSink(REC)).resolves.toBeUndefined();
    expect(info).toHaveBeenCalled();
    info.mockRestore();
  });
});
