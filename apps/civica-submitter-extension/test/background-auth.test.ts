/**
 * Background worker auth tests (#317 part 3).
 *
 * The worker now authorizes gateway calls with the per-CBO device ACCESS TOKEN
 * (chrome.storage.session), refreshes once on a 401, and falls back to the
 * legacy pasted bearer only when no device token is connected. We drive it
 * through the real onMessage handler it registers at import time.
 *
 * jsdom env; chrome stub (storage.local + .session + captured onMessage) from
 * test/setup.ts. `fetch` is stubbed per test.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "../src/background"; // registers the onMessage listener (side effect)
import { __dispatchMessage } from "./setup";
import { writeConfig } from "../src/config";
import { TOKEN_STORAGE_KEY } from "../src/auth/device-flow";

const PAYLOAD_OK = { packet_id: "p1", first_name: "Maria" };

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/** Authorization header from a recorded fetch call. */
function authHeaderOf(call: unknown[]): string | undefined {
  const init = call[1] as { headers?: Record<string, string> } | undefined;
  return init?.headers?.Authorization;
}

async function seedDeviceToken(accessToken = "device-access", expiresInMs = 60_000): Promise<void> {
  await chrome.storage.session!.set({
    [TOKEN_STORAGE_KEY]: {
      accessToken,
      refreshToken: "device-refresh",
      accessExpiresAt: Date.now() + expiresInMs,
    },
  });
}

beforeEach(async () => {
  await writeConfig({ baseUrl: "https://civica-api.workers.dev", bearerToken: "" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// device-token-first auth
// ---------------------------------------------------------------------------

describe("fetchPayload auth", () => {
  it("uses the device access token as Bearer", async () => {
    await seedDeviceToken("device-access");
    const fetchFn = vi.fn(() => Promise.resolve(jsonResponse(200, PAYLOAD_OK)));
    vi.stubGlobal("fetch", fetchFn);

    const res = await __dispatchMessage<{ ok: boolean; data?: unknown }>({
      type: "fetchPayload",
      packetId: "p1",
    });

    expect(res.ok).toBe(true);
    expect(res.data).toMatchObject({ first_name: "Maria" });
    expect(authHeaderOf(fetchFn.mock.calls[0])).toBe("Bearer device-access");
  });

  it("on 401, refreshes once and retries with the rotated token", async () => {
    await seedDeviceToken("stale-access");
    const fetchFn = vi.fn();
    // 1) payload → 401, 2) refresh → new pair, 3) retried payload → 200.
    fetchFn
      .mockResolvedValueOnce(jsonResponse(401, { error: "invalid_token" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: "fresh-access",
          refresh_token: "fresh-refresh",
          token_type: "bearer",
          expires_in: 3600,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, PAYLOAD_OK));
    vi.stubGlobal("fetch", fetchFn);

    const res = await __dispatchMessage<{ ok: boolean }>({ type: "fetchPayload", packetId: "p1" });

    expect(res.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    // First call used the stale token; the retry used the rotated one.
    expect(authHeaderOf(fetchFn.mock.calls[0])).toBe("Bearer stale-access");
    expect(authHeaderOf(fetchFn.mock.calls[2])).toBe("Bearer fresh-access");
  });

  it("signals reconnectNeeded when the post-401 refresh fails", async () => {
    await seedDeviceToken("stale-access");
    const fetchFn = vi.fn();
    fetchFn
      .mockResolvedValueOnce(jsonResponse(401, { error: "invalid_token" }))
      .mockResolvedValueOnce(jsonResponse(400, { error: "invalid_grant" }));
    vi.stubGlobal("fetch", fetchFn);

    const res = await __dispatchMessage<{ ok: boolean; reconnectNeeded?: boolean }>({
      type: "fetchPayload",
      packetId: "p1",
    });

    expect(res.ok).toBe(false);
    expect(res.reconnectNeeded).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// legacy bearer fallback (only when no device token)
// ---------------------------------------------------------------------------

describe("legacy bearer fallback", () => {
  it("uses the pasted bearer when no device token is connected", async () => {
    await writeConfig({ bearerToken: "legacy-paste" });
    const fetchFn = vi.fn(() => Promise.resolve(jsonResponse(200, PAYLOAD_OK)));
    vi.stubGlobal("fetch", fetchFn);

    const res = await __dispatchMessage<{ ok: boolean }>({ type: "fetchPayload", packetId: "p1" });

    expect(res.ok).toBe(true);
    expect(authHeaderOf(fetchFn.mock.calls[0])).toBe("Bearer legacy-paste");
  });

  it("device token takes precedence over a configured legacy bearer", async () => {
    await writeConfig({ bearerToken: "legacy-paste" });
    await seedDeviceToken("device-access");
    const fetchFn = vi.fn(() => Promise.resolve(jsonResponse(200, PAYLOAD_OK)));
    vi.stubGlobal("fetch", fetchFn);

    await __dispatchMessage({ type: "fetchPayload", packetId: "p1" });
    expect(authHeaderOf(fetchFn.mock.calls[0])).toBe("Bearer device-access");
  });

  it("a 401 on the legacy bearer is NOT retried (nothing to refresh)", async () => {
    await writeConfig({ bearerToken: "legacy-paste" });
    const fetchFn = vi.fn(() => Promise.resolve(jsonResponse(401, { error: "invalid_token" })));
    vi.stubGlobal("fetch", fetchFn);

    const res = await __dispatchMessage<{ ok: boolean; status?: number }>({
      type: "fetchPayload",
      packetId: "p1",
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("returns reconnectNeeded when neither a device token nor a bearer exists", async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    const res = await __dispatchMessage<{ ok: boolean; reconnectNeeded?: boolean }>({
      type: "fetchPayload",
      packetId: "p1",
    });
    expect(res.ok).toBe(false);
    expect(res.reconnectNeeded).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// reportConfirm uses the same auth path
// ---------------------------------------------------------------------------

describe("reportConfirm auth", () => {
  it("forwards the confirmation with the device token", async () => {
    await seedDeviceToken("device-access");
    const fetchFn = vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true })));
    vi.stubGlobal("fetch", fetchFn);

    const res = await __dispatchMessage<{ ok: boolean }>({
      type: "reportConfirm",
      packetId: "p1",
      benefitscalCaseNumber: "BC-123",
    });

    expect(res.ok).toBe(true);
    expect(authHeaderOf(fetchFn.mock.calls[0])).toBe("Bearer device-access");
    const call = fetchFn.mock.calls[0] as unknown[];
    expect((call[0] as string)).toContain("/confirm");
  });
});
