import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sendDepositLanded,
  sendLowBalance,
  sendReLink,
  sendAnomaly,
  buildApnsJwt,
  isInsideQuietHours,
  type ApnsSendDeps,
  type ApnsPrefs,
} from "./apns-send.js";
import { TEST_ENV } from "../test/helpers.js";
import type { Env } from "../types.js";

// ─── ES256 test key (PEM, freshly generated for tests) ─────────────────────
// This is NOT a real Apple key. crypto.subtle.importKey rejects invalid PKCS#8
// so we use a valid P-256 key just for the signature test.
const TEST_P8 = [
  "-----BEGIN PRIVATE KEY-----",
  "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hb2",
  "OF/2NxApJCzGCEDdfSp6VQO30hyhRANCAAQRWz+jn65BtOMvdyHKcvjBeBSDZH2r",
  "1RTwjmYSi9R/zpBnuQ4EiMnCqfMPWiZqB4QdbAd0E7oH50VpuZ1P087G",
  "-----END PRIVATE KEY-----",
].join("\n");

const APNS_ENV: Env = {
  ...TEST_ENV,
  APNS_KEY_P8: TEST_P8,
  APNS_KEY_ID: "TESTKEYID12",
  APNS_TEAM_ID: "TESTTEAMID1",
  APNS_TOPIC: "com.civica.test",
  APNS_ENV: "development",
};

