// Civica Submitter popup — the "Connect with Civica" device-flow UI + packet
// picker (#317 part 3).
//
// Two top-level modes:
//   DISCONNECTED → "Connect with Civica" button. Clicking starts the device
//     authorization, shows the user_code prominently + an "Open Civica to
//     approve" button (opens verification_uri_complete), and POLLS FROM THE
//     POPUP for approval. On success we store tokens and switch to CONNECTED.
//   CONNECTED → "Connected to Civica" + a packet picker. Selecting an applicant
//     sets civica.activePacketId (what content.ts reads) and shows a "Now
//     filling for X — go to BenefitsCal" confirmation. A Disconnect button
//     clears the session tokens.
//
// MV3 JUDGMENT CALL: we poll from the popup, not the service worker. MV3 service
// workers are torn down after ~30s idle and cannot reliably run a multi-minute
// poll; the popup is alive exactly while the assister is waiting on the approval
// screen, so polling here is both reliable and scoped. If the popup closes mid-
// wait, the poll's AbortSignal fires and the device_code simply expires server-
// side — re-opening the popup starts a fresh authorization. (See device-flow.ts
// pollForToken note.)
//
// SECURITY: the user_code is rendered to the DOM but NEVER logged. Tokens never
// touch this file's variables in plaintext beyond what device-flow stores.
//
// Testability: the controller is constructed with injectable dependencies (the
// device-flow + packets fns, an openTab fn, and the root element) so the jsdom
// tests drive every state without real chrome.* APIs. The bootstrap at the
// bottom wires the real implementations and runs only in a browser.

import {
  startDeviceAuthorization,
  pollForToken,
  clearTokens,
  isConnected,
  DeviceFlowError,
  type DeviceAuthorization,
} from "./auth/device-flow";
import {
  fetchPackets,
  applicantLabel,
  PacketsError,
  type PacketSummary,
} from "./auth/packets-api";
import { setActivePacketId } from "./config";

// ---------------------------------------------------------------------------
// View state
// ---------------------------------------------------------------------------

export type PopupView =
  | { mode: "loading" }
  | { mode: "disconnected" }
  | { mode: "connecting" } // authorize request in flight
  | { mode: "waiting"; auth: DeviceAuthorization } // user_code shown, polling
  | { mode: "connected"; packets: PacketSummary[]; loadingPackets: boolean }
  | { mode: "empty" } // connected, zero submittable packets
  | { mode: "selected"; label: string } // active packet set; "go to BenefitsCal"
  | { mode: "error"; message: string; canRetry: boolean };

/** Dependencies the controller calls — injected so tests can stub them. */
export interface PopupDeps {
  startDeviceAuthorization: typeof startDeviceAuthorization;
  pollForToken: typeof pollForToken;
  clearTokens: typeof clearTokens;
  isConnected: typeof isConnected;
  fetchPackets: typeof fetchPackets;
  setActivePacketId: typeof setActivePacketId;
  /** Opens the verification URL (a new tab in the browser). */
  openTab: (url: string) => void;
  /** Opens the extension options page (the "Advanced settings" link). */
  openOptions?: () => void;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class PopupController {
  private view: PopupView = { mode: "loading" };
  private pollAbort: AbortController | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly deps: PopupDeps,
  ) {}

  /** Initial render: connected → load picker; else show the connect button. */
  async start(): Promise<void> {
    const connected = await this.deps.isConnected();
    if (connected) {
      await this.enterConnected();
    } else {
      this.set({ mode: "disconnected" });
    }
  }

  /** Stop any in-flight poll (popup is closing). */
  dispose(): void {
    this.pollAbort?.abort();
    this.pollAbort = null;
  }

  // ── transitions ──────────────────────────────────────────────────────────

