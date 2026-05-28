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
