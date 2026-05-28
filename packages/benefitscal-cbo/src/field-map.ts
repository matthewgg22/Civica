/**
 * BenefitsCal CBO portal field map
 *
 * Two surfaces consume this file:
 *   1. Server-side submitter (submitter.ts) — drives BenefitsCal via Playwright
 *      under Civica's own CBO Assister credentials (Model A: Civica is the CBO).
 *   2. Browser extension content script (apps/civica-submitter-extension) —
 *      runs in a partner-CBO assister's browser, where THEY are already
 *      logged into BenefitsCal under their own CBO Manager account
 *      (Model B: Civica is the SaaS layer for other CBOs).
 *
 * Both surfaces need the same data: which form fields exist, which CSS
 * selectors target them, and where the value comes from in the prepared
 * BenefitsCalPayload. APPLICATION_FORM_PAGES is the single source of
 * truth for that mapping.
 *
 * Selector verification: every field below is gated on TODO-14
 * (Matthew logging into a live CBO Manager account once the county
 * approves Civica's application and capturing actual selectors via
 * Playwright inspection). Fields tagged `todo: true` carry best-guess
 * selectors derived from the publicly-visible applicant flow at
 * benefitscal.com — they are NOT verified against the CBO Manager UI.
 * DO NOT remove the todo markers until live verification.
 *
 * Legacy exports (PERSONAL_INFO_FIELDS / HOUSEHOLD_FIELDS / etc.) are
 * preserved for backward compatibility with any callers that may have
 * grown to depend on them. New code should import APPLICATION_FORM_PAGES
 * directly.
 */

// ---------------------------------------------------------------------------
// New unified shape — page → fields[]
// ---------------------------------------------------------------------------

/**
 * How a field value should be coerced before being written to the DOM /
 * Playwright. The content script and the Playwright submitter both branch
 * on this when filling.
 */
export type FieldFillKind =
  | "text"
  | "date" // ISO 8601 → portal's preferred date format
  | "select" // <select> — value must match an option
  | "checkbox"
  | "radio"
  | "phone" // E.164 → portal's preferred phone format (often no `+`)
  | "ssn_last4" // 4-digit last-4 SSN
  | "currency_monthly" // dollars/month, written as a plain number string
  | "file_upload"; // file input — content script can't fill these in the assister flow

export interface FieldFill {
  /** CSS selector identifying the form input on this page. */
  selector: string;
  /**
   * Dot-path into the BenefitsCalPayload where the value comes from.
   * Examples: "first_name", "address.street", "household_members[0].first_name".
   * Resolved by a tiny path walker in the consumer; null/undefined values
   * are skipped (no fill, no error).
   */
  source: string;
  kind: FieldFillKind;
  /** Optional human label used in transcripts/console logs. */
  label?: string;
  /**
   * True when the selector is a best-guess from the publicly-visible
   * applicant flow and has NOT been verified against the live CBO Manager
   * portal. TODO-14: live walkthrough required to clear this flag.
   */
  todo?: true;
}

/**
 * An iterable item in the form — either a single set of fields on the
 * current page, or a "fan-out" that produces multiple sets of fields
 * for collection types (household members, income sources, etc.).
 */
export interface FormPage {
  /** Stable internal identifier used in transcripts (e.g. "household_primary"). */
  step: string;
  /**
   * Matches window.location.pathname (content script) or page.url() (Playwright)
   * against the current page. Use a RegExp so subpath variations don't break the
   * match. Captures are not used.
   */
  urlPattern: RegExp;
  /** Static fields on this page — filled once per submission. */
  fields: FieldFill[];
  /**
   * Optional CSS selector for the "Next" button that advances to the
   * subsequent page. The server-side Playwright submitter clicks this
   * after filling; the extension does NOT (the assister advances manually).
   */
  nextButtonSelector?: string;
  /** Page-level TODO when the entire page is unverified. */
  todo?: true;
}

/**
 * The final review/submit page. We do not auto-click submit (the assister
 * always confirms manually); instead we wait for the assister to submit
 * and observe the post-submit success page.
 */
