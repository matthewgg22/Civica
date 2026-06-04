// Storage keys + small helpers for accessing the extension's two config
// values. Both are user-supplied via the options page and persist via
// chrome.storage.local. No remote sync — they stay on the assister's
// machine and are not transmitted to anyone but the configured Civica
// gateway.

export const STORAGE_KEYS = {
  /** Civica gateway base URL, e.g. https://civica-api.workers.dev */
  baseUrl: "civica.baseUrl",
  /** Bearer token issued by Civica to authorize this assister's extension. */
  bearerToken: "civica.bearerToken",
  /** Packet id currently selected for autofill (set from background; read by content). */
  activePacketId: "civica.activePacketId",
} as const;

export interface ExtensionConfig {
  baseUrl: string;
  bearerToken: string;
  activePacketId: string | null;
}

const DEFAULT_BASE_URL = "https://civica-api.workers.dev";

export async function readConfig(): Promise<ExtensionConfig> {
  const raw = await chrome.storage.local.get([
    STORAGE_KEYS.baseUrl,
    STORAGE_KEYS.bearerToken,
    STORAGE_KEYS.activePacketId,
  ]);
  return {
    baseUrl:
      typeof raw[STORAGE_KEYS.baseUrl] === "string" && raw[STORAGE_KEYS.baseUrl]
        ? (raw[STORAGE_KEYS.baseUrl] as string)
        : DEFAULT_BASE_URL,
    bearerToken:
      typeof raw[STORAGE_KEYS.bearerToken] === "string"
        ? (raw[STORAGE_KEYS.bearerToken] as string)
        : "",
    activePacketId:
      typeof raw[STORAGE_KEYS.activePacketId] === "string"
        ? (raw[STORAGE_KEYS.activePacketId] as string)
        : null,
  };
}

export async function writeConfig(patch: Partial<ExtensionConfig>): Promise<void> {
  const updates: Record<string, string | null> = {};
  if (patch.baseUrl !== undefined) updates[STORAGE_KEYS.baseUrl] = patch.baseUrl;
  if (patch.bearerToken !== undefined) updates[STORAGE_KEYS.bearerToken] = patch.bearerToken;
  if (patch.activePacketId !== undefined) updates[STORAGE_KEYS.activePacketId] = patch.activePacketId;
  await chrome.storage.local.set(updates);
}

/**
 * Set (or clear, with null) the packet the content script autofills. This is
 * THE dashboard↔extension connection point: the popup picker calls this after
 * the assister selects an applicant, and content.ts reads
 * `civica.activePacketId` from chrome.storage.local on each page load.
 *
 * activePacketId is NOT a secret (it's an org-scoped UUID), so it stays in
 * chrome.storage.local — unlike the tokens, which live in session storage.
 */
export async function setActivePacketId(packetId: string | null): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.activePacketId]: packetId,
  });
}

// ---------------------------------------------------------------------------
// Per-page fill state (V1-6, #315) — cross-step continuity.
//
// The assister traverses ~9 URL transitions to complete one application. The
// active packet id already persists (above); here we persist, per (packet,
// page), the fingerprints of what Civica wrote on that page. This lets the
// overlay's "Clear Civica fills" control revert ONLY Civica's writes even after
// the assister navigated away and back (a fresh content-script load), and lets
// the overlay show which page was last filled for which applicant.
// ---------------------------------------------------------------------------

import type { FillFingerprint } from "./fill-markers";

/** Storage key for a single page's fill record under a given packet. */
function pageFillKey(packetId: string, pageCode: string): string {
  return `civica.fill.${packetId}.${pageCode}`;
}

/** Persisted record of one page's Civica-written fields. */
export interface PageFillState {
  packetId: string;
  pageCode: string;
  /** Epoch ms of the last fill. */
  filledAt: number;
  /** What Civica wrote (used to clear safely without touching human edits). */
  fingerprints: FillFingerprint[];
}

export async function readPageFillState(
  packetId: string,
  pageCode: string,
): Promise<PageFillState | null> {
  const key = pageFillKey(packetId, pageCode);
  const raw = await chrome.storage.local.get(key);
  const v = raw[key];
  if (v && typeof v === "object" && Array.isArray((v as PageFillState).fingerprints)) {
    return v as PageFillState;
  }
  return null;
}

export async function writePageFillState(state: PageFillState): Promise<void> {
  await chrome.storage.local.set({
    [pageFillKey(state.packetId, state.pageCode)]: state,
  });
}

export async function clearPageFillState(
  packetId: string,
  pageCode: string,
): Promise<void> {
  await chrome.storage.local.remove(pageFillKey(packetId, pageCode));
}

/**
 * Read every persisted PageFillState for one packet (V1-6a, #316). Used by
 * the pre-submit trust panel to render "everything Civica filled across the
 * walk" on the Review & Submit step. Returns most-recently-filled first.
 *
 * Implementation: scans `chrome.storage.local.get(null)` for keys prefixed
 * with `civica.fill.<packetId>.`. The per-page write API uses this same
 * prefix shape (see `pageFillKey`); changing one without the other will
 * silently break aggregate reads.
 */
export async function readAllPageFillStatesForPacket(
  packetId: string,
): Promise<PageFillState[]> {
  const prefix = `civica.fill.${packetId}.`;
  const all = await chrome.storage.local.get(null);
  const out: PageFillState[] = [];
  for (const [k, v] of Object.entries(all)) {
    if (!k.startsWith(prefix)) continue;
    if (
      v &&
      typeof v === "object" &&
      Array.isArray((v as PageFillState).fingerprints)
    ) {
      out.push(v as PageFillState);
    }
  }
  // Most-recently-filled first so the trust panel shows the page the user
  // most likely just completed at the top.
  out.sort((a, b) => b.filledAt - a.filledAt);
  return out;
}
