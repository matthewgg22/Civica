import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/supabase.js", () => ({
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from "../lib/supabase.js";
import {
  diffFingerprints,
  runEbtProbe,
  type ProbeFingerprintResult,
} from "./ebt-probe.js";
import { TEST_ENV, makeQueryBuilder } from "../test/helpers.js";
import type { Env } from "../types.js";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockTestCard(cookieJson: string | null) {
  const selectResult = cookieJson
    ? { data: { id: "card-1", session_cookie_encrypted: cookieJson }, error: null }
    : { data: null, error: null };
  vi.mocked(makeServiceClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(makeQueryBuilder(selectResult)),
    }),
  } as never);
}

const FINGERPRINT_BASELINE: ProbeFingerprintResult = {
  balance: {
    url: "https://www.ebt.ca.gov/cardholder/Home",
    status: 200,
    inputNames: [],
    tableColumnCounts: [3],
    anchorTextPresence: {
      "Available Balance": true,
      "Cash Benefits": true,
      "Food Benefits": true,
    },
  },
  transactions: {
    url: "https://www.ebt.ca.gov/cardholder/transactions",
    status: 200,
    inputNames: [],
    tableColumnCounts: [4],
    anchorTextPresence: {
      Amount: true,
      Posted: true,
      "Transaction History": true,
    },
  },
  capturedAt: "2026-05-24T14:00:00.000Z",
};

// ---------------------------------------------------------------------------
// diffFingerprints — pure-function unit tests (mirror the scraper-side suite
// so a copy/paste regression on the gateway is caught here too).
// ---------------------------------------------------------------------------

describe("diffFingerprints", () => {
  it("returns equal=true when fingerprints match", () => {
    const a = structuredClone(FINGERPRINT_BASELINE);
    const b = structuredClone(FINGERPRINT_BASELINE);
    b.capturedAt = "2099-01-01T00:00:00.000Z";
    const diff = diffFingerprints(a, b);
    expect(diff.equal).toBe(true);
    expect(diff.changes).toEqual([]);
  });

  it("flags inputNames drift on balance page", () => {
    const current = structuredClone(FINGERPRINT_BASELINE);
    current.balance.inputNames = ["newField"];
    const diff = diffFingerprints(FINGERPRINT_BASELINE, current);
    expect(diff.equal).toBe(false);
    expect(diff.changes[0]).toMatchObject({ page: "balance", field: "inputNames" });
  });

  it("flags anchor-text presence change on transactions page", () => {
    const current = structuredClone(FINGERPRINT_BASELINE);
    current.transactions.anchorTextPresence["Transaction History"] = false;
    const diff = diffFingerprints(FINGERPRINT_BASELINE, current);
    expect(diff.equal).toBe(false);
    expect(diff.changes.some((c) => c.page === "transactions" && c.field === "anchorTextPresence")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runEbtProbe — integration-ish: mocks the test-card lookup, the scraper
// POST, and Slack, then asserts the cron returns the expected ProbeRunResult.
// ---------------------------------------------------------------------------

describe("runEbtProbe", () => {
  const baseEnv: Env = {
    ...TEST_ENV,
    EBT_SCRAPER_DISPATCH_URL: "https://scraper.test/scrape",
    EBT_SCRAPER_WEBHOOK_SECRET: "test-shared-secret",
  };

  it("skips when EBT_SCRAPER_DISPATCH_URL is unset", async () => {
    const env: Env = { ...baseEnv };
    delete env.EBT_SCRAPER_DISPATCH_URL;
    const result = await runEbtProbe(env);
    expect(result.ran).toBe(false);
    expect(result.reason).toBe("no_dispatch_url");
  });

  it("skips when EBT_SCRAPER_WEBHOOK_SECRET is unset", async () => {
    const env: Env = { ...baseEnv };
    delete env.EBT_SCRAPER_WEBHOOK_SECRET;
    const result = await runEbtProbe(env);
    expect(result.ran).toBe(false);
    expect(result.reason).toBe("no_secret");
  });

  it("skips when no test card is seeded", async () => {
    mockTestCard(null);
    const result = await runEbtProbe(baseEnv);
    expect(result.ran).toBe(false);
    expect(result.reason).toBe("no_test_card");
  });

  it("returns ran=true, drift=false when the live fingerprint matches the baseline", async () => {
    mockTestCard(JSON.stringify([{ name: "JSESSIONID", value: "x" }]));
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(FINGERPRINT_BASELINE), { status: 200 }),
    );
    const result = await runEbtProbe(baseEnv);
    expect(result.ran).toBe(true);
    expect(result.diff?.equal).toBe(true);
  });

  it("posts to Slack when drift is detected AND webhook is configured", async () => {
    mockTestCard(JSON.stringify([{ name: "JSESSIONID", value: "x" }]));
    const drifted = structuredClone(FINGERPRINT_BASELINE);
    drifted.balance.inputNames = ["newField"];
    const fetchMock = vi
      .fn()
      // First call: scraper probe (returns drifted fingerprint)
      .mockResolvedValueOnce(new Response(JSON.stringify(drifted), { status: 200 }))
      // Second call: Slack webhook
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    globalThis.fetch = fetchMock;
    const env: Env = {
      ...baseEnv,
      SLACK_OBSERVABILITY_WEBHOOK_URL: "https://hooks.slack.test/services/AAA",
    };
    const result = await runEbtProbe(env);
    expect(result.ran).toBe(true);
    expect(result.diff?.equal).toBe(false);
    expect(result.slackPosted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Second call was Slack.
    const slackCall = fetchMock.mock.calls[1]!;
    expect(slackCall[0]).toContain("hooks.slack.test");
  });

  it("flags slackPosted=false when drift is detected but no webhook is configured", async () => {
    mockTestCard(JSON.stringify([{ name: "JSESSIONID", value: "x" }]));
    const drifted = structuredClone(FINGERPRINT_BASELINE);
    drifted.balance.inputNames = ["other"];
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(drifted), { status: 200 }),
    );
    const result = await runEbtProbe(baseEnv);
    expect(result.ran).toBe(true);
    expect(result.diff?.equal).toBe(false);
    expect(result.slackPosted).toBe(false);
  });

  it("returns scraper_status_<n> when the scraper call fails", async () => {
    mockTestCard(JSON.stringify([{ name: "JSESSIONID", value: "x" }]));
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("nope", { status: 502 }));
    const result = await runEbtProbe(baseEnv);
    expect(result.ran).toBe(false);
    expect(result.reason).toBe("scraper_status_502");
  });

  it("rewrites /scrape → /probe-selectors-authed in the dispatch URL", async () => {
    mockTestCard(JSON.stringify([{ name: "JSESSIONID", value: "x" }]));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(FINGERPRINT_BASELINE), { status: 200 }),
    );
    globalThis.fetch = fetchMock;
    await runEbtProbe(baseEnv);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toBe("https://scraper.test/probe-selectors-authed");
  });
});
