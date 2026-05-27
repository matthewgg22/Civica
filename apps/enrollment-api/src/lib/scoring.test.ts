// Unit tests for the QC evaluation emit helper — TODO-5 / T8 shadow-mode.
//
// scoring.scorePacketRisk requires a live Supabase anon client, so it's
// covered by integration tests elsewhere. The emit helper is pure
// service-role + storage and can be tested with a tiny mock client.

import { describe, it, expect, vi } from "vitest";
import {
  emitQcEvaluation,
  QC_EVALUATION_EMIT_BUCKET,
  QC_EVALUATION_EMIT_PREFIX,
  type FlowSignal,
  type ScoringResult,
} from "./scoring.js";
import * as supabaseModule from "./supabase.js";

function makeMockStorage() {
  const upload = vi.fn().mockResolvedValue({ data: { path: "ok" }, error: null });
  const from = vi.fn(() => ({ upload }));
  return {
    upload,
    from,
    client: { storage: { from } } as unknown as ReturnType<typeof supabaseModule.makeServiceClient>,
  };
}

const baseResult: ScoringResult = {
  score: 42,
  tier: "medium",
  factors: ["earned_income_unverified"],
  engine_version: "v0.2.0",
};

const baseSignals: FlowSignal[] = [
  { flow: "utility-sua", defensibility_score: "moderate" },
  { flow: "gig-income", defensibility_score: "weak" },
];

describe("emitQcEvaluation", () => {
  it("skips emit when result.score is null (incomplete evaluation)", async () => {
    const mock = makeMockStorage();
    vi.spyOn(supabaseModule, "makeServiceClient").mockReturnValue(mock.client);

    const result = await emitQcEvaluation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      "pkt-1",
      "app-1",
      { ...baseResult, score: null, tier: "incomplete" },
      baseSignals,
    );

    expect(result).toBeUndefined();
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("writes to civica-analytics under civica-emit/qc-evaluations/date=YYYY-MM-DD/", async () => {
    const mock = makeMockStorage();
    vi.spyOn(supabaseModule, "makeServiceClient").mockReturnValue(mock.client);

    const path = await emitQcEvaluation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      "pkt-abc",
      "app-xyz",
      baseResult,
      baseSignals,
    );

    expect(typeof path).toBe("string");
    expect(path).toMatch(/^civica-emit\/qc-evaluations\/date=\d{4}-\d{2}-\d{2}\/pkt-abc-/);
    expect(mock.from).toHaveBeenCalledWith(QC_EVALUATION_EMIT_BUCKET);
    expect(mock.upload).toHaveBeenCalledTimes(1);

    const [storagePath, body, opts] = mock.upload.mock.calls[0]!;
    expect(storagePath).toBe(path);
    expect(opts).toMatchObject({ contentType: "application/json", upsert: false });
    expect(body).toBeInstanceOf(Blob);
  });

  it("includes per-flow signals + context fields in the event body", async () => {
    const mock = makeMockStorage();
    vi.spyOn(supabaseModule, "makeServiceClient").mockReturnValue(mock.client);

    await emitQcEvaluation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      "pkt-1",
      "app-1",
      baseResult,
      baseSignals,
      {
        org_id: "org-42",
        county: "Alameda",
        state_code: "CA",
        packet_status: "In Navigator Review",
      },
    );

    const [, body] = mock.upload.mock.calls[0]!;
    const text = await (body as Blob).text();
    const event = JSON.parse(text);

    expect(event).toMatchObject({
      schema_version: 1,
      packet_id: "pkt-1",
      applicant_id: "app-1",
      org_id: "org-42",
      county: "Alameda",
      state_code: "CA",
      packet_status: "In Navigator Review",
      engine_version: "v0.2.0",
      tier: "medium",
      score: 42,
      factors: ["earned_income_unverified"],
      flow_signals: baseSignals,
    });
    expect(typeof event.event_id).toBe("string");
    expect(event.event_id.length).toBeGreaterThan(8);
    expect(typeof event.emitted_at).toBe("string");
    expect(new Date(event.emitted_at).toString()).not.toBe("Invalid Date");
  });

  it("nulls context fields default to null in the event body", async () => {
    const mock = makeMockStorage();
    vi.spyOn(supabaseModule, "makeServiceClient").mockReturnValue(mock.client);

    await emitQcEvaluation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      "pkt-1",
      "app-1",
      baseResult,
      baseSignals,
    );

    const [, body] = mock.upload.mock.calls[0]!;
    const event = JSON.parse(await (body as Blob).text());
    expect(event.org_id).toBeNull();
    expect(event.county).toBeNull();
    expect(event.state_code).toBeNull();
    expect(event.packet_status).toBeNull();
  });

  it("swallows storage errors and returns null (never throws)", async () => {
    const mock = makeMockStorage();
    mock.upload.mockResolvedValueOnce({ data: null, error: { message: "bucket missing" } });
    vi.spyOn(supabaseModule, "makeServiceClient").mockReturnValue(mock.client);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await emitQcEvaluation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      "pkt-1",
      "app-1",
      baseResult,
      baseSignals,
    );

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/qc_evaluation emit failed/));
    warn.mockRestore();
  });

  it("swallows thrown errors from the service client and returns null", async () => {
    vi.spyOn(supabaseModule, "makeServiceClient").mockImplementation(() => {
      throw new Error("env not configured");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await emitQcEvaluation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      "pkt-1",
      "app-1",
      baseResult,
      baseSignals,
    );

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/qc_evaluation emit threw/));
    warn.mockRestore();
  });
});

describe("emit path constants", () => {
  it("bucket is civica-analytics (matches storage migration)", () => {
    expect(QC_EVALUATION_EMIT_BUCKET).toBe("civica-analytics");
  });

  it("prefix matches the analytics-engine reader prefix", () => {
    expect(QC_EVALUATION_EMIT_PREFIX).toBe("civica-emit/qc-evaluations");
  });
});
