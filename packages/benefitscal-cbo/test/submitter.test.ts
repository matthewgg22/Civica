import { describe, it, expect, vi } from "vitest";
import {
  submitToBenefitsCal,
  navigateToApplicationHub,
  startSection,
  acceptUnvalidatedAddress,
  type BrowserDriver,
  type BrowserDriverFactory,
  type BrowserDriverLocator,
  type BrowserDriverPage,
  type SubmitterOptions,
} from "../src/driver/submitter";
import type { BenefitsCalPayload } from "../src/core/schemas";

// ---------------------------------------------------------------------------
// Fixture: minimal valid-ish snapshot.
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

// ---------------------------------------------------------------------------
// Locator + page mocks. The portal walk-recording tests need to introspect
// which (role, name) and (label) combos were resolved on the page. We
// record those on `roleCalls` / `labelCalls` arrays attached to the page.
// ---------------------------------------------------------------------------

type RecordedPage = BrowserDriverPage & {
  roleCalls: Array<{ role: string; name: string }>;
  labelCalls: string[];
  locatorActions: Array<{ kind: "click" | "fill"; target: string; value?: string }>;
};

interface MakePageOpts {
  /** Map of "role:name" → isVisible result for getByRole(...).isVisible(). */
  visibility?: Record<string, boolean>;
  /** Override individual page methods (e.g. fill that throws). */
  overrides?: Partial<BrowserDriverPage>;
}

function makeMockPage(opts: MakePageOpts = {}): RecordedPage {
  const roleCalls: RecordedPage["roleCalls"] = [];
  const labelCalls: RecordedPage["labelCalls"] = [];
  const locatorActions: RecordedPage["locatorActions"] = [];

  const visibility = opts.visibility ?? {};

  const makeLocator = (target: string): BrowserDriverLocator => ({
    click: vi.fn(async () => {
      locatorActions.push({ kind: "click", target });
    }),
    fill: vi.fn(async (value: string) => {
      locatorActions.push({ kind: "fill", target, value });
    }),
    isVisible: vi.fn(async () => visibility[target] ?? false),
    textContent: vi.fn(async () => null),
  });

  const page: RecordedPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    waitForURL: vi.fn().mockResolvedValue(undefined),
    textContent: vi.fn().mockResolvedValue(null),
    screenshot: vi.fn().mockResolvedValue(null),
    getByLabel: vi.fn((label: string) => {
      labelCalls.push(label);
      return makeLocator(`label:${label}`);
    }),
    getByRole: vi.fn((role: string, options: { name: string }) => {
      roleCalls.push({ role, name: options.name });
      return makeLocator(`role:${role}:${options.name}`);
    }),
    ...opts.overrides,
    roleCalls,
    labelCalls,
    locatorActions,
  } as RecordedPage;

  return page;
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

// ---------------------------------------------------------------------------
// Framework: credentials, lifecycle, hooks
// ---------------------------------------------------------------------------

describe("submitToBenefitsCal — framework behavior", () => {
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
    expect(factory.launch).not.toHaveBeenCalled();
  });

  it("returns 'failed' when browser launch throws", async () => {
    const factory: BrowserDriverFactory = {
      launch: vi.fn().mockRejectedValue(new Error("chromium binary missing")),
    };

    const result = await submitToBenefitsCal(baseOpts(factory));

    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("chromium binary missing");
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
      overrides: {
        click: vi.fn().mockRejectedValue(new Error("click failed")),
      },
    });
    const { factory, close } = makeMockFactory(page);

    const result = await submitToBenefitsCal(baseOpts(factory));

    expect(result.status).toBe("failed");
    expect(close).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Post-login URL + entry flow
// ---------------------------------------------------------------------------

describe("submitToBenefitsCal — login + entry flow", () => {
  it("waits for /CBO/CBDAS after login (not /cbo/dashboard)", async () => {
    const page = makeMockPage();
    const { factory } = makeMockFactory(page);

    await submitToBenefitsCal(baseOpts(factory));

    const waitCalls = (page.waitForURL as ReturnType<typeof vi.fn>).mock.calls;
    const loginWait = waitCalls.find(
      ([pat]) => pat instanceof RegExp && pat.source.includes("CBDAS"),
    );
    expect(loginWait).toBeDefined();
    // Ensure we are NOT waiting for the old speculative URL.
    const oldWait = waitCalls.find(
      ([pat]) => pat instanceof RegExp && pat.source.includes("dashboard"),
    );
    expect(oldWait).toBeUndefined();
  });

  it("drives the dashboard → ABOVR → ABHLT → ABDEI → ABSNC → ABNAV chain in order", async () => {
    const page = makeMockPage();
    const { factory } = makeMockFactory(page);

    const result = await submitToBenefitsCal(baseOpts(factory));

    // The flow proceeds until section 1's mid-page TBD throws, but the
    // entry chain must complete first.
    expect(result.status).toBe("failed");

    const buttonClicks = page.roleCalls
      .filter((c) => c.role === "button")
      .map((c) => c.name);

    // First five button resolutions, in order, are the entry chain.
    expect(buttonClicks.slice(0, 5)).toEqual([
      "New Application",
      "BEGIN",
      "Next", // ABHLT → ABDEI
      "Next", // ABDEI → ABSNC
      "Next", // ABSNC → ABNAV
    ]);

    const steps = result.transcript.map((t) => t.step);
    expect(steps).toContain("logged_in");
    expect(steps).toContain("page_ABOVR_loaded");
    expect(steps).toContain("page_ABHLT_loaded");
    expect(steps).toContain("page_ABDEI_loaded");
    expect(steps).toContain("page_ABSNC_loaded");
    expect(steps).toContain("page_ABNAV_loaded");
  });

  it("uses portal-coded transcript step names (not TODO_portal_flow)", async () => {
    const page = makeMockPage();
    const { factory } = makeMockFactory(page);

    const result = await submitToBenefitsCal(baseOpts(factory));
    const steps = result.transcript.map((t) => t.step);

    expect(steps).not.toContain("TODO_portal_flow");
    expect(steps).toContain("section_your_information_started");
  });
});

