// Vitest setup (V1-6, #315).
//
// jsdom does not ship the `chrome.*` extension APIs. The content script reads
// the active packet id from `chrome.storage.local` at import time (via its
// top-level `main()`), and the cross-step continuity helpers persist per-page
// fill state there. We install a tiny in-memory stub so:
//   (a) importing `content.ts` doesn't throw on a missing `chrome` global, and
//   (b) tests can exercise the real `runPageFill` / `clearPage` persistence
//       round-trip against an actual (fake) storage backend.
//
// The stub is intentionally minimal — just the `storage.local` get/set/remove
// surface the extension uses, plus a no-op `runtime` so `sendMessage` doesn't
// blow up if a test path reaches it. State resets between tests via the
// exported `__resetChromeStorage` helper (called from beforeEach in tests that
// care).

import { beforeEach } from "vitest";

interface FakeStorageArea {
  get(
    keys: string | string[] | null,
  ): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
}

const store = new Map<string, unknown>();

export function __resetChromeStorage(): void {
  store.clear();
}

const local: FakeStorageArea = {
  get(keys) {
    const out: Record<string, unknown> = {};
    if (keys === null || keys === undefined) {
      for (const [k, v] of store) out[k] = v;
      return Promise.resolve(out);
    }
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      if (store.has(k)) out[k] = store.get(k);
    }
    return Promise.resolve(out);
  },
  set(items) {
    for (const [k, v] of Object.entries(items)) store.set(k, v);
    return Promise.resolve();
  },
  remove(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) store.delete(k);
    return Promise.resolve();
  },
  clear() {
    store.clear();
    return Promise.resolve();
  },
};

// Install on globalThis. `as unknown as typeof chrome` keeps the surface tiny
// without re-declaring the full @types/chrome shape.
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: { local },
  runtime: {
    // sendMessage is unused by the fill/marker/state tests, but present so any
    // accidental call resolves rather than throwing on `chrome.runtime`.
    sendMessage: (_msg: unknown, cb?: (res: unknown) => void) => {
      cb?.({ ok: false, error: "no background in tests" });
    },
    lastError: undefined,
  },
};

// Reset storage before every test so persistence assertions are isolated.
beforeEach(() => {
  __resetChromeStorage();
});