const DEFAULT_PREFS: ApnsPrefs = {
  deposit_on: true,
  low_balance_on: true,
  perks_on: true,
  recert_on: true,
  quiet_start_minutes: 21 * 60,
  quiet_end_minutes: 8 * 60,
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeDeps(overrides: Partial<ApnsSendDeps> = {}, env: Env = APNS_ENV): {
  deps: ApnsSendDeps;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
  return {
    fetchMock,
    deps: {
      env,
      fetchFn: fetchMock as unknown as typeof fetch,
      fetchPrefs: vi.fn().mockResolvedValue(DEFAULT_PREFS),
      fetchTokens: vi.fn().mockResolvedValue(["deadbeefcafef00d"]),
      // Fix to a daytime moment (10:30 UTC) so default 21:00-08:00 quiet
      // window doesn't suppress sends.
      now: () => new Date("2026-05-22T10:30:00Z"),
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── isInsideQuietHours ───────────────────────────────────────────────────

describe("isInsideQuietHours", () => {
  it("same-day window: inside", () => {
    expect(isInsideQuietHours({ nowMinutes: 13 * 60, quietStartMinutes: 12 * 60, quietEndMinutes: 14 * 60 })).toBe(true);
  });
  it("same-day window: outside", () => {
    expect(isInsideQuietHours({ nowMinutes: 15 * 60, quietStartMinutes: 12 * 60, quietEndMinutes: 14 * 60 })).toBe(false);
  });
  it("wrap-midnight window: evening side (22:00 with 21:00-08:00)", () => {
    expect(isInsideQuietHours({ nowMinutes: 22 * 60, quietStartMinutes: 21 * 60, quietEndMinutes: 8 * 60 })).toBe(true);
  });
  it("wrap-midnight window: morning side (07:30 with 21:00-08:00)", () => {
    expect(isInsideQuietHours({ nowMinutes: 7 * 60 + 30, quietStartMinutes: 21 * 60, quietEndMinutes: 8 * 60 })).toBe(true);
  });
  it("wrap-midnight window: midday (12:00 with 21:00-08:00)", () => {
    expect(isInsideQuietHours({ nowMinutes: 12 * 60, quietStartMinutes: 21 * 60, quietEndMinutes: 8 * 60 })).toBe(false);
  });
  it("disabled when start === end", () => {
    expect(isInsideQuietHours({ nowMinutes: 12 * 60, quietStartMinutes: 9 * 60, quietEndMinutes: 9 * 60 })).toBe(false);
  });
});

// ─── buildApnsJwt ─────────────────────────────────────────────────────────

describe("buildApnsJwt", () => {
  it("produces a 3-segment JWT with the expected header + payload", async () => {
    const jwt = await buildApnsJwt({
      keyP8: TEST_P8,
      keyId: "TESTKEYID12",
      teamId: "TESTTEAMID1",
      now: new Date("2026-05-22T10:30:00Z"),
    });
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);

    const decode = (b64: string) => {
      const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, "=").replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(padded));
    };
    const header = decode(parts[0]!);
    const payload = decode(parts[1]!);
    expect(header).toEqual({ alg: "ES256", kid: "TESTKEYID12", typ: "JWT" });
    expect(payload.iss).toBe("TESTTEAMID1");
    expect(payload.iat).toBe(Math.floor(new Date("2026-05-22T10:30:00Z").getTime() / 1000));
    // Signature should be base64url (no padding, no +//).
    expect(parts[2]).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ─── sendDepositLanded ────────────────────────────────────────────────────

describe("sendDepositLanded", () => {
  it("returns not-configured when APNS_* env vars are missing", async () => {
    const { deps } = makeDeps({}, TEST_ENV);
    const report = await sendDepositLanded({ deps, userId: "u-1", amount: 23200 });
    expect(report.status).toBe("not-configured");
    expect(report.attempts).toBe(0);
  });

  it("skips when user has deposit_on=false", async () => {
    const { deps, fetchMock } = makeDeps({
      fetchPrefs: vi.fn().mockResolvedValue({ ...DEFAULT_PREFS, deposit_on: false }),
    });
    const report = await sendDepositLanded({ deps, userId: "u-1", amount: 23200 });
    expect(report.status).toBe("skipped");
    expect(report.reason).toContain("deposit_landed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips when current time is inside quiet hours", async () => {
    const { deps, fetchMock } = makeDeps({
      // 22:00 UTC, default quiet window is 21:00-08:00 → inside
      now: () => new Date("2026-05-22T22:00:00Z"),
    });
    const report = await sendDepositLanded({ deps, userId: "u-1", amount: 23200 });
    expect(report.status).toBe("skipped");
    expect(report.reason).toBe("inside quiet hours");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns no-tokens when user has no devices registered", async () => {
    const { deps, fetchMock } = makeDeps({
      fetchTokens: vi.fn().mockResolvedValue([]),
    });
    const report = await sendDepositLanded({ deps, userId: "u-1", amount: 23200 });
    expect(report.status).toBe("no-tokens");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs one push per device with correct URL + headers + payload", async () => {
    const { deps, fetchMock } = makeDeps({
      fetchTokens: vi.fn().mockResolvedValue(["tokenA", "tokenB"]),
    });
    const report = await sendDepositLanded({ deps, userId: "u-1", amount: 23200 });
    expect(report.status).toBe("sent");
    expect(report.attempts).toBe(2);
    expect(report.successes).toBe(2);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url0, init0] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url0).toBe("https://api.sandbox.push.apple.com/3/device/tokenA");
    expect((init0.headers as Record<string, string>)["apns-topic"]).toBe("com.civica.test");
    expect((init0.headers as Record<string, string>)["apns-push-type"]).toBe("alert");
    expect((init0.headers as Record<string, string>)["authorization"]).toMatch(/^bearer eyJ/);

    const body = JSON.parse(init0.body as string);
    expect(body.aps.alert.title).toBe("Your CalFresh deposit landed");
    expect(body.aps.alert.body).toContain("$232.00");
    expect(body.category).toBe("deposit_landed");
    expect(body.amount_cents).toBe(23200);
    expect(body.aps["thread-id"]).toBe("ebt-deposit_landed");
  });

  it("uses production host when APNS_ENV=production", async () => {
    const { deps, fetchMock } = makeDeps({}, { ...APNS_ENV, APNS_ENV: "production" });
    await sendDepositLanded({ deps, userId: "u-1", amount: 23200 });
    expect((fetchMock.mock.calls[0]?.[0] as string)).toContain("api.push.apple.com");
  });

  it("status=failed when all device sends are non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad", { status: 410 }));
    const { deps } = makeDeps({ fetchFn: fetchMock as unknown as typeof fetch });
    const report = await sendDepositLanded({ deps, userId: "u-1", amount: 23200 });
    expect(report.status).toBe("failed");
    expect(report.successes).toBe(0);
  });

  it("treats null prefs row as defaults-on (new user)", async () => {
    const { deps, fetchMock } = makeDeps({
      fetchPrefs: vi.fn().mockResolvedValue(null),
    });
    const report = await sendDepositLanded({ deps, userId: "u-1", amount: 100 });
    expect(report.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalled();
  });
});

// ─── sendLowBalance ───────────────────────────────────────────────────────

describe("sendLowBalance", () => {
  it("skips when low_balance_on=false", async () => {
    const { deps } = makeDeps({
      fetchPrefs: vi.fn().mockResolvedValue({ ...DEFAULT_PREFS, low_balance_on: false }),
    });
    const report = await sendLowBalance({ deps, userId: "u-1", thresholdCents: 2000 });
    expect(report.status).toBe("skipped");
  });

  it("payload includes threshold_cents", async () => {
    const { deps, fetchMock } = makeDeps();
    await sendLowBalance({ deps, userId: "u-1", thresholdCents: 2500 });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.threshold_cents).toBe(2500);
    expect(body.aps.alert.body).toContain("$25.00");
  });
});

// ─── sendReLink (never muted by prefs) ────────────────────────────────────

describe("sendReLink", () => {
  it("fires even when all category toggles are OFF", async () => {
    const { deps, fetchMock } = makeDeps({
      fetchPrefs: vi.fn().mockResolvedValue({
        ...DEFAULT_PREFS,
        deposit_on: false,
        low_balance_on: false,
        perks_on: false,
        recert_on: false,
      }),
    });
    const report = await sendReLink({ deps, userId: "u-1" });
    expect(report.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("still respects quiet hours", async () => {
    const { deps } = makeDeps({
      now: () => new Date("2026-05-22T22:00:00Z"),
    });
    const report = await sendReLink({ deps, userId: "u-1" });
    expect(report.status).toBe("skipped");
  });
});

// ─── sendAnomaly (priority=10) ────────────────────────────────────────────

describe("sendAnomaly", () => {
  it("uses apns-priority=10 (immediate)", async () => {
    const { deps, fetchMock } = makeDeps();
    await sendAnomaly({
      deps,
      userId: "u-1",
      transaction: { id: "tx-1", merchant: "EXAMPLE STORE", amount_cents: 5500 },
    });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["apns-priority"]).toBe("10");
  });

  it("payload carries transaction context", async () => {
    const { deps, fetchMock } = makeDeps();
    await sendAnomaly({
      deps,
      userId: "u-1",
      transaction: { id: "tx-42", merchant: "WEIRD STORE", amount_cents: 9900 },
    });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.transaction_id).toBe("tx-42");
    expect(body.merchant).toBe("WEIRD STORE");
    expect(body.amount_cents).toBe(9900);
    expect(body.aps.alert.body).toContain("WEIRD STORE");
  });
});

// ─── Non-anomaly default priority ─────────────────────────────────────────

describe("send priority defaults", () => {
  it("deposit_landed uses apns-priority=5", async () => {
    const { deps, fetchMock } = makeDeps();
    await sendDepositLanded({ deps, userId: "u-1", amount: 1000 });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["apns-priority"]).toBe("5");
  });
});
