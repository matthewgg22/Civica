import { describe, it, expect, vi, beforeEach } from "vitest";

// This route is the ONLY path by which a wrong eligibility answer reaches us.
// Two properties matter more than anything else here:
//   1. It must never punish the reporter. Every server-side failure still
//      returns success, because telling someone their report failed teaches
//      them not to bother next time — and they are the only sensor we have.
//   2. Free text must be PII-scrubbed. Someone reporting a wrong answer will
//      explain their situation, and that is exactly where an income figure or
//      an address ends up.

const insert = vi.hoisted(() => vi.fn());
const upsert = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ schema: () => ({ from: () => ({ insert, upsert }) }) }),
}));
vi.mock("@civica/demeter-engine", () => ({
  // Stand-in scrubber: proves the route ROUTES free text through redaction,
  // without re-testing pii.ts (which has its own suite).
  redactPii: (s: string) => ({ redacted: s.replace(/\d{3}-\d{2}-\d{4}/g, "[redacted]"), found: 0 }),
}));
vi.mock("@civica/demeter-engine/packs", () => ({
  isAnswerLang: (v: unknown) => ["en", "es", "vi", "zh"].includes(v as string),
  VERIFIED_STATE_CODES: ["CA", "TX"],
}));
vi.mock("../../../lead-capture/rate-limit", () => ({ rateLimit }));

import { POST } from "../route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/demeter/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const REPORT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockReturnValue(true);
  insert.mockResolvedValue({ error: null });
  upsert.mockResolvedValue({ error: null });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
});

describe("POST /api/demeter/feedback", () => {
  it("stores an anonymous thumbs-down with its triage context", async () => {
    const res = await POST(
      req({
        rating: "down",
        reason: "citation_wrong",
        question: "Do I qualify?",
        answer: "Yes, under 7 CFR 273.9.",
        state: "ca",
        lang: "es",
        certainty: "certain",
      }) as never,
    );
    expect(res.status).toBe(201);
    const row = insert.mock.calls[0]![0];
    expect(row).toMatchObject({
      staff_user_id: null,
      source: "public",
      rating: "down",
      reason: "citation_wrong",
      scope_state: "CA", // upper-cased and validated against the pack list
      lang: "es",
      certainty: "certain",
    });
  });

  it("UPSERTS on report_id, so enriching a report does not file a second one", async () => {
    // REGRESSION (second-pass review): two submits per thumbs-down used to be
    // two rows, double-counting one complaint in demeter_feedback_stats and
    // splitting it across two `reason` buckets.
    await POST(req({ rating: "down", reportId: REPORT_ID }) as never);
    expect(insert).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]![0].report_id).toBe(REPORT_ID);
    expect(upsert.mock.calls[0]![1]).toEqual({ onConflict: "report_id" });
  });

  it("plain-INSERTS when no report id is supplied", async () => {
    // A row with no report_id has nothing to conflict on; upserting on a null
    // key would make every anonymous report collide with every other.
    await POST(req({ rating: "up" }) as never);
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]![0].report_id).toBeNull();
  });

  it("rejects a report id that is not a UUID", async () => {
    await POST(req({ rating: "up", reportId: "'; drop table --" }) as never);
    expect(upsert).not.toHaveBeenCalled();
    expect(insert.mock.calls[0]![0].report_id).toBeNull();
  });

  it("scrubs PII out of the free-text note before it persists", async () => {
    await POST(
      req({ rating: "down", note: "my ssn is 123-45-6789 and it said I don't qualify" }) as never,
    );
    expect(insert.mock.calls[0]![0].note).not.toContain("123-45-6789");
    expect(insert.mock.calls[0]![0].note).toContain("[redacted]");
  });

  it("drops a state with no verified pack rather than storing a bad code", async () => {
    await POST(req({ rating: "up", state: "ZZ" }) as never);
    expect(insert.mock.calls[0]![0].scope_state).toBeNull();
  });

  it("ignores a reason outside the shared enum", async () => {
    // One queue means one vocabulary — a free-form reason would fragment the
    // triage rollup that groups by it.
    await POST(req({ rating: "down", reason: "made_up_reason" }) as never);
    expect(insert.mock.calls[0]![0].reason).toBeNull();
  });

  it("rejects a rating that is not up/down", async () => {
    const res = await POST(req({ rating: "sideways" }) as never);
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rate-limits, so an unauthenticated write endpoint is not an open door", async () => {
    rateLimit.mockReturnValue(false);
    const res = await POST(req({ rating: "up" }) as never);
    expect(res.status).toBe(429);
    expect(insert).not.toHaveBeenCalled();
  });

  it("still tells the reporter it worked when the DB write fails", async () => {
    insert.mockResolvedValue({ error: { message: "boom" } });
    const res = await POST(req({ rating: "down" }) as never);
    // 202, not 500: they did their part. The failure is ours and is logged
    // server-side — surfacing it would only train them out of reporting.
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, stored: false });
  });

  it("still succeeds when Supabase is not configured at all", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await POST(req({ rating: "down" }) as never);
    expect(res.status).toBe(202);
    expect(insert).not.toHaveBeenCalled();
  });
});
