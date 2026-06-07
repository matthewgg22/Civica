import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.hoisted(() => vi.fn());
const mockCreateServiceClient = vi.hoisted(() => vi.fn());

vi.mock("../../supabase", () => ({
  createServiceClient: mockCreateServiceClient,
}));

import { logMaeQuery, type MaeAuditRecord } from "../audit";

const rec: MaeAuditRecord = {
  staffUserId: "u-1",
  questionRedacted: "What is the shelter deduction?",
  answer: "Shelter costs above 50% of income (7 CFR 273.9(d)(6)).",
  citations: [{ citation: "7 CFR 273.9(d)(6)", status: "in_sources" }],
  unrecognizedCount: 0,
  piiRedactions: 2,
  model: "claude-opus-4-8",
  corpusDate: "2026-06-02",
};

beforeEach(() => {
  mockInsert.mockReset();
  mockCreateServiceClient.mockReset();
  mockCreateServiceClient.mockReturnValue({
    schema: () => ({ from: () => ({ insert: mockInsert }) }),
  });
});

describe("Mae audit log", () => {
  it("writes a mapped, PII-scrubbed row via the service role", async () => {
    mockInsert.mockResolvedValue({ error: null });
    await logMaeQuery(rec);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        staff_user_id: "u-1",
        question_redacted: "What is the shelter deduction?",
        unrecognized_count: 0,
        pii_redactions: 2,
        model: "claude-opus-4-8",
        corpus_date: "2026-06-02",
      }),
    );
  });

  it("never throws when the insert errors (falls back to a log line)", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    mockInsert.mockResolvedValue({ error: new Error("relation does not exist") });
    await expect(logMaeQuery(rec)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith("[mae-audit]", expect.stringContaining("relation does not exist"));
    spy.mockRestore();
  });

  it("never throws when the service client is unavailable", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    mockCreateServiceClient.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY unset");
    });
    await expect(logMaeQuery(rec)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
