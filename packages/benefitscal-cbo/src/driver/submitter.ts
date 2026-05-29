/**
 * BenefitsCal CBO portal submitter — Phase 2.
 *
 * This module drives the BenefitsCal CBO Manager portal end-to-end. The
 * architecture and selector strategy are encoded from a live walkthrough
 * of the production portal performed 2026-05-28; see
 * `packages/benefitscal-cbo/portal-map/SELECTORS.md` for the authoritative
 * findings, including the URL map and per-page selectors.
 *
 * High level flow:
 *   login (/cbo/login) → /CBO/CBDAS dashboard
 *     → "New Application" → ABOVR → BEGIN
 *     → ABHLT → Next → ABDEI → Next → ABSNC → Next → ABNAV (hub)
 *     → For each of the 9 sections, click "Start <Section>" then run the
 *       per-section submitter, which returns to ABNAV when complete.
 *
 * Today we have selectors for step 1 ("Your Information") only — sub-pages
 * ABLPR (language), ABNMI (name) and ABNHA (address). The remaining 8
 * sections (People, Household Details, Income, Expenses, Assets, Other
 * Situations, Document Upload, Review and Submit) throw `PORTAL_STEP_TBD`
 * until a sandbox walk fills them in. Schema gaps surfaced so far
 * (Household Details, Assets, Other Situations) are noted inline — see
 * task TODO-15 for the schema extension.
 *
 * CLOUDFLARE WORKER NOTE:
 * Workers cannot run Playwright in-process. Callers from the Worker
 * runtime must inject a `BrowserDriver` (see `./browserless.ts`).
 */

import type { BenefitsCalPayload } from "../core/schemas";

// ---------------------------------------------------------------------------
// Transcript types
// ---------------------------------------------------------------------------

export interface TranscriptStep {
  /** Stable identifier (e.g. "browser_launched", "page_ABNAV_loaded"). */
  step: string;
  /** ISO 8601 timestamp. */
  at: string;
  /** Optional human-readable note. */
  note?: string;
  /** Optional small (≤ ~20 KB) base64 PNG screenshot. */
  screenshot_base64?: string;
}

export interface SubmitterResult {
  status: "succeeded" | "failed";
  confirmation_number?: string;
  benefitscal_application_id?: string;
  transcript: TranscriptStep[];
  error?: {
    message: string;
    step?: string;
  };
}

// ---------------------------------------------------------------------------
// BrowserDriver interface
//
// Abstracts the Playwright runtime. We expose Playwright-style locator
// queries (`getByLabel`, `getByRole`) because the portal's `id`/`name`
// attributes are unstable (random UUIDs on buttons; positional `#text1`
// on inputs — see SELECTORS.md "Architectural findings"). Selecting by
// visible label / aria role survives portal layout shuffles and fails
// loudly when the label changes.
// ---------------------------------------------------------------------------

export interface BrowserDriverLocator {
  fill(value: string): Promise<void>;
  click(): Promise<void>;
  isVisible(): Promise<boolean>;
  textContent(): Promise<string | null>;
}

export interface BrowserDriverPage {
  goto(url: string, opts?: { timeout?: number }): Promise<void>;
  /** Legacy CSS-selector fill. Prefer `getByLabel` for portal forms. */
  fill(selector: string, value: string): Promise<void>;
  /** Legacy CSS-selector click. Prefer `getByRole` for portal buttons. */
  click(selector: string): Promise<void>;
  waitForURL(pattern: RegExp | string, opts?: { timeout?: number }): Promise<void>;
  /** Returns inner text of the first matching element, or null if not found. */
  textContent(selector: string): Promise<string | null>;
  /** Best-effort screenshot returning base64. May return null when unavailable. */
  screenshot(): Promise<string | null>;
  /** Playwright-style accessible-label locator. */
  getByLabel(label: string): BrowserDriverLocator;
  /** Playwright-style ARIA role locator (typically used for buttons by name). */
  getByRole(role: string, options: { name: string }): BrowserDriverLocator;
}

export interface BrowserDriver {
  newPage(): Promise<BrowserDriverPage>;
  close(): Promise<void>;
}

export interface BrowserDriverFactory {
  launch(opts: { headless: boolean }): Promise<BrowserDriver>;
}

// ---------------------------------------------------------------------------
// Section identifiers — match the 9 ABNAV Start buttons.
// Note: enabled Start buttons read "Start <Section>"; disabled ones read
// "Start <Section> Not Available". We always click the enabled form; the
// caller's responsibility is to call sections in unlock order.
// ---------------------------------------------------------------------------

