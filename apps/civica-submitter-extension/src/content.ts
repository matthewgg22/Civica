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
  sectionSequence,
  ADDRESS_VALIDATION_REQUIRED_EVENT,
  ADDRESS_VALIDATION_RESOLVED_EVENT,
  handleAddressValidationModal,
  type PortalPage,
  type FieldSelector,
  type FlowType,
} from "@civica/benefitscal-cbo/core";
import { resolvePath } from "./payload-path";
import {
  markElement,
  clearAllMarkers,
  clearCivicaFills,
  fingerprintOf,
  type FillFingerprint,
} from "./fill-markers";
import { waitFor } from "./readiness";
import { buildReviewPanel, type ReviewPanel } from "./review-panel";
import {
  readPageFillState,
  writePageFillState,
  clearPageFillState,
  readAllPageFillStatesForPacket,
} from "./config";

interface PayloadFetchResponse {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Staff election prompt (D12 — per-tab session, not a packet field).
//
// When the extension first activates on a BenefitsCal tab, show a one-time
// dropdown asking which programs the applicant is filing for. The selection is
// stored only in the tab's session (a module-level variable); it resets fresh
// on every new tab. Staff has applicant context when running Mode A submission.
//
// Design guarantees:
//   - "Skip" (or dismissing via Escape) → undefined → defaults to multi-program (D8).
//   - The dropdown is inside the extension's shadow root (civica-election-host),
//     fully isolated from BenefitsCal's styles/forms.
//   - Resolves on staff action (select + confirm) or immediate fallback.
//   - Never auto-advances the portal page; staff must click the portal's own Next.
// ---------------------------------------------------------------------------

/** Tab-session flow type — set once per tab when the prompt resolves. */
let _tabFlowType: FlowType = undefined;
/** True after the prompt has been shown once on this tab (prevents re-prompt). */
let _electionShown = false;

/**
 * Show the staff election dropdown and resolve with the chosen FlowType.
 * If already shown on this tab, returns the cached value immediately.
 * Returns a Promise that resolves when the staff confirms or dismisses.
 */
export async function promptFlowType(): Promise<FlowType> {
  if (_electionShown) return _tabFlowType;
  _electionShown = true;

  return new Promise<FlowType>((resolve) => {
    const HOST_ID = "civica-election-host";
    // Remove any leftover host from a prior injection attempt.
    document.getElementById(HOST_ID)?.remove();

    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText =
      "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;";
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .card {
        font: 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        background: #f4f1eb; color: #1f2722; border: 1px solid #cbc6bc;
        border-radius: 8px; padding: 14px 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.14);
        min-width: 320px; max-width: 420px;
      }
      .title { font-weight: 700; margin-bottom: 8px; font-size: 14px; }
      .subtitle { font-size: 12px; opacity: 0.7; margin-bottom: 10px; }
      select {
        width: 100%; padding: 6px 8px; border: 1px solid #cbc6bc;
        border-radius: 4px; font-size: 13px; background: #fff; margin-bottom: 10px;
      }
      .actions { display: flex; gap: 8px; justify-content: flex-end; }
      button {
        font: 600 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        cursor: pointer; padding: 6px 12px; border-radius: 4px; border: 1px solid #cbc6bc;
        background: rgba(255,255,255,0.7); color: #1f2722;
      }
      button.primary { background: #1f4d3b; color: #fff; border-color: #163a2c; }
      button:hover { opacity: 0.85; }
    `;

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = "Which programs is this applicant filing for?";

    const subtitle = document.createElement("div");
    subtitle.className = "subtitle";
    subtitle.textContent =
      "Civica uses this to include the right sections. Choose before walking the form.";

    const sel = document.createElement("select");
    const opts: Array<{ label: string; value: string }> = [
      { label: "SNAP only (CalFresh)", value: "snap-only" },
      { label: "SNAP + Medi-Cal", value: "multi-program" },
      { label: "SNAP + Cash Aid (TANF)", value: "multi-program" },
      { label: "SNAP + Medi-Cal + Cash Aid", value: "multi-program" },
      { label: "Skip (use multi-program default)", value: "multi-program" },
    ];
    for (const opt of opts) {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      sel.append(el);
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.textContent = "Skip";
    skipBtn.addEventListener("click", () => {
      host.remove();
      _tabFlowType = undefined; // D8: skip → undefined → multi-program
      resolve(undefined);
    });

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "primary";
    confirmBtn.textContent = "Confirm";
    confirmBtn.addEventListener("click", () => {
      host.remove();
      const chosen = sel.value as "snap-only" | "multi-program";
      _tabFlowType = chosen;
      resolve(chosen);
    });

    actions.append(skipBtn, confirmBtn);
    card.append(title, subtitle, sel, actions);
    shadow.append(style, card);
    document.body.appendChild(host);
  });
}

/**
 * The five explicit states the overlay can be in (V1-6, #315). The assister is
 * the compliance gate, so the overlay must tell them precisely where things
 * stand and what to do next — not just emit an ad-hoc count.
 *   - `loading` — fetching the packet payload.
 *   - `empty`   — no active packet / first run; tell them to pick one in Civica.
 *   - `error`   — fetch failed, page structure changed, or the page never
 *                 hydrated; user-visible and actionable.
 *   - `partial` — some fields filled, some need a human; show the breakdown.
 *   - `success` — every known field filled; "review and click Next".
 */
export type OverlayStatus = "loading" | "empty" | "error" | "partial" | "success";

/** A control button rendered in the overlay (Re-fill / Clear). */
interface OverlayAction {
  id: string;
  label: string;
  onClick: () => void | Promise<void>;
}

export interface OverlayState {
  status: OverlayStatus;
  /** Headline shown in bold. */
  title: string;
  /** Body copy: the actionable detail. */
  message: string;
  /** Optional per-step controls (Re-fill / Clear). */
  actions?: OverlayAction[];
  /**
   * Optional pre-submit trust panel (V1-6a, #316). When present, renders as a
   * scrollable table BELOW the body + actions: each row is `field label →
   * what Civica wrote → what's on the page now → status pill`. Read-only.
   */
  panel?: ReviewPanel;
}

const OVERLAY_ID = "civica-submitter-overlay";
const LOG_PREFIX = "[Civica Submitter]";

/** A single field's fill outcome, paired with the element it touched (if any). */
export interface FieldFillEvent {
  field: FieldSelector;
  outcome: FieldOutcome;
  /** The DOM element resolved/filled, when one was located. */
  element: Element | null;
}

/** Callback invoked once per field as `fillPage`/`fillField` processes it. */
export type FieldFillReporter = (event: FieldFillEvent) => void;

// ---------------------------------------------------------------------------
// Entry — wired only on benefitscal.com per manifest.
// ---------------------------------------------------------------------------

void main().catch((err: unknown) => {
  console.error(LOG_PREFIX, "fatal", err);
  renderOverlay({
    status: "error",
    title: "Civica Submitter error",
    message: err instanceof Error ? err.message : String(err),
  });
});

async function main(): Promise<void> {
  // Show `loading` immediately so the assister knows the extension is alive
  // while we read storage + fetch the payload.
  renderOverlay({
    status: "loading",
    title: "Civica Submitter",
    message: "Loading the selected packet…",
  });

  // 1. Look up the active packet id. If none, surface the `empty` state and
  //    bail — the assister hasn't selected a packet from Civica yet.
  const activePacketId = await readActivePacketId();
  if (!activePacketId) {
    renderOverlay({
      status: "empty",
      title: "No packet selected",
      message:
        "Civica Submitter is installed but no packet is selected. Open the Civica dashboard, pick a packet, then return here.",
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
      status: "error",
      title: "Could not load packet",
      message: `Civica could not load packet ${activePacketId.slice(0, 8)}: ${resp.error ?? "unknown error"}. Check the extension options (gateway URL + token), then reload this page.`,
    });
    return;
  }
  const payload = resp.data;

  // 3. Staff election prompt (D12 — per-tab session, not a packet field).
  //    Show the activation dropdown on the first page load for this tab so
  //    staff can indicate which programs the applicant is filing for before
  //    the walk begins. sectionSequence() uses the result to gate which steps
  //    the extension expects (SNAP-only omits Assets; multi-program includes it).
  //    The prompt is a no-op if already answered on this tab.
  //    We pass the result to sectionSequence but don't block the fill on it —
  //    the section sequence is informational at PR1; the per-page fill logic is
  //    unchanged (it always fills whatever page it lands on).
  const flowType = await promptFlowType();
  // Compute the expected page sequence for this flow. At PR1, steps 2-9 stubs
  // are empty so this is primarily step-0 + step-1; when T7 walk lands the
  // stubs are populated and this sequence becomes the full walk order.
  const _expectedSequence = sectionSequence(
    payload as Parameters<typeof sectionSequence>[0],
    flowType,
  );
  // Log the sequence so the assister + devs can verify in the extension console.
  console.debug(LOG_PREFIX, "section sequence for flow", flowType ?? "multi-program (default)", _expectedSequence);

  // 4. Match the current URL against a known form page.
  const page = findPageForUrl(window.location.pathname);
  if (page) {
    await runPageFill(page, payload, activePacketId);
    return;
  }

  // 5. Confirmation page handling.
  if (CONFIRMATION_PAGE.urlPattern.test(window.location.pathname)) {
    await handleConfirmation(activePacketId);
    return;
  }

  // 6. Neither a known form page nor the confirmation page — quiet info state.
  renderOverlay({
    status: "empty",
    title: "Civica Submitter active",
    message: `Navigate to a CalFresh application page to autofill packet ${activePacketId.slice(0, 8)}.`,
  });
}

// ---------------------------------------------------------------------------
// Page-fill orchestration (V1-6, #315): readiness gate → fill → mark →
// persist → render state → wire Re-fill / Clear controls.
// ---------------------------------------------------------------------------

/**
 * Drive one form page end-to-end. Pure-additive around the existing
 * `fillPage` core: it adds a hydration wait, per-field markers, fill-state
 * persistence, the 5-state overlay, and the Re-fill / Clear controls. None of
 * the fill/transform/option-group logic changed.
 */
export async function runPageFill(
  page: PortalPage,
  payload: unknown,
  packetId: string,
  root: ParentNode = document,
  opts: { readinessTimeoutMs?: number } = {},
): Promise<void> {
  const readinessTimeoutMs = opts.readinessTimeoutMs ?? 5000;
  // (a) Readiness gate. The portal is a React SPA that can soft-update; filling
  // before the fields hydrate would no-op every field. Wait (≤5s) for the
  // page's first fillable field to actually exist in the DOM. Pages with no
  // auto-fillable fields skip the wait (nothing to wait for).
  const probe = firstFillableSelector(page);
  if (probe) {
    const ready = await waitFor((r) => resolveField(probe, r) !== null, {
      root,
      timeoutMs: readinessTimeoutMs,
    });
    if (!ready) {
      renderOverlay({
        status: "error",
        title: "Page didn't finish loading",
        message:
          "Civica couldn't find this page's fields — it may not have finished loading. Reload the page and try again.",
        actions: [
          {
            id: "refill",
            label: "Re-fill this page",
            onClick: () => runPageFill(page, payload, packetId, root, opts),
          },
        ],
      });
      return;
    }
  }

  // (b) Clear any stale markers from a prior fill of this page before re-filling
  // (e.g. a soft re-render, or the assister hitting "Re-fill"). Keeps the
  // markers honest — they always reflect the most recent fill.
  clearAllMarkers(root);

  // (c) Fill, collecting per-field events so we can mark elements + fingerprint
  // what we wrote (for safe clearing later).
  const fingerprints: FillFingerprint[] = [];
  const result = fillPage(page, payload, root, (ev) => {
    if (!ev.element) return;
    if (ev.outcome === "filled") {
      markElement(ev.element, "filled", ev.field.label);
      // V1-6a (#316): carry the field's human-readable label on the
      // fingerprint so the pre-submit trust panel can render rows.
      fingerprints.push(fingerprintOf(ev.element, ev.field.type, ev.field.label));
    } else if (ev.outcome === "needs-review" || ev.outcome === "not-found") {
      // A located element we deliberately did NOT write (unmapped eligibility
      // value) — flag it for the human. `not-found` rarely has an element.
      markElement(ev.element, "review", ev.field.label);
    }
  });

  // (d) Persist this page's fill state so Clear works even after navigating
  // away and back (a fresh content-script load rebinds these fingerprints).
  await writePageFillState({
    packetId,
    pageCode: page.pageCode,
    filledAt: Date.now(),
    fingerprints,
  });

  // (e) Address-validation modal dispatch (V1-5 PR2, #314). When the current
  //     page is ABNHA (home-address), the portal may trigger its 2-modal USPS
  //     validation flow after we write the address fields. We surface the modal
  //     to the reviewer via civica:address-validation-required and WAIT for them
  //     to resolve it (civica:address-validation-resolved). NO auto-accept.
  //     AC #3: the human selects the validated address; extension only notifies.
  //
  //     This runs AFTER fill so the address fields are already written when the
  //     portal triggers its validation on blur/submit — the reviewer sees both
  //     the pre-filled fields and the modal options at the same time.
  //
  //     Member index 0 = primary applicant. When T7 walk lands steps 2-9, the
  //     per-member address pages will pass a memberIndex > 0 here.
  if (page.pageCode === "ABNHA") {
    console.debug(
      LOG_PREFIX,
      "ABNHA: address-validation modal may appear — dispatching civica:address-validation-required",
    );
    // Note: we don't await here at page-fill time — the modal is only triggered
    // by the portal after the user would click Next. We dispatch the required
    // event so the trust panel wires its listener, and the assister can watch
    // for the portal's modal to appear. The actual resolution handshake happens
    // when the modal appears and the reviewer responds.
    // Fire-and-inform pattern: the event carries empty addressOptions at this
    // point (the portal modal hasn't appeared yet); the trust panel shows a
    // "watch for the address-validation modal" notice.
    void handleAddressValidationModal(page.pageCode, 0, root, document, 0).catch(
      () => {
        // Timeout (0ms) → resolves immediately with null. This is the fire-
        // and-inform pattern: the event dispatch is what matters, not waiting.
      },
    );
  }

  // (f) Render the resulting state with Re-fill / Clear controls.
  renderOverlay(describeFill(result, page, payload, packetId, root));
}

// Expose event name constants at module level so tests can reference them
// without re-importing from @civica/benefitscal-cbo/core.
export { ADDRESS_VALIDATION_REQUIRED_EVENT, ADDRESS_VALIDATION_RESOLVED_EVENT };

/**
 * The first auto-fillable field on a page, used as the readiness probe. We wait
 * for THIS field's element to exist before filling. Returns null for info-only
 * pages (nothing to wait for).
 */
function firstFillableSelector(page: PortalPage): FieldSelector | null {
  for (const field of Object.values(page.fields)) {
    if (!isAutoFillable(field)) continue;
    // For an option group, probe the first option's element; otherwise the
    // field itself.
    if (isOptionGroupField(field) && field.options) {
      const firstOpt = Object.values(field.options)[0];
      if (firstOpt) return firstOpt;
    }
    return field;
  }
  return null;
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
  onField?: FieldFillReporter,
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
      // No DOM element resolved — still report so a UI can note it if desired.
      onField?.({ field, outcome: "needs-review", element: null });
      continue;
    }
    fillable++;
    const outcome = fillField(field, payload, root, onField);
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
  onField?: FieldFillReporter,
): FieldOutcome {
  // Track the DOM element this field resolved to (if any) so we can report it
  // to `onField` for marking. A single `done()` exit reports + returns, keeping
  // the existing outcome contract byte-for-byte for callers passing no reporter.
  let resolved: Element | null = null;
  const done = (outcome: FieldOutcome): FieldOutcome => {
    onField?.({ field, outcome, element: resolved });
    return outcome;
  };

  // Buttons are navigation, never data entry — never resolve or click them.
  // (advanceButtons live off `page.fields` entirely, but guard anyway.)
  if (field.type === "button") return done("needs-review");

  // (3) Radio/checkbox option group — resolve which option to click. Checked
  // BEFORE the constant-direct path so a constant-on-a-group (ABPRI
  // applying-for-self) routes through the option resolver. fillOptionGroup
  // reports its own element directly through `onField`.
  if (isOptionGroupField(field)) {
    return fillOptionGroup(field, payload, root, onField);
  }

  // (2) Constant-direct fill: a fixed value with no option indirection (the
  // ABPRI #snap checkbox = constant "true"). Ignores the payload.
  const constant = constantValue(field);
  if (constant !== null) {
    const el = resolveField(field, root);
    resolved = el;
    if (!el) {
      console.debug(LOG_PREFIX, `not found: ${field.label} (${field.fallbackSelector ?? "label-only"})`);
      return done("not-found");
    }
    const ok = fillElement(el, field.type, constant);
    if (!ok) {
      console.warn(LOG_PREFIX, `could not fill constant: ${field.label} (type ${field.type})`);
      return done("not-found");
    }
    return done("filled");
  }

  if (!field.source) return done("needs-review");

  const value = resolvePath(payload, field.source);
  if (value === null || value === undefined || value === "") {
    console.debug(LOG_PREFIX, `no value at path: ${field.source}`);
    return done("no-value");
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
      return done("needs-review");
    }
    const transformed = fn(fillValue);
    if (transformed === null) {
      console.debug(
        LOG_PREFIX,
        `transform "${field.transform}" could not map value for ${field.label}`,
      );
      // Resolve (but never write) the element so a UI can flag THIS control for
      // the assister — the value couldn't be mapped (e.g. an out-of-CA county),
      // so they must fill it by hand.
      resolved = resolveField(field, root);
      return done("needs-review");
    }
    fillValue = transformed;
  }

  const el = resolveField(field, root);
  resolved = el;
  if (!el) {
    console.debug(LOG_PREFIX, `not found: ${field.label} (${field.fallbackSelector ?? "label-only"})`);
    return done("not-found");
  }

  const ok = fillElement(el, field.type, fillValue);
  if (!ok) {
    // fillElement returns false for a wrong element type or a missing <select>
    // option — surface it like a not-found so the assister double-checks.
    console.warn(LOG_PREFIX, `could not fill: ${field.label} (type ${field.type})`);
    return done("not-found");
  }
  return done("filled");
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
  onField?: FieldFillReporter,
): FieldOutcome {
  // Single reporting exit, mirroring `fillField`. `resolved` is the SPECIFIC
  // option element we clicked (Yes/No/married/…), so markers/fingerprints pin
  // to the exact control, while `field` stays the group (for the label).
  let resolved: Element | null = null;
  const done = (outcome: FieldOutcome): FieldOutcome => {
    onField?.({ field, outcome, element: resolved });
    return outcome;
  };

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
      return done("no-value");
    }
    // needs-review: unmapped/absent eligibility value — click NOTHING.
    console.debug(LOG_PREFIX, `needs review (unmapped option): ${field.label}`);
    return done("needs-review");
  }

  // Locate the chosen option's specific input and click/check it.
  const el = resolveField(resolution.option, root);
  resolved = el;
  if (!el) {
    console.debug(
      LOG_PREFIX,
      `option not found: ${field.label} → ${resolution.key} (${resolution.option.fallbackSelector ?? "label-only"})`,
    );
    return done("not-found");
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
    return done("not-found");
  }
  return done("filled");
}