  /** "Connect with Civica" → authorize, show code, poll. */
  async connect(): Promise<void> {
    this.set({ mode: "connecting" });
    let auth: DeviceAuthorization;
    try {
      auth = await this.deps.startDeviceAuthorization();
    } catch (err) {
      this.set({
        mode: "error",
        message: this.describeError(err, "Could not start the connection."),
        canRetry: true,
      });
      return;
    }

    this.set({ mode: "waiting", auth });

    // Poll from the popup while it's open. The abort controller lets dispose()
    // (popup close) and a fresh connect() cancel a stale loop.
    this.pollAbort?.abort();
    const abort = new AbortController();
    this.pollAbort = abort;

    try {
      await this.deps.pollForToken(auth.device_code, auth.interval, {
        signal: abort.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return; // popup closed / restarted
      this.set({
        mode: "error",
        message: this.describePollError(err),
        canRetry: true,
      });
      return;
    }

    // Approved + tokens stored by pollForToken → show the picker.
    await this.enterConnected();
  }

  /** Open the dashboard approval page (verification_uri_complete). */
  openApproval(): void {
    if (this.view.mode !== "waiting") return;
    this.deps.openTab(this.view.auth.verification_uri_complete);
  }

  /** Connected: fetch + show the picker (or the empty state). */
  private async enterConnected(): Promise<void> {
    this.set({ mode: "connected", packets: [], loadingPackets: true });
    let packets: PacketSummary[];
    try {
      packets = await this.deps.fetchPackets();
    } catch (err) {
      if (err instanceof PacketsError && err.reconnectNeeded) {
        // Token died between connect and fetch — drop back to disconnected.
        await this.deps.clearTokens();
        this.set({ mode: "disconnected" });
        return;
      }
      this.set({
        mode: "error",
        message: err instanceof Error ? err.message : "Could not load packets.",
        canRetry: true,
      });
      return;
    }
    if (packets.length === 0) {
      this.set({ mode: "empty" });
      return;
    }
    this.set({ mode: "connected", packets, loadingPackets: false });
  }

  /** Assister picked an applicant → set the active packet for content.ts. */
  async selectPacket(packet: PacketSummary): Promise<void> {
    await this.deps.setActivePacketId(packet.id);
    this.set({ mode: "selected", label: applicantLabel(packet) });
  }

  /** Disconnect → clear tokens + active packet, back to the connect button. */
  async disconnect(): Promise<void> {
    this.dispose();
    await this.deps.clearTokens();
    await this.deps.setActivePacketId(null);
    this.set({ mode: "disconnected" });
  }

  /** Retry from the error state: re-evaluate connection and route. */
  async retry(): Promise<void> {
    await this.start();
  }

  // ── rendering ──────────────────────────────────────────────────────────────

  /** Current view (exposed for tests). */
  current(): PopupView {
    return this.view;
  }

  private set(view: PopupView): void {
    this.view = view;
    this.render();
  }

  private render(): void {
    renderView(this.root, this.view, {
      onConnect: () => void this.connect(),
      onOpenApproval: () => this.openApproval(),
      onSelect: (p) => void this.selectPacket(p),
      onDisconnect: () => void this.disconnect(),
      onRetry: () => void this.retry(),
    });
  }

  // ── error copy ───────────────────────────────────────────────────────────

  private describeError(err: unknown, fallback: string): string {
    if (err instanceof DeviceFlowError) {
      return err.code === "network"
        ? "Network error reaching Civica. Check your connection."
        : fallback;
    }
    return fallback;
  }

  private describePollError(err: unknown): string {
    if (err instanceof DeviceFlowError) {
      switch (err.code) {
        case "expired":
          return "The code expired before it was approved. Try connecting again.";
        case "denied":
          return "The connection was declined in Civica.";
        case "network":
          return "Lost connection to Civica while waiting. Try again.";
        default:
          return "Something went wrong while waiting for approval.";
      }
    }
    return "Something went wrong while waiting for approval.";
  }
}

// ---------------------------------------------------------------------------
// Pure-ish render (DOM only — no chrome.* / network). Exported for tests.
// ---------------------------------------------------------------------------

interface RenderHandlers {
  onConnect: () => void;
  onOpenApproval: () => void;
  onSelect: (p: PacketSummary) => void;
  onDisconnect: () => void;
  onRetry: () => void;
}

export function renderView(
  root: HTMLElement,
  view: PopupView,
  h: RenderHandlers,
): void {
  root.replaceChildren();
  switch (view.mode) {
    case "loading":
      root.appendChild(pill("waiting", "Loading"));
      root.appendChild(text("p", "hint", spinnerText("Checking connection…")));
      return;

    case "disconnected": {
      root.appendChild(pill("", "Not connected"));
      root.appendChild(
        text("p", "hint", "Connect this browser to your Civica account to load packets."),
      );
      root.appendChild(button("Connect with Civica", h.onConnect, { id: "connect-btn" }));
      return;
    }

    case "connecting":
      root.appendChild(pill("waiting", "Connecting"));
      root.appendChild(text("p", "hint", spinnerText("Starting connection…")));
      return;

    case "waiting": {
      root.appendChild(pill("waiting", "Waiting for approval"));
      root.appendChild(
        text("p", "hint", "Enter this code in Civica to approve this browser:"),
      );
      const code = document.createElement("div");
      code.className = "usercode";
      code.id = "user-code";
      code.textContent = view.auth.user_code;
      root.appendChild(code);
      root.appendChild(
        button("Open Civica to approve", h.onOpenApproval, { id: "approve-link" }),
      );
      root.appendChild(text("p", "hint", spinnerText("Waiting for you to approve…")));
      return;
    }

    case "connected": {
      root.appendChild(pill("connected", "Connected to Civica"));
      if (view.loadingPackets) {
        root.appendChild(text("p", "hint", spinnerText("Loading packets…")));
      } else {
        root.appendChild(
          text("p", "hint", "Pick an applicant, then go to BenefitsCal to autofill."),
        );
        root.appendChild(renderPicker(view.packets, h.onSelect));
      }
      root.appendChild(
        button("Disconnect", h.onDisconnect, { id: "disconnect-btn", secondary: true }),
      );
      return;
    }

    case "empty": {
      root.appendChild(pill("connected", "Connected to Civica"));
      root.appendChild(
        text(
          "p",
          "empty",
          "No packets are ready to submit yet. When a navigator marks one ready for handoff, it appears here.",
        ),
      );
      root.appendChild(
        button("Disconnect", h.onDisconnect, { id: "disconnect-btn", secondary: true }),
      );
      return;
    }

    case "selected": {
      root.appendChild(pill("connected", "Connected to Civica"));
      const box = document.createElement("div");
      box.className = "confirm";
      box.id = "selected-confirm";
      const strong = document.createElement("strong");
      strong.textContent = view.label;
      box.append("Now filling for ", strong, ". Go to BenefitsCal and start the application.");
      root.appendChild(box);
      root.appendChild(
        button("Pick a different applicant", h.onRetry, { id: "repick-btn", secondary: true }),
      );
      return;
    }

    case "error": {
      root.appendChild(pill("error", "Problem"));
      root.appendChild(text("p", "msg err", view.message));
      if (view.canRetry) {
        root.appendChild(button("Try again", h.onConnect, { id: "retry-btn" }));
      }
      return;
    }
  }
}

function renderPicker(packets: PacketSummary[], onSelect: (p: PacketSummary) => void): HTMLElement {
  const ul = document.createElement("ul");
  ul.className = "picker";
  ul.id = "packet-picker";
  for (const p of packets) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "packet";
    btn.dataset.packetId = p.id;
    btn.addEventListener("click", () => onSelect(p));

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = applicantLabel(p);
    btn.appendChild(name);

    const meta = document.createElement("span");
    meta.className = "meta";
    const status = document.createElement("span");
    status.textContent = p.status;
    meta.appendChild(status);
    if (p.county) {
      const county = document.createElement("span");
      county.textContent = p.county;
      meta.appendChild(county);
    }
    if (p.qc_badge) {
      meta.appendChild(qcBadge(p.qc_badge.tier));
    }
    btn.appendChild(meta);

    li.appendChild(btn);
    ul.appendChild(li);
  }
  return ul;
}

function qcBadge(tier: string): HTMLElement {
  const span = document.createElement("span");
  const t = tier.toLowerCase();
  const cls = t.includes("high") ? "high" : t.includes("med") ? "medium" : "low";
  span.className = `badge ${cls}`;
  span.textContent = `QC: ${tier}`;
  return span;
}

// ── tiny DOM builders ──────────────────────────────────────────────────────

function pill(state: "" | "connected" | "waiting" | "error", label: string): HTMLElement {
  const div = document.createElement("div");
  div.className = "status-pill";
  const dot = document.createElement("span");
  dot.className = state ? `dot ${state}` : "dot";
  div.appendChild(dot);
  div.append(label);
  return div;
}

function text(tag: string, className: string, content: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = content;
  return el;
}

function spinnerText(label: string): string {
  // Plain text — the spinner glyph is purely decorative via CSS on the parent,
  // but we keep the label text-only so screen readers announce just the status.
  return label;
}

function button(
  label: string,
  onClick: () => void,
  opts: { id?: string; secondary?: boolean } = {},
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  if (opts.id) btn.id = opts.id;
  if (opts.secondary) btn.className = "secondary";
  else btn.classList.add("row");
  btn.addEventListener("click", onClick);
  return btn;
}

// ---------------------------------------------------------------------------
// Bootstrap (browser only). Skipped under test (no document#root / no chrome).
// ---------------------------------------------------------------------------

function realDeps(): PopupDeps {
  return {
    startDeviceAuthorization,
    pollForToken,
    clearTokens,
    isConnected,
    fetchPackets,
    setActivePacketId,
    openTab: (url) => {
      void chrome.tabs.create({ url });
    },
    openOptions: () => {
      chrome.runtime.openOptionsPage?.();
    },
  };
}

// Only auto-run in a real popup document, never when imported by a test.
const rootEl = typeof document !== "undefined" ? document.getElementById("root") : null;
if (rootEl && typeof chrome !== "undefined" && chrome.storage) {
  const controller = new PopupController(rootEl, realDeps());
  void controller.start();

  // Cancel the poll when the popup is dismissed.
  window.addEventListener("pagehide", () => controller.dispose());

  const optionsLink = document.getElementById("options-link");
  optionsLink?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage?.();
  });
}
