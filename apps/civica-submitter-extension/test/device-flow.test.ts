/**
 * OAuth device-flow client tests (#317 part 3).
 *
 * Covers the RFC 8628 protocol against a stubbed `fetch`, plus token storage:
 *   - authorize parses the response shape;
 *   - pollOnce maps pending / slow_down / success / expired / denied;
 *   - pollForToken honors the interval, backs off on slow_down, and aborts;
 *   - refresh rotates + stores; a hard refresh failure clears tokens;
 *   - tokens land in chrome.storage.SESSION, never local;
 *   - getAccessToken refreshes when the stored access token is expired.
 *
 * jsdom env + the chrome.storage stub (local + session) from test/setup.ts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  startDeviceAuthorization,
  pollOnce,
  pollForToken,
  refreshAccessToken,
  getAccessToken,
  forceRefresh,
  clearTokens,
  isConnected,
  DeviceFlowError,
  TOKEN_STORAGE_KEY,
} from "../src/auth/device-flow";
import { __chromeStores } from "./setup";

const BASE = "https://civica-api.workers.dev";

/** Build a fetch Response-ish object the client's `await res.json()` understands. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/** Queue of responses returned in order by the stubbed fetch. */
function stubFetchSequence(responses: Response[]): ReturnType<typeof vi.fn> {
  let i = 0;
  const fn = vi.fn(() => {
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return Promise.resolve(r);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const AUTH_BODY = {
  device_code: "dev-abc",
  user_code: "WXYZ-1234",
  verification_uri: "https://dash.example/extension/connect",
  verification_uri_complete: "https://dash.example/extension/connect?user_code=WXYZ-1234",
  expires_in: 600,
  interval: 1,
};

const TOKEN_BODY = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  token_type: "bearer",
  expires_in: 3600,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// authorize
// ---------------------------------------------------------------------------

describe("startDeviceAuthorization", () => {
  it("parses a well-formed authorize response", async () => {
    const fetchFn = stubFetchSequence([jsonResponse(200, AUTH_BODY)]);
    const auth = await startDeviceAuthorization(BASE);
    expect(auth.user_code).toBe("WXYZ-1234");
    expect(auth.verification_uri_complete).toContain("user_code=");
    expect(auth.interval).toBe(1);
    // Hits the device subtree under the gateway base.
    expect(fetchFn).toHaveBeenCalledWith(
      `${BASE}/v1/enrollment/oauth/device/authorize`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws server on an unexpected shape", async () => {
    stubFetchSequence([jsonResponse(200, { nope: true })]);
    await expect(startDeviceAuthorization(BASE)).rejects.toBeInstanceOf(DeviceFlowError);
  });

  it("throws network when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    await expect(startDeviceAuthorization(BASE)).rejects.toMatchObject({ code: "network" });
  });
});

// ---------------------------------------------------------------------------
// pollOnce — single-step protocol mapping
// ---------------------------------------------------------------------------

describe("pollOnce", () => {
  it("returns 'pending' for authorization_pending", async () => {
    stubFetchSequence([jsonResponse(400, { error: "authorization_pending" })]);
    expect(await pollOnce(BASE, "dev-abc")).toBe("pending");
  });

  it("returns 'slow_down' for slow_down", async () => {
    stubFetchSequence([jsonResponse(400, { error: "slow_down" })]);
    expect(await pollOnce(BASE, "dev-abc")).toBe("slow_down");
  });

  it("returns the token pair on approval", async () => {
    stubFetchSequence([jsonResponse(200, TOKEN_BODY)]);
    const r = await pollOnce(BASE, "dev-abc");
    expect(r).toMatchObject({ access_token: "access-1", refresh_token: "refresh-1" });
  });

  it("rejects with code 'expired' on expired_token", async () => {
    stubFetchSequence([jsonResponse(400, { error: "expired_token" })]);
    await expect(pollOnce(BASE, "dev-abc")).rejects.toMatchObject({ code: "expired" });
  });

  it("rejects with code 'denied' on access_denied", async () => {
    stubFetchSequence([jsonResponse(400, { error: "access_denied" })]);
    await expect(pollOnce(BASE, "dev-abc")).rejects.toMatchObject({ code: "denied" });
  });

  it("treats invalid_grant as expired (re-start)", async () => {
    stubFetchSequence([jsonResponse(400, { error: "invalid_grant" })]);
    await expect(pollOnce(BASE, "dev-abc")).rejects.toMatchObject({ code: "expired" });
  });
});

// ---------------------------------------------------------------------------
// pollForToken — the loop (interval + slow_down + abort)
// ---------------------------------------------------------------------------

describe("pollForToken", () => {
  it("polls 'pending' then resolves on success, storing tokens", async () => {
    stubFetchSequence([
      jsonResponse(400, { error: "authorization_pending" }),
      jsonResponse(200, TOKEN_BODY),
    ]);
    // Inject an instant wait so the loop doesn't actually sleep.
    const waits: number[] = [];
    const token = await pollForToken("dev-abc", 5, {
      wait: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    expect(token.access_token).toBe("access-1");
    // Tokens persisted to SESSION, not local.
    expect(__chromeStores.session.has(TOKEN_STORAGE_KEY)).toBe(true);
    expect(__chromeStores.local.has(TOKEN_STORAGE_KEY)).toBe(false);
  });

  it("honors slow_down by increasing the wait by +5s", async () => {
    stubFetchSequence([
      jsonResponse(400, { error: "slow_down" }),
      jsonResponse(200, TOKEN_BODY),
    ]);
    const waits: number[] = [];
    await pollForToken("dev-abc", 5, {
      wait: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    // First wait = interval (5s). After slow_down the second wait is +5s = 10s.
    expect(waits[0]).toBe(5000);
    expect(waits[1]).toBe(10000);
  });

  it("rejects with an AbortError when the signal aborts", async () => {
    stubFetchSequence([jsonResponse(400, { error: "authorization_pending" })]);
    const ac = new AbortController();
    const p = pollForToken("dev-abc", 5, {
      signal: ac.signal,
      wait: () => {
        ac.abort();
        return Promise.resolve();
      },
    });
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });

  it("propagates a terminal poll error (expired) out of the loop", async () => {
    stubFetchSequence([jsonResponse(400, { error: "expired_token" })]);
    await expect(
      pollForToken("dev-abc", 5, { wait: () => Promise.resolve() }),
    ).rejects.toMatchObject({ code: "expired" });
  });
});

// ---------------------------------------------------------------------------
// refresh
// ---------------------------------------------------------------------------

describe("refreshAccessToken", () => {
  it("rotates the pair and stores the new one in session", async () => {
    const rotated = {
      access_token: "access-2",
      refresh_token: "refresh-2",
      token_type: "bearer",
      expires_in: 3600,
    };
    stubFetchSequence([jsonResponse(200, rotated)]);
    const r = await refreshAccessToken("refresh-1");
    expect(r.access_token).toBe("access-2");
    const stored = __chromeStores.session.get(TOKEN_STORAGE_KEY) as {
      accessToken: string;
      refreshToken: string;
    };
    expect(stored.accessToken).toBe("access-2");
    expect(stored.refreshToken).toBe("refresh-2");
  });

  it("clears tokens and throws 'invalid' on invalid_grant (reuse/expired)", async () => {
    // Seed a token, then a refresh that fails.
    await seedTokens({ accessExpiresAt: Date.now() + 1000 });
    stubFetchSequence([jsonResponse(400, { error: "invalid_grant" })]);
    await expect(refreshAccessToken("refresh-old")).rejects.toMatchObject({ code: "invalid" });
    expect(await isConnected()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// storage + getAccessToken
// ---------------------------------------------------------------------------

describe("token storage + getAccessToken", () => {
  it("getAccessToken returns null when not connected", async () => {
    expect(await getAccessToken()).toBeNull();
  });

  it("returns the stored token when it is still valid (no fetch)", async () => {
    await seedTokens({ accessToken: "valid-a", accessExpiresAt: Date.now() + 60_000 });
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    expect(await getAccessToken()).toBe("valid-a");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refreshes when the stored access token is expired", async () => {
    await seedTokens({ accessToken: "stale", accessExpiresAt: Date.now() - 1000 });
    stubFetchSequence([
      jsonResponse(200, {
        access_token: "fresh",
        refresh_token: "refresh-2",
        token_type: "bearer",
        expires_in: 3600,
      }),
    ]);
    expect(await getAccessToken()).toBe("fresh");
  });

  it("forceRefresh rotates even when the access token is not yet expired", async () => {
    await seedTokens({ accessToken: "still-good", accessExpiresAt: Date.now() + 60_000 });
    stubFetchSequence([
      jsonResponse(200, {
        access_token: "rotated",
        refresh_token: "refresh-3",
        token_type: "bearer",
        expires_in: 3600,
      }),
    ]);
    expect(await forceRefresh()).toBe("rotated");
  });

  it("clearTokens disconnects", async () => {
    await seedTokens({ accessExpiresAt: Date.now() + 60_000 });
    expect(await isConnected()).toBe(true);
    await clearTokens();
    expect(await isConnected()).toBe(false);
  });
});

// ── helper: seed a stored token pair directly into session ──────────────────
async function seedTokens(
  over: Partial<{ accessToken: string; refreshToken: string; accessExpiresAt: number }> = {},
): Promise<void> {
  await chrome.storage.session!.set({
    [TOKEN_STORAGE_KEY]: {
      accessToken: over.accessToken ?? "seed-access",
      refreshToken: over.refreshToken ?? "seed-refresh",
      accessExpiresAt: over.accessExpiresAt ?? Date.now() + 60_000,
    },
  });
}
