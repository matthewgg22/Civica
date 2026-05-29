/**
 * Popup controller tests (#317 part 3).
 *
 * Drives the PopupController with injected dependencies (no real chrome.* /
 * network) and asserts the rendered DOM + the dashboard↔extension wire:
 *   - disconnected → Connect shows the user_code + opens the verify URL;
 *   - poll success → connected + picker;
 *   - selecting a packet sets civica.activePacketId (what content.ts reads);
 *   - disconnect clears tokens + the active packet;
 *   - empty + error states render distinctly.
 *
 * jsdom env; chrome.storage stub from test/setup.ts (used only by the real
 * setActivePacketId we pass through to verify the local-storage write).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PopupController, type PopupDeps, type PopupView } from "../src/popup";
import { DeviceFlowError, type DeviceAuthorization } from "../src/auth/device-flow";
import { PacketsError, type PacketSummary } from "../src/auth/packets-api";
import { setActivePacketId, readConfig } from "../src/config";
import { __chromeStores } from "./setup";

const AUTH: DeviceAuthorization = {
  device_code: "dev-abc",
  user_code: "WXYZ-1234",
  verification_uri: "https://dash.example/extension/connect",
  verification_uri_complete: "https://dash.example/extension/connect?user_code=WXYZ-1234",
  expires_in: 600,
  interval: 1,
};

const PACKETS: PacketSummary[] = [
  {
    id: "11111111-aaaa-bbbb-cccc-222222222222",
    applicant_name_ciphertext: "cipher",
    status: "Ready for Handoff",
    county: "Alameda",
    updated_at: "2026-05-29T00:00:00Z",
    qc_badge: { tier: "Low", score: 12 },
  },
  {
    id: "33333333-dddd-eeee-ffff-444444444444",
    applicant_name_ciphertext: null,
    status: "Handed Off",
    county: null,
    updated_at: null,
    qc_badge: null,
  },
];

/** Build deps with sensible defaults; override per test. */
function makeDeps(over: Partial<PopupDeps> = {}): PopupDeps {
  return {
    startDeviceAuthorization: vi.fn(() => Promise.resolve(AUTH)),
    pollForToken: vi.fn(() => Promise.resolve({
      access_token: "a",
      refresh_token: "r",
      token_type: "bearer",
      expires_in: 3600,
    })),
    clearTokens: vi.fn(() => Promise.resolve()),
    isConnected: vi.fn(() => Promise.resolve(false)),
    fetchPackets: vi.fn(() => Promise.resolve(PACKETS)),
    // Real setActivePacketId so we verify the actual chrome.storage.local write.
    setActivePacketId,
    openTab: vi.fn(),
    openOptions: vi.fn(),
    ...over,
  };
}

function mount(): HTMLElement {
  document.body.innerHTML = `<div id="root"></div>`;
  return document.getElementById("root")!;
}

/** Let the controller's async transitions settle. */
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// disconnected → connect
// ---------------------------------------------------------------------------

describe("disconnected state", () => {
  it("shows the Connect button when not connected", async () => {
    const root = mount();
    const c = new PopupController(root, makeDeps());
    await c.start();
    expect(root.querySelector("#connect-btn")).not.toBeNull();
    expect(root.textContent).toContain("Connect with Civica");
  });

  it("Connect shows the user_code and starts polling", async () => {
    const root = mount();
    // Never-resolving poll so we stay in the 'waiting' state to inspect it.
    // connect() awaits the poll, so we DON'T await it here — the 'waiting' state
    // is set synchronously before the poll await.
    const pollForToken = vi.fn(() => new Promise<never>(() => {}));
    const c = new PopupController(root, makeDeps({ pollForToken }));
    await c.start();
    void c.connect();
    await flush();

    expect(c.current().mode).toBe("waiting");
    const code = root.querySelector("#user-code");
    expect(code?.textContent).toBe("WXYZ-1234");
    expect(root.querySelector("#approve-link")).not.toBeNull();
    expect(pollForToken).toHaveBeenCalledWith("dev-abc", 1, expect.anything());
  });

  it("the approve button opens verification_uri_complete", async () => {
    const root = mount();
    const openTab = vi.fn();
    const pollForToken = vi.fn(() => new Promise<never>(() => {}));
    const c = new PopupController(root, makeDeps({ openTab, pollForToken }));
    await c.start();
    void c.connect();
    await flush();

    (root.querySelector("#approve-link") as HTMLButtonElement).click();
    expect(openTab).toHaveBeenCalledWith(AUTH.verification_uri_complete);
  });
});

// ---------------------------------------------------------------------------
// connect → poll success → connected + picker
// ---------------------------------------------------------------------------

