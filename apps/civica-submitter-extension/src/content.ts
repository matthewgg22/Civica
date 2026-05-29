// Civica Submitter content script.
//
// Runs inside the assister's authenticated BenefitsCal session. The
// assister is the principal — this script never touches credentials,
// never auto-submits, and never blocks the assister's manual
// interactions. It pre-fills form fields from a Civica packet payload
// and surfaces a small status overlay so the assister knows what
// happened.
//
// Lifecycle:
//   1. On page load, request the active packet's payload from background.
//      (Background reads from chrome.storage.local + Civica gateway.)
//   2. Match current URL against PORTAL_PAGES[].urlPattern.
//   3. For each field that carries a `source` (a dotted payload path), resolve
//      the value out of the payload and the DOM element via resolveField()
//      (label-first, like Playwright's getByLabel), then fill it with the
//      React-safe fillElement() primitive. Fields with no `source` are left for
//      the assister to fill by hand (counted as "needs review", not errors).
//   4. After fill, render a small toast/banner indicating how many fields
//      were filled, skipped (no packet source), and not found in the DOM.
//   5. On SPA navigation to the CONFIRMATION_PAGE URL, scrape the case
//      number selector and POST it back via background.
//
// Hard guarantees (anti-foot-gun):
//   - Never calls .click() on any submit button (we never resolve/advance
//     `advanceButton`s; FieldType "button" is not a fill target).
//   - Never calls .submit() on any form.
//   - Never inspects DOM outside benefitscal.com (manifest-restricted).
//   - Skips file inputs entirely (browser security forbids; the map has no
//     file fields in step-1, but resolveField + fillElement also refuse them).

// Import from the browser-safe /core surface (PORTAL_PAGES selector map, the
// React-safe fill primitive, and the label-first DOM resolver). NOT /field-map
// (deleted in V1-5, #314) and NOT the package root (its driver subtree has a
// dynamic `import("playwright")` that Vite's import analysis chokes on in
// extension test contexts).
import {
  PORTAL_PAGES,
  CONFIRMATION_PAGE,
  resolveField,
  fillElement,
  fillRadio,
  fillCheckbox,
  resolveOption,
  isOptionGroupField,
  constantValue,
  TRANSFORMS,
  type PortalPage,
  type FieldSelector,
} from "@civica/benefitscal-cbo/core";
import { resolvePath } from "./payload-path";

