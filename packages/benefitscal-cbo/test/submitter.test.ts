import { describe, it, expect, vi } from "vitest";
import {
  submitToBenefitsCal,
  type BrowserDriver,
  type BrowserDriverFactory,
  type BrowserDriverPage,
  type SubmitterOptions,
} from "../src/submitter";
import type { BenefitsCalPayload } from "../src/schemas";

// ---------------------------------------------------------------------------
// Fixture: minimal valid-ish snapshot. The submitter does not currently
// validate snapshot fields (portal flow is TODO), so we only need a
// stable shape for the tests.
// ---------------------------------------------------------------------------

const SNAPSHOT = {
  packet_id: "11111111-1111-1111-1111-111111111111",
  first_name: "Test",
  last_name: "User",
  date_of_birth: "1990-01-01",
  ssn_last4: "1234",
  address: { street: "1 Main St", city: "LA", state: "CA", zip: "90001" },
  phone: "+14155551234",
  household_members: [],
  income_sources: [],
  utility_allowance_type: "standard",
  document_urls: [],
  client_signature_type: "async_portal",
} as unknown as BenefitsCalPayload;

function makeMockPage(overrides: Partial<BrowserDriverPage> = {}): BrowserDriverPage {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    waitForURL: vi.fn().mockResolvedValue(undefined),
    textContent: vi.fn().mockResolvedValue(null),
    screenshot: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeMockFactory(
  page: BrowserDriverPage,
  closeFn: () => Promise<void> = async () => undefined,
): { factory: BrowserDriverFactory; close: ReturnType<typeof vi.fn> } {
  const close = vi.fn().mockImplementation(closeFn);
  const browser: BrowserDriver = {
    newPage: vi.fn().mockResolvedValue(page),
    close,
  };
  return {
    factory: { launch: vi.fn().mockResolvedValue(browser) },
    close,
  };
}

function baseOpts(factory: BrowserDriverFactory): SubmitterOptions {
  return {
    username: "navigator@example.com",
    password: "hunter2",
    snapshot: SNAPSHOT,
    driverFactory: factory,
  };
}

describe("submitToBenefitsCal — framework behavior", () => {
  it("returns 'failed' with PORTAL_FLOW_NOT_IMPLEMENTED when reaching the TODO portal flow", async () => {
    const page = makeMockPage();
    const { factory, close } = makeMockFactory(page);

    const result = await submitToBenefitsCal(baseOpts(factory));

    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("PORTAL_FLOW_NOT_IMPLEMENTED");

    // Transcript must record at least browser launch + login.
    const steps = result.transcript.map((t) => t.step);
    expect(steps).toContain("browser_launched");
    expect(steps).toContain("page_opened");
    expect(steps).toContain("login_page_loaded");
    expect(steps).toContain("logged_in");
    expect(steps).toContain("TODO_portal_flow");

    // Browser cleanup must always run.
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns 'failed' when credentials are missing", async () => {
    const page = makeMockPage();
    const { factory } = makeMockFactory(page);

    const result = await submitToBenefitsCal({
      ...baseOpts(factory),
      username: "",
      password: "",
    });

    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("MISSING_CREDENTIALS");
    // Factory should not have launched.
    expect(factory.launch).not.toHaveBeenCalled();
  });

  it("returns 'failed' with step='browser_launched' when login form is unreachable", async () => {
    const page = makeMockPage({
      fill: vi.fn().mockRejectedValue(new Error("selector [name=username] not found")),
    });
    const { factory, close } = makeMockFactory(page);

    const result = await submitToBenefitsCal(baseOpts(factory));

    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("[name=username]");
    // Last successful transcript step was login_page_loaded.
    expect(result.error?.step).toBe("login_page_loaded");
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns 'failed' when browser launch throws", async () => {
    const factory: BrowserDriverFactory = {
      launch: vi.fn().mockRejectedValue(new Error("chromium binary missing")),
    };

    const result = await submitToBenefitsCal(baseOpts(factory));

    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("chromium binary missing");
    // No transcript steps because launch failed before push("browser_launched").
    expect(result.transcript).toEqual([]);
  });

  it("invokes the onBeforeLogin hook with the page", async () => {
    const page = makeMockPage();
    const { factory } = makeMockFactory(page);
    const onBeforeLogin = vi.fn().mockResolvedValue(undefined);

    await submitToBenefitsCal({ ...baseOpts(factory), hooks: { onBeforeLogin } });

    expect(onBeforeLogin).toHaveBeenCalledWith(page);
  });

  it("closes the browser even when an error is thrown mid-flow", async () => {
    const page = makeMockPage({
      click: vi.fn().mockRejectedValue(new Error("click failed")),
    });
    const { factory, close } = makeMockFactory(page);

    const result = await submitToBenefitsCal(baseOpts(factory));

    expect(result.status).toBe("failed");
    expect(close).toHaveBeenCalledOnce();
  });
});
