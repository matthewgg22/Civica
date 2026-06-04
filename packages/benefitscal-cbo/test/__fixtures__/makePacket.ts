// @vitest-environment jsdom
/**
 * Shared test fixture + runSectionFillTest helper for V1-5 PR3 step-1 unit tests.
 *
 * Two exports:
 *   makePacket(overrides?)        — builds a synthetic BenefitsCalPayload
 *   runSectionFillTest(code, opts) — inline fill loop over a snapshot-frozen PortalPage
 *
 * Architectural decision (D6 / outside voice F5):
 *   - The PortalPage is snapshot-frozen at first access (deep-clone with RegExp
 *     serialization). Without this, every T7 walk-refresh would cascade 19
 *     test failures as selector-map structural changes propagate into fixtures.
 *   - The fill loop is INLINE here (~30 lines), NOT imported from
 *     apps/civica-submitter-extension/src/content.ts. That avoids a
 *     cross-workspace dependency on the extension's Chrome-environment code.
 *     The loop mirrors fillField / fillOptionGroup from content.ts exactly.
 */

import { expect } from "vitest";
import type { BenefitsCalPayload } from "../../src/core/schemas";
import { PORTAL_PAGES_BY_CODE } from "../../src/core/selector-map";
import type { FieldSelector, PortalPage } from "../../src/core/selector-map";
import { resolveField } from "../../src/core/locate";
import { scopePayloadForMember } from "../../src/core/member-scope";
import {
  fillElement,
  fillRadio,
  fillCheckbox,
} from "../../src/core/fill";
import {
  resolveOption,
  isOptionGroupField,
  constantValue,
} from "../../src/core/select-option";
import { TRANSFORMS } from "../../src/core/transforms";

// ---------------------------------------------------------------------------
// RegExp serialization helpers for the snapshot-freeze.
//
// JSON.stringify cannot serialize RegExp values (they become {}). We use a
// custom replacer/reviver pair so urlPattern round-trips correctly.
// ---------------------------------------------------------------------------

interface SerializedRegExp {
  __type: "RegExp";
  source: string;
  flags: string;
}

function regExpReplacer(_key: string, value: unknown): unknown {
  if (value instanceof RegExp) {
    return { __type: "RegExp", source: value.source, flags: value.flags } as SerializedRegExp;
  }
  return value;
}

function regExpReviver(_key: string, value: unknown): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    (value as SerializedRegExp).__type === "RegExp"
  ) {
    const v = value as SerializedRegExp;
    return new RegExp(v.source, v.flags);
  }
  return value;
}

/** Deep-clone a PortalPage, preserving RegExp values (urlPattern). */
function freezePage(page: PortalPage): PortalPage {
  return JSON.parse(JSON.stringify(page, regExpReplacer), regExpReviver) as PortalPage;
}

/** Snapshot cache: pageCode → frozen PortalPage (built once at first access). */
const frozenPageCache = new Map<string, PortalPage>();

function getFrozenPage(pageCode: string): PortalPage {
  const cached = frozenPageCache.get(pageCode);
  if (cached) return cached;
  const live = PORTAL_PAGES_BY_CODE[pageCode];
  if (!live) throw new Error(`Unknown pageCode: ${pageCode}. Check PORTAL_PAGES_BY_CODE.`);
  const frozen = freezePage(live);
  frozenPageCache.set(pageCode, frozen);
  return frozen;
}

// ---------------------------------------------------------------------------
// makePacket — synthetic BenefitsCalPayload with sensible CA defaults.
// ---------------------------------------------------------------------------

type PartialPayload = Partial<BenefitsCalPayload & {
  address: Partial<BenefitsCalPayload["address"]>;
}>;

