/**
 * BenefitsCal CBO portal — typed selector map (V1-1a, #310).
 *
 * Materializes the prose selector map at `portal-map/SELECTORS.md` (captured
 * 2026-05-28 by walking the live production CBO portal as an approved CBO)
 * into a typed, importable data structure. This is the authoritative,
 * machine-readable form of that walk.
 *
 * Architectural facts encoded from the walk (apply globally):
 *   - The portal is a React app on the CalSAWS "lift-ux" component library.
 *   - Every `<button>` carries a random-UUID `id` (`lift-ux-id-<uuid>`), so
 *     buttons are NEVER selectable by id. They are selected by visible text /
 *     ARIA label — modeled here as `type: "button"` fields whose `label` is
 *     the `getByRole('button', { name })` accessible name.
 *   - Inputs are inconsistent: some have descriptive ids/names, others are
 *     positional (`#text1`..`#text4` on ABNMI). The recommended strategy is
 *     label-first (`getByLabel(...)`), with the stable id/name kept in
 *     `fallbackSelector` only when one exists. Positional ids are recorded as
 *     fallbacks but flagged in their `note`.
 *   - DOB (ABRDT) is intentionally `type="password"` to defeat browser
 *     autofill — modeled as the dedicated `type: "date-password"`.
 *   - SNAP-only applications (only `#snap` checked on ABPRI) cause the portal
 *     to OMIT the Assets step entirely (CA BBCE bypass).
 *   - The home-address page (ABNHA) triggers a 2-modal address-validation
 *     flow when USPS can't validate — see ADDRESS_VALIDATION_FLOW.
 *
 * Pure data. Browser-safe: no imports of playwright/submitter/driver, per the
 * `/core` contract in `./index.ts`.
 *
 * This is the sole portal field-map: the stale `./field-map.ts` placeholder it
 * superseded was deleted in V1-5 (#314) once the browser extension's
 * `content.ts` migrated onto `PORTAL_PAGES` + `resolveField` + `fillElement`.
 * Each fillable field carries a `source` (a dotted path into BenefitsCalPayload)
 * so the extension can map packet data → portal field.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * How a field is rendered/filled on the portal.
 *   - "text"          plain <input type=text>
 *   - "select"        <select> — `optionValues` maps logical key → option value
 *   - "radio"         radio group — `optionValues` maps logical key → element id/value
 *   - "checkbox"      single <input type=checkbox>
 *   - "date-password" DOB input rendered as type=password (ABRDT)
 *   - "button"        a <button> selected by accessible name (random-UUID id)
 */
export type FieldType =
  | "text"
  | "select"
  | "radio"
  | "checkbox"
  | "date-password"
  | "button";

export interface FieldSelector {
  /**
   * Primary locator: the visible label / accessible name. For inputs this is
   * the `getByLabel(label)` text; for buttons it is the
   * `getByRole('button', { name: label })` accessible name.
   */
  label: string;
  /**
   * Stable `#id` / `[name=...]` CSS selector when the portal exposes one.
   * Omitted when the only id is a random `lift-ux-id-<uuid>` (all buttons and
   * the ABNSN reason select), in which case `label` is the ONLY reliable
   * locator.
   */
  fallbackSelector?: string;
  type: FieldType;
  /**
   * For selects/radios: logical key → portal option `value` (or, for radio
   * groups whose values aren't exposed, the element id suffix). Examples:
   * county ordinals (`Sacramento: "34"`), marital status, SSN-existence,
   * no-SSN reason codes.
   */
  optionValues?: Record<string, string>;
  /**
   * Dot-path into the prepared `BenefitsCalPayload` (see `core/schemas.ts`)
   * where this field's value comes from — e.g. `first_name`, `address.zip`.
   * Consumers (the browser extension content script) resolve it with a tiny
   * path walker and skip the field when the value is missing.
   *
   * Only set on fields with an obvious packet → portal mapping (name, address,
   * DOB, SSN-last-4, program selection). Fields with no sensible payload source
   * (language prefs, gender, sex-assigned-at-birth, marital status) leave this
   * `undefined`, which the consumer treats as "human fills this" → skipped.
   * Buttons and info-only navigation never carry a `source`.
   */
  source?: string;
  /**
   * Optional value transform applied to the resolved `source` value before
   * `fillElement` (V1-3, #313). Names a function in `core/transforms.ts`'s
   * `TRANSFORMS` registry — e.g. `"ca-county-ordinal"` (county NAME → the
   * portal's 2-digit ordinal option value) or `"phone-10digit"` (E.164 → bare
   * 10-digit national number). A transform that returns `null` means the value
   * can't be mapped: the consumer SKIPS the fill and counts it "needs review"
   * rather than writing garbage. Fields with no transform are filled verbatim.
   */
  transform?: string;
  /**
   * Radio/checkbox option-selection map (V1-6, #314). For an eligibility radio
   * *group* (ABNHA homelessness, ABCOS student, ABDOC citizenship, ABMRS marital
   * status, ABPRI applying-for-self) or a checkbox driven by a boolean, this
   * maps a NORMALIZED schema value → an option key. The option key resolves
   * against this field's `options` map to the specific radio/checkbox element to
   * click; for a single checkbox the mapped value is coerced to boolean.
   *
   * Booleans normalize to the strings `"true"`/`"false"`; enums (marital status,
   * citizenship) normalize to their canonical Civica enum string. The map MUST
   * be EXHAUSTIVE over the schema's possible values — eligibility-critical
   * fields never fall through to a default. A resolved value with no `optionMap`
   * entry is treated as "needs review" (the consumer clicks nothing), never a
   * guess. See `core/select-option.ts` for the normalization + lookup.
   */
  optionMap?: Record<string, string>;
  /**
   * Per-option locators for a radio *group* field, keyed by the SAME option keys
   * `optionMap`/`constant`/`presenceOf` resolve to (e.g. `{ Yes: {...}, No:
   * {...} }`). Each value is itself a `FieldSelector` (label + optional
   * `fallbackSelector` + `type`) locating that one option's input. The consumer,
   * having mapped a schema value → option key, looks the key up here, resolves
   * the element, and clicks it. Present only on group fields; an individual
   * option field (one Yes radio) does not carry `options`.
   */
  options?: Record<string, FieldSelector>;
  /**
   * A FIXED value to fill, independent of any packet data (V1-6, #314). Used for
   * the ABPRI program selection, which is policy, not packet-sourced: the
   * applicant is applying for CalFresh, so `calFresh` is `constant: "true"`
   * (always check `#snap`) and `applyingForSelf` is `constant: "Yes"` (the Civica
   * applicant IS the beneficiary). For a radio group, the constant is an option
   * key resolved via `options`; for a checkbox it is coerced to boolean. A field
   * with `constant` set ignores `source`/`optionMap` and never reads the payload.
   */
  constant?: string;
  /**
   * ABSSN-only presence hint (V1-6, #314). The "Do you have an SSN?" radio can't
   * be expressed by a value→option map because the signal is the PRESENCE of
   * `ssn_last4`, not its value. `presenceOf` names a payload dot-path; the
   * consumer selects the `"present"` option key when the path resolves to a
   * non-empty value and the `"absent"` option key when it does not. Both keys
   * MUST exist in `options`. If `"absent"` is omitted from `options`, a missing
   * value is left for the human (needs-review) rather than guessing.
   */
  presenceOf?: string;
  /** True for portal-required fields (per SELECTORS.md "REQUIRED" tags). */
  required?: boolean;
  /**
   * True when the only available CSS hook is positional/unstable (e.g. ABNMI
   * `#text1`) — callers should prefer `label`. Documents the walk's warning.
   */
  unstableSelector?: boolean;
  /** Free-form note carrying a judgment call or schema gap from the walk. */
  note?: string;
}