export type SectionName =
  | "Your Information"
  | "People"
  | "Household" // aria-label is "Household", not "Household Details"
  | "Income"
  | "Expenses"
  | "Assets"
  | "Other Situations"
  | "Document Upload"
  | "Review and Submit"; // aria uses "and"; nav header uses "&"

// ---------------------------------------------------------------------------
// Submitter options
// ---------------------------------------------------------------------------

export interface SubmitterOptions {
  username: string;
  password: string;
  snapshot: BenefitsCalPayload;
  /** Defaults to https://benefitscal.com/cbo/login. */
  baseURL?: string;
  driverFactory: BrowserDriverFactory;
  hooks?: {
    onBeforeLogin?: (page: BrowserDriverPage) => Promise<void>;
    onAfterSubmit?: (page: BrowserDriverPage) => Promise<void>;
  };
}

// ---------------------------------------------------------------------------
// submitToBenefitsCal — main entrypoint
//
// CONSTRAINT: BenefitsCal enforces a ~15-minute inactivity TTL on the
// draft application (per ABHLT page copy). Do not introduce sleeps, manual
// gates, or retry-with-backoff loops longer than a few seconds anywhere
// in this flow — one application must complete end-to-end inside the
// window or the draft is silently discarded.
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
    await page.goto(baseURL, { timeout: 15_000 });
    push("login_page_loaded");
    await opts.hooks?.onBeforeLogin?.(page);
    await page.fill("[name=username]", opts.username);
    await page.fill("[name=password]", opts.password);
    await page.click("button[type=submit]");
    // Post-login lands on /CBO/CBDAS (capital "CBO"), NOT /cbo/dashboard
    // as the speculative version assumed. See SELECTORS.md §Step 0.
    await page.waitForURL(/\/CBO\/CBDAS/, { timeout: 15_000 });
    push("logged_in");

    // 2. Dashboard → ABNAV hub
    await navigateToApplicationHub(page, push);

    // 3. Per-section submitters. Sections must be invoked in portal unlock
    // order — ABNAV gates each section until the prior one is complete.
    push("section_your_information_started");
    await startSection(page, "Your Information");
    await submitYourInformation(page, opts.snapshot, push);
    push("section_your_information_completed");

    // Remaining sections — selectors not yet captured. Throw a localized
    // error so the framework above + tests can prove the architecture
    // wires through, while leaving the per-section TODO in one place.
    push("section_people_started");
    await startSection(page, "People");
    await submitPeople(page, opts.snapshot, push);
    push("section_people_completed");

    push("section_household_started");
    await startSection(page, "Household");
    await submitHouseholdDetails(page, opts.snapshot, push);
    push("section_household_completed");

    push("section_income_started");
    await startSection(page, "Income");
    await submitIncome(page, opts.snapshot, push);
    push("section_income_completed");

    push("section_expenses_started");
    await startSection(page, "Expenses");
    await submitExpenses(page, opts.snapshot, push);
    push("section_expenses_completed");

    push("section_assets_started");
    await startSection(page, "Assets");
    await submitAssets(page, opts.snapshot, push);
    push("section_assets_completed");

    push("section_other_situations_started");
    await startSection(page, "Other Situations");
    await submitOtherSituations(page, opts.snapshot, push);
    push("section_other_situations_completed");

    push("section_document_upload_started");
    await startSection(page, "Document Upload");
    await submitDocumentUpload(page, opts.snapshot, push);
    push("section_document_upload_completed");

    push("section_review_and_submit_started");
    await startSection(page, "Review and Submit");
    const confirmation = await submitReviewAndSubmit(page, opts.snapshot, push);
    push("section_review_and_submit_completed");

    await opts.hooks?.onAfterSubmit?.(page);

    return {
      status: "succeeded",
      ...(confirmation ? { confirmation_number: confirmation } : {}),
      transcript,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lastStep = transcript[transcript.length - 1]?.step;
    const error: { message: string; step?: string } = { message };
    if (lastStep !== undefined) error.step = lastStep;
    return { status: "failed", transcript, error };
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
// navigateToApplicationHub — /CBO/CBDAS → ABNAV
// ---------------------------------------------------------------------------

export async function navigateToApplicationHub(
  page: BrowserDriverPage,
  push: (step: string, note?: string) => void,
): Promise<void> {
  // Dashboard → New Application → ABOVR
  await page.getByRole("button", { name: "New Application" }).click();
  await page.waitForURL(/\/ApplyForBenefits\/begin\/ABOVR/, { timeout: 15_000 });
  push("page_ABOVR_loaded");

  // ABOVR → BEGIN → ABHLT
  await page.getByRole("button", { name: "BEGIN" }).click();
  await page.waitForURL(/\/ApplyForBenefits\/ABHLT/, { timeout: 15_000 });
  push("page_ABHLT_loaded");

  // ABHLT → Next → ABDEI
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForURL(/\/ApplyForBenefits\/ABDEI/, { timeout: 15_000 });
  push("page_ABDEI_loaded");

  // ABDEI → Next → ABSNC
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForURL(/\/ApplyForBenefits\/ABSNC/, { timeout: 15_000 });
  push("page_ABSNC_loaded");

  // ABSNC → Next → ABNAV (hub)
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForURL(/\/ApplyForBenefits\/ABNAV/, { timeout: 15_000 });
  push("page_ABNAV_loaded");
}

// ---------------------------------------------------------------------------
// startSection — click the right "Start <Section>" button on ABNAV.
//
// ABNAV has 9 Start buttons; disabled sections include "Not Available" in
// their aria-label. We always target the enabled form ("Start <name>");
// if the caller invokes a section before its predecessor completes, the
// click will throw because no such locator exists.
// ---------------------------------------------------------------------------

export async function startSection(
  page: BrowserDriverPage,
  name: SectionName,
): Promise<void> {
  await page.getByRole("button", { name: `Start ${name}` }).click();
}

// ---------------------------------------------------------------------------
// acceptUnvalidatedAddress — modal handler for the ABNHA USPS check.
//
// When USPS can't validate the entered address, a modal appears with two
// choices: "USE THIS ADDRESS" (force-accept) vs "Correct my address".
// We force-accept. The caller is responsible for re-clicking Next after.
// Returns true if the modal was present and dismissed; false if no modal.
// ---------------------------------------------------------------------------

export async function acceptUnvalidatedAddress(
  page: BrowserDriverPage,
): Promise<boolean> {
  const button = page.getByRole("button", { name: "USE THIS ADDRESS" });
  if (await button.isVisible()) {
    await button.click();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Section 1 — Your Information (ABLPR → ABNMI → ABNHA → ...)
// ---------------------------------------------------------------------------

async function submitYourInformation(
  page: BrowserDriverPage,
  snapshot: BenefitsCalPayload,
  push: (step: string, note?: string) => void,
): Promise<void> {
  // 1.1 ABLPR — Language preferences. All three selects are OPTIONAL and
  // not present in BenefitsCalPayload (schema-coverage gap noted in
  // SELECTORS.md). Skip with Next.
  await page.waitForURL(/\/ApplyForBenefits\/ABLPR/, { timeout: 15_000 });
  push("page_ABLPR_loaded");
  await page.getByRole("button", { name: "Next" }).click();

  // 1.2 ABNMI — Applicant name. Inputs use positional ids (#text1..#text4)
  // — must use getByLabel.
  await page.waitForURL(/\/ApplyForBenefits\/ABNMI/, { timeout: 15_000 });
  push("page_ABNMI_loaded");
  await page.getByLabel("First Name (required)").fill(snapshot.first_name);
  await page.getByLabel("Last Name (required)").fill(snapshot.last_name);
  await page.getByRole("button", { name: "Next" }).click();

  // 1.3 ABNHA — Home address.
  await page.waitForURL(/\/ApplyForBenefits\/ABNHA/, { timeout: 15_000 });
  push("page_ABNHA_loaded");
  // "Are you experiencing homelessness?" — default No. We do not yet
  // carry a homelessness flag in BenefitsCalPayload; flag for TODO-15.
  await page.getByLabel("No").click();
  await page.getByLabel("Address Line 1 (required)").fill(snapshot.address.street);
  await page.getByLabel("City (required)").fill(snapshot.address.city);
  await page.getByLabel("State").fill(snapshot.address.state);
  // ZIP field is `#zip5` — accept 5-digit only; trim any +4.
  const zip5 = snapshot.address.zip.slice(0, 5);
  await page.getByLabel("Zip Code (required)").fill(zip5);
  await page.getByRole("button", { name: "Next" }).click();

  if (await acceptUnvalidatedAddress(page)) {
    push("address_validation_modal_accepted");
    // Per SELECTORS.md §1.3, re-click Next after dismissing the modal.
    await page.getByRole("button", { name: "Next" }).click();
  }

  // 1.4+ — TBD. Walk paused on ABNHA after the modal dismiss; see
  // SELECTORS.md §1.4+. The remainder of section 1 must be captured in
  // a sandbox before this section can return cleanly.
  throw new Error(
    "PORTAL_STEP_TBD: Your Information sub-pages 1.4+ not yet captured — see portal-map/SELECTORS.md §1.4+",
  );
}

// ---------------------------------------------------------------------------
// Section stubs — selectors TBD pending sandbox walk.
//
// Schema-coverage gaps noted in SELECTORS.md (TODO-15):
//   - Household Details: fields TBD
//   - Assets: fields TBD
//   - Other Situations: fields TBD
// New fields land on BenefitsCalPayload in `schemas.ts` once the walk
// surfaces their shapes.
// ---------------------------------------------------------------------------

async function submitPeople(
  _page: BrowserDriverPage,
  _snapshot: BenefitsCalPayload,
  _push: (step: string, note?: string) => void,
): Promise<void> {
  throw new Error(
    "PORTAL_STEP_TBD: step People not yet captured — see portal-map/SELECTORS.md",
  );
}

async function submitHouseholdDetails(
  _page: BrowserDriverPage,
  _snapshot: BenefitsCalPayload,
  _push: (step: string, note?: string) => void,
): Promise<void> {
  throw new Error(
    "PORTAL_STEP_TBD: step Household Details not yet captured — see portal-map/SELECTORS.md",
  );
}

async function submitIncome(
  _page: BrowserDriverPage,
  _snapshot: BenefitsCalPayload,
  _push: (step: string, note?: string) => void,
): Promise<void> {
  throw new Error(
    "PORTAL_STEP_TBD: step Income not yet captured — see portal-map/SELECTORS.md",
  );
}

async function submitExpenses(
  _page: BrowserDriverPage,
  _snapshot: BenefitsCalPayload,
  _push: (step: string, note?: string) => void,
): Promise<void> {
  throw new Error(
    "PORTAL_STEP_TBD: step Expenses not yet captured — see portal-map/SELECTORS.md",
  );
}

async function submitAssets(
  _page: BrowserDriverPage,
  _snapshot: BenefitsCalPayload,
  _push: (step: string, note?: string) => void,
): Promise<void> {
  throw new Error(
    "PORTAL_STEP_TBD: step Assets not yet captured — see portal-map/SELECTORS.md",
  );
}

async function submitOtherSituations(
  _page: BrowserDriverPage,
  _snapshot: BenefitsCalPayload,
  _push: (step: string, note?: string) => void,
): Promise<void> {
  throw new Error(
    "PORTAL_STEP_TBD: step Other Situations not yet captured — see portal-map/SELECTORS.md",
  );
}

async function submitDocumentUpload(
  _page: BrowserDriverPage,
  _snapshot: BenefitsCalPayload,
  _push: (step: string, note?: string) => void,
): Promise<void> {
  throw new Error(
    "PORTAL_STEP_TBD: step Document Upload not yet captured — see portal-map/SELECTORS.md",
  );
}

async function submitReviewAndSubmit(
  _page: BrowserDriverPage,
  _snapshot: BenefitsCalPayload,
  _push: (step: string, note?: string) => void,
): Promise<string | undefined> {
  throw new Error(
    "PORTAL_STEP_TBD: step Review and Submit not yet captured — see portal-map/SELECTORS.md",
  );
}

// ---------------------------------------------------------------------------
// nodePlaywrightDriverFactory — opt-in Node driver for offline tooling.
// `playwright` is dynamically imported so it never enters the Worker bundle.
// ---------------------------------------------------------------------------

export async function nodePlaywrightDriverFactory(): Promise<BrowserDriverFactory> {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapLocator = (loc: any): BrowserDriverLocator => ({
    fill: (value: string) => loc.fill(value),
    click: () => loc.click(),
    isVisible: () => loc.isVisible(),
    textContent: () => loc.textContent(),
  });

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
            getByLabel: (label: string) => wrapLocator(page.getByLabel(label)),
            getByRole: (role: string, options: { name: string }) =>
              wrapLocator(page.getByRole(role, options)),
          } satisfies BrowserDriverPage;
        },
        close: () => browser.close(),
      };
    },
  };
}
