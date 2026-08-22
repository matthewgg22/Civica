// @vitest-environment jsdom
//
// The Pi-inspired chat redesign (owner brief 2026-08-21). Four moves, each
// pinned here:
//
//   1. BOXLESS: assistant prose sits directly on the page — no bubble, no
//      border. The reader's own messages become quiet tint chips (ink on
//      --demeter-tint), not brand-colored blocks. Pi's structure, Demeter's
//      palette — the warm-cream ground was deliberately NOT adopted (white
//      was decided the same day, and stands).
//   2. SIDEBAR: a toggle at the chat's top-left opens a drawer — saved
//      conversations, sign-in state. Keyboard-closable, inert when closed.
//   3. SIGN-IN lives at the top right when signed out.
//   4. ONBOARDING asks for the STATE, conversationally, and never a name
//      (the retention line says "avoid names" — same rule the landing mini
//      chat pins).
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";

afterEach(cleanup);

// jsdom has no Element.scrollTo; the transcript's follow-scroll calls it on
// every render (same stub as the other DemeterChat suites).
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

function mountChat() {
  return render(
    <DemeterChat
      states={VERIFIED_STATES}
      initialState={null}
      initialQuestion={null}
      initialMessages={[]}
      initialWorksheet={null}
      savedConversationId={null}
      pendingSave={false}
      geoHint={null}
    />,
  );
}

describe("the sidebar — the tracking panel, open by default", () => {
  // OWNER REFINEMENT (same day): the sidebar IS the tracking panel — state
  // scope, the outlined application, the keep/verify tools — branded with
  // the mark, and OPEN on arrival at desktop widths. Someone should see
  // what the product is keeping for them, not discover it behind an icon.
  it("starts open, branded, with the tracking panel inside", () => {
    const { container } = mountChat();
    const drawer = container.querySelector("#demeter-sidebar")!;
    expect(drawer.getAttribute("aria-hidden")).toBe("false");
    // The brand rides in the sidebar head, shielded from translation.
    const word = drawer.querySelector(".demeter__sbword")!;
    expect(word.textContent).toBe("Demeter");
    expect(word.getAttribute("translate")).toBe("no");
    // The tracking panel moved in whole: state picker + worksheet.
    expect(drawer.querySelector(".demeter__side")).toBeTruthy();
    expect(drawer.textContent).toContain(T.en.worksheet.modeAsk);
  });

  it("closes from its own head toggle, and the chrome toggle reopens it", () => {
    const { container } = mountChat();
    const drawer = container.querySelector("#demeter-sidebar")!;
    // While open, exactly ONE toggle — the sidebar's own.
    expect(container.querySelectorAll("button.demeter__sidebartoggle").length).toBe(1);
    fireEvent.click(drawer.querySelector("button.demeter__sidebartoggle")!);
    expect(drawer.getAttribute("aria-hidden")).toBe("true");
    // Closed: the chrome-row toggle appears, and reopens.
    const chrome = container.querySelector(".demeter__head button.demeter__sidebartoggle")!;
    expect(chrome).toBeTruthy();
    expect(chrome.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(chrome);
    expect(drawer.getAttribute("aria-hidden")).toBe("false");
  });

  it("Escape closes it only where it is an overlay (narrow screens)", () => {
    const { container } = mountChat();
    const drawer = container.querySelector("#demeter-sidebar")!;
    // Desktop (jsdom default 1024): Escape must NOT vanish a standing column.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(drawer.getAttribute("aria-hidden")).toBe("false");
    // Narrow: it is an overlay, and Escape is the reflex.
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(drawer.getAttribute("aria-hidden")).toBe("true");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });

  it("carries the saved-conversations link and, signed out, the sign-in invitation", () => {
    const { container } = mountChat();
    const drawer = container.querySelector("#demeter-sidebar")!;
    expect(drawer.querySelector("a[href*='/screen/saved']")).toBeTruthy();
    const signin = drawer.querySelector("a[href*='/sign-in']");
    expect(signin).toBeTruthy();
    expect(signin!.getAttribute("href")).toContain("next=");
  });

  it("holds the language picker — the top bar control moved in here", () => {
    // Owner refinement: languages live in the sidebar; the chrome row keeps
    // only sign-in. One language control, not two.
    const { container } = mountChat();
    const drawer = container.querySelector("#demeter-sidebar")!;
    expect(drawer.querySelector("select.demeter__lang-select")).toBeTruthy();
    expect(container.querySelector(".demeter__head select")).toBeNull();
  });

  it("keeps a state picker OUTSIDE the drawer for narrow screens", () => {
    // REGRESSION (caught by the mobile-first e2e suite): moving the tracking
    // panel into the drawer buried the state control behind a closed overlay
    // on phones. The state is the fact every figure depends on — on narrow
    // viewports a picker instance renders in the conversation column
    // instead, and exactly ONE instance ever exists in the DOM (state-driven,
    // not CSS-hidden: two controls in the accessibility tree is two
    // controls, whatever the stylesheet says).
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: /max-width:\s*900px/.test(q),
      media: q, addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
    }));
    const { container } = mountChat();
    expect(container.querySelector(".demeter__mobilepicker .dmst")).toBeTruthy();
    expect(container.querySelectorAll(".dmst").length).toBe(1);
    vi.unstubAllGlobals();
  });

  it("the sidebar brand links back to the main page", () => {
    const { container } = mountChat();
    const brand = container.querySelector("#demeter-sidebar a.demeter__sbbrand")!;
    expect(brand).toBeTruthy();
    expect(brand.getAttribute("href")).toBe("/screen/ask");
    expect(brand.textContent).toContain("Demeter");
  });
});