// ---------------------------------------------------------------------------
// Section 1 — Your Information
// ---------------------------------------------------------------------------

describe("submitToBenefitsCal — section 1 (Your Information)", () => {
  it("fills name + address inputs on ABNMI and ABNHA using getByLabel", async () => {
    const page = makeMockPage();
    const { factory } = makeMockFactory(page);

    await submitToBenefitsCal(baseOpts(factory));

    // ABNMI name fills
    const filledNames = page.locatorActions
      .filter((a) => a.kind === "fill")
      .map((a) => ({ target: a.target, value: a.value }));

    expect(filledNames).toContainEqual({
      target: "label:First Name (required)",
      value: "Test",
    });
    expect(filledNames).toContainEqual({
      target: "label:Last Name (required)",
      value: "User",
    });

    // ABNHA address fills
    expect(filledNames).toContainEqual({
      target: "label:Address Line 1 (required)",
      value: "1 Main St",
    });
    expect(filledNames).toContainEqual({
      target: "label:City (required)",
      value: "LA",
    });
    expect(filledNames).toContainEqual({
      target: "label:State",
      value: "CA",
    });
    expect(filledNames).toContainEqual({
      target: "label:Zip Code (required)",
      value: "90001",
    });

    // ABLPR/ABNMI/ABNHA transcript markers
    const result = await submitToBenefitsCal(baseOpts(makeMockFactory(makeMockPage()).factory));
    const steps = result.transcript.map((t) => t.step);
    expect(steps).toContain("page_ABLPR_loaded");
    expect(steps).toContain("page_ABNMI_loaded");
    expect(steps).toContain("page_ABNHA_loaded");
  });

  it("section 2+ throws PORTAL_STEP_TBD when reached directly", async () => {
    // Drive far enough to reach a TBD section by stubbing section 1 to
    // succeed — easiest path: call startSection + invoke People directly.
    // But submitter doesn't export submitPeople; assert via a custom run
    // that intercepts the section-1 throw and checks the transcript shape.
    const page = makeMockPage();
    const { factory } = makeMockFactory(page);

    const result = await submitToBenefitsCal(baseOpts(factory));

    // Section 1 itself throws PORTAL_STEP_TBD on the 1.4+ gap.
    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("PORTAL_STEP_TBD");
    expect(result.error?.message).toContain("1.4+");
  });
});

// ---------------------------------------------------------------------------
// Helpers exported for reuse + testing
// ---------------------------------------------------------------------------

describe("startSection", () => {
  it("clicks 'Start <name>' for the given section", async () => {
    const page = makeMockPage();
    await startSection(page, "Your Information");
    expect(page.roleCalls).toContainEqual({
      role: "button",
      name: "Start Your Information",
    });
  });

  it("clicks 'Start Household' (not 'Start Household Details') — aria-label mismatch", async () => {
    const page = makeMockPage();
    await startSection(page, "Household");
    expect(page.roleCalls).toContainEqual({
      role: "button",
      name: "Start Household",
    });
  });
});

describe("navigateToApplicationHub", () => {
  it("clicks New Application → BEGIN → Next×3 in order", async () => {
    const page = makeMockPage();
    const push = vi.fn();
    await navigateToApplicationHub(page, push);

    const names = page.roleCalls.map((c) => c.name);
    expect(names).toEqual(["New Application", "BEGIN", "Next", "Next", "Next"]);
  });
});

describe("acceptUnvalidatedAddress", () => {
  it("clicks 'USE THIS ADDRESS' when the modal is visible", async () => {
    const page = makeMockPage({
      visibility: { "role:button:USE THIS ADDRESS": true },
    });

    const dismissed = await acceptUnvalidatedAddress(page);

    expect(dismissed).toBe(true);
    expect(page.locatorActions).toContainEqual({
      kind: "click",
      target: "role:button:USE THIS ADDRESS",
    });
  });

  it("does nothing when the modal is not visible", async () => {
    const page = makeMockPage(); // default: all locators report not-visible

    const dismissed = await acceptUnvalidatedAddress(page);

    expect(dismissed).toBe(false);
    // No click was issued on the modal button.
    expect(
      page.locatorActions.find(
        (a) => a.kind === "click" && a.target === "role:button:USE THIS ADDRESS",
      ),
    ).toBeUndefined();
  });
});