export interface PortalPage {
  /** 5-letter portal page code, e.g. "ABNMI". */
  pageCode: string;
  /** Human-readable purpose, mirrored from SELECTORS.md. */
  title: string;
  /** Matches window.location.pathname / page.url(). */
  urlPattern: RegExp;
  /**
   * Portal step number 1-9 (Your Information=1 … Review & Submit=9). 0 = pre-
   * application pages (login, dashboard, entry-flow chain) that precede step 1.
   */
  step: number;
  /** Logical field name → selector. Empty for info-only / navigation pages. */
  fields: Record<string, FieldSelector>;
  /**
   * The button that advances off this page. Most form sub-pages use the shared
   * `Next` button; entry-flow pages use BEGIN / New Application; etc. Selected
   * by accessible name (random-UUID id).
   */
  advanceButton?: FieldSelector;
  /** True for pages with no fields (info screens / pure navigation). */
  infoOnly?: boolean;
  /**
   * True for pages that repeat once per household member (step 2 People
   * sub-flow). The extension uses a sessionStorage member-index counter so
   * each repetition fills the correct household_members[N] element.
   * Source paths on repeating pages use [] as an index placeholder
   * (e.g. "household_members[].first_name"); content.ts rewrites them to
   * "household_members[N].first_name" before resolving.
   */
  repeating?: boolean;
}

// ---------------------------------------------------------------------------
// Shared selectors
// ---------------------------------------------------------------------------

/** The shared "Next" button present on every form sub-page. */
export const NEXT_BUTTON: FieldSelector = {
  label: "Next",
  type: "button",
};

// ---------------------------------------------------------------------------
// California county → 2-digit ordinal (alphabetical CA county index).
//
// SELECTORS.md anchors: Alameda="01", Sacramento="34". The portal's
// `select#county` (shown in the address-validation modal #2) uses these
// alphabetical ordinals. All 58 counties enumerated so the address flow can
// map any intake county to its ordinal at fill time.
// ---------------------------------------------------------------------------

const CA_COUNTIES_ALPHABETICAL = [
  "Alameda",
  "Alpine",
  "Amador",
  "Butte",
  "Calaveras",
  "Colusa",
  "Contra Costa",
  "Del Norte",
  "El Dorado",
  "Fresno",
  "Glenn",
  "Humboldt",
  "Imperial",
  "Inyo",
  "Kern",
  "Kings",
  "Lake",
  "Lassen",
  "Los Angeles",
  "Madera",
  "Marin",
  "Mariposa",
  "Mendocino",
  "Merced",
  "Modoc",
  "Mono",
  "Monterey",
  "Napa",
  "Nevada",
  "Orange",
  "Placer",
  "Plumas",
  "Riverside",
  "Sacramento",
  "San Benito",
  "San Bernardino",
  "San Diego",
  "San Francisco",
  "San Joaquin",
  "San Luis Obispo",
  "San Mateo",
  "Santa Barbara",
  "Santa Clara",
  "Santa Cruz",
  "Shasta",
  "Sierra",
  "Siskiyou",
  "Solano",
  "Sonoma",
  "Stanislaus",
  "Sutter",
  "Tehama",
  "Trinity",
  "Tulare",
  "Tuolumne",
  "Ventura",
  "Yolo",
  "Yuba",
] as const;