describe("sign-in at the top right", () => {
  it("shows exactly one sign-in: chrome row while the rail is closed, rail foot while open", () => {
    // Owner rec (2026-08-22): with the rail open, its foot button is THE
    // sign-in; a second underlined link floating in the chrome row was an
    // orphan. Closed rail: the chrome link returns to keep the toggle
    // company.
    const { container } = mountChat();
    const head = container.querySelector(".demeter__head")!;
    const drawer = container.querySelector("#demeter-sidebar")!;
    // Open (default): rail foot only.
    expect(head.querySelector("a[href*='/sign-in']")).toBeNull();
    expect(drawer.querySelector("a[href*='/sign-in']")).toBeTruthy();
    // Close the rail: the chrome link appears.
    fireEvent.click(drawer.querySelector("button.demeter__sidebartoggle")!);
    expect(head.querySelector("a[href*='/sign-in']")).toBeTruthy();
  });
});

describe("state-first onboarding", () => {
  it("the empty state asks for the state and never a name", () => {
    const { container } = mountChat();
    const empty = container.querySelector(".demeter__empty")!;
    expect(empty.textContent).toContain(T.en.emptyAskState);
    expect(empty.textContent!.toLowerCase()).not.toMatch(/your name|first name/);
  });

  it("the ask-state line exists in all four languages and never asks a name", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      const s = T[lang].emptyAskState;
      expect(s?.trim(), lang).toBeTruthy();
      expect(s.toLowerCase(), lang).not.toMatch(/name|nombre|tên|名字|姓名/);
    }
  });

  it("keeps the framing block — the redesign restyles it, it does not delete it", () => {
    mountChat();
    expect(screen.getByText(T.en.emptyTitle)).toBeTruthy();
    expect(screen.getByText(T.en.emptyModes)).toBeTruthy();
  });
});

describe("boxless messages (CSS contract)", () => {
  const css = () => readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");

  it("assistant prose carries no box", () => {
    const rule = css().match(/\.demeter__msg--assistant\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/background:\s*transparent/);
    expect(rule).toMatch(/border:\s*0/);
  });

  it("the reader's messages are tint chips, not brand blocks", () => {
    const rule = css().match(/\.demeter__msg--user\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/var\(--demeter-tint\)/);
    expect(rule).toMatch(/color:\s*var\(--demeter-ink\)/);
    expect(rule).not.toMatch(/var\(--demeter-terracotta\)/);
  });

  it("one language control at a time — the nav's links yield to the open rail's select", () => {
    // Owner catch (2026-08-22): with the rail open, the nav's language links
    // and the rail's language select were both on screen. Same dedup rule as
    // the brand and sign-in, pinned at the stylesheet.
    const s = css();
    expect(s).toMatch(/\.dmchat:has\(\.demeter__sidebar--open\) \.dmnav__langs \{ display: none; \}/);
  });

  it("the sidebar respects reduced motion", () => {
    const s = css();
    const reduced = s.slice(s.indexOf("prefers-reduced-motion"), s.length);
    expect(s).toMatch(/demeter__sidebar/);
    expect(reduced).toMatch(/demeter__sidebar[^}]*transition:\s*none/);
  });
});

// The auth probe must never break the chat: no Supabase env in jsdom, and
// the component still mounts signed-out. (This whole file mounting IS that
// test, but pin it explicitly so a thrown client is a failure, not a skip.)
describe("auth probe fails closed to signed-out", () => {
  it("mounts without Supabase env and shows the signed-out affordances", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = mountChat();
    // Rail open by default → the rail's foot carries the sign-in.
    expect(container.querySelector("#demeter-sidebar a[href*='/sign-in']")).toBeTruthy();
    spy.mockRestore();
  });
});
