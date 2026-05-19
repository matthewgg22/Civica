/**
 * BenefitsCal Phase 2 — Playwright submitter (Session M1)
 *
 * Drives the BenefitsCal CBO Manager portal to submit a packet on the
 * client's behalf. This module is the FRAMEWORK only: browser lifecycle,
 * login skeleton, transcript capture, resource cleanup, and error
 * handling. The actual portal-specific UI flow (selectors, form sections,
 * confirmation page parsing) is INTENTIONALLY STUBBED — county CBO
 * approval is pending and we cannot guess at selectors without seeing
 * the live portal.
 *
 * CLOUDFLARE WORKER NOTE:
 * Workers cannot run real Playwright/Chromium in-process. Callers from
 * the Worker runtime must inject a `BrowserDriver` that delegates to an
 * external service (e.g. Browserless, a self-hosted Playwright server,
 * or a Durable Object that proxies a long-lived browser). The
 * `chromium` import path used by Node-side tooling is gated behind the
 * default driver factory and only loaded when a Node driver is
 * explicitly requested.
 *
 * Rollout gate (see README.md):
 *   - M1 must record 5 successful sandbox submissions
 *   - M2 (live CBO credentials) must be loaded as Worker secrets
 *   - ≥2 navigator-driven smoke tests must pass against production portal
 * Until then, v1 launch path is manual PDF export (Session F SOP).
 */

import type { BenefitsCalPayload } from "./schemas";

// ---------------------------------------------------------------------------
// Transcript types
// ---------------------------------------------------------------------------

export interface TranscriptStep {
  /** Stable identifier (e.g. "browser_launched", "logged_in"). */
  step: string;
  /** ISO 8601 timestamp. */
  at: string;
  /** Optional human-readable note. */
  note?: string;
  /** Optional small (≤ ~20 KB) base64 PNG screenshot. Do NOT include large screenshots — the transcript is stored inline in JSONB. */
  screenshot_base64?: string;
}

export interface SubmitterResult {
  status: "succeeded" | "failed";
  confirmation_number?: string;
  benefitscal_application_id?: string;
  transcript: TranscriptStep[];
  error?: {
    message: string;
    /** Step name that was active when the error fired (last transcript entry). */
    step?: string;
  };
}

// ---------------------------------------------------------------------------
// BrowserDriver interface
//
// Abstracts away the actual Playwright runtime so the submitter is
// testable and runtime-portable (Node test, CF Worker via external
// browser service, etc.).
// ---------------------------------------------------------------------------

export interface BrowserDriverPage {
  goto(url: string, opts?: { timeout?: number }): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  waitForURL(pattern: RegExp | string, opts?: { timeout?: number }): Promise<void>;
  /** Returns inner text of the first matching element, or null if not found. */
  textContent(selector: string): Promise<string | null>;
  /** Best-effort screenshot returning base64. Implementations may return null when capture is unavailable. */
  screenshot(): Promise<string | null>;
}

export interface BrowserDriver {
  newPage(): Promise<BrowserDriverPage>;
  close(): Promise<void>;
}

export interface BrowserDriverFactory {
  launch(opts: { headless: boolean }): Promise<BrowserDriver>;
}

// ---------------------------------------------------------------------------
// Submitter options
// ---------------------------------------------------------------------------

export interface SubmitterOptions {
  username: string;
  password: string;
  snapshot: BenefitsCalPayload;
  /** Defaults to https://benefitscal.com/cbo/login. */
  baseURL?: string;
  /** Injected driver factory. In Node tests, pass a mock. In production, wire to Browserless / external service. */
  driverFactory: BrowserDriverFactory;
  /** Optional hooks for testing & instrumentation. */
  hooks?: {
    onBeforeLogin?: (page: BrowserDriverPage) => Promise<void>;
    onAfterSubmit?: (page: BrowserDriverPage) => Promise<void>;
  };
}

// ---------------------------------------------------------------------------
// submitToBenefitsCal — main entrypoint
// ---------------------------------------------------------------------------