/** County name → 2-digit ordinal string, e.g. `{ Sacramento: "34" }`. */
export const CA_COUNTY_ORDINALS: Record<string, string> = Object.fromEntries(
  CA_COUNTIES_ALPHABETICAL.map((name, i) => [
    name,
    String(i + 1).padStart(2, "0"),
  ]),
);

// ---------------------------------------------------------------------------
// ABNAV — Application Summary hub: the 9 "Start" buttons.
//
// Disambiguated by ARIA label. Sections unlock sequentially; labels include
// "Not Available" until the prior section is complete. Note the walk's
// findings: "Household" (not "Household Details") and "Review and Submit"
// (with "and", not "&" as the side-nav uses).
// ---------------------------------------------------------------------------

export const ABNAV_START_BUTTONS: Record<string, FieldSelector> = {
  yourInformation: { label: "Start Your Information", type: "button" },
  people: { label: "Start People Not Available", type: "button" },
  household: { label: "Start Household Not Available", type: "button" },
  income: { label: "Start Income Not Available", type: "button" },
  expenses: { label: "Start Expenses Not Available", type: "button" },
  assets: { label: "Start Assets Not Available", type: "button" },
  otherSituations: {
    label: "Start Other Situations Not Available",
    type: "button",
  },
  documentUpload: {
    label: "Start Document Upload Not Available",
    type: "button",
  },
  reviewAndSubmit: {
    label: "Start Review and Submit Not Available",
    type: "button",
  },
};

// ---------------------------------------------------------------------------
// Entry-flow button sequence: CBDAS → ABOVR → ABHLT → ABDEI → ABSNC → ABNAV.
// Each entry is the button you click to LEAVE the named page.
// ---------------------------------------------------------------------------

export const ENTRY_FLOW_BUTTONS: FieldSelector[] = [
  { label: "New Application", type: "button", note: "on /CBO/CBDAS dashboard" },
  { label: "BEGIN", type: "button", note: "on /ApplyForBenefits/begin/ABOVR" },
  { label: "Next", type: "button", note: "ABHLT → ABDEI" },
  { label: "Next", type: "button", note: "ABDEI → ABSNC" },
  { label: "Next", type: "button", note: "ABSNC → ABNAV" },
];

// ---------------------------------------------------------------------------
// ABNHA 2-modal address-validation flow (fires when USPS can't validate).
//   Modal #1 "Can't validate": click USE THIS ADDRESS.
//   Modal #2 "What county?": select#county (2-digit ordinals), click CONTINUE.
//   Then click Next to advance to ABMAD.
// ---------------------------------------------------------------------------

export const ADDRESS_VALIDATION_FLOW = {
  /** Modal #1 — accept the entered address as-is. */
  useThisAddressButton: {
    label: "USE THIS ADDRESS",
    type: "button",
  } as FieldSelector,
  /**
   * Modal #2 — county select. `optionValues` is the full CA alphabetical
   * ordinal map (Alameda="01" … Sacramento="34" … Yuba="58"). Schema gap:
   * `PostalAddress` has no county field; intake already needs county for
   * SNAPAgencyDirectory routing, so supply it at fill time.
   */
  countySelect: {
    label: "County",
    fallbackSelector: "select#county",
    type: "select",
    required: true,
    optionValues: CA_COUNTY_ORDINALS,
    source: "address.county",
    transform: "ca-county-ordinal",
    note: "name=county; appears only in the address-validation modal #2. source=address.county (county NAME) lands via V1-2/#312; the ca-county-ordinal transform (V1-3/#313) maps the name → the 2-digit option value. Unknown county → transform returns null → skipped (human fills the modal)",
  } as FieldSelector,
  /** Modal #2 — confirm county (uppercase accessible name). */
  continueButton: { label: "CONTINUE", type: "button" } as FieldSelector,
  /** After both modals close, advance to ABMAD. */
  nextButton: NEXT_BUTTON,
};

// ---------------------------------------------------------------------------
// PORTAL_PAGES — every page documented in SELECTORS.md.
// ---------------------------------------------------------------------------