interface PayloadFetchResponse {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

interface OverlayState {
  message: string;
  tone: "info" | "warning" | "success" | "error";
}

const OVERLAY_ID = "civica-submitter-overlay";
const LOG_PREFIX = "[Civica Submitter]";

// ---------------------------------------------------------------------------
// Entry — wired only on benefitscal.com per manifest.
// ---------------------------------------------------------------------------

void main().catch((err: unknown) => {
  console.error(LOG_PREFIX, "fatal", err);
  renderOverlay({
    message: `Civica Submitter error: ${err instanceof Error ? err.message : String(err)}`,
    tone: "error",
  });
});

async function main(): Promise<void> {
  // 1. Look up the active packet id. If none, surface a quiet banner and
  //    bail — the assister hasn't selected a packet from Civica yet.
  const activePacketId = await readActivePacketId();
  if (!activePacketId) {
    renderOverlay({
      message:
        "Civica Submitter is installed but no packet is selected. Open the Civica dashboard, pick a packet, then return here.",
      tone: "info",
    });
    return;
  }

  // 2. Fetch the prepared payload via the background broker.
  const resp = await sendMessage<PayloadFetchResponse>({
    type: "fetchPayload",
    packetId: activePacketId,
  });
  if (!resp.ok || !resp.data) {
    renderOverlay({
      message: `Civica Submitter could not load packet ${activePacketId}: ${resp.error ?? "unknown error"}`,
      tone: "error",
    });
    return;
  }
  const payload = resp.data;

  // 3. Match the current URL.
  const page = findPageForUrl(window.location.pathname);
  if (page) {
    const result = fillPage(page, payload);
    renderOverlay(describeFill(result));
    return;
  }

  // 4. Confirmation page handling.
  if (CONFIRMATION_PAGE.urlPattern.test(window.location.pathname)) {
    await handleConfirmation(activePacketId);
    return;
  }

  // 5. Neither a known form page nor the confirmation page — quiet banner.
  renderOverlay({
    message: `Civica Submitter is active. Navigate to a CalFresh application page to autofill packet ${activePacketId.slice(0, 8)}.`,
    tone: "info",
  });
}

// ---------------------------------------------------------------------------
// Page matching
// ---------------------------------------------------------------------------

function findPageForUrl(pathname: string): PortalPage | null {
  for (const page of PORTAL_PAGES) {
    if (page.urlPattern.test(pathname)) return page;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Field fill
// ---------------------------------------------------------------------------

interface FillResult {
  /** Fields on this page that carry a `source` (i.e. are auto-fillable). */
  fillable: number;
  /** Fields actually written into the DOM. */
  filled: number;
  /** Fillable fields skipped because the packet had no value at the source. */
  skippedNoValue: number;
  /** Fillable fields whose DOM element could not be located on the page. */
  notFound: number;
  /**
   * Fields left for the assister to fill by hand: either no `source`, or a
   * `source` whose `transform` returned null (value couldn't be mapped, e.g. a
   * county with no CA ordinal). The latter is also counted in `fillable`, so
   * `fillable + needsReview` may exceed `total` by the number of such fields.
   */
  needsReview: number;
  /** Total fields on the page (= `Object.values(page.fields).length`). */
  total: number;
}

export function fillPage(
  page: PortalPage,
  payload: unknown,
  root: ParentNode = document,
): FillResult {
  let filled = 0;
  let skippedNoValue = 0;
  let notFound = 0;
  let needsReview = 0;
  let fillable = 0;

  const fields = Object.values(page.fields);
  for (const field of fields) {
    // A field is auto-fillable when it has a packet `source`, a `constant`
    // (program selection), or a `presenceOf` test (ABSSN). Everything else
    // (language prefs, gender, unmapped marital status, etc.) is left for the
    // assister to fill by hand and counted as needs-review.
    if (!isAutoFillable(field)) {
      needsReview++;
      console.debug(LOG_PREFIX, `needs review (no source/constant): ${field.label}`);
      continue;
    }
    fillable++;
    const outcome = fillField(field, payload, root);
    switch (outcome) {
      case "filled":
        filled++;
        break;
      case "no-value":
        skippedNoValue++;
        break;
      case "not-found":
        notFound++;
        break;
      case "needs-review":
        // A field with a `source` whose transform returned null (e.g. a county
        // with no CA ordinal) — the value couldn't be mapped, so the assister
        // fills it. Counted as needs-review like a source-less field.
        needsReview++;
        break;
    }
  }

  return {
    fillable,
    filled,
    skippedNoValue,
    notFound,
    needsReview,
    total: fields.length,
  };
}

type FieldOutcome = "filled" | "no-value" | "not-found" | "needs-review";

/**
 * Whether a field can be auto-filled at all: it has a packet `source`, a
 * `constant` value (program selection — always check #snap, always "applying for
 * self = Yes"), or a `presenceOf` test (ABSSN "do you have an SSN?"). Fields with
 * none of these are left for the assister (needs-review). Buttons never qualify.
 */
function isAutoFillable(field: FieldSelector): boolean {
  if (field.type === "button") return false;
  return (
    field.source !== undefined ||
    field.constant !== undefined ||
    field.presenceOf !== undefined
  );
}

/**
 * Attempt to fill a single field. Returns the outcome so `fillPage` can tally
 * filled / no-value / not-found / needs-review separately.
 *
 * Routing (V1-6, #314):
 *   1. buttons → needs-review (never data entry).
 *   2. constant-direct fill (a `constant` on a field with no `options`, e.g. the
 *      ABPRI CalFresh checkbox) → fill the field itself with the constant.
 *   3. radio/checkbox option *group* (`optionMap`/`presenceOf`/`constant` +
 *      `options`) → {@link fillOptionGroup}: map the schema value (or presence,
 *      or constant) to the specific option to click. An unmapped/absent
 *      eligibility value clicks NOTHING (needs-review) — never a default.
 *   4. otherwise the plain source → transform → fillElement path.
 */
export function fillField(
  field: FieldSelector,
  payload: unknown,
  root: ParentNode = document,
): FieldOutcome {
  // Buttons are navigation, never data entry — never resolve or click them.
  // (advanceButtons live off `page.fields` entirely, but guard anyway.)
  if (field.type === "button") return "needs-review";

  // (3) Radio/checkbox option group — resolve which option to click. Checked
  // BEFORE the constant-direct path so a constant-on-a-group (ABPRI
  // applying-for-self) routes through the option resolver.
  if (isOptionGroupField(field)) {
    return fillOptionGroup(field, payload, root);
  }

  // (2) Constant-direct fill: a fixed value with no option indirection (the
  // ABPRI #snap checkbox = constant "true"). Ignores the payload.
  const constant = constantValue(field);
  if (constant !== null) {
    const el = resolveField(field, root);
    if (!el) {
      console.debug(LOG_PREFIX, `not found: ${field.label} (${field.fallbackSelector ?? "label-only"})`);
      return "not-found";
    }
    const ok = fillElement(el, field.type, constant);
    if (!ok) {
      console.warn(LOG_PREFIX, `could not fill constant: ${field.label} (type ${field.type})`);
      return "not-found";
    }
    return "filled";
  }

  if (!field.source) return "needs-review";

  const value = resolvePath(payload, field.source);
  if (value === null || value === undefined || value === "") {
    console.debug(LOG_PREFIX, `no value at path: ${field.source}`);
    return "no-value";
  }

  // Apply the field's value transform, if any (V1-3, #313): county NAME →
  // 2-digit ordinal, E.164 phone → bare 10-digit, etc. A transform returning
  // null means the value can't be mapped (e.g. an out-of-CA county) — skip the
  // fill and flag it for the assister rather than writing a garbage value.
  let fillValue = String(value);
  if (field.transform) {
    const fn = TRANSFORMS[field.transform];
    if (!fn) {
      // An unknown transform name is a selector-map bug; don't guess — flag it.
      console.warn(LOG_PREFIX, `unknown transform "${field.transform}" for ${field.label}`);
      return "needs-review";
    }
    const transformed = fn(fillValue);
    if (transformed === null) {
      console.debug(
        LOG_PREFIX,
        `transform "${field.transform}" could not map value for ${field.label}`,
      );
      return "needs-review";
    }
    fillValue = transformed;
  }

  const el = resolveField(field, root);
  if (!el) {
    console.debug(LOG_PREFIX, `not found: ${field.label} (${field.fallbackSelector ?? "label-only"})`);
    return "not-found";
  }

  const ok = fillElement(el, field.type, fillValue);
  if (!ok) {
    // fillElement returns false for a wrong element type or a missing <select>
    // option — surface it like a not-found so the assister double-checks.
    console.warn(LOG_PREFIX, `could not fill: ${field.label} (type ${field.type})`);
    return "not-found";
  }
  return "filled";
}

/**
 * Fill a radio/checkbox *option group* (V1-6, #314): ABNHA homelessness, ABCOS
 * student, ABDOC citizenship, ABMRS marital status, ABPRI applying-for-self,
 * ABSSN SSN presence. The group's option-selection mechanism
 * (`constant`/`presenceOf`/`optionMap`) is resolved by the pure `resolveOption`
 * helper to the specific per-option FieldSelector; we then locate THAT option's
 * element and click it via fillElement.
 *
 * Eligibility correctness: `resolveOption` NEVER falls through to a default — an
 * unmapped or absent value yields a "needs-review" reason and we click nothing.
 */
function fillOptionGroup(
  field: FieldSelector,
  payload: unknown,
  root: ParentNode,
): FieldOutcome {
  // The value `resolveOption` reasons over: for a presence test it's the value
  // at the `presenceOf` path; for an optionMap it's the value at `source`; a
  // pure `constant` group ignores it.
  let resolvedValue: unknown = undefined;
  if (field.presenceOf !== undefined) {
    resolvedValue = resolvePath(payload, field.presenceOf);
  } else if (field.source !== undefined) {
    resolvedValue = resolvePath(payload, field.source);
  }

  const resolution = resolveOption(field, resolvedValue);
  if (!resolution.ok) {
    if (resolution.reason === "no-value") {
      console.debug(LOG_PREFIX, `no value for option group: ${field.label}`);
      return "no-value";
    }
    // needs-review: unmapped/absent eligibility value — click NOTHING.
    console.debug(LOG_PREFIX, `needs review (unmapped option): ${field.label}`);
    return "needs-review";
  }

  // Locate the chosen option's specific input and click/check it.
  const el = resolveField(resolution.option, root);
  if (!el) {
    console.debug(
      LOG_PREFIX,
      `option not found: ${field.label} → ${resolution.key} (${resolution.option.fallbackSelector ?? "label-only"})`,
    );
    return "not-found";
  }

  // The option element is already pinned (we located THIS specific radio/
  // checkbox), so select it unconditionally: `fillRadio(el)` with no value
  // clicks the resolved radio (its DOM `.value` is a portal-internal token, not
  // the option key, so we must NOT gate on it); `fillCheckbox(el, true)` checks
  // it. Both are idempotent and dispatch React's synthetic change event.
  const ok =
    resolution.option.type === "checkbox"
      ? fillCheckbox(el, true)
      : fillRadio(el);
  if (!ok) {
    console.warn(
      LOG_PREFIX,
      `could not fill option: ${field.label} → ${resolution.key} (type ${resolution.option.type})`,
    );
    return "not-found";
  }
  return "filled";
}

/** Turn a fill tally into an overlay message + tone. */
function describeFill(r: FillResult): OverlayState {
  const parts: string[] = [`Filled ${r.filled} of ${r.fillable} auto-fillable fields`];
  if (r.skippedNoValue > 0) parts.push(`${r.skippedNoValue} had no packet data`);
  if (r.notFound > 0) parts.push(`${r.notFound} not found on the page`);
  if (r.needsReview > 0) parts.push(`${r.needsReview} need manual review`);
  const detail = parts.length > 1 ? ` (${parts.slice(1).join(", ")})` : "";
  const tone: OverlayState["tone"] =
    r.notFound > 0
      ? "warning"
      : r.skippedNoValue > 0 || r.needsReview > 0
        ? "warning"
        : r.filled > 0
          ? "success"
          : "info";
  const lead =
    r.fillable === 0
      ? `No auto-fillable fields on this page${r.needsReview > 0 ? ` — ${r.needsReview} need manual review` : ""}.`
      : `${parts[0]}${detail}.`;
  return {
    message: `${lead} Review the form, then click Next/Continue yourself.`,
    tone,
  };
}

// ---------------------------------------------------------------------------
// Confirmation page handling
// ---------------------------------------------------------------------------

async function handleConfirmation(packetId: string): Promise<void> {
  if (!CONFIRMATION_PAGE.verified) {
    renderOverlay({
      message:
        "Civica Submitter detected the success page, but the confirmation-number selector hasn't been verified against the live portal yet. Copy the case number from the page and paste it into Civica's dashboard manually.",
      tone: "warning",
    });
    return;
  }
  const caseEl = document.querySelector(CONFIRMATION_PAGE.caseNumberSelector);
  const caseNumber = caseEl?.textContent?.trim() ?? null;
  if (!caseNumber) {
    renderOverlay({
      message:
        "Civica Submitter saw the success page but could not find the confirmation number. Copy it manually into the Civica dashboard.",
      tone: "warning",
    });
    return;
  }
  let applicationId: string | undefined;
  if (CONFIRMATION_PAGE.applicationIdSelector) {
    const appIdEl = document.querySelector(CONFIRMATION_PAGE.applicationIdSelector);
    applicationId = appIdEl?.textContent?.trim() || undefined;
  }
  const resp = await sendMessage({
    type: "reportConfirm",
    packetId,
    benefitscalCaseNumber: caseNumber,
    benefitscalApplicationId: applicationId,
  });
  if (resp.ok) {
    renderOverlay({
      message: `Submission confirmed. Civica recorded case ${caseNumber}.`,
      tone: "success",
    });
  } else {
    renderOverlay({
      message: `Captured case ${caseNumber} but failed to report it back to Civica: ${resp.error ?? "unknown error"}. Record manually.`,
      tone: "error",
    });
  }
}

// ---------------------------------------------------------------------------
// Storage + messaging helpers
// ---------------------------------------------------------------------------

async function readActivePacketId(): Promise<string | null> {
  const raw = await chrome.storage.local.get("civica.activePacketId");
  const v = raw["civica.activePacketId"];
  return typeof v === "string" && v.length > 0 ? v : null;
}

async function sendMessage<T = { ok: boolean; data?: unknown; error?: string }>(
  msg: Record<string, unknown>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(msg, (response: T) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message ?? "messaging error"));
          return;
        }
        resolve(response);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Overlay
//
// Small fixed-position banner. Renders into a Shadow DOM so BenefitsCal's
// own styles can't accidentally collide with ours.
// ---------------------------------------------------------------------------

function renderOverlay(state: OverlayState): void {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();
  const host = document.createElement("div");
  host.id = OVERLAY_ID;
  host.style.position = "fixed";
  host.style.bottom = "16px";
  host.style.right = "16px";
  host.style.zIndex = "2147483647"; // max — sit above any BenefitsCal modal
  const shadow = host.attachShadow({ mode: "open" });
  const tones: Record<OverlayState["tone"], { bg: string; fg: string; border: string }> = {
    info: { bg: "#f4f1eb", fg: "#1f2722", border: "#cbc6bc" },
    success: { bg: "#1f4d3b", fg: "#ffffff", border: "#163a2c" },
    warning: { bg: "#fff4d6", fg: "#5a3b00", border: "#d8b566" },
    error: { bg: "#fde8e4", fg: "#8b1d11", border: "#d88a78" },
  };
  const tone = tones[state.tone];
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .root {
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: ${tone.bg};
        color: ${tone.fg};
        border: 1px solid ${tone.border};
        border-radius: 4px;
        padding: 10px 12px;
        max-width: 360px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      }
      .label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        opacity: 0.7;
        margin-bottom: 4px;
      }
      .body { white-space: pre-wrap; }
    </style>
    <div class="root">
      <div class="label">Civica Submitter</div>
      <div class="body"></div>
    </div>
  `;
  const body = shadow.querySelector(".body");
  if (body) body.textContent = state.message;
  document.body.appendChild(host);
}
