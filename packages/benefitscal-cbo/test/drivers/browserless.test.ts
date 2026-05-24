import { describe, it, expect, vi } from "vitest";
import { browserlessDriverFactory } from "../../src/drivers/browserless";

interface CapturedCall {
  url: string;
  init: RequestInit | undefined;
}

/**
 * Make a fake fetch that returns a JSON response. Records each call so the
 * test can assert URL + body shape.
 */
function makeFetch(
  payloads: Array<{ status?: number; body: unknown }>,
): { fetchImpl: typeof fetch; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  let i = 0;
  const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    const p = payloads[Math.min(i, payloads.length - 1)]!;
    i++;
    const status = p.status ?? 200;
    return new Response(JSON.stringify(p.body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("browserlessDriverFactory", () => {
  it("throws when apiKey is missing", () => {
    expect(() => browserlessDriverFactory({ apiKey: "" })).toThrow(/apiKey is required/);
  });

  it("launch() returns a BrowserDriver; newPage() returns a BrowserDriverPage", async () => {
    const { fetchImpl } = makeFetch([{ body: { data: { ok: true } } }]);
    const factory = browserlessDriverFactory({ apiKey: "test-key", fetchImpl });
    const browser = await factory.launch({ headless: true });
    expect(browser.newPage).toBeTypeOf("function");
    expect(browser.close).toBeTypeOf("function");
    const page = await browser.newPage();
    expect(page.goto).toBeTypeOf("function");
    expect(page.fill).toBeTypeOf("function");
    expect(page.click).toBeTypeOf("function");
    expect(page.waitForURL).toBeTypeOf("function");
    expect(page.textContent).toBeTypeOf("function");
    expect(page.screenshot).toBeTypeOf("function");
  });

  it("page.goto() POSTs to /function with the URL embedded in the script", async () => {
    const { fetchImpl, calls } = makeFetch([
      { body: { data: { ok: true }, browserWSEndpoint: "ws://browserless/123" } },
    ]);
    const factory = browserlessDriverFactory({ apiKey: "test-key", fetchImpl });
    const browser = await factory.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto("https://benefitscal.com/cbo/login");

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toContain("/function");
    expect(call.url).toContain("token=test-key");
    expect(call.init?.method).toBe("POST");
    const body = JSON.parse(call.init?.body as string) as { code: string };
    expect(body.code).toContain("page.goto(\"https://benefitscal.com/cbo/login\"");
    expect(body.code).toContain("module.exports");
  });

  it("subsequent calls reuse browserWSEndpoint returned by the first call", async () => {
    const { fetchImpl, calls } = makeFetch([
      { body: { data: { ok: true }, browserWSEndpoint: "ws://browserless/abc" } },
      { body: { data: { ok: true } } },
    ]);
    const factory = browserlessDriverFactory({ apiKey: "k", fetchImpl });
    const browser = await factory.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto("https://example.com");
    await page.fill("#user", "alice");

    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).not.toContain("browserWSEndpoint");
    expect(calls[1]!.url).toContain("browserWSEndpoint=ws%3A%2F%2Fbrowserless%2Fabc");
  });

  it("page.fill() serializes selector + value via JSON.stringify", async () => {
    const { fetchImpl, calls } = makeFetch([{ body: { data: { ok: true } } }]);
    const factory = browserlessDriverFactory({ apiKey: "k", fetchImpl });
    const page = await (await factory.launch({ headless: true })).newPage();

    await page.fill("[name=password]", "p@ss\"word");

    const body = JSON.parse(calls[0]!.init?.body as string) as { code: string };
    expect(body.code).toContain("page.fill(\"[name=password]\", \"p@ss\\\"word\")");
  });

  it("page.click() serializes the selector", async () => {
    const { fetchImpl, calls } = makeFetch([{ body: { data: { ok: true } } }]);
    const factory = browserlessDriverFactory({ apiKey: "k", fetchImpl });
    const page = await (await factory.launch({ headless: true })).newPage();

    await page.click("button[type=submit]");

    const body = JSON.parse(calls[0]!.init?.body as string) as { code: string };
    expect(body.code).toContain("page.click(\"button[type=submit]\")");
  });

  it("page.waitForURL() reconstructs a RegExp on the remote side", async () => {
    const { fetchImpl, calls } = makeFetch([{ body: { data: { ok: true } } }]);
    const factory = browserlessDriverFactory({ apiKey: "k", fetchImpl });
    const page = await (await factory.launch({ headless: true })).newPage();

    await page.waitForURL(/\/cbo\/dashboard/, { timeout: 5000 });

    const body = JSON.parse(calls[0]!.init?.body as string) as { code: string };
    expect(body.code).toContain("new RegExp(\"\\\\/cbo\\\\/dashboard\"");
    expect(body.code).toContain("timeout: 5000");
  });

  it("page.textContent() returns the value field from the response", async () => {
    const { fetchImpl } = makeFetch([
      { body: { data: { ok: true, value: "ABC-123" } } },
    ]);
    const factory = browserlessDriverFactory({ apiKey: "k", fetchImpl });
    const page = await (await factory.launch({ headless: true })).newPage();

    const v = await page.textContent("[data-testid=confirmation-number]");
    expect(v).toBe("ABC-123");
  });

  it("page.textContent() returns null when remote returns null value", async () => {
    const { fetchImpl } = makeFetch([
      { body: { data: { ok: true, value: null } } },
    ]);
    const page = await (
      await browserlessDriverFactory({ apiKey: "k", fetchImpl }).launch({ headless: true })
    ).newPage();
    expect(await page.textContent("#nope")).toBeNull();
  });

  it("page.screenshot() returns base64 from the value field", async () => {
    const { fetchImpl } = makeFetch([
      { body: { data: { ok: true, value: "iVBORw0KGgo=" } } },
    ]);
    const page = await (
      await browserlessDriverFactory({ apiKey: "k", fetchImpl }).launch({ headless: true })
    ).newPage();
    expect(await page.screenshot()).toBe("iVBORw0KGgo=");
  });

  it("page.screenshot() swallows errors and returns null (best-effort)", async () => {
    const { fetchImpl } = makeFetch([{ status: 500, body: { error: "kaboom" } }]);
    const page = await (
      await browserlessDriverFactory({ apiKey: "k", fetchImpl }).launch({ headless: true })
    ).newPage();
    expect(await page.screenshot()).toBeNull();
  });

  it("401 from Browserless throws a structured auth error", async () => {
    const { fetchImpl } = makeFetch([{ status: 401, body: { error: "bad token" } }]);
    const page = await (
      await browserlessDriverFactory({ apiKey: "bad", fetchImpl }).launch({ headless: true })
    ).newPage();

    await expect(page.goto("https://x")).rejects.toThrow(/BROWSERLESS_AUTH_ERROR/);
  });

  it("429 from Browserless throws a quota error", async () => {
    const { fetchImpl } = makeFetch([{ status: 429, body: { error: "quota" } }]);
    const page = await (
      await browserlessDriverFactory({ apiKey: "k", fetchImpl }).launch({ headless: true })
    ).newPage();

    await expect(page.goto("https://x")).rejects.toThrow(/BROWSERLESS_QUOTA_EXCEEDED/);
  });

  it("network failure throws a structured network error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const page = await (
      await browserlessDriverFactory({ apiKey: "k", fetchImpl }).launch({ headless: true })
    ).newPage();

    await expect(page.goto("https://x")).rejects.toThrow(/BROWSERLESS_NETWORK_ERROR.*ECONNREFUSED/);
  });

  it("remote script returning ok:false throws BROWSERLESS_SCRIPT_ERROR", async () => {
    const { fetchImpl } = makeFetch([
      { body: { data: { ok: false, message: "selector not found" } } },
    ]);
    const page = await (
      await browserlessDriverFactory({ apiKey: "k", fetchImpl }).launch({ headless: true })
    ).newPage();

    await expect(page.click("#x")).rejects.toThrow(/BROWSERLESS_SCRIPT_ERROR.*selector not found/);
  });

  it("close() posts a terminate function only if a session was opened", async () => {
    // First: no calls, then close() — should not POST anything.
    const noCallFetch = makeFetch([{ body: { data: { ok: true } } }]);
    const browserA = await browserlessDriverFactory({
      apiKey: "k",
      fetchImpl: noCallFetch.fetchImpl,
    }).launch({ headless: true });
    await browserA.close();
    expect(noCallFetch.calls).toHaveLength(0);

    // Second: a goto() opens a session; close() then posts one terminate call.
    const sessionFetch = makeFetch([
      { body: { data: { ok: true }, browserWSEndpoint: "ws://x" } },
      { body: { data: { ok: true } } },
    ]);
    const browserB = await browserlessDriverFactory({
      apiKey: "k",
      fetchImpl: sessionFetch.fetchImpl,
    }).launch({ headless: true });
    const page = await browserB.newPage();
    await page.goto("https://example.com");
    await browserB.close();
    expect(sessionFetch.calls).toHaveLength(2);
  });

  it("uses custom baseURL when provided", async () => {
    const { fetchImpl, calls } = makeFetch([{ body: { data: { ok: true } } }]);
    const page = await (
      await browserlessDriverFactory({
        apiKey: "k",
        baseURL: "https://staging.browserless.example",
        fetchImpl,
      }).launch({ headless: true })
    ).newPage();

    await page.goto("https://x");
    expect(calls[0]!.url).toMatch(/^https:\/\/staging\.browserless\.example\/function/);
  });
});