export const PORTAL_PAGES: PortalPage[] = [
  // === Step 0: login + entry flow ========================================
  {
    pageCode: "LOGIN",
    title: "CBO login",
    // benefitscal.com/cbo/login (UNVERIFIED in walk — Matt navigated himself).
    urlPattern: /\/cbo\/login/,
    step: 0,
    infoOnly: true,
    fields: {},
  },
  {
    pageCode: "CBDAS",
    title: "Post-login CBO dashboard",
    urlPattern: /\/CBO\/CBDAS/,
    step: 0,
    fields: {},
    advanceButton: {
      label: "New Application",
      type: "button",
      note: "→ /ApplyForBenefits/begin/ABOVR?lang=en",
    },
  },
  {
    pageCode: "ABOVR",
    title: "Overview — What to expect",
    urlPattern: /\/ApplyForBenefits\/begin\/ABOVR/,
    step: 0,
    infoOnly: true,
    fields: {},
    advanceButton: { label: "BEGIN", type: "button", note: "→ ABHLT" },
  },
  {
    pageCode: "ABHLT",
    title: "Helpful Tips",
    urlPattern: /\/ApplyForBenefits\/ABHLT/,
    step: 0,
    infoOnly: true,
    fields: {},
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABDEI",
    title: "Diversity, Equity & Inclusion statement",
    urlPattern: /\/ApplyForBenefits\/ABDEI/,
    step: 0,
    infoOnly: true,
    fields: {},
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABSNC",
    title: "Pass-through page",
    urlPattern: /\/ApplyForBenefits\/ABSNC/,
    step: 0,
    infoOnly: true,
    fields: {},
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABNAV",
    title: "Application Summary hub — 9 Start buttons",
    urlPattern: /\/ApplyForBenefits\/ABNAV/,
    step: 0,
    infoOnly: true,
    // The 9 Start buttons live in ABNAV_START_BUTTONS (logical names) rather
    // than `fields` since they are navigation, not data entry.
    fields: {},
  },

  // === Step 1: Your Information ==========================================
  {
    pageCode: "ABLPR",
    title: "Language preferences (all optional)",
    urlPattern: /\/ApplyForBenefits\/ABLPR/,
    step: 1,
    fields: {
      // ~45 language options each; not in BenefitsCalPayload — default skip.
      readLanguage: {
        label: "What language do you prefer to read?",
        fallbackSelector: "select#primarylang",
        type: "select",
        note: "~45 options; not in payload schema — default skip",
      },
      spokenLanguage: {
        label: "What language do you prefer to speak?",
        fallbackSelector: "select#spokenlang",
        type: "select",
        note: "~45 options; not in payload schema — default skip",
      },
      applicationLanguage: {
        label:
          "In what language would you like to complete this application?",
        fallbackSelector: "select#applang",
        type: "select",
        note: "~45 options; not in payload schema — default skip",
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABNMI",
    title: "Applicant name",
    urlPattern: /\/ApplyForBenefits\/ABNMI/,
    step: 1,
    fields: {
      firstName: {
        label: "First Name (required)",
        fallbackSelector: "#text1",
        type: "text",
        required: true,
        unstableSelector: true,
        source: "first_name",
        note: "positional id #text1 — prefer label",
      },
      middleName: {
        label: "Middle Name",
        fallbackSelector: "#text2",
        type: "text",
        unstableSelector: true,
        note: "positional id #text2 — prefer label; no payload field — human fills",
      },
      lastName: {
        label: "Last Name (required)",
        fallbackSelector: "#text3",
        type: "text",
        required: true,
        unstableSelector: true,
        source: "last_name",
        note: "positional id #text3 — prefer label",
      },
      suffix: {
        label: "Suffix",
        fallbackSelector: "select#suffix",
        type: "select",
      },
      otherNames: {
        label: "Other Names",
        fallbackSelector: "#text4",
        type: "text",
        unstableSelector: true,
        note: "positional id #text4 — prefer label",
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABNHA",
    title: "Home address (+ 2-modal address-validation flow)",
    urlPattern: /\/ApplyForBenefits\/ABNHA/,
    step: 1,
    fields: {
      // "Are you experiencing homelessness?" Yes/No radio group (name=radioCard).
      // Modeled as ONE group field so the boolean is_homeless drives which option
      // is clicked; the per-option locators live in `options`. Eligibility-
      // critical (shelter/expedite): absent is_homeless → needs-review, never a
      // guess.
      experiencingHomelessness: {
        label: "Are you experiencing homelessness?",
        type: "radio",
        source: "is_homeless",
        optionMap: { true: "Yes", false: "No" },
        options: {
          Yes: { label: "Yes", fallbackSelector: "#radioCard_0", type: "radio" },
          No: { label: "No", fallbackSelector: "#radioCard_1", type: "radio" },
        },
        note: 'name=radioCard; source=is_homeless → Yes/No. Absent → needs-review',
      },
      addressLine1: {
        label: "Address Line 1 (required)",
        fallbackSelector: "#addressLine1",
        type: "text",
        required: true,
        source: "address.street",
      },
      addressLine2: {
        label: "Address Line 2",
        fallbackSelector: "#addressLine2",
        type: "text",
        note: "no payload field (unit/apt) — human fills",
      },
      city: {
        label: "City (required)",
        fallbackSelector: "#city",
        type: "text",
        required: true,
        source: "address.city",
      },
      state: {
        label: "State",
        fallbackSelector: "select#state",
        type: "select",
        source: "address.state",
        note: "option values are 2-letter codes, e.g. CA; payload address.state is already a 2-letter code",
      },
      zip: {
        label: "Zip Code (required)",
        fallbackSelector: "#zip5",
        type: "text",
        required: true,
        source: "address.zip",
      },
    },
    // The address-validation modals (USE THIS ADDRESS, county select, CONTINUE)
    // live in ADDRESS_VALIDATION_FLOW since they are conditional + modal.
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABMAD",
    title: "Mailing address differs?",
    urlPattern: /\/ApplyForBenefits\/ABMAD/,
    step: 1,
    fields: {
      mailingDiffersYes: {
        label: "Yes",
        fallbackSelector: "#mailadr1_radio_0",
        type: "radio",
        note: "name=mailadr1_radio; Yes reveals a 2nd address form (not walked)",
      },
      mailingDiffersNo: {
        label: "No",
        fallbackSelector: "#mailadr1_radio_1",
        type: "radio",
        note: "name=mailadr1_radio; submitter picks No",
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABCON",
    title: "Contact info (all optional)",
    urlPattern: /\/ApplyForBenefits\/ABCON/,
    step: 1,
    fields: {
      homePhone: { label: "Home Phone", fallbackSelector: "#homePhone", type: "text" },
      mobilePhone: {
        label: "Mobile Phone",
        fallbackSelector: "#mobilePhone",
        type: "text",
        source: "phone",
        transform: "phone-10digit",
        note: "payload.phone is E.164 (+1XXXXXXXXXX); the portal historically rejects the +1 prefix. V1-3/#313 wires source=phone + the phone-10digit transform so the +1/punctuation is stripped to a bare 10-digit national number before fill. Applicant's single phone fills the Mobile Phone field; Home/Alternate are left for the assister.",
      },
      altPhone: { label: "Alternate Phone", fallbackSelector: "#altPhone", type: "text" },
      email: {
        label: "Email",
        fallbackSelector: "#mail",
        type: "text",
        note: "id #mail collides with ABCOP email checkbox (different page); no payload email field — human fills",
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABCOP",
    title: "Communication opt-in (all optional)",
    urlPattern: /\/ApplyForBenefits\/ABCOP/,
    step: 1,
    fields: {
      emailAlerts: {
        label: "Email alerts",
        fallbackSelector: "input[type=checkbox]#mail",
        type: "checkbox",
        note: "id #mail collides with ABCON email input (different page)",
      },
      textAlerts: {
        label: "Text alerts",
        fallbackSelector: "input[type=checkbox]#phone",
        type: "checkbox",
      },
      tcpaAcknowledgment: {
        label: "TCPA acknowledgment",
        fallbackSelector: "input[type=checkbox]#acceptance_agreement",
        type: "checkbox",
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABPRI",
    title: "Program selection (required, critical)",
    urlPattern: /\/ApplyForBenefits\/ABPRI/,
    step: 1,
    fields: {
      // CalFresh is the WHOLE POINT of the submission, not packet-driven — always
      // check #snap. `constant: "true"` (coerced to a checkbox check). SNAP-only
      // (just this box) makes the portal omit the Assets step (CA BBCE bypass).
      calFresh: {
        label: "CalFresh",
        fallbackSelector: "input[type=checkbox]#snap",
        type: "checkbox",
        required: true,
        constant: "true",
        note: "Civica ALWAYS checks this (constant, not packet data); SNAP-only omits the Assets step (CA BBCE bypass)",
      },
      // Cash Aid / Medi-Cal: CalFresh-only for v1 — intentionally NOT checked.
      // No `source` and no `constant` → left untouched (the box defaults
      // unchecked; checking either would add the Assets step). Counted as
      // needs-review like any sourceless field.
      cashAid: {
        label: "Cash Aid",
        fallbackSelector: "input[type=checkbox]#tanf",
        type: "checkbox",
        note: "CalWORKs/TCVAP/RCA; CalFresh-only v1 → never checked by Civica; if checked, Assets step appears",
      },
      mediCal: {
        label: "Medi-Cal",
        fallbackSelector: "input[type=checkbox]#medicaid",
        type: "checkbox",
        note: "CalFresh-only v1 → never checked by Civica; if checked, Assets step appears",
      },
      // "Are you applying for benefits for yourself?" — the Civica applicant IS
      // the beneficiary, so this is ALWAYS Yes (constant, not packet data).
      // Modeled as a Yes/No radio group (name=label) with a constant option key.
      applyingForSelf: {
        label: "Are you applying for benefits for yourself?",
        type: "radio",
        required: true,
        constant: "Yes",
        options: {
          Yes: { label: "Yes", fallbackSelector: "#label_0", type: "radio" },
          No: { label: "No", fallbackSelector: "#label_1", type: "radio" },
        },
        note: 'name=label; constant Yes — the Civica applicant is always the beneficiary',
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABCSD",
    title: '"Skip and submit now" upsell (no inputs)',
    urlPattern: /\/ApplyForBenefits\/ABCSD/,
    step: 1,
    infoOnly: true,
    fields: {},
    advanceButton: {
      label: "CONTINUE APPLICATION",
      type: "button",
      note: 'submitter always picks this over the "Skip and submit now" link',
    },
  },
  {
    pageCode: "ABDIS",
    title: "Disability accommodation (optional)",
    urlPattern: /\/ApplyForBenefits\/ABDIS/,
    step: 1,
    fields: {
      needHelpYes: {
        label: "Yes",
        fallbackSelector: "#disability0",
        type: "radio",
        note: 'name=disability; "Need help to apply?"',
      },
      needHelpNo: {
        label: "No",
        fallbackSelector: "#disability1",
        type: "radio",
        note: "name=disability",
      },
      deafOrHardOfHearingYes: {
        label: "Yes",
        fallbackSelector: "#deaf0",
        type: "radio",
        note: 'name=deaf; "Deaf or hard of hearing?"',
      },
      deafOrHardOfHearingNo: {
        label: "No",
        fallbackSelector: "#deaf1",
        type: "radio",
        note: "name=deaf",
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABCOS",
    title: "College student status (required for SNAP eligibility)",
    urlPattern: /\/ApplyForBenefits\/ABCOS/,
    step: 1,
    fields: {
      // "Are you a college student?" Yes/No radio group
      // (name=CollegeStudentE_radio_button). Drives a SNAP student-restriction
      // determination → eligibility-critical: absent is_college_student →
      // needs-review, never defaulted to "not a student".
      collegeStudent: {
        label: "Are you a college student?",
        type: "radio",
        required: true,
        source: "is_college_student",
        optionMap: { true: "Yes", false: "No" },
        options: {
          Yes: {
            label: "Yes",
            fallbackSelector: "#CollegeStudentE_radio_button_0",
            type: "radio",
          },
          No: {
            label: "No",
            fallbackSelector: "#CollegeStudentE_radio_button_1",
            type: "radio",
          },
        },
        note: "name=CollegeStudentE_radio_button; source=is_college_student → Yes/No. Absent → needs-review",
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABCFA",
    title: "CalFresh authorized representative (case rep)",
    urlPattern: /\/ApplyForBenefits\/ABCFA/,
    step: 1,
    fields: {
      authRepYes: {
        label: "Yes",
        fallbackSelector: "#filingTax_0",
        type: "radio",
        note: "name=filingTax (misleading id — portal bug?); CBO may register as auth rep. Default No",
      },
      authRepNo: {
        label: "No",
        fallbackSelector: "#filingTax_1",
        type: "radio",
        note: "name=filingTax; default No",
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABCFS",
    title: "Benefits-spend authorized representative",
    urlPattern: /\/ApplyForBenefits\/ABCFS/,
    step: 1,
    fields: {
      spendRepYes: {
        label: "Yes",
        fallbackSelector: "#select_group_0",
        type: "radio",
        note: "name=select_group; who can USE the EBT card. Default No",
      },
      spendRepNo: {
        label: "No",
        fallbackSelector: "#select_group_1",
        type: "radio",
        note: "name=select_group; default No",
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABRDT",
    title: "Date of birth (required)",
    urlPattern: /\/ApplyForBenefits\/ABRDT/,
    step: 1,
    fields: {
      dateOfBirth: {
        label: "Date of Birth (required)",
        fallbackSelector: "#birthDate_primary_input",
        type: "date-password",
        required: true,
        source: "date_of_birth",
        note: 'type=password (defeats autofill); format MM/DD/YYYY; no name attribute. payload date_of_birth is ISO YYYY-MM-DD; fillElement normalizes to MM/DD/YYYY',
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABSSN",
    title: "SSN existence question",
    urlPattern: /\/ApplyForBenefits\/ABSSN/,
    step: 1,
    fields: {
      // "Do you have an SSN?" radio group (name=SSN_IND). This is a PRESENCE
      // question, not a value→option map: the signal is whether the packet
      // carries an SSN at all, so it uses `presenceOf` rather than
      // source+optionMap. ssn_last4 present → click "Yes" (#ssn_group0). When
      // ABSENT we deliberately DO NOT auto-pick a no-SSN answer: a simple
      // presence test can't distinguish "No" (#ssn_group1) from "I don't have it
      // right now" (#ssn_group2), and choosing wrong is eligibility-relevant — so
      // the `absent` option key is intentionally OMITTED from `options`, leaving
      // the field for the human (needs-review). The Yes branch leads to ABNSN
      // (why no SSN); the no-SSN branches aren't auto-driven.
      ssnExistence: {
        label: "Do you have a Social Security Number?",
        type: "radio",
        presenceOf: "ssn_last4",
        options: {
          present: { label: "Yes", fallbackSelector: "#ssn_group0", type: "radio" },
          // `absent` intentionally omitted — see note above.
        },
        note: "name=SSN_IND; presenceOf=ssn_last4 → Yes (#ssn_group0). Absent → needs-review (human picks No / 'don't have it right now')",
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABNSN",
    title: "Why no SSN (only if ABSSN != Yes)",
    urlPattern: /\/ApplyForBenefits\/ABNSN/,
    step: 1,
    fields: {
      reasonForNoSsn: {
        label: "Reason for not having a Social Security Number",
        // First UUID-id <select> encountered: id=lift-ux-id-<uuid>. MUST use
        // the label locator — no stable fallbackSelector exists.
        type: "select",
        note: "id is a random lift-ux-id-<uuid> — label-only locator",
        optionValues: {
          adoptionTaxpayerIdOrItin: "01",
          religiousExemption: "02",
          doesNotQualifyOrNonWork: "03",
          appliedForSsn: "05",
          // "Other" option value unknown from walk.
        },
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABMRS",
    title: "Marital status (optional)",
    urlPattern: /\/ApplyForBenefits\/ABMRS/,
    step: 1,
    fields: {
      // Marital status radio group (name=maritalStatus), 8 options indexed _0.._7
      // per the walk. Each MaritalStatusSchema enum value maps explicitly to one
      // option (no default). domestic_partner → the portal's "Registered Domestic
      // Partner"; common_law → "Common Law"; never_married is distinct from
      // single. Optional page: absent marital_status → needs-review.
      maritalStatus: {
        label: "Marital status",
        type: "radio",
        source: "marital_status",
        optionMap: {
          single: "single",
          married: "married",
          divorced: "divorced",
          separated: "separated",
          widowed: "widowed",
          domestic_partner: "registeredDomesticPartner",
          common_law: "commonLaw",
          never_married: "neverMarried",
        },
        options: {
          commonLaw: {
            label: "Common Law",
            fallbackSelector: "#maritalStatus_0",
            type: "radio",
          },
          divorced: {
            label: "Divorced",
            fallbackSelector: "#maritalStatus_1",
            type: "radio",
          },
          married: {
            label: "Married",
            fallbackSelector: "#maritalStatus_2",
            type: "radio",
          },
          neverMarried: {
            label: "Never Married",
            fallbackSelector: "#maritalStatus_3",
            type: "radio",
          },
          registeredDomesticPartner: {
            label: "Registered Domestic Partner",
            fallbackSelector: "#maritalStatus_4",
            type: "radio",
          },
          separated: {
            label: "Separated",
            fallbackSelector: "#maritalStatus_5",
            type: "radio",
          },
          single: {
            label: "Single",
            fallbackSelector: "#maritalStatus_6",
            type: "radio",
          },
          widowed: {
            label: "Widowed",
            fallbackSelector: "#maritalStatus_7",
            type: "radio",
          },
        },
        note: "name=maritalStatus; source=marital_status, each enum value mapped to its radio (_0.._7). Absent → needs-review",
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABCID",
    title: "Citizenship intro (no inputs)",
    urlPattern: /\/ApplyForBenefits\/ABCID/,
    step: 1,
    infoOnly: true,
    fields: {},
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABDOC",
    title: "Citizenship Yes/No (required for SNAP eligibility)",
    urlPattern: /\/ApplyForBenefits\/ABDOC/,
    step: 1,
    fields: {
      // "Are you a U.S. citizen?" Yes/No radio group (name=citizen_radio). The
      // schema's citizenship_status is 3-way (us_citizen | us_national |
      // non_citizen); ALL THREE map explicitly here — us_citizen AND us_national
      // → Yes (a U.S. national answers "yes" to the citizenship gate), non_citizen
      // → No. Eligibility-critical (non-citizen SNAP rules): absent
      // citizenship_status → needs-review, never defaulted to us_citizen.
      citizen: {
        label: "Are you a U.S. citizen?",
        type: "radio",
        required: true,
        source: "citizenship_status",
        optionMap: { us_citizen: "Yes", us_national: "Yes", non_citizen: "No" },
        options: {
          Yes: { label: "Yes", fallbackSelector: "#citizen_radio_0", type: "radio" },
          No: { label: "No", fallbackSelector: "#citizen_radio_1", type: "radio" },
        },
        note: "name=citizen_radio; ABDOC is NOT the step-8 Document Upload. source=citizenship_status; non_citizen → No (immigration-status branch not walked)",
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABBID",
    title: "Background questions intro (no inputs)",
    urlPattern: /\/ApplyForBenefits\/ABBID/,
    step: 1,
    infoOnly: true,
    fields: {},
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABASX",
    title: "Sex assigned at birth (optional)",
    urlPattern: /\/ApplyForBenefits\/ABASX/,
    step: 1,
    fields: {
      assignedSex: {
        label: "Sex assigned at birth",
        type: "radio",
        note: "name=assignedSex; value = element id suffix index",
        optionValues: {
          female: "0",
          male: "1",
          preferNotToAnswer: "2",
        },
      },
    },
    advanceButton: NEXT_BUTTON,
  },
  {
    pageCode: "ABGNR",
    title: "Gender identity (optional)",
    urlPattern: /\/ApplyForBenefits\/ABGNR/,
    step: 1,
    fields: {
      genderIdentity: {
        label: "Gender identity",
        type: "radio",
        note: "name=gender; 7 options (indexed 0-6) not enumerated in walk",
      },
    },
    advanceButton: NEXT_BUTTON,
  },

  // ---------------------------------------------------------------------------
  // Step 2 — People (household members sub-flow)
  //
  // Walk source: form-tree.json §sections[1], captured 2026-05-29 (partial).
  // All 7 pages confirmed present in the production CBO walk under VoteNow.
  //
  // Repeating pages (ABNMI_MEMBER … ABHAD) use [] source-path placeholders.
  // content.ts rewrites [] → [memberIndex] before resolving each field so
  // household_members[0] fills on the first member pass, [1] on the second,
  // etc. The member index increments each time ABNMI_MEMBER is detected.
  //
  // ABNMI_MEMBER shares its urlPattern with step-1 ABNMI (same portal page
  // code, same URL — the portal reuses the name form for every household
  // member). Content.ts disambiguates via the civica.inPeopleSection session
  // flag set when ABHSD is detected.
  // ---------------------------------------------------------------------------

  {
    // Gate: "Do you have other people living in your household?"
    // presenceOf: "household_members[0]" → Yes if array is non-empty, else No.
    pageCode: "ABHSD",
    title: "Household members gate (do you have other people?)",
    urlPattern: /\/ApplyForBenefits\/ABHSD/,
    step: 2,
    fields: {
      otherHouseholdMembers: {
        label: "Do you have other people living in your household?",
        fallbackSelector: "[name=hshld_radiogrp]",
        type: "radio",
        presenceOf: "household_members[0]",
        options: {
          present: {
            label: "Yes",
            fallbackSelector: "#hshld_radiogrp_0",
            type: "radio",
          },
          absent: {
            label: "No",
            fallbackSelector: "#hshld_radiogrp_1",
            type: "radio",
          },
        },
      },
    },
    advanceButton: NEXT_BUTTON,
  },

  {
    // Per-member name page. Same URL as step-1 ABNMI — content.ts resolves
    // the collision via civica.inPeopleSection session flag.
    // Uses [] source paths; content.ts rewrites to [memberIndex] at fill time.
    pageCode: "ABNMI_MEMBER",
    title: "Household member name (step 2, repeating)",
    urlPattern: /\/ApplyForBenefits\/ABNMI/,
    step: 2,
    repeating: true,
    fields: {
      firstName: {
        label: "First Name (required)",
        fallbackSelector: "#text1",
        type: "text",
        required: true,
        source: "household_members[0].first_name",
      },
      lastName: {
        label: "Last Name (required)",
        fallbackSelector: "#text3",
        type: "text",
        required: true,
        source: "household_members[0].last_name",
      },
      // Middle name, suffix, other names have no schema source → needs-review.
    },
    advanceButton: NEXT_BUTTON,
  },

  {
    // Relationship to primary applicant. select#optiongroup (UUID id — resolve
    // by label). Option list not captured in walk; label-based resolveOption
    // handles common values (Spouse, Child/Stepchild, Parent, Sibling…).
    pageCode: "ABHHR",
    title: "Relationship to applicant (step 2, repeating)",
    urlPattern: /\/ApplyForBenefits\/ABHHR/,
    step: 2,
    repeating: true,
    fields: {
      relationship: {
        label: "How is",
        fallbackSelector: "select#optiongroup",
        type: "select",
        source: "household_members[0].relationship",
        note: "Label contains member name interpolation; fallback selector is stable.",
      },
    },
    advanceButton: NEXT_BUTTON,
  },

  {
    // Program inclusion — always check CalFresh (#snap) for each member.
    // constant: "true" on the checkbox (same pattern as ABPRI CalFresh).
    pageCode: "ABPSM",
    title: "Member program inclusion — CalFresh (step 2, repeating)",
    urlPattern: /\/ApplyForBenefits\/ABPSM/,
    step: 2,
    repeating: true,
    fields: {
      includedInSnap: {
        label: "Food (CalFresh)",
        fallbackSelector: "input[type=checkbox]#snap",
        type: "checkbox",
        required: true,
        constant: "true",
        note: "Civica always checks CalFresh for each member (constant, not packet data).",
      },
      // doesNotApply checkbox: never checked by Civica (no source, no constant).
    },
    advanceButton: NEXT_BUTTON,
  },

  {
    // "Do you buy and prepare food together?" — not in BenefitsCalPayload schema.
    // Left as info-only/needs-review for v1; the assister answers manually.
    pageCode: "ABBPF",
    title: "Buy and prepare food together? (step 2, repeating)",
    urlPattern: /\/ApplyForBenefits\/ABBPF/,
    step: 2,
    repeating: true,
    fields: {
      // buys_food_together not in schema → needs-review
    },
    advanceButton: NEXT_BUTTON,
  },

  {
    // "Does <name> live with you?" — not in schema; assister answers manually.
    pageCode: "ABLNA",
    title: "Member lives with applicant? (step 2, repeating)",
    urlPattern: /\/ApplyForBenefits\/ABLNA/,
    step: 2,
    repeating: true,
    fields: {
      // lives_with_applicant not in schema → needs-review
    },
    advanceButton: NEXT_BUTTON,
  },

  {
    // Member's address — only appears when ABLNA = No (member lives elsewhere).
    // HouseholdMember schema has no address fields in v1 → needs-review.
    pageCode: "ABHAD",
    title: "Member address (only if not living with applicant, step 2)",
    urlPattern: /\/ApplyForBenefits\/ABHAD/,
    step: 2,
    repeating: true,
    fields: {
      // address fields not in HouseholdMember schema → needs-review
    },
    advanceButton: NEXT_BUTTON,
  },
];

/**
 * Convenience lookup: pageCode → PortalPage. Built once at module load.
 */
export const PORTAL_PAGES_BY_CODE: Record<string, PortalPage> =
  Object.fromEntries(PORTAL_PAGES.map((p) => [p.pageCode, p]));

// ---------------------------------------------------------------------------
// Confirmation / success page.
//
// The live walk (portal-map/SELECTORS.md) covered only the entry flow + step-1
// sub-pages; it did NOT reach the post-submit success screen, so the selectors
// below are UNVERIFIED placeholders (carried over from the deleted field-map's
// CONFIRMATION_PAGE). `verified: false` is the signal that V1-4's later walk
// must confirm the real urlPattern + case-number selector. The extension uses
// this only to scrape the BenefitsCal case number for write-back; it never
// auto-submits to reach this page.
// ---------------------------------------------------------------------------

export interface ConfirmationPageSelector {
  /** Matches window.location.pathname on the success screen. */
  urlPattern: RegExp;
  /** CSS selector for the confirmation/case-number element. */
  caseNumberSelector: string;
  /** Optional secondary selector for an application-id field. */
  applicationIdSelector?: string;
  /**
   * False until V1-4's walk confirms these selectors against the live success
   * screen. While false, the extension surfaces a "copy the case number
   * manually" warning rather than trusting an unverified scrape.
   */
  verified: boolean;
}

export const CONFIRMATION_PAGE: ConfirmationPageSelector = {
  urlPattern: /\/cbo\/application\/success/,
  caseNumberSelector: "[data-testid=confirmation-number]",
  applicationIdSelector: "[data-testid=application-id]",
  verified: false,
};
