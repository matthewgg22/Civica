/**
 * BrowserDriver implementation backed by Browserless.io (TODO-15).
 *
 * Why Browserless v1
 * ------------------
 * Cloudflare Workers cannot run Playwright/Chromium in-process. The
 * submitter framework (`packages/benefitscal-cbo/src/submitter.ts`) takes a
 * `BrowserDriverFactory` so production can delegate the actual browser
 * automation to an external service. For the pilot (≤100 submissions/month)
 * we use Browserless's hosted /function endpoint:
 *
 *   - Free tier: 1000 units/month (≈200x pilot volume).
 *   - Zero infra to manage.
 *   - One wrangler secret to set.
 *
 * The trade-off is that BenefitsCal credentials briefly transit through
 * Browserless's TLS pipeline for ~30s per submission. At <100 submissions
 * /month and no persistence on their side, this is acceptable. Migrate to a
 * Fly.io sidecar (option B) once monthly submissions cross ~500 OR a
 * data-pass-through audit requires in-house browser execution. See
 * packages/benefitscal-cbo/README.md for the v1→v2 migration playbook.
 *
 * Wire shape
 * ----------
 * Browserless's /function endpoint accepts a JS function body that runs in
 * their Playwright environment with `{ page, browser, context }` in scope.
 * Each `BrowserDriver` / `BrowserDriverPage` method becomes one POST that
 * stringifies a small Playwright snippet and parses the structured response.
 *
 * Session continuity (login → fill → click → ...) is preserved by reading
 * `browserWSEndpoint` off the first response and passing it back on
 * subsequent calls via the `?browserWSEndpoint=...` query param, which
 * Browserless uses to reconnect to the same browser. If the endpoint is
 * missing from the response (e.g. older API version), the driver still
 * works for self-contained single-step scripts; multi-step flows depending
 * on persistent state will see the underlying browser drop between calls
 * and surface as a clean failure in the submitter's transcript.
 *
 * NOTE: the implementation here is intentionally small and uses `fetch`
 * only — no `playwright` import — so the Worker bundle stays Worker-safe.
 */

import type {
  BrowserDriver,
  BrowserDriverFactory,
  BrowserDriverPage,
} from "../submitter";

export interface BrowserlessDriverOptions {
  /** Browserless.io API key (token). Set via `wrangler secret put BROWSERLESS_API_KEY`. */
  apiKey: string;
  /** Defaults to `https://chrome.browserless.io`. Override for staging / regional endpoints. */
  baseURL?: string;
  /** Per-call timeout in ms. Defaults to 90_000 (90s) — Browserless's own default. */
  timeout?: number;
  /** Optional fetch override (tests inject a vi.fn()). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface BrowserlessFunctionResponse {
  /** Whatever the user script returned (we use `{ ok, value? }`). */
  data?: unknown;
  /** Session WebSocket endpoint that subsequent calls can reconnect to. */
  browserWSEndpoint?: string;
  /** Error string when Browserless itself fails (e.g. quota, bad script). */
  error?: string;
}

const DEFAULT_BASE_URL = "https://chrome.browserless.io";
const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Build a Playwright function body that runs `inner` against `page` and
 * returns `{ ok: true, value }` or `{ ok: false, message }`.
 *
 * Browserless expects: `module.exports = async ({ page, context }) => { ... }`.
 * The function must serialize as plain text. We avoid template tags from
 * the host script — selectors and values are interpolated into a JS string
 * literal via JSON.stringify for safe quoting.
 */
function wrapScript(inner: string): string {
  return `module.exports = async ({ page, browser, context }) => {
  try {
    ${inner}
  } catch (err) {
    return { ok: false, message: err && err.message ? err.message : String(err) };
  }
};`;
}

/**
 * Driver factory for Browserless.io. The returned factory is what gets
 * passed into `submitToBenefitsCal({ driverFactory })`.
 */
export function browserlessDriverFactory(
  opts: BrowserlessDriverOptions,
): BrowserDriverFactory {
  if (!opts.apiKey) {
    throw new Error(
      "browserlessDriverFactory: apiKey is required (set BROWSERLESS_API_KEY).",
    );
  }
  return {
    async launch(_launchOpts: { headless: boolean }): Promise<BrowserDriver> {
      // Session token returned by the first /function call. Used to keep all
      // subsequent calls on the same underlying browser/page so login state
      // persists across method invocations.
      const session: { browserWSEndpoint?: string } = {};
      return makeBrowserlessBrowser(opts, session);
    },
  };
}

function makeBrowserlessBrowser(
  opts: BrowserlessDriverOptions,
  session: { browserWSEndpoint?: string },
): BrowserDriver {
  return {
    async newPage(): Promise<BrowserDriverPage> {
      return makeBrowserlessPage(opts, session);
    },
    async close(): Promise<void> {
      // Best-effort: tell Browserless to close the session if we have one.
      // If the endpoint isn't known (no calls were made, or older API), this
      // is a no-op — Browserless garbage-collects idle sessions on its side.
      if (!session.browserWSEndpoint) return;
      try {
        await postFunction(opts, session, "return { ok: true };", {
          terminate: true,
        });
      } catch {
        // Swallow — cleanup is best-effort by design.
      } finally {
        delete session.browserWSEndpoint;
      }
    },
  };
}