/**
 * Map a fill tally onto one of the five overlay states (V1-6, #315) and attach
 * the per-step Re-fill / Clear controls.
 *
 * State selection:
 *   - `error`   — every fillable field came back not-found (filled 0). A strong
 *                 signal the portal's structure changed under us; actionable.
 *   - `success` — every fillable field was filled and nothing needs a human
 *                 (no needs-review, no not-found, no no-value).
 *   - `partial` — anything in between (some filled, some need review / had no
 *                 data / weren't found), including a human-only page (no
 *                 auto-fillable fields).
 *
 * The `loading` and `empty` states are produced upstream in `main()`, not here.
 */
export function describeFill(
  r: FillResult,
  page: PortalPage,
  payload: unknown,
  packetId: string,
  root: ParentNode,
): OverlayState {
  const refill: OverlayAction = {
    id: "refill",
    label: "Re-fill this page",
    onClick: () => runPageFill(page, payload, packetId, root),
  };
  const clear: OverlayAction = {
    id: "clear",
    label: "Clear Civica fills on this page",
    onClick: () => clearPage(packetId, page.pageCode, root),
  };
  // V1-6a (#316): the pre-submit trust panel — opens a tabular review of
  // every field Civica filled across every page for this packet so the
  // assister can verify before clicking the portal's Submit. Always
  // surfaced (post-#316 the assister has an explicit "what did Civica do?"
  // affordance regardless of page); on the Review & Submit step (once V1-4
  // walks it) this is the panel that satisfies the "human reviews before
  // submitting" compliance posture.
  const reviewPanel: OverlayAction = {
    id: "review-panel",
    label: "Review what Civica filled",
    onClick: () => showTrustPanel(packetId, root),
  };

  // Page-structure failure: we had fields to fill but located NONE of them.
  if (r.fillable > 0 && r.filled === 0 && r.notFound === r.fillable) {
    return {
      status: "error",
      title: "Page structure may have changed",
      message:
        "Civica recognized this page but couldn't locate any of its fields — the portal layout may have changed. Reload and try again; if it persists, fill this page by hand.",
      actions: [refill],
    };
  }

  const parts: string[] = [];
  if (r.skippedNoValue > 0) parts.push(`${r.skippedNoValue} had no packet data`);
  if (r.notFound > 0) parts.push(`${r.notFound} not found on the page`);
  if (r.needsReview > 0) parts.push(`${r.needsReview} need manual review`);
  const breakdown = parts.length > 0 ? ` ${parts.join(", ")}.` : "";

  const allDone =
    r.fillable > 0 &&
    r.filled === r.fillable &&
    r.needsReview === 0 &&
    r.notFound === 0 &&
    r.skippedNoValue === 0;

  if (allDone) {
    return {
      status: "success",
      title: `Filled all ${r.filled} field${r.filled === 1 ? "" : "s"}`,
      message:
        "Every field Civica can fill on this page is done. Review the form, then click Next/Continue yourself.",
      actions: [refill, clear, reviewPanel],
    };
  }

  // Partial — some combination of filled + needs-human.
  const lead =
    r.fillable === 0
      ? `No auto-fillable fields here${r.needsReview > 0 ? ` — ${r.needsReview} need your input` : ""}.`
      : `Filled ${r.filled} of ${r.fillable} fields.${breakdown}`;
  return {
    status: "partial",
    title: "Review needed",
    message: `${lead} Check the highlighted fields, then click Next/Continue yourself.`,
    actions: r.filled > 0 ? [refill, clear, reviewPanel] : [refill, reviewPanel],
  };
}

