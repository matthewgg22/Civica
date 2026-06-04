/**
 * Dynamic section sequence (V1-5 PR1, #314).
 *
 * Returns the ordered list of pageCodes the extension should expect to walk
 * for a given applicant payload + staff-selected flow type.
 *
 * Design decisions (locked):
 *   D8  — undefined flowType defaults to multi-program (safe superset; the
 *          applicant walks all sections rather than silently skipping needed ones).
 *   D12 — flowType is NOT a packet field. It is collected from the staff via an
 *          activation dropdown shown when the extension loads on BenefitsCal (see
 *          `promptFlowType` in the extension's content.ts). Fresh per-tab session;
 *          no stale state across tabs.
 *
 * Sequence structure:
 *   Step 0 — entry flow (LOGIN → CBDAS → ABOVR → ABHLT → ABDEI → ABSNC → ABNAV)
 *   Step 1 — Your Information (~19 sub-pages from the SELECTORS.md walk)
 *   Steps 2-9 — walked by V1-4 (T7); pageCodes appended here as stubs.
 *             The walk for SNAP-only skips Assets (step 6) per CA BBCE bypass.
 *             Multi-program flows include Assets. No step 2-9 selector data
 *             exists yet (PR4/PR5, blocked on T7), so those sequences are empty
 *             arrays that will be extended as walk data lands.
 *
 * Pure compute. Browser-safe: no imports from playwright/driver. Imported by
 * the extension's content.ts and by the section-sequence unit tests.
 */

import { PORTAL_PAGES } from "./selector-map";
import type { BenefitsCalPayload } from "./schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Programs the staff indicates the applicant is filing for. Collected via an
 * activation dropdown (D12) — NOT a packet field. Selection is per-tab.
 *
 *   - `'snap-only'`      — CalFresh only. Portal omits Assets step (CA BBCE bypass).
 *   - `'multi-program'`  — SNAP + one or more of Medi-Cal / Cash Aid (TANF).
 *                          Portal includes Assets step; staff must check the
 *                          additional program boxes on ABPRI.
 *   - `undefined`        — staff skipped the prompt; defaults to multi-program
 *                          per D8 (safe superset).
 */
export type FlowType = "snap-only" | "multi-program" | undefined;

// ---------------------------------------------------------------------------
// Step-0 and step-1 page ordering (authoritative — derived from PORTAL_PAGES
// in selector-map.ts, the sole source of page order truth).
// ---------------------------------------------------------------------------

/** Step-0 pageCodes in walk order (login + entry flow). */
const STEP_0_CODES: readonly string[] = PORTAL_PAGES.filter(
  (p) => p.step === 0,
).map((p) => p.pageCode);

/** Step-1 pageCodes in walk order (Your Information). */
const STEP_1_CODES: readonly string[] = PORTAL_PAGES.filter(
  (p) => p.step === 1,
).map((p) => p.pageCode);

// ---------------------------------------------------------------------------
// Steps 2-9 stubs (T7/V1-4 walk pending; PR4+PR5 populate these).
//
// These arrays are intentionally EMPTY at PR1 time. As each walk lands (T7
// for steps 2-9), the walk author extends the relevant array with real
// pageCodes. The sectionSequence function already threads them through the
// output, so the extension walks them as soon as they are populated.
//
// SNAP-only skips step 6 (Assets) per the CA BBCE bypass confirmed in the
// SELECTORS.md walk note: "SNAP-only applications (only #snap checked on
// ABPRI) cause the portal to OMIT the Assets step entirely."
//
// Multi-program flows include step 6.
// ---------------------------------------------------------------------------

/**
 * Step 2 — People in household (both flows, PR4 #314).
 *
 * ABHSD  — gate ("do you have other members?")
 * ABNMI_MEMBER — per-member name (repeating; same URL as step-1 ABNMI)
 * ABHHR  — relationship to applicant (repeating)
 * ABPSM  — program inclusion / CalFresh checkbox (repeating)
 * ABBPF  — buy and prepare food together (repeating, no source → needs-review)
 * ABLNA  — does member live with applicant? (repeating, no source → needs-review)
 * ABHAD  — member address only when ABLNA = No (repeating, conditional)
 *
 * All repeating pages use [0] source paths; content.ts wraps the payload
 * in a proxy (scopePayloadForMember) that places household_members[N] at
 * index [0] for each member fill. ABHSD gates the sub-flow so solo
 * applicants (household_members = []) skip the member loop.
 */
const STEP_2_CODES: readonly string[] = [
  "ABHSD",
  "ABNMI_MEMBER",
  "ABHHR",
  "ABPSM",
  "ABBPF",
  "ABLNA",
  "ABHAD",
];

/** Step 3 — Household details (both flows). */
const STEP_3_CODES: readonly string[] = [];

/** Step 4 — Income (both flows). */
const STEP_4_CODES: readonly string[] = [];

/** Step 5 — Expenses (both flows). */
const STEP_5_CODES: readonly string[] = [];

/**
 * Step 6 — Assets (OMITTED for snap-only per CA BBCE bypass; INCLUDED for
 * multi-program since checking TANF or Medi-Cal adds the Assets step).
 */
const STEP_6_CODES_MULTI_PROGRAM: readonly string[] = [];

/** Step 7 — Other Situations (both flows). */
const STEP_7_CODES: readonly string[] = [];

/** Step 8 — Document Upload (both flows). */
const STEP_8_CODES: readonly string[] = [];

/** Step 9 — Review & Submit (both flows). */
const STEP_9_CODES: readonly string[] = [];

// ---------------------------------------------------------------------------
// sectionSequence
// ---------------------------------------------------------------------------

/**
 * Returns the ordered list of pageCodes the extension should expect to walk
 * for the given payload and staff-selected flow type.
 *
 * @param _payload  - The prepared BenefitsCalPayload for this applicant.
 *                    Currently unused (step-2 codes are always included; the
 *                    ABHSD gate in the portal handles the solo-applicant fast
 *                    path). Steps 3-9 may gate on payload data when their walk
 *                    data lands.
 * @param flowType  - Staff-elected flow type. `undefined` → multi-program (D8).
 *
 * @returns Ordered array of pageCode strings.
 */
export function sectionSequence(
  _payload: BenefitsCalPayload,
  flowType: FlowType,
): string[] {
  // D8: undefined flowType defaults to multi-program (safe superset).
  const resolvedFlow: "snap-only" | "multi-program" =
    flowType ?? "multi-program";

  return [
    ...STEP_0_CODES,
    ...STEP_1_CODES,
    ...STEP_2_CODES,
    ...STEP_3_CODES,
    ...STEP_4_CODES,
    ...STEP_5_CODES,
    // Step 6 (Assets) is OMITTED for SNAP-only (CA BBCE bypass).
    ...(resolvedFlow === "multi-program" ? STEP_6_CODES_MULTI_PROGRAM : []),
    ...STEP_7_CODES,
    ...STEP_8_CODES,
    ...STEP_9_CODES,
  ];
}