function makeBrowserlessPage(
  opts: BrowserlessDriverOptions,
  session: { browserWSEndpoint?: string },
): BrowserDriverPage {
  return {
    async goto(url, gotoOpts) {
      const timeout = gotoOpts?.timeout ?? 30_000;
      await runScript(
        opts,
        session,
        `await page.goto(${JSON.stringify(url)}, { timeout: ${Number(timeout)}, waitUntil: "load" });
       return { ok: true };`,
      );
    },
    async fill(selector, value) {
      await runScript(
        opts,
        session,
        `await page.fill(${JSON.stringify(selector)}, ${JSON.stringify(value)});
       return { ok: true };`,
      );
    },
    async click(selector) {
      await runScript(
        opts,
        session,
        `await page.click(${JSON.stringify(selector)});
       return { ok: true };`,
      );
    },
    async waitForURL(pattern, waitOpts) {
      const timeout = waitOpts?.timeout ?? 30_000;
      // RegExp must be re-built inside the remote script. We serialize the
      // source + flags and reconstruct on the other side.
      const patternJs =
        pattern instanceof RegExp
          ? `new RegExp(${JSON.stringify(pattern.source)}, ${JSON.stringify(pattern.flags)})`
          : JSON.stringify(pattern);
      await runScript(
        opts,
        session,
        `await page.waitForURL(${patternJs}, { timeout: ${Number(timeout)} });
       return { ok: true };`,
      );
    },
    async textContent(selector) {
      const value = await runScript<string | null>(
        opts,
        session,
        `const v = await page.textContent(${JSON.stringify(selector)});
       return { ok: true, value: v };`,
      );
      return value ?? null;
    },
    async screenshot() {
      try {
        const value = await runScript<string | null>(
          opts,
          session,
          `const buf = await page.screenshot({ type: "png" });
         return { ok: true, value: buf.toString("base64") };`,
        );
        return value ?? null;
      } catch {
        // Screenshot is best-effort per the BrowserDriverPage contract.
        return null;
      }
    },
  };
}

/**
 * POST a Playwright snippet to Browserless's /function endpoint, reusing
 * the session's browserWSEndpoint when present so login state persists.
 *
 * Throws a structured Error with `BROWSERLESS_*` prefix on failure so the
 * submitter framework can surface the failure step accurately.
 */
async function runScript<T = unknown>(
  opts: BrowserlessDriverOptions,
  session: { browserWSEndpoint?: string },
  innerBody: string,
): Promise<T | undefined> {
  const resp = await postFunction(opts, session, innerBody);
  const data = resp.data as { ok?: boolean; value?: T; message?: string } | undefined;
  if (!data || data.ok !== true) {
    const message =
      data?.message ?? resp.error ?? "Browserless function returned no result";
    throw new Error(`BROWSERLESS_SCRIPT_ERROR: ${message}`);
  }
  return data.value;
}

async function postFunction(
  opts: BrowserlessDriverOptions,
  session: { browserWSEndpoint?: string },
  innerBody: string,
  extra?: { terminate?: boolean },
): Promise<BrowserlessFunctionResponse> {
  const baseURL = opts.baseURL ?? DEFAULT_BASE_URL;
  const timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl ?? fetch;

  const url = new URL("/function", baseURL);
  url.searchParams.set("token", opts.apiKey);
  if (session.browserWSEndpoint) {
    url.searchParams.set("browserWSEndpoint", session.browserWSEndpoint);
  }

  const code = wrapScript(innerBody);

  // AbortController for the per-call timeout. Use a try/finally to make
  // sure the timer never outlives the request.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, context: {} }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      throw new Error(`BROWSERLESS_TIMEOUT: request exceeded ${timeoutMs}ms`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`BROWSERLESS_NETWORK_ERROR: ${message}`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `BROWSERLESS_AUTH_ERROR: ${res.status} — check BROWSERLESS_API_KEY`,
    );
  }
  if (res.status === 429) {
    throw new Error(
      "BROWSERLESS_QUOTA_EXCEEDED: free tier exhausted; upgrade plan or migrate to Fly.io sidecar",
    );
  }
  if (!res.ok) {
    const body = await safeReadText(res);
    throw new Error(`BROWSERLESS_HTTP_${res.status}: ${body}`);
  }

  let parsed: BrowserlessFunctionResponse;
  try {
    parsed = (await res.json()) as BrowserlessFunctionResponse;
  } catch {
    throw new Error("BROWSERLESS_BAD_RESPONSE: failed to parse JSON");
  }

  // Capture the session endpoint for subsequent calls. Browserless returns
  // this on the first call; later calls echo it back.
  if (parsed.browserWSEndpoint && !extra?.terminate) {
    session.browserWSEndpoint = parsed.browserWSEndpoint;
  }

  return parsed;
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return `<unreadable body, status ${res.status}>`;
  }
}
