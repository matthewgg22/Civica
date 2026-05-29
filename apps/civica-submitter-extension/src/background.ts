// Civica Submitter background service worker.
//
// Single responsibility: brokers cross-origin requests to the Civica
// gateway on behalf of the content script. The content script runs in
// the benefitscal.com origin, so it cannot fetch civica's own API
// directly without falling out of CORS — it sends a message here, this
// worker forwards via fetch, and returns the response.
//
// AUTH (#317 part 3): the primary credential is the per-CBO device-flow
// ACCESS TOKEN (chrome.storage.session, obtained via the popup "Connect with
// Civica" flow). On a 401 we refresh once and retry. The legacy manually-pasted
// bearer token remains ONLY as a fallback when no device token is connected, so
// existing sideload setups keep working until they re-connect.
//
// Tokens never reach the content script — this worker reads them from session
// storage and centralizes the auth shape.

import { readConfig } from "./config";
import {
  getAccessToken,
  forceRefresh,
  clearTokens,
  DeviceFlowError,
} from "./auth/device-flow";

interface FetchPayloadMessage {
  type: "fetchPayload";
  packetId: string;
}

interface ReportConfirmMessage {
  type: "reportConfirm";
  packetId: string;
  benefitscalCaseNumber: string;
  benefitscalApplicationId?: string;
}

type Message = FetchPayloadMessage | ReportConfirmMessage;

interface MessageResponse<T = unknown> {
  ok: boolean;
  status?: number;
  data?: T;
  error?: string;
  /** Set when auth is gone and the assister must re-run the popup connect flow. */
  reconnectNeeded?: boolean;
}

chrome.runtime.onMessage.addListener(
  (raw: Message, _sender, sendResponse: (res: MessageResponse) => void) => {
    // chrome.runtime.onMessage requires returning `true` to signal an async
    // response. The actual response is delivered via sendResponse() inside
    // the awaited promise.
    void handle(raw).then(sendResponse).catch((err: unknown) => {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    });
    return true;
  },
);

async function handle(msg: Message): Promise<MessageResponse> {
  const config = await readConfig();

  // Resolve auth: device access token (preferred) → legacy pasted bearer.
  let auth: ResolvedAuth;
  try {
    auth = await resolveAuth(config.bearerToken);
  } catch (err) {
    // A refresh was attempted (token expired) and failed → reconnect needed.
    if (err instanceof DeviceFlowError) {
      return { ok: false, reconnectNeeded: true, error: reconnectMessage(err) };
    }
    throw err;
  }
  if (!auth) {
    return {
      ok: false,
      reconnectNeeded: true,
      error:
        "Not connected to Civica. Open the extension popup and click “Connect with Civica”.",
    };
  }

  switch (msg.type) {
    case "fetchPayload":
      return withAuthRetry(auth, (token) =>
        fetchPayload(config.baseUrl, token, msg.packetId),
      );
    case "reportConfirm":
      return withAuthRetry(auth, (token) =>
        reportConfirm(
          config.baseUrl,
          token,
          msg.packetId,
          msg.benefitscalCaseNumber,
          msg.benefitscalApplicationId,
        ),
      );
    default: {
      const exhaustive: never = msg;
      return {
        ok: false,
        error: `Unknown message type: ${(exhaustive as { type: string }).type}`,
      };
    }
  }
}

/** How a request is being authorized this turn. */
type ResolvedAuth =
  | { kind: "device"; token: string }
  | { kind: "legacy"; token: string }
  | null;

/**
 * Device token takes precedence; getAccessToken() transparently refreshes an
 * expired access token (and may throw DeviceFlowError if that refresh fails).
 * Falls back to the legacy pasted bearer only when NOT connected via the device
 * flow — so existing sideload installs keep working until they re-connect.
 */
async function resolveAuth(legacyBearer: string): Promise<ResolvedAuth> {
  const deviceToken = await getAccessToken();
  if (deviceToken) return { kind: "device", token: deviceToken };
  if (legacyBearer) return { kind: "legacy", token: legacyBearer };
  return null;
}

/**
 * Runs a forwarder; on a 401 with a DEVICE token, refreshes once and retries.
 * A 401 on the legacy bearer is returned as-is (nothing to refresh). If the
 * forced refresh itself fails, clears tokens and signals reconnectNeeded.
 */
async function withAuthRetry(
  auth: NonNullable<ResolvedAuth>,
  run: (token: string) => Promise<MessageResponse>,
): Promise<MessageResponse> {
  const first = await run(auth.token);
  if (first.status !== 401 || auth.kind !== "device") return first;

  // Device token rejected — try exactly one forced refresh + retry.
  let refreshed: string | null;
  try {
    refreshed = await forceRefresh();
  } catch (err) {
    await clearTokens();
    return {
      ok: false,
      reconnectNeeded: true,
      error: err instanceof DeviceFlowError ? reconnectMessage(err) : "Reconnect with Civica.",
    };
  }
  if (!refreshed) {
    return { ok: false, reconnectNeeded: true, error: "Reconnect with Civica." };
  }
  return run(refreshed);
}

function reconnectMessage(err: DeviceFlowError): string {
  return err.code === "network"
    ? "Network error reaching Civica. Check your connection and try again."
    : "Your Civica session expired. Open the popup and reconnect.";
}

async function fetchPayload(
  baseUrl: string,
  bearerToken: string,
  packetId: string,
): Promise<MessageResponse> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/enrollment/extension/packets/${encodeURIComponent(packetId)}/payload`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: "application/json",
      },
    });
    const body: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMessage =
        body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message
          : `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: errorMessage };
    }
    return { ok: true, status: res.status, data: body };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network error",
    };
  }
}

async function reportConfirm(
  baseUrl: string,
  bearerToken: string,
  packetId: string,
  benefitscalCaseNumber: string,
  benefitscalApplicationId: string | undefined,
): Promise<MessageResponse> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/enrollment/extension/packets/${encodeURIComponent(packetId)}/confirm`;
  const body: Record<string, string | undefined> = {
    benefitscal_confirmation_number: benefitscalCaseNumber,
  };
  if (benefitscalApplicationId) {
    body["benefitscal_application_id"] = benefitscalApplicationId;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const respBody: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMessage =
        respBody && typeof respBody === "object" && "message" in respBody && typeof respBody.message === "string"
          ? respBody.message
          : `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: errorMessage };
    }
    return { ok: true, status: res.status, data: respBody };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network error",
    };
  }
}