export async function submitToBenefitsCal(
  opts: SubmitterOptions,
): Promise<SubmitterResult> {
  const transcript: TranscriptStep[] = [];
  let browser: BrowserDriver | undefined;

  const push = (step: string, note?: string): void => {
    const entry: TranscriptStep = { step, at: new Date().toISOString() };
    if (note !== undefined) entry.note = note;
    transcript.push(entry);
  };

  try {
    if (!opts.username || !opts.password) {
      throw new Error(
        "MISSING_CREDENTIALS: BENEFITSCAL_CBO_USERNAME / BENEFITSCAL_CBO_PASSWORD must be set as Worker secrets.",
      );
    }

    browser = await opts.driverFactory.launch({ headless: true });
    push("browser_launched");

    const page = await browser.newPage();
    push("page_opened");

    const baseURL = opts.baseURL ?? "https://benefitscal.com/cbo/login";

    // 1. Login
    await page.goto(baseURL, { timeout: 15000 });
    push("login_page_loaded");
    await opts.hooks?.onBeforeLogin?.(page);
    await page.fill("[name=username]", opts.username);
    await page.fill("[name=password]", opts.password);
    await page.click("button[type=submit]");
    await page.waitForURL(/\/cbo\/dashboard/, { timeout: 15000 });
    push("logged_in");

    // 2. Portal-specific application flow.
    //
    // TODO(M2): Fill in once CBO Manager credentials are live AND Matthew has
    // logged into the portal to capture actual selectors + page structure.
    // The shape of these steps is known from the BenefitsCal applicant flow
    // but the CBO Manager portal layout is NOT confirmed. DO NOT GUESS at
    // selectors — visit the live portal, capture HTML, then fill these in.
    //
    // Expected step sequence (each becomes a transcript entry):
    //   a) click_new_application       — "New CalFresh Application" button
    //   b) fill_household_primary      — applicant first/last name, DOB, SSN last 4,
    //                                    address (street, city, state, zip), phone
    //   c) fill_household_members      — one row per snapshot.household_members[],
    //                                    fields: first_name, last_name, DOB, relationship
    //   d) fill_income_sources         — one row per snapshot.income_sources[],
    //                                    fields: income_type, income_amount, income_frequency
    //   e) fill_utility_allowance      — snapshot.utility_allowance_type → portal SUA selector
    //   f) upload_documents            — one upload per snapshot.document_urls[];
    //                                    download from signed URL, attach via file input
    //   g) fill_consent                — snapshot.client_signature_type +
    //                                    telephonic_consent_recorded_at if applicable
    //   h) click_review_and_submit     — Review page sanity check then submit
    //   i) capture_confirmation        — read confirmation number from success page
    //                                    (likely a selector like "[data-testid=confirmation-number]"
    //                                    or text scrape — verify against live portal)
    //
    // Field-name mapping lives in field-map.ts; selectors must be confirmed
    // against the live portal before this can run.

    push(
      "TODO_portal_flow",
      "Portal-specific UI flow not yet implemented; awaiting CBO Manager credentials.",
    );
    throw new Error(
      "PORTAL_FLOW_NOT_IMPLEMENTED: BenefitsCal portal layout unavailable without CBO Manager credentials. See packages/benefitscal-cbo/README.md for the steps to fill in.",
    );

    // Unreachable until portal flow is filled in. Kept as a structural hint:
    //
    // await opts.hooks?.onAfterSubmit?.(page);
    // const confirmation = await page.textContent("[data-testid=confirmation-number]");
    // return {
    //   status: "succeeded",
    //   confirmation_number: confirmation ?? undefined,
    //   transcript,
    // };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lastStep = transcript[transcript.length - 1]?.step;
    const error: { message: string; step?: string } = { message };
    if (lastStep !== undefined) error.step = lastStep;
    return {
      status: "failed",
      transcript,
      error,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Best-effort cleanup; never let close() failure mask the real error.
      }
    }
  }
}

// ---------------------------------------------------------------------------
// nodePlaywrightDriverFactory — opt-in Node driver
//
// Returns a BrowserDriverFactory backed by the real `playwright` package.
// Importing playwright is gated behind this function so it does not appear
// in the Cloudflare Worker bundle. Use this in offline tooling / CLI /
// integration tests that run against a recorded portal trace.
//
// To use:
//   const factory = await nodePlaywrightDriverFactory();
//   await submitToBenefitsCal({ ..., driverFactory: factory });
//
// In CF Worker production, inject an external-service driver instead
// (e.g. one that hits a Browserless WebSocket endpoint).
// ---------------------------------------------------------------------------

export async function nodePlaywrightDriverFactory(): Promise<BrowserDriverFactory> {
  // Dynamic import keeps `playwright` out of the Worker bundle.
  // The cast lets us type the adapter without taking a hard dep on the
  // Playwright type surface in this package's tsconfig.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pw: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pw = (await import("playwright" as any)) as any;
  } catch {
    throw new Error(
      "playwright is not installed. Install as a devDependency for Node-side testing only — do NOT bundle into the CF Worker.",
    );
  }

  return {
    async launch(launchOpts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const browser: any = await pw.chromium.launch({ headless: launchOpts.headless });
      return {
        async newPage() {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const page: any = await browser.newPage();
          return {
            goto: (url: string, o?: { timeout?: number }) => page.goto(url, o),
            fill: (sel: string, val: string) => page.fill(sel, val),
            click: (sel: string) => page.click(sel),
            waitForURL: (pat: RegExp | string, o?: { timeout?: number }) =>
              page.waitForURL(pat, o),
            textContent: (sel: string) => page.textContent(sel),
            screenshot: async () => {
              try {
                const buf = await page.screenshot({ type: "png" });
                return Buffer.from(buf).toString("base64");
              } catch {
                return null;
              }
            },
          } satisfies BrowserDriverPage;
        },
        close: () => browser.close(),
      };
    },
  };
}
