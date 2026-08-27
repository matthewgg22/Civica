// @vitest-environment jsdom
//
// The first-visit card on the LANDING page (owner, 2026-08-26).
//
// The bare domain redirects to /screen/ask, so that is the door almost
// everyone comes through — and the card only existed on /chat, the smaller
// one. Someone arriving at the front of the product was the one person who
// never met the definition of SNAP or the line saying this is not the
// government.
//
// THE LOAD-BEARING PART IS THE SHARED KEY. Two surfaces, one answer: dismiss
// it at either door and it is dismissed at both. Being introduced twice, once
// per door, is precisely what a "first visit" card must not do — and it is
// the failure a second copy of the storage logic would have produced.
import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

import { LandingWelcome } from "../LandingWelcome";
import { WELCOME_SEEN_KEY, welcomeSeen, markWelcomeSeen } from "../../lib/welcome-seen";
import { T } from "../../lib/i18n/demeter-chat-copy";

// This jsdom has sessionStorage but NOT localStorage; without a stub every
// case here would exercise the blocked-storage path instead.
//
// This is now the SECOND file stubbing that global (demeter-welcome is the
// other), which widens the window on the intermittent failure tracked in
// issue #1020: while the stub is installed, files sharing this worker mount a
// chat with the card over it, and the card eats their clicks. The restore
// below is per-file and correct; the real fix belongs in #1020 — suites that
// mount DemeterChat and do not care about the card should seed the key
// themselves rather than depend on worker scheduling.
const store = new Map<string, string>();
const original = Object.getOwnPropertyDescriptor(window, "localStorage");
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  },
});
afterEach(() => {
  cleanup();
  store.clear();
});
afterAll(() => {
  // Put the environment back, or the stub leaks into every file sharing this
  // worker and their mounts start rendering a modal that eats their clicks.
  if (original) Object.defineProperty(window, "localStorage", original);
  else delete (window as unknown as Record<string, unknown>).localStorage;
});

describe("the front door introduces the product", () => {
  it("shows on a first visit", () => {
    const c = render(<LandingWelcome lang="en" />).container;
    expect(c.querySelector(".dmwel"), "no card at the door most people use").not.toBeNull();
    expect(c.textContent).toContain(T.en.welcome.title);
  });

  it("does not show once it has been seen", () => {
    store.set(WELCOME_SEEN_KEY, "1");
    expect(render(<LandingWelcome lang="en" />).container.querySelector(".dmwel")).toBeNull();
  });

  it("shows in the reader's own language", () => {
    const c = render(<LandingWelcome lang="es" />).container;
    expect(c.textContent).toContain(T.es.welcome.title);
    // The USDA notice is English on every language, by requirement.
    expect(c.textContent).toContain("service mark");
  });
});

describe("one key, both doors", () => {
  it("dismissing at the landing marks it seen for the chat too", () => {
    const c = render(<LandingWelcome lang="en" />).container;
    expect(welcomeSeen()).toBe(false);
    fireEvent.click(c.querySelector(".dmwel__secondary")!);
    expect(c.querySelector(".dmwel")).toBeNull();
    // The chat reads this exact function, so this IS the chat's answer.
    expect(welcomeSeen(), "the chat would introduce itself a second time").toBe(true);
  });

  it("having seen it in the chat suppresses it at the landing", () => {
    markWelcomeSeen();
    expect(render(<LandingWelcome lang="en" />).container.querySelector(".dmwel")).toBeNull();
  });
});

describe("blocked storage still gets the introduction", () => {
  it("shows when localStorage throws", () => {
    const spy = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    // A card shown again is mild annoyance; a card never shown means someone
    // who does not know what SNAP is never finds out.
    expect(render(<LandingWelcome lang="en" />).container.querySelector(".dmwel")).not.toBeNull();
    spy.mockRestore();
  });
});