export interface ConfirmationPage {
  urlPattern: RegExp;
  /** CSS selector for the confirmation/case-number element. */
  caseNumberSelector: string;
  /** Optional secondary selector for an application-id field. */
  applicationIdSelector?: string;
  todo?: true;
}

// ---------------------------------------------------------------------------
// The 9 application pages (TODO-14)
//
// Step names mirror the existing transcript convention from submitter.ts:
//   a) click_new_application
//   b) fill_household_primary
//   c) fill_household_members
//   d) fill_income_sources
//   e) fill_utility_allowance
//   f) upload_documents
//   g) fill_consent
//   h) click_review_and_submit
//   i) capture_confirmation
//
// (a) and (h) have no fields to fill — they're navigation steps. The
// content script handles them as no-ops; the Playwright submitter
// clicks the corresponding buttons.
// ---------------------------------------------------------------------------

export const APPLICATION_FORM_PAGES: readonly FormPage[] = [
  // ------------------------------------------------------------------------
  // Page: applicant primary household member (name, DOB, SSN last 4, contact)
  // ------------------------------------------------------------------------
  {
    step: "fill_household_primary",
    urlPattern: /\/cbo\/application\/household\/primary/,
    todo: true,
    fields: [
      { selector: "[name=firstName]", source: "first_name", kind: "text", label: "First name", todo: true },
      { selector: "[name=lastName]", source: "last_name", kind: "text", label: "Last name", todo: true },
      { selector: "[name=dateOfBirth]", source: "date_of_birth", kind: "date", label: "DOB", todo: true },
      {
        selector: "[name=ssn]",
        source: "ssn_last4",
        kind: "ssn_last4",
        label: "SSN (last 4)",
        todo: true,
      },
      { selector: "[name=streetAddress]", source: "address.street", kind: "text", label: "Street", todo: true },
      { selector: "[name=city]", source: "address.city", kind: "text", label: "City", todo: true },
      { selector: "[name=state]", source: "address.state", kind: "select", label: "State", todo: true },
      { selector: "[name=zipCode]", source: "address.zip", kind: "text", label: "ZIP", todo: true },
      { selector: "[name=phoneNumber]", source: "phone", kind: "phone", label: "Phone", todo: true },
    ],
    nextButtonSelector: "[data-testid=next-button]",
  },

  // ------------------------------------------------------------------------
  // Page: additional household members (variable count — fan-out at runtime)
  // ------------------------------------------------------------------------
  {
    step: "fill_household_members",
    urlPattern: /\/cbo\/application\/household\/members/,
    todo: true,
    // Static placeholders — actual rows are added by the consumer at runtime
    // by walking payload.household_members[] and stamping these field shapes.
    // The extension and the Playwright submitter both implement the same
    // walker; this entry just marks the page exists and where the templated
    // selectors live.
    fields: [
      {
        selector: "[data-testid=member-row-template]",
        source: "household_members",
        kind: "text",
        label: "Household members (fan-out)",
        todo: true,
      },
    ],
    nextButtonSelector: "[data-testid=next-button]",
  },

  // ------------------------------------------------------------------------
  // Page: income sources (variable count, fan-out)
  // ------------------------------------------------------------------------
  {
    step: "fill_income_sources",
    urlPattern: /\/cbo\/application\/income/,
    todo: true,
    fields: [
      {
        selector: "[data-testid=income-row-template]",
        source: "income_sources",
        kind: "text",
        label: "Income sources (fan-out)",
        todo: true,
      },
    ],
    nextButtonSelector: "[data-testid=next-button]",
  },

  // ------------------------------------------------------------------------
  // Page: utility allowance (SUA tier checkboxes — see submitter.ts comment
  // about heat/electricity/phone/water being individual checkboxes, not a
  // single select).
  // ------------------------------------------------------------------------
  {
    step: "fill_utility_allowance",
    urlPattern: /\/cbo\/application\/utility/,
    todo: true,
    fields: [
      // Mapping from utility_allowance_type to individual checkboxes is done
      // by the consumer. "standard" → all true; "limited" → exactly one;
      // "telephone_only" → just phone; "none" → all false.
      { selector: "[name=paysHeat]", source: "utility_allowance_type", kind: "checkbox", label: "Pays heat", todo: true },
      { selector: "[name=paysElectricity]", source: "utility_allowance_type", kind: "checkbox", label: "Pays electricity", todo: true },
      { selector: "[name=paysPhone]", source: "utility_allowance_type", kind: "checkbox", label: "Pays phone", todo: true },
      { selector: "[name=paysWater]", source: "utility_allowance_type", kind: "checkbox", label: "Pays water", todo: true },
    ],
    nextButtonSelector: "[data-testid=next-button]",
  },

  // ------------------------------------------------------------------------
  // Page: documents (file uploads — content script cannot fill file inputs
  // for security reasons; assister must drag-drop or click manually).
  // Server-side Playwright CAN fill them by downloading from signed URLs.
  // ------------------------------------------------------------------------
  {
    step: "upload_documents",
    urlPattern: /\/cbo\/application\/documents/,
    todo: true,
    fields: [
      // Per-document-type upload selectors. Marked file_upload so the
      // extension content script skips them and surfaces a "upload these
      // X documents manually" hint to the assister instead.
      { selector: "[data-upload=photo_id]", source: "document_urls", kind: "file_upload", label: "Photo ID", todo: true },
      { selector: "[data-upload=paystub]", source: "document_urls", kind: "file_upload", label: "Paystubs", todo: true },
      { selector: "[data-upload=utility_bill]", source: "document_urls", kind: "file_upload", label: "Utility bill", todo: true },
      { selector: "[data-upload=bank_statement]", source: "document_urls", kind: "file_upload", label: "Bank statement", todo: true },
      { selector: "[data-upload=lease]", source: "document_urls", kind: "file_upload", label: "Lease", todo: true },
    ],
    nextButtonSelector: "[data-testid=next-button]",
  },

  // ------------------------------------------------------------------------
  // Page: consent / signature
  // ------------------------------------------------------------------------
  {
    step: "fill_consent",
    urlPattern: /\/cbo\/application\/consent/,
    todo: true,
    fields: [
      { selector: "[name=clientSignatureType]", source: "client_signature_type", kind: "select", label: "Signature type", todo: true },
      { selector: "[name=telephonicConsentDate]", source: "telephonic_consent_recorded_at", kind: "date", label: "Telephonic consent date", todo: true },
    ],
    nextButtonSelector: "[data-testid=review-button]",
  },
];

