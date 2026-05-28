// Civica Submitter background service worker.
//
// Single responsibility: brokers cross-origin requests to the Civica
// gateway on behalf of the content script. The content script runs in
// the benefitscal.com origin, so it cannot fetch civica's own API
// directly without falling out of CORS — it sends a message here, this
// worker forwards via fetch, and returns the response.
//
// This keeps the bearer token out of the content script's memory
// (background-only storage read) and centralizes the auth shape.

import { readConfig } from "./config";

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
  if (!config.bearerToken) {
    return {
      ok: false,
      error: "No bearer token configured. Open the extension options to set one.",
    };
  }

  switch (msg.type) {
    case "fetchPayload":
      return fetchPayload(config.baseUrl, config.bearerToken, msg.packetId);
    case "reportConfirm":
      return reportConfirm(
        config.baseUrl,
        config.bearerToken,
        msg.packetId,
        msg.benefitscalCaseNumber,
        msg.benefitscalApplicationId,
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