/** Builds a synthetic BenefitsCalPayload with sensible defaults. Override any field. */
export function makePacket(overrides: PartialPayload = {}): BenefitsCalPayload {
  const base: BenefitsCalPayload = {
    packet_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    first_name: "Maria",
    last_name: "Test",
    date_of_birth: "1985-03-15",
    ssn_last4: "4321",
    address: {
      street: "123 Main St",
      city: "Oakland",
      state: "CA",
      zip: "94601",
      county: "Alameda",
    },
    phone: "+15105551234",
    is_homeless: false,
    is_college_student: false,
    citizenship_status: "us_citizen",
    marital_status: "single",
    household_members: [],
    income_sources: [],
    utility_allowance_type: "standard",
    document_urls: [],
    client_signature_type: "async_portal",
  };

  return {
    ...base,
    ...overrides,
    address: {
      ...base.address,
      ...(typeof overrides.address === "object" && overrides.address !== null
        ? overrides.address
        : {}),
    },
  } as BenefitsCalPayload;
}

// ---------------------------------------------------------------------------
// Outcome type — mirrors FieldOutcome from content.ts
// ---------------------------------------------------------------------------

export type FieldOutcome = "filled" | "no-value" | "not-found" | "needs-review";

// ---------------------------------------------------------------------------
// Inline path resolver (mirrors payload-path.ts from the extension).
// Kept here to avoid cross-workspace imports.
// ---------------------------------------------------------------------------

function resolvePath(root: unknown, path: string): unknown {
  if (!root || typeof root !== "object") return null;
  let cur: unknown = root;
  const segments = path.split(".");
  for (const seg of segments) {
    if (cur === null || cur === undefined) return null;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[(\d+)\])?$/.exec(seg);
    if (!m) return null;
    const key = m[1];
    if (!key) return null;
    const idx = m[2];
    const obj = cur as Record<string, unknown>;
    const next = obj[key];
    if (idx === undefined) {
      cur = next;
    } else {
      if (!Array.isArray(next)) return null;
      const i = Number.parseInt(idx, 10);
      cur = next[i] ?? null;
    }
  }
  return cur ?? null;
}

// ---------------------------------------------------------------------------
// DOM builder — creates a minimal jsdom document root from a PortalPage's
// fields so resolveField can locate elements.
//
// Strategy: for each field, build the HTML the portal would render:
//   - text / date-password / select / checkbox → <label for=id> + <input id=id>
//   - radio option group → per-option <label for=id> + <input type=radio id=id>
//   - button → <button aria-label=label>
// We use the field's fallbackSelector (e.g. #text1, #birthDate_primary_input)
// as the element id when available — this ensures both label-resolution AND
// fallback-selector resolution paths are exercised.
// ---------------------------------------------------------------------------

