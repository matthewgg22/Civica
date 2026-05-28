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
//   2. Match current URL against APPLICATION_FORM_PAGES.urlPattern.
//   3. For each matched field, resolve the source path into the payload
//      and write the value into the DOM element. Fields tagged `todo: true`
//      are skipped with a console warning (selectors not yet verified
//      against the live CBO Manager portal — TODO-14).
//   4. After fill, render a small toast/banner indicating how many fields
//      were filled and how many were skipped (TODOs).
//   5. On SPA navigation to the CONFIRMATION_PAGE URL, scrape the case
//      number selector and POST it back via background.
//
// Hard guarantees (anti-foot-gun):
//   - Never calls .click() on any submit button.
//   - Never calls .submit() on any form.
//   - Never inspects DOM outside benefitscal.com (manifest-restricted).
//   - Skips file_upload kinds entirely (browser security forbids).

// Import directly from the field-map subpath so we don't pull in submitter.ts
// (which has a dynamic `import("playwright")` that Vite's import analysis
// chokes on in extension test contexts).
import {
  APPLICATION_FORM_PAGES,
  CONFIRMATION_PAGE,
  type FieldFill,
  type FormPage,
} from "@civica/benefitscal-cbo/field-map";
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
    renderOverlay({
      message: `Filled ${result.filled} of ${result.total} fields on this page${result.skipped > 0 ? ` (${result.skipped} skipped — selectors not yet verified)` : ""}. Review the form, then click Continue.`,
      tone: result.skipped > 0 ? "warning" : "success",
    });
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

function findPageForUrl(pathname: string): FormPage | null {
  for (const page of APPLICATION_FORM_PAGES) {
    if (page.urlPattern.test(pathname)) return page;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Field fill
// ---------------------------------------------------------------------------

interface FillResult {
  total: number;
  filled: number;
  skipped: number;
}

export function fillPage(
  page: FormPage,
  payload: unknown,
  root: ParentNode = document,
): FillResult {
  let filled = 0;
  let skipped = 0;
  for (const field of page.fields) {
    if (fillField(field, payload, root)) {
      filled++;
    } else {
      skipped++;
    }
  }
  return { total: page.fields.length, filled, skipped };
}

/** Returns true when the field was actually written; false otherwise. */
export function fillField(
  field: FieldFill,
  payload: unknown,
  root: ParentNode = document,
): boolean {
  // TODO-14: every current field has `todo: true` because selectors haven't
  // been captured against the live CBO Manager portal yet. We skip them
  // here with a debug log so the structure is exercised in tests but no
  // accidental fills happen against random matching elements on
  // unverified selectors.
  if (field.todo) {
    console.debug(LOG_PREFIX, `skipped (todo): ${field.label ?? field.source}`);
    return false;
  }

  if (field.kind === "file_upload") {
    // File inputs cannot be filled programmatically from a content script
    // for security reasons (the assister must drag-drop or click).
    console.debug(LOG_PREFIX, `skipped (file_upload): ${field.label ?? field.source}`);
    return false;
  }

  const el = root.querySelector(field.selector);
  if (!el) {
    console.debug(LOG_PREFIX, `not found: ${field.selector}`);
    return false;
  }

  const value = resolvePath(payload, field.source);
  if (value === null || value === undefined || value === "") {
    console.debug(LOG_PREFIX, `no value at path: ${field.source}`);
    return false;
  }

  return writeValue(el, field, value);
}

function writeValue(el: Element, field: FieldFill, value: unknown): boolean {
  switch (field.kind) {
    case "text":
    case "ssn_last4":
    case "currency_monthly":
      return writeText(el, String(value));
    case "phone":
      // Convert E.164 (+15551234567) → portal-preferred 10-digit (5551234567).
      // BenefitsCal forms historically reject leading +; if that turns out
      // not to be the case after TODO-14 verification, drop this transform.
      return writeText(el, String(value).replace(/^\+1/, "").replace(/\D/g, ""));
    case "date":
      return writeText(el, formatDateForPortal(String(value)));
    case "select":
      return writeSelect(el, String(value));
    case "checkbox":
      return writeCheckbox(el, coerceBoolean(value));
    case "radio":
      return writeRadio(el, String(value));
    case "file_upload":
      // Unreachable in practice — fillField() filters file_upload before
      // calling writeValue(). Included here for switch exhaustiveness.
      return false;
    default: {
      const exhaustive: never = field.kind;
      console.warn(LOG_PREFIX, `unhandled kind: ${exhaustive as string}`);
      return false;
    }
  }
}

function writeText(el: Element, value: string): boolean {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  el.focus();
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.blur();
  return true;
}

function writeSelect(el: Element, value: string): boolean {
  if (!(el instanceof HTMLSelectElement)) return false;
  el.value = value;
  if (el.value !== value) {
    // Couldn't find the option — common when option labels differ from the
    // value we have. Surface in the console so the assister knows.
    console.warn(LOG_PREFIX, `select option not found for value: ${value}`);
    return false;
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function writeCheckbox(el: Element, checked: boolean): boolean {
  if (!(el instanceof HTMLInputElement) || el.type !== "checkbox") return false;
  if (el.checked === checked) return true;
  el.click();
  return true;
}

function writeRadio(el: Element, value: string): boolean {
  // For radio groups, the consumer is expected to pass the selector for the
  // specific radio button to select (e.g., "[name=foo][value=yes]"). If the
  // current element's value matches, click it.
  if (!(el instanceof HTMLInputElement) || el.type !== "radio") return false;
  if (el.value === value) {
    if (!el.checked) el.click();
    return true;
  }
  return false;
}

function formatDateForPortal(iso: string): string {
  // Many SAWS-style portals want MM/DD/YYYY. TODO-14: verify exact
  // expected format. ISO YYYY-MM-DD passes through if the input accepts it.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

function coerceBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "yes" || v === "1";
  if (typeof v === "number") return v !== 0;
  return false;
}

// ---------------------------------------------------------------------------
// Confirmation page handling
// ---------------------------------------------------------------------------

async function handleConfirmation(packetId: string): Promise<void> {
  if (CONFIRMATION_PAGE.todo) {
    renderOverlay({
      message:
        "Civica Submitter detected the success page, but the confirmation-number selector hasn't been verified against the live portal yet (TODO-14). Copy the case number from the page and paste it into Civica's dashboard manually.",
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
