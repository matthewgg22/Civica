// Unit tests for the QC evaluation emit helper — TODO-5 / T8 shadow-mode.
//
// scoring.scorePacketRisk requires a live Supabase anon client, so it's
// covered by integration tests elsewhere. The emit helper is pure
// service-role + storage and can be tested with a tiny mock client.

import { describe, it, expect, vi } from "vitest";
import {
  emitQcEvaluation,
  deriveEngagementVector,
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

describe("emitQcEvaluation — PII firewall", () => {
  // These tests enforce that the civica-analytics bucket never receives PII.
  // The QcEvaluationEvent schema is intentionally narrow (IDs + QC metadata only).
  // Ported from the orphaned Lane C / T9 attempt. Issue #473.

  const PII_FIELD_NAMES = [
    "name", "first_name", "last_name", "full_name",
    "ssn", "social_security", "social_security_number",
    "dob", "date_of_birth", "birth_date",
    "email", "email_address",
    "phone", "phone_number", "mobile",
    "address", "street", "street_address", "zip", "zipcode",
  ];

  it("emitted event keys contain no PII field names", async () => {
    const mock = makeMockStorage();
    vi.spyOn(supabaseModule, "makeServiceClient").mockReturnValue(mock.client);

    await emitQcEvaluation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      "pkt-pii-1",
      "app-pii-1",
      baseResult,
      baseSignals,
      { org_id: "org-1", county: "Los Angeles", state_code: "CA" },
    );

    const [, body] = mock.upload.mock.calls[0]!;
    const event = JSON.parse(await (body as Blob).text()) as Record<string, unknown>;
    const keys = Object.keys(event).map((k) => k.toLowerCase());

    for (const piiField of PII_FIELD_NAMES) {
      expect(keys, `event must not contain key "${piiField}"`).not.toContain(piiField);
    }
  });

  it("extra PII-like fields on context are not forwarded to the event", async () => {
    const mock = makeMockStorage();
    vi.spyOn(supabaseModule, "makeServiceClient").mockReturnValue(mock.client);

    // Cast to bypass TypeScript — simulates a JS caller that passes extra fields
    const leakyContext = {
      org_id: "org-1",
      name: "Jane Smith",
      email: "jane@example.com",
      ssn: "123-45-6789",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await emitQcEvaluation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      "pkt-pii-2",
      "app-pii-2",
      baseResult,
      baseSignals,
      leakyContext,
    );

    const [, body] = mock.upload.mock.calls[0]!;
    const text = await (body as Blob).text();
    const event = JSON.parse(text) as Record<string, unknown>;

    // No PII key should appear in the serialised event
    for (const piiField of PII_FIELD_NAMES) {
      expect(Object.keys(event).map((k) => k.toLowerCase())).not.toContain(piiField);
    }
    // The PII values themselves should not appear anywhere in the JSON text
    expect(text).not.toContain("Jane Smith");
    expect(text).not.toContain("jane@example.com");
    expect(text).not.toContain("123-45-6789");
  });

  it("applicant_id is an opaque identifier, not a name or contact field", async () => {
    const mock = makeMockStorage();
    vi.spyOn(supabaseModule, "makeServiceClient").mockReturnValue(mock.client);

    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    await emitQcEvaluation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      "pkt-pii-3",
      uuid,
      baseResult,
      baseSignals,
    );

    const [, body] = mock.upload.mock.calls[0]!;
    const event = JSON.parse(await (body as Blob).text()) as Record<string, unknown>;
    // applicant_id is present as an opaque UUID, not a name or contact
    expect(event["applicant_id"]).toBe(uuid);
    // The event has no key named "name", "email", or "phone"
    expect(event).not.toHaveProperty("name");
    expect(event).not.toHaveProperty("email");
    expect(event).not.toHaveProperty("phone");
  });

  it("event serialises exactly the allowed schema keys and nothing else", async () => {
    const mock = makeMockStorage();
    vi.spyOn(supabaseModule, "makeServiceClient").mockReturnValue(mock.client);

    await emitQcEvaluation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      "pkt-schema",
      "app-schema",
      baseResult,
      baseSignals,
      { org_id: "org-1" },
    );

    const [, body] = mock.upload.mock.calls[0]!;
    const event = JSON.parse(await (body as Blob).text()) as Record<string, unknown>;
    const ALLOWED_KEYS = new Set([
      "schema_version", "event_id", "emitted_at",
      "packet_id", "applicant_id",
      "org_id", "county", "state_code", "packet_status",
      "engine_version", "tier", "score", "factors", "flow_signals",
    ]);

    for (const key of Object.keys(event)) {
      expect(ALLOWED_KEYS, `unexpected key "${key}" in emitted event`).toContain(key);
    }
  });
});

describe("deriveEngagementVector", () => {
  it("maps non-weak signals to 1.0 coverage", () => {
    const result = deriveEngagementVector({
      flowSignals: [
        { flow: "utility-sua",  defensibility_score: "strong" },
        { flow: "gig-income",   defensibility_score: "moderate" },
        { flow: "shared-lease", defensibility_score: "strong" },
      ],
    });
    expect(result.utility_sua).toBe(1);
    expect(result.gig_income).toBe(1);
    expect(result.shared_lease).toBe(1);
    expect(result.assets).toBe(0);
    expect(result.benefit_impact).toBe(0);
  });

  it("maps weak signals to 0 coverage", () => {
    const result = deriveEngagementVector({
      flowSignals: [
        { flow: "utility-sua", defensibility_score: "weak" },
        { flow: "gig-income",  defensibility_score: "weak" },
      ],
    });
    expect(result.utility_sua).toBe(0);
    expect(result.gig_income).toBe(0);
  });

  it("absent flows default to 0 coverage", () => {
    const result = deriveEngagementVector({ flowSignals: [] });
    expect(result.utility_sua).toBe(0);
    expect(result.gig_income).toBe(0);
    expect(result.shared_lease).toBe(0);
  });

  it("argyleConnected=true sets gig_income=1 regardless of signals", () => {
    const result = deriveEngagementVector({
      flowSignals: [],
      argyleConnected: true,
    });
    expect(result.gig_income).toBe(1);
    expect(result.utility_sua).toBe(0); // unaffected
  });

  it("argyleConnected=false does not boost gig_income", () => {
    const result = deriveEngagementVector({
      flowSignals: [{ flow: "gig-income", defensibility_score: "weak" }],
      argyleConnected: false,
    });
    expect(result.gig_income).toBe(0);
  });

  it("assets and benefit_impact always 0 (no gateway signal yet)", () => {
    const result = deriveEngagementVector({
      flowSignals: [
        { flow: "utility-sua",  defensibility_score: "strong" },
        { flow: "gig-income",   defensibility_score: "strong" },
        { flow: "shared-lease", defensibility_score: "strong" },
      ],
      argyleConnected: true,
    });
    expect(result.assets).toBe(0);
    expect(result.benefit_impact).toBe(0);
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