/**
 * "Review what Civica filled" handler (V1-6a, #316). Reads every persisted
 * fill state for this packet, builds the source-vs-on-page diff table, and
 * re-renders the existing overlay with the panel attached. Read-only: never
 * mutates the portal DOM, never submits — the assister still clicks the
 * portal's own Submit control.
 */
export async function showTrustPanel(
  packetId: string,
  root: ParentNode = document,
): Promise<void> {
  const states = await readAllPageFillStatesForPacket(packetId);
  const panel = buildReviewPanel(states, root);
  const pageCount = states.length;
  const title =
    panel.summary.totalFilled === 0
      ? "Nothing filled yet for this packet"
      : `${panel.summary.totalFilled} field${panel.summary.totalFilled === 1 ? "" : "s"} filled across ${pageCount} page${pageCount === 1 ? "" : "s"}`;
  const flags: string[] = [];
  if (panel.summary.humanEdited > 0) {
    flags.push(`${panel.summary.humanEdited} edited since fill`);
  }
  if (panel.summary.notOnPage > 0) {
    flags.push(`${panel.summary.notOnPage} not on this page`);
  }
  const message =
    panel.summary.totalFilled === 0
      ? "Re-fill any prior page first; the panel populates as Civica writes fields."
      : `Source vs on-page values for every field Civica wrote. ${
          flags.length > 0 ? flags.join("; ") + "." : "All values still match."
        } Civica never submits — that's still your click on the portal's Submit control.`;
  renderOverlay({
    status: panel.summary.humanEdited > 0 ? "partial" : "success",
    title,
    message,
    panel,
  });
}