/**
 * The success/confirmation page that BenefitsCal renders after submit.
 * Used to capture the BenefitsCal confirmation number for write-back to
 * Civica's benefitscal_submissions table.
 */
export const CONFIRMATION_PAGE: ConfirmationPage = {
  urlPattern: /\/cbo\/application\/success/,
  caseNumberSelector: "[data-testid=confirmation-number]",
  applicationIdSelector: "[data-testid=application-id]",
  todo: true,
};

// ---------------------------------------------------------------------------
// Legacy exports — preserved for backward compatibility.
// New consumers should import APPLICATION_FORM_PAGES and CONFIRMATION_PAGE
// instead. These constants are scheduled for deletion once nothing imports
// them (currently nothing in the repo does, but historical PRs may have).
// ---------------------------------------------------------------------------

export const PERSONAL_INFO_FIELDS = {
  firstName: "firstName",
  lastName: "lastName",
  dateOfBirth: "dateOfBirth",
  ssn: "ssn",
  streetAddress: "streetAddress",
  city: "city",
  state: "state",
  zipCode: "zipCode",
  phoneNumber: "phoneNumber",
} as const;

export const HOUSEHOLD_FIELDS = {
  householdMembers: "householdMembers",
} as const;

export const INCOME_FIELDS = {
  incomeType: "incomeType",
  incomeAmount: "incomeAmount",
  incomeFrequency: "incomeFrequency",
} as const;

export const UTILITY_FIELDS = {
  utilityAllowanceType: "utilityAllowanceType",
} as const;

export const DOCUMENT_FIELDS = {
  documentUpload: "documentUpload",
} as const;

export const CONSENT_FIELDS = {
  clientSignatureType: "clientSignatureType",
  telephonicConsentDate: "telephonicConsentDate",
} as const;