function buildDomForPage(page: PortalPage): HTMLElement {
  const root = document.createElement("div");

  for (const field of Object.values(page.fields)) {
    if (field.type === "button") {
      // Buttons are not fill targets; skip DOM building.
      continue;
    }

    if (isOptionGroupField(field) && field.options) {
      // Radio/checkbox group: render one element per option.
      for (const [, optSel] of Object.entries(field.options)) {
        const optId = optSel.fallbackSelector
          ? optSel.fallbackSelector.replace(/^#/, "")
          : `opt-${optSel.label.replace(/\s+/g, "-")}`;
        const label = document.createElement("label");
        label.setAttribute("for", optId);
        label.textContent = optSel.label;
        const input = document.createElement("input");
        input.type = optSel.type === "checkbox" ? "checkbox" : "radio";
        input.id = optId;
        root.append(label, input);
      }
      continue;
    }

    // Plain field (text, date-password, select, checkbox, radio individual).
    // Derive element id from fallbackSelector or generate from label.
    const rawSelector = field.fallbackSelector ?? "";
    let elemId = rawSelector.replace(/^#/, "").replace(/^input\[type=[^\]]+\]#/, "");
    if (!elemId) {
      elemId = `field-${field.label.replace(/[^A-Za-z0-9]/g, "-").toLowerCase()}`;
    }

    // Also handle selectors like "select#county" or "input[type=checkbox]#mail"
    const hashIdx = rawSelector.lastIndexOf("#");
    if (hashIdx >= 0 && rawSelector.includes("#", 0)) {
      elemId = rawSelector.slice(hashIdx + 1);
    }

    const label = document.createElement("label");
    label.setAttribute("for", elemId);
    label.textContent = field.label;

    let el: HTMLElement;
    if (field.type === "select") {
      const select = document.createElement("select");
      select.id = elemId;
      // Add a handful of option values from optionValues if present, plus a blank.
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "--";
      select.append(blank);
      if (field.optionValues) {
        for (const optVal of Object.values(field.optionValues)) {
          const opt = document.createElement("option");
          opt.value = optVal;
          opt.textContent = optVal;
          select.append(opt);
        }
      }
      // For address.state: add CA option
      if (field.source === "address.state") {
        const caOpt = document.createElement("option");
        caOpt.value = "CA";
        caOpt.textContent = "CA";
        select.append(caOpt);
      }
      el = select;
    } else if (field.type === "checkbox") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = elemId;
      el = input;
    } else if (field.type === "radio") {
      // Single (non-group) radio
      const input = document.createElement("input");
      input.type = "radio";
      input.id = elemId;
      el = input;
    } else {
      // text, date-password
      const input = document.createElement("input");
      input.type = field.type === "date-password" ? "password" : "text";
      input.id = elemId;
      el = input;
    }

    root.append(label, el);
  }

  return root;
}

// ---------------------------------------------------------------------------
// Inline fill loop — mirrors fillField + fillOptionGroup from content.ts.
// NO import from the extension. DOM-only; no Chrome APIs, no overlay.
// ---------------------------------------------------------------------------

function fillFieldInline(
  field: FieldSelector,
  payload: unknown,
  root: ParentNode,
): FieldOutcome {
  if (field.type === "button") return "needs-review";

  // Option group (radio/checkbox group with options).
  if (isOptionGroupField(field)) {
    let resolvedValue: unknown = undefined;
    if (field.presenceOf !== undefined) {
      resolvedValue = resolvePath(payload, field.presenceOf);
    } else if (field.source !== undefined) {
      resolvedValue = resolvePath(payload, field.source);
    }
    const resolution = resolveOption(field, resolvedValue);
    if (!resolution.ok) {
      return resolution.reason === "no-value" ? "no-value" : "needs-review";
    }
    const el = resolveField(resolution.option, root);
    if (!el) return "not-found";
    const ok =
      resolution.option.type === "checkbox"
        ? fillCheckbox(el, true)
        : fillRadio(el);
    return ok ? "filled" : "not-found";
  }

  // Constant-direct fill (e.g. ABPRI CalFresh checkbox).
  const cval = constantValue(field);
  if (cval !== null) {
    const el = resolveField(field, root);
    if (!el) return "not-found";
    return fillElement(el, field.type, cval) ? "filled" : "not-found";
  }

  if (!field.source) return "needs-review";

  const value = resolvePath(payload, field.source);
  if (value === null || value === undefined || value === "") return "no-value";

  let fillValue = String(value);
  if (field.transform) {
    const fn = TRANSFORMS[field.transform];
    if (!fn) return "needs-review";
    const transformed = fn(fillValue);
    if (transformed === null) return "needs-review";
    fillValue = transformed;
  }

  const el = resolveField(field, root);
  if (!el) return "not-found";
  return fillElement(el, field.type, fillValue) ? "filled" : "not-found";
}

// ---------------------------------------------------------------------------
// runSectionFillTest — the shared per-section test helper.
// ---------------------------------------------------------------------------

export interface RunSectionFillTestOpts {
  /** Partial overrides applied on top of makePacket() defaults. */
  payloadOverrides?: PartialPayload;
  /**
   * Expected per-field outcome, keyed by the logical field name in page.fields.
   * Omitted fields are not asserted (useful for info-only or optional fields
   * you don't need to pin).
   */
  expectedFilled?: Record<string, FieldOutcome>;
  /** Minimum number of fields that must be "filled". Defaults to 0. */
  minFilled?: number;
  /**
   * Household-member index for repeating step-2 pages. When set, the payload is
   * wrapped via scopePayloadForMember (the core proxy) before the fill loop, so
   * `household_members[0].X` source paths resolve to member N. Mirrors what
   * content.ts does on each ABNMI_MEMBER repetition.
   */
  scopeMemberIndex?: number;
  /**
   * Explicit DOM HTML for the page root, replacing the auto-built DOM. Use for
   * pages whose option lists the walk did not capture (e.g. the ABHHR
   * relationship <select>), where the auto-builder cannot synthesize realistic
   * option values. The HTML must contain the field elements resolveField will
   * locate (by label or fallbackSelector).
   */
  domHtml?: string;
  /**
   * Post-fill value assertions, keyed by logical field name. Proves the RIGHT
   * value landed (e.g. member[1] → "Bob", not member[0] → "Alice") — the core
   * correctness property the outcome map alone can't verify.
   *
   *   - plain text / select field → assert element.value === expected
   *   - checkbox field            → expected "checked" / "unchecked"
   *   - option group              → expected is the option KEY (e.g. "present"),
   *                                 asserts that option's element is checked
   */
  expectedValues?: Record<string, string>;
}

/**
 * Fill a step-1 page against a synthetic packet and assert per-field outcomes.
 *
 * - Looks up the FROZEN PortalPage for pageCode (snapshot cache).
 * - Builds a synthetic jsdom DOM root from the page's fields.
 * - Runs the INLINE fill loop (no import of fillPage from content.ts).
 * - Asserts expectedFilled outcomes and minFilled count.
 */
export function runSectionFillTest(
  pageCode: string,
  opts: RunSectionFillTestOpts = {},
): void {
  const page = getFrozenPage(pageCode);
  const basePayload = makePacket(opts.payloadOverrides ?? {});
  // Scope to a household member for repeating step-2 pages (mirrors content.ts).
  const payload =
    opts.scopeMemberIndex !== undefined
      ? scopePayloadForMember(basePayload, opts.scopeMemberIndex)
      : basePayload;

  // Use explicit DOM when provided (pages with uncaptured option lists);
  // otherwise auto-build from the page's fields.
  let root: HTMLElement;
  if (opts.domHtml !== undefined) {
    root = document.createElement("div");
    root.innerHTML = opts.domHtml;
  } else {
    root = buildDomForPage(page);
  }

  // Append root to document so label[for] resolution widens correctly.
  document.body.appendChild(root);

  const outcomes: Record<string, FieldOutcome> = {};
  let filledCount = 0;

  for (const [fieldName, field] of Object.entries(page.fields)) {
    const outcome = fillFieldInline(field, payload, root);
    outcomes[fieldName] = outcome;
    if (outcome === "filled") filledCount++;
  }

  // Value readback (BEFORE cleanup — elements must still be in the DOM).
  // Proves the correct value landed, keyed by logical field name.
  if (opts.expectedValues) {
    for (const [fieldName, expected] of Object.entries(opts.expectedValues)) {
      const field = page.fields[fieldName];
      expect(field, `field "${fieldName}" exists in page.fields`).toBeTruthy();
      if (!field) continue;

      if (isOptionGroupField(field) && field.options) {
        // expected is the option KEY; assert that option's element is checked.
        const optSel = field.options[expected];
        expect(optSel, `option "${expected}" exists on "${fieldName}"`).toBeTruthy();
        if (!optSel) continue;
        const el = resolveField(optSel, root) as HTMLInputElement | null;
        expect(el, `option "${expected}" element resolved`).toBeTruthy();
        expect(el?.checked, `option "${expected}" checked`).toBe(true);
      } else {
        const el = resolveField(field, root) as
          | HTMLInputElement
          | HTMLSelectElement
          | null;
        expect(el, `field "${fieldName}" element resolved`).toBeTruthy();
        if (!el) continue;
        if (el instanceof HTMLInputElement && el.type === "checkbox") {
          expect(el.checked, `field "${fieldName}" checked state`).toBe(
            expected === "checked",
          );
        } else {
          expect(el.value, `field "${fieldName}" value`).toBe(expected);
        }
      }
    }
  }

  // Clean up.
  document.body.removeChild(root);

  // Assert per-field expectations.
  if (opts.expectedFilled) {
    for (const [fieldName, expected] of Object.entries(opts.expectedFilled)) {
      expect(outcomes[fieldName], `field "${fieldName}" outcome`).toBe(expected);
    }
  }

  // Assert minFilled.
  if (opts.minFilled !== undefined) {
    expect(filledCount, `at least ${opts.minFilled} fields filled`).toBeGreaterThanOrEqual(
      opts.minFilled,
    );
  }
}