/**
 * "Clear Civica fills on this page" handler. Reads the persisted fingerprints
 * for (packet, page), reverts ONLY the fields whose current value still equals
 * what Civica wrote (human edits preserved), removes the markers, drops the
 * persisted state, and re-renders the overlay with the tally.
 */
export async function clearPage(
  packetId: string,
  pageCode: string,
  root: ParentNode,
): Promise<void> {
  const state = await readPageFillState(packetId, pageCode);
  const fingerprints = state?.fingerprints ?? [];
  const res = clearCivicaFills(fingerprints, root);
  await clearPageFillState(packetId, pageCode);
  const preserved =
    res.preservedHumanEdits > 0
      ? ` ${res.preservedHumanEdits} you had edited were left untouched.`
      : "";
  renderOverlay({
    status: "empty",
    title: "Civica fills cleared",
    message: `Cleared ${res.cleared} field${res.cleared === 1 ? "" : "s"} Civica wrote.${preserved} Re-open this page or reload to fill again.`,
  });
}

// ---------------------------------------------------------------------------
// Confirmation page handling
// ---------------------------------------------------------------------------

async function handleConfirmation(packetId: string): Promise<void> {
  if (!CONFIRMATION_PAGE.verified) {
    renderOverlay({
      status: "partial",
      title: "Success page detected",
      message:
        "Civica saw the confirmation page, but the case-number selector isn't verified against the live portal yet. Copy the case number from the page into Civica's dashboard manually.",
    });
    return;
  }
  const caseEl = document.querySelector(CONFIRMATION_PAGE.caseNumberSelector);
  const caseNumber = caseEl?.textContent?.trim() ?? null;
  if (!caseNumber) {
    renderOverlay({
      status: "error",
      title: "Couldn't read the case number",
      message:
        "Civica saw the success page but could not find the confirmation number. Copy it into the Civica dashboard manually.",
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
      status: "success",
      title: "Submission confirmed",
      message: `Civica recorded case ${caseNumber}.`,
    });
  } else {
    renderOverlay({
      status: "error",
      title: "Couldn't report the case number",
      message: `Captured case ${caseNumber} but failed to report it to Civica: ${resp.error ?? "unknown error"}. Record it manually.`,
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
// Small fixed-position banner. Renders into a Shadow DOM so BenefitsCal's own
// styles can't collide with ours (and ours can't leak into the portal). Renders
// one of the five explicit states with a status pill, headline, body, and any
// per-step controls (Re-fill / Clear). Buttons are `type="button"` and live
// inside the shadow root, fully isolated from the portal's <form> — they can
// never submit or advance the application.
// ---------------------------------------------------------------------------

/** Per-status palette + the human-facing status pill text. */
const STATUS_STYLES: Record<
  OverlayStatus,
  { bg: string; fg: string; border: string; pill: string; pillLabel: string }
> = {
  loading: { bg: "#f4f1eb", fg: "#1f2722", border: "#cbc6bc", pill: "#6b7280", pillLabel: "Loading" },
  empty: { bg: "#f4f1eb", fg: "#1f2722", border: "#cbc6bc", pill: "#6b7280", pillLabel: "Idle" },
  partial: { bg: "#fff4d6", fg: "#5a3b00", border: "#d8b566", pill: "#B5511E", pillLabel: "Review" },
  success: { bg: "#1f4d3b", fg: "#ffffff", border: "#163a2c", pill: "#bfe3cf", pillLabel: "Filled" },
  error: { bg: "#fde8e4", fg: "#8b1d11", border: "#d88a78", pill: "#b3261e", pillLabel: "Error" },
};

export function renderOverlay(state: OverlayState): void {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();
  const host = document.createElement("div");
  host.id = OVERLAY_ID;
  // Expose the state on the host for tests / debugging (shadow root is closed
  // to portal CSS but this attr lets a test assert which state rendered).
  host.setAttribute("data-civica-state", state.status);
  host.style.position = "fixed";
  host.style.bottom = "16px";
  host.style.right = "16px";
  host.style.zIndex = "2147483647"; // max — sit above any BenefitsCal modal
  const shadow = host.attachShadow({ mode: "open" });
  const s = STATUS_STYLES[state.status];

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .root {
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: ${s.bg};
      color: ${s.fg};
      border: 1px solid ${s.border};
      border-radius: 6px;
      padding: 10px 12px;
      max-width: 360px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }
    .head { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
    .brand {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em; opacity: 0.7;
    }
    .pill {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em; color: #fff; background: ${s.pill};
      border-radius: 10px; padding: 1px 7px;
    }
    .spinner {
      width: 11px; height: 11px; border-radius: 50%;
      border: 2px solid currentColor; border-right-color: transparent;
      display: inline-block; animation: civspin 0.7s linear infinite; opacity: 0.7;
    }
    @keyframes civspin { to { transform: rotate(360deg); } }
    .title { font-weight: 600; margin-bottom: 2px; }
    .body { white-space: pre-wrap; }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    button {
      font: 600 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer; padding: 5px 9px; border-radius: 4px;
      border: 1px solid ${s.border};
      background: rgba(255,255,255,0.6); color: ${s.fg};
    }
    button:hover { background: rgba(255,255,255,0.9); }
    button:disabled { opacity: 0.5; cursor: default; }
    /* V1-6a (#316) trust panel table */
    .panel {
      margin-top: 10px; max-height: 280px; overflow-y: auto;
      border: 1px solid ${s.border}; border-radius: 4px;
      background: rgba(255,255,255,0.5);
    }
    .panel table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .panel th, .panel td {
      text-align: left; padding: 4px 6px; vertical-align: top;
      border-bottom: 1px solid rgba(0,0,0,0.08);
    }
    .panel th { font-weight: 600; background: rgba(0,0,0,0.04); position: sticky; top: 0; }
    .panel tr:last-child td { border-bottom: none; }
    .panel .label { font-weight: 600; }
    .panel .value { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all; }
    .panel .status {
      display: inline-block; font-size: 9px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
      padding: 1px 5px; border-radius: 8px; color: #fff;
    }
    .panel .status[data-s="match"]        { background: #1f4d3b; }
    .panel .status[data-s="human-edited"] { background: #B5511E; }
    .panel .status[data-s="not-on-page"]  { background: #6b6b6b; }
    .panel .empty {
      padding: 14px 10px; text-align: center; font-style: italic; opacity: 0.7;
    }
  `;

  const root = document.createElement("div");
  root.className = "root";

  const head = document.createElement("div");
  head.className = "head";
  const brand = document.createElement("span");
  brand.className = "brand";
  brand.textContent = "Civica Submitter";
  const pill = document.createElement("span");
  pill.className = "pill";
  pill.textContent = s.pillLabel;
  head.append(brand, pill);
  if (state.status === "loading") {
    const spin = document.createElement("span");
    spin.className = "spinner";
    head.append(spin);
  }

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = state.title;

  const body = document.createElement("div");
  body.className = "body";
  body.textContent = state.message;

  root.append(head, title, body);

  if (state.actions && state.actions.length > 0) {
    const actions = document.createElement("div");
    actions.className = "actions";
    for (const action of state.actions) {
      const btn = document.createElement("button");
      btn.type = "button"; // never a submit — isolated from the portal form
      btn.textContent = action.label;
      btn.dataset.action = action.id;
      btn.addEventListener("click", () => {
        // Guard against double-clicks while the async handler runs.
        btn.disabled = true;
        void Promise.resolve(action.onClick()).catch((err: unknown) => {
          console.error(LOG_PREFIX, "action failed", action.id, err);
          btn.disabled = false;
        });
      });
      actions.append(btn);
    }
    root.append(actions);
  }

  // V1-6a (#316): the pre-submit trust panel. Tabular, scrollable, sticky
  // header, status pill per row. Pure DOM — never wires a Submit control.
  if (state.panel) {
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("data-civica-panel", "review");
    if (state.panel.rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No fills recorded for this packet yet.";
      panel.append(empty);
    } else {
      const table = document.createElement("table");
      const thead = document.createElement("thead");
      thead.innerHTML =
        "<tr><th>Field</th><th>Civica wrote</th><th>On page now</th><th>Status</th></tr>";
      const tbody = document.createElement("tbody");
      for (const row of state.panel.rows) {
        const tr = document.createElement("tr");
        tr.setAttribute("data-status", row.status);
        tr.setAttribute("data-page-code", row.pageCode);
        const labelTd = document.createElement("td");
        labelTd.className = "label";
        labelTd.textContent = row.fieldLabel;
        const civicaTd = document.createElement("td");
        civicaTd.className = "value";
        civicaTd.textContent = row.civicaWrote;
        const currentTd = document.createElement("td");
        currentTd.className = "value";
        currentTd.textContent = row.currentlyOnPage ?? "(not on this page)";
        const statusTd = document.createElement("td");
        const pill = document.createElement("span");
        pill.className = "status";
        pill.setAttribute("data-s", row.status);
        pill.textContent =
          row.status === "match"
            ? "match"
            : row.status === "human-edited"
              ? "edited"
              : "n/a";
        statusTd.append(pill);
        tr.append(labelTd, civicaTd, currentTd, statusTd);
        tbody.append(tr);
      }
      table.append(thead, tbody);
      panel.append(table);
    }
    root.append(panel);
  }

  shadow.append(style, root);
  document.body.appendChild(host);
}
