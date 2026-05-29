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
// chrome.storage.session is a SEPARATE in-memory area (the device tokens live
// here, never in local — #317). Backed by its own map so a test can assert that
// tokens land in session, not local.
const sessionStore = new Map<string, unknown>();

export function __resetChromeStorage(): void {
  store.clear();
  sessionStore.clear();
}

/** Read-only peek into the backing maps so tests can assert WHERE a value went
 * (e.g. tokens in session, activePacketId in local). */
export const __chromeStores = {
  local: store,
  session: sessionStore,
};

/** The message listener the background worker registers at import time. */
type MessageListener = (
  msg: unknown,
  sender: unknown,
  sendResponse: (r: unknown) => void,
) => boolean | void;
let __capturedMessageListener: MessageListener | undefined;

/** Invoke the background's onMessage handler and resolve with its response. */
export function __dispatchMessage<T = unknown>(msg: unknown): Promise<T> {
  if (!__capturedMessageListener) {
    throw new Error("No background message listener registered (import background.ts first).");
  }
  return new Promise<T>((resolve) => {
    __capturedMessageListener!(msg, {}, (res) => resolve(res as T));
  });
}

/** Factory so local + session share one implementation over different maps. */
function makeArea(backing: Map<string, unknown>): FakeStorageArea {
  return {
    get(keys) {
      const out: Record<string, unknown> = {};
      if (keys === null || keys === undefined) {
        for (const [k, v] of backing) out[k] = v;
        return Promise.resolve(out);
      }
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) {
        if (backing.has(k)) out[k] = backing.get(k);
      }
      return Promise.resolve(out);
    },
    set(items) {
      for (const [k, v] of Object.entries(items)) backing.set(k, v);
      return Promise.resolve();
    },
    remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) backing.delete(k);
      return Promise.resolve();
    },
    clear() {
      backing.clear();
      return Promise.resolve();
    },
  };
}

const local = makeArea(store);
const session = makeArea(sessionStore);

// Install on globalThis. `as unknown as typeof chrome` keeps the surface tiny
// without re-declaring the full @types/chrome shape.
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: { local, session },
  runtime: {
    // sendMessage is unused by the fill/marker/state tests, but present so any
    // accidental call resolves rather than throwing on `chrome.runtime`.
    sendMessage: (_msg: unknown, cb?: (res: unknown) => void) => {
      cb?.({ ok: false, error: "no background in tests" });
    },
    // The background worker registers a message listener at import time. We
    // capture it so background-auth.test.ts can invoke the handler directly
    // (and resolve the async sendResponse it returns `true` to keep open).
    onMessage: {
      addListener: (
        fn: (msg: unknown, sender: unknown, sendResponse: (r: unknown) => void) => boolean | void,
      ) => {
        __capturedMessageListener = fn;
      },
    },
    openOptionsPage: () => {},
    lastError: undefined,
  },
  tabs: {
    // The popup opens the verification URL via chrome.tabs.create; the stub just
    // resolves so a test can spy via dependency injection instead.
    create: (_props: unknown) => Promise.resolve({}),
  },
};

// Reset storage before every test so persistence assertions are isolated.
beforeEach(() => {
  __resetChromeStorage();
});
