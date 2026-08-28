// POST /api/demeter/conversations — the worksheet rides on the saved row (#905),
// and the write must survive the deploy window where the code is live but the
// worksheet column's migration has not been pasted into prod yet (migrations
// apply by hand via the dashboard SQL editor). In that window PostgREST fails
// the write with a column-not-found error; the route retries once without the
// worksheet so the transcript still saves — the worksheet is an enhancement,
// the save is the product.
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  getUser: vi.fn(),
  count: vi.fn(),
}));

vi.mock("../../../../../lib/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: db.getUser },
    schema: () => ({
      from: () => ({
        insert: (row: unknown) => ({
          select: () => ({ single: () => db.insert(row) }),
        }),
        update: (row: unknown) => ({
          eq: () => ({ select: () => ({ maybeSingle: () => db.update(row) }) }),
        }),
        select: (_cols: string, opts?: { count?: string; head?: boolean }) =>
          opts?.head
            ? db.count()
            : { single: vi.fn(), maybeSingle: vi.fn() },
      }),
    }),
  })),
}));

// `after()` throws outside a request scope, and the save route now uses it to
// record the "saved" conversion without making anyone wait. Same shape as the
// /api/demeter suite's mock: collect the callbacks, run none of them — this
// file is about worksheet handling, not telemetry.
const afterCallbacks: Array<() => Promise<void>> = [];
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (fn: () => Promise<void>) => afterCallbacks.push(fn) };
});

import { POST } from "../route";

const WORKSHEET = {
  mode: "estimate",
  facts: { household: [{ member_id: "a", age: 45, role: "head" }] },
  classification: null,
};

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/demeter/conversations", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const MESSAGES = [
  { role: "user", content: "What's the income limit?" },
  { role: "assistant", content: "For a household of two…" },
];

const MISSING_COLUMN = {
  data: null,
  error: {
    code: "PGRST204",
    message:
      "Could not find the 'worksheet' column of 'demeter_conversations' in the schema cache",
  },
};

beforeEach(() => {
  db.insert.mockReset();
  db.update.mockReset();
  db.count.mockReset().mockResolvedValue({ count: 0, error: null });
  db.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("POST /api/demeter/conversations — worksheet on the row (#905)", () => {
  it("stores a valid worksheet with the insert", async () => {
    db.insert.mockResolvedValue({ data: { id: "c1", title: "t", updated_at: "now" }, error: null });
    const res = await POST(makeReq({ messages: MESSAGES, worksheet: WORKSHEET }));
    expect(res.status).toBe(201);
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ worksheet: WORKSHEET }));
  });

  it("drops a malformed worksheet rather than rejecting the save", async () => {
    db.insert.mockResolvedValue({ data: { id: "c1", title: "t", updated_at: "now" }, error: null });
    const res = await POST(makeReq({ messages: MESSAGES, worksheet: { mode: "turbo" } }));
    expect(res.status).toBe(201);
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ worksheet: null }));
  });

  it("retries the insert without the worksheet when the column does not exist yet", async () => {
    db.insert
      .mockResolvedValueOnce(MISSING_COLUMN)
      .mockResolvedValueOnce({
        data: { id: "c1", title: "t", updated_at: "now" },
        error: null,
      });
    const res = await POST(makeReq({ messages: MESSAGES, worksheet: WORKSHEET }));
    expect(res.status).toBe(201);
    expect(db.insert).toHaveBeenCalledTimes(2);
    const retryRow = db.insert.mock.calls[1]![0] as Record<string, unknown>;
    expect("worksheet" in retryRow).toBe(false);
  });

  it("retries an update the same way, so the auto-refresh keeps working too", async () => {
    db.update
      .mockResolvedValueOnce(MISSING_COLUMN)
      .mockResolvedValueOnce({
        data: { id: "c1", title: "t", updated_at: "now" },
        error: null,
      });
    const res = await POST(makeReq({ id: "c1", messages: MESSAGES, worksheet: WORKSHEET }));
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledTimes(2);
    const retryRow = db.update.mock.calls[1]![0] as Record<string, unknown>;
    expect("worksheet" in retryRow).toBe(false);
  });

  it("a genuine insert failure still fails — the retry is only for the missing column", async () => {
    db.insert.mockResolvedValue({ data: null, error: { code: "23505", message: "boom" } });
    const res = await POST(makeReq({ messages: MESSAGES, worksheet: WORKSHEET }));
    expect(res.status).toBe(500);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});