describe("poll success → connected picker", () => {
  it("renders the packet picker after approval", async () => {
    const root = mount();
    const c = new PopupController(root, makeDeps());
    await c.start();
    await c.connect();
    await flush();

    expect(c.current().mode).toBe("connected");
    const items = root.querySelectorAll("#packet-picker .packet");
    expect(items).toHaveLength(2);
    // QC badge surfaces for the packet that has one.
    expect(root.querySelector(".badge")?.textContent).toContain("QC: Low");
    // Disconnect control present.
    expect(root.querySelector("#disconnect-btn")).not.toBeNull();
  });

  it("starting connected goes straight to the picker", async () => {
    const root = mount();
    const c = new PopupController(root, makeDeps({ isConnected: vi.fn(() => Promise.resolve(true)) }));
    await c.start();
    await flush();
    expect(c.current().mode).toBe("connected");
    expect(root.querySelectorAll("#packet-picker .packet")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// THE WIRE: selecting a packet sets civica.activePacketId
// ---------------------------------------------------------------------------

describe("packet selection (dashboard↔extension wire)", () => {
  it("clicking a packet sets civica.activePacketId in chrome.storage.local", async () => {
    const root = mount();
    const c = new PopupController(root, makeDeps());
    await c.start();
    await c.connect();
    await flush();

    const firstPacket = root.querySelector("#packet-picker .packet") as HTMLButtonElement;
    firstPacket.click();
    await flush();

    // content.ts reads exactly this key from local storage.
    const cfg = await readConfig();
    expect(cfg.activePacketId).toBe(PACKETS[0].id);
    expect(__chromeStores.local.get("civica.activePacketId")).toBe(PACKETS[0].id);

    // Confirmation copy points the assister at BenefitsCal.
    expect(c.current().mode).toBe("selected");
    expect(root.querySelector("#selected-confirm")?.textContent).toContain("Go to BenefitsCal");
  });
});

// ---------------------------------------------------------------------------
// disconnect
// ---------------------------------------------------------------------------

describe("disconnect", () => {
  it("clears tokens + the active packet and returns to the connect button", async () => {
    const root = mount();
    const clearTokens = vi.fn(() => Promise.resolve());
    const c = new PopupController(root, makeDeps({ clearTokens }));
    await c.start();
    await c.connect();
    await flush();

    // Pre-set an active packet to prove disconnect clears it.
    await setActivePacketId("some-packet");
    (root.querySelector("#disconnect-btn") as HTMLButtonElement).click();
    await flush();

    expect(clearTokens).toHaveBeenCalled();
    expect(__chromeStores.local.get("civica.activePacketId")).toBeNull();
    expect(c.current().mode).toBe("disconnected");
    expect(root.querySelector("#connect-btn")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// empty + error states
// ---------------------------------------------------------------------------

describe("empty + error states", () => {
  it("shows the empty state when connected with zero packets", async () => {
    const root = mount();
    const c = new PopupController(root, makeDeps({ fetchPackets: vi.fn(() => Promise.resolve([])) }));
    await c.start();
    await c.connect();
    await flush();
    expect(c.current().mode).toBe("empty");
    expect(root.textContent).toContain("No packets are ready");
  });

  it("shows an error + retry when authorize fails", async () => {
    const root = mount();
    const startDeviceAuthorization = vi.fn(() =>
      Promise.reject(new DeviceFlowError("network", "offline")),
    );
    const c = new PopupController(root, makeDeps({ startDeviceAuthorization }));
    await c.start();
    await c.connect();
    await flush();
    expect(c.current().mode).toBe("error");
    expect(root.querySelector("#retry-btn")).not.toBeNull();
    expect(root.textContent).toContain("Network error");
  });

  it("maps a denied poll to a clear declined message", async () => {
    const root = mount();
    const pollForToken = vi.fn(() => Promise.reject(new DeviceFlowError("denied", "no")));
    const c = new PopupController(root, makeDeps({ pollForToken }));
    await c.start();
    await c.connect();
    await flush();
    expect(c.current().mode).toBe("error");
    expect(root.textContent).toContain("declined");
  });

  it("an expired poll surfaces a re-connect prompt", async () => {
    const root = mount();
    const pollForToken = vi.fn(() => Promise.reject(new DeviceFlowError("expired", "no")));
    const c = new PopupController(root, makeDeps({ pollForToken }));
    await c.start();
    await c.connect();
    await flush();
    expect(c.current().mode).toBe("error");
    expect(root.textContent).toContain("expired");
  });

  it("a reconnect-needed packets error drops back to disconnected", async () => {
    const root = mount();
    const fetchPackets = vi.fn(() => Promise.reject(new PacketsError("gone", true)));
    const clearTokens = vi.fn(() => Promise.resolve());
    const c = new PopupController(
      root,
      makeDeps({ isConnected: vi.fn(() => Promise.resolve(true)), fetchPackets, clearTokens }),
    );
    await c.start();
    await flush();
    expect(clearTokens).toHaveBeenCalled();
    expect(c.current().mode).toBe("disconnected");
  });
});

// ---------------------------------------------------------------------------
// abort: closing the popup mid-wait does not flip to an error
// ---------------------------------------------------------------------------

describe("poll abort", () => {
  it("an AbortError during polling leaves the view in 'waiting' (popup closed)", async () => {
    const root = mount();
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    const pollForToken = vi.fn(() => Promise.reject(abortErr));
    const c = new PopupController(root, makeDeps({ pollForToken }));
    await c.start();
    await c.connect();
    await flush();
    // No error state — the popup simply closed; the loop was cancelled.
    expect((c.current() as PopupView).mode).toBe("waiting");
  });
});
