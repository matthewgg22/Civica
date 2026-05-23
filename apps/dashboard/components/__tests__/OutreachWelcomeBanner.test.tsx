import { render, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import OutreachWelcomeBanner from "../OutreachWelcomeBanner";

const STORAGE_KEY = "civica.outreach.welcomeDismissed";

// jsdom under Node 25 ships with an opaque empty `window.localStorage` (Node's
// experimental Web Storage shadows jsdom's). Install a minimal in-memory shim
// before each test so getItem/setItem actually round-trip.
function installLocalStorageShim() {
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(i: number) {
      return Array.from(store.keys())[i] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: shim,
    writable: true,
    configurable: true,
  });
}

describe("OutreachWelcomeBanner", () => {
  beforeEach(() => {
    installLocalStorageShim();
  });

  it("renders the banner when localStorage key is unset", () => {
    const { container } = render(<OutreachWelcomeBanner />);
    // Region role marks the banner card.
    const region = container.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    // Welcome copy must be present.
    expect(container.textContent).toMatch(/Welcome to your queue/);
    // "Got it" CTA must be present.
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.some((b) => b.textContent?.trim() === "Got it")).toBe(true);
  });

  it("does NOT render when localStorage key is set to 'dismissed'", () => {
    window.localStorage.setItem(STORAGE_KEY, "dismissed");
    const { container } = render(<OutreachWelcomeBanner />);
    expect(container.querySelector('[role="region"]')).toBeNull();
    expect(container.textContent ?? "").not.toMatch(/Welcome to your queue/);
  });

  it("clicking 'Got it' sets the localStorage key AND unmounts the banner", () => {
    const { container } = render(<OutreachWelcomeBanner />);
    // Banner present pre-click.
    expect(container.querySelector('[role="region"]')).toBeTruthy();

    const buttons = Array.from(container.querySelectorAll("button"));
    const gotItButton = buttons.find((b) => b.textContent?.trim() === "Got it");
    expect(gotItButton).toBeTruthy();

    act(() => {
      gotItButton!.click();
    });

    // localStorage key set.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dismissed");
    // Banner unmounted.
    expect(container.querySelector('[role="region"]')).toBeNull();
  });

  it("clicking the X dismiss button also dismisses the banner", () => {
    const { container } = render(<OutreachWelcomeBanner />);
    const dismissX = container.querySelector(
      'button[aria-label="Dismiss welcome banner"]',
    );
    expect(dismissX).toBeTruthy();

    act(() => {
      (dismissX as HTMLButtonElement).click();
    });

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dismissed");
    expect(container.querySelector('[role="region"]')).toBeNull();
  });
});
