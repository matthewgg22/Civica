// Packet-picker data source (#317 part 3).
//
// GET /v1/enrollment/extension/packets — the CBO org's submittable packets,
// authorized by the per-CBO device ACCESS TOKEN (this endpoint is device-only;
// the legacy shared bearer is rejected with 403 because it has no org to scope
// to — see apps/enrollment-api/src/routes/extension/packets-list.ts).
//
// Called from the popup (not the background worker): the popup is open while the
// assister picks, and a direct fetch keeps the access token out of yet another
// message hop. CORS: the gateway allows the extension origin for /v1/enrollment.

import { readConfig } from "../config";
import { getAccessToken } from "./device-flow";

/** A QC risk badge if the packet has a scored error-risk row, else null. */
export interface QcBadge {
  tier: string;
  score: number | null;
}

/** One row in the picker (mirrors packets-list.ts response items). */
export interface PacketSummary {
  id: string;
  /** Phase-1 ciphertext marker; the picker shows "Name hidden" until decrypt. */
  applicant_name_ciphertext: string | null;
  status: string;
  county: string | null;
  updated_at: string | null;
  qc_badge: QcBadge | null;
}

interface PacketsListResponse {
  org_id: string;
  packets: PacketSummary[];
}

/** Raised when the picker can't be loaded; `reconnectNeeded` drives the popup
 * back to the disconnected state. */
export class PacketsError extends Error {
  constructor(
    message: string,
    readonly reconnectNeeded = false,
  ) {
    super(message);
    this.name = "PacketsError";
  }
}

/**
 * Fetch the org's submittable packets for the picker. Throws PacketsError on
 * any failure; a 401/403 sets `reconnectNeeded` so the popup prompts a reconnect
 * rather than showing a confusing empty list.
 */
export async function fetchPackets(): Promise<PacketSummary[]> {
  const { baseUrl } = await readConfig();
  const token = await getAccessToken();
  if (!token) {
    throw new PacketsError("Not connected to Civica.", true);
  }

  const url = `${baseUrl.replace(/\/$/, "")}/v1/enrollment/extension/packets`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch (err) {
    throw new PacketsError(err instanceof Error ? err.message : "Network error");
  }

  if (res.status === 401 || res.status === 403) {
    throw new PacketsError("Your Civica session expired — reconnect.", true);
  }

  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : `Could not load packets (HTTP ${res.status})`;
    throw new PacketsError(msg);
  }

  if (!isPacketsListResponse(body)) {
    throw new PacketsError("Packets response had an unexpected shape.");
  }
  return body.packets;
}

function isPacketsListResponse(v: unknown): v is PacketsListResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.packets);
}

/**
 * Human-facing applicant label for a picker row. Phase-1 PII posture: names are
 * ciphertext, so we never render them; we show a stable short id instead.
 */
export function applicantLabel(p: PacketSummary): string {
  // The packet id is an org-scoped UUID — safe to show, and gives the assister
  // a stable handle that matches what the Civica dashboard displays.
  return `Applicant ${p.id.slice(0, 8)}`;
}
