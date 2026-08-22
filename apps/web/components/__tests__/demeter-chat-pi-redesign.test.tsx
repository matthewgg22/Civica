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

  it("signed out, the saved-conversations entry IS the sign-in invitation", () => {
    // Owner rec (2026-08-22): the rail's foot sign-in button is gone. Rather
    // than a bare "Saved conversations" link plus a separate invitation two
    // controls away, the entry says what signing in buys and goes there.
    const { container } = mountChat();
    const entry = container.querySelector("#demeter-sidebar a.demeter__sblabel")!;
    expect(entry.getAttribute("href")).toContain("/sign-in");
    expect(entry.getAttribute("href")).toContain("next=");
    expect(entry.className).toContain("demeter__sblabel--signin");
    expect(entry.textContent).toContain(T.en.sidebarSavedSignin);
    // And the retired foot button really is gone.
    expect(container.querySelector(".demeter__sidebarsignin")).toBeNull();
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
  it("offers sign-in at the top right in BOTH rail states, and in the settings bar", () => {
    // SUPERSEDES the earlier one-sign-in-on-screen rule (owner rec, same
    // day): the top right is universal — it does not move or vanish when
    // the rail opens — and the rail's settings bar groups a second one with
    // privacy and feedback, where someone hunting account things looks.
    const { container } = mountChat();
    const head = container.querySelector(".demeter__head")!;
    const drawer = container.querySelector("#demeter-sidebar")!;
    expect(head.querySelector("a.demeter__signin[href*='/sign-in']")).toBeTruthy();
    expect(drawer.querySelector("a[href*='/sign-in']")).toBeTruthy();
    // Still there with the rail closed — that is what "universal" means.
    fireEvent.click(drawer.querySelector("button.demeter__sidebartoggle")!);
    expect(head.querySelector("a.demeter__signin[href*='/sign-in']")).toBeTruthy();
  });
});

describe("sign-in opens over the chat (owner rec 2026-08-22)", () => {
  it("the chrome link opens the modal instead of navigating — but keeps its href", () => {
    // The ROUTE stays the fallback: magic-link returns, OAuth error
    // redirects, shared links and no-JS all still land on /sign-in. The
    // click handler only takes over when JavaScript is there.
    const { container } = mountChat();
    const link = container.querySelector(".demeter__head a.demeter__signin") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("/sign-in");
    expect(container.querySelector(".dmsi")).toBeNull();
    fireEvent.click(link, { button: 0 });
    const modal = container.querySelector(".dmsi")!;
    expect(modal).toBeTruthy();
    expect(modal.querySelector("[role='dialog']")?.getAttribute("aria-modal")).toBe("true");
  });

  it("a modifier-click still means open-the-route", () => {
    const { container } = mountChat();
    const link = container.querySelector(".demeter__head a.demeter__signin")!;
    fireEvent.click(link, { metaKey: true, button: 0 });
    expect(container.querySelector(".dmsi")).toBeNull();
  });

  it("Escape closes it", () => {
    const { container } = mountChat();
    fireEvent.click(container.querySelector(".demeter__head a.demeter__signin")!, { button: 0 });
    expect(container.querySelector(".dmsi")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector(".dmsi")).toBeNull();
  });

  it("the rail's saved-conversations entry opens the same modal", () => {
    const { container } = mountChat();
    fireEvent.click(container.querySelector("#demeter-sidebar a.demeter__sblabel")!, { button: 0 });
    expect(container.querySelector(".dmsi")).toBeTruthy();
  });

  it("focus starts in the card, cycles inside it, and returns to the opener on close", () => {
    const { container } = mountChat();
    const opener = container.querySelector(".demeter__head a.demeter__signin") as HTMLElement;
    opener.focus();
    fireEvent.click(opener, { button: 0 });
    const card = container.querySelector(".dmsi__card") as HTMLElement;
    expect(document.activeElement).toBe(card);

    // Tab from the card lands on the first control INSIDE it, not on
    // whatever sits behind the overlay.
    fireEvent.keyDown(window, { key: "Tab" });
    expect(card.contains(document.activeElement)).toBe(true);

    // Shift+Tab from the first control wraps to the last, still inside.
    const focusable = [...card.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])')];
    focusable[0]!.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(card.contains(document.activeElement)).toBe(true);

    // Closing hands focus back to what opened it.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector(".dmsi")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("the chat is NOT filtered — the overlay blurs it, so the fixed rail stays put", () => {
    // A `filter` on the chat would make it the containing block for the
    // fixed rail and chrome row, jumping both the moment the card opened.
    // The blur belongs to the overlay's backdrop-filter instead.
    const s = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");
    expect(s).toMatch(/\.dmsi\s*\{[^}]*backdrop-filter:\s*blur/);
    expect(s).not.toMatch(/\.demeter--behindmodal/);
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

  it("no site nav on /chat — so one brand, one language control, structurally", () => {
    // EVOLVED from a CSS dedup rule. The duplicate brand and duplicate
    // language control were both symptoms of the site nav riding a surface
    // that already has its own chrome; the owner's call (2026-08-22) was to
    // remove the nav from /chat entirely. Asserted at the SOURCE rather than
    // the stylesheet: a hidden nav is still a nav, and this is the fact that
    // makes the dedup rules unnecessary.
    for (const page of ["app/chat/page.tsx", "app/[lang]/chat/page.tsx"]) {
      const src = readFileSync(join(__dirname, "..", "..", page), "utf8");
      expect(src, page).not.toMatch(/DemeterNav/);
    }
    // And the rail still carries the one language control.
    const { container } = mountChat();
    expect(container.querySelectorAll("select.demeter__lang-select").length).toBe(1);
  });

  it("the chrome row carries the skip link, the reference page, and a boxed sign-in", () => {
    // What the retired nav is replaced by: the composer skip target (a
    // keyboard reader would otherwise cross the whole rail to reach the
    // box), the reference page, and sign-in — the rest of the nav's job
    // moved into the rail.
    const { container } = mountChat();
    const skip = container.querySelector("a.demeter__skip")!;
    expect(skip.getAttribute("href")).toBe("#demeter-composer");
    expect(container.querySelector("form#demeter-composer")).toBeTruthy();
    expect(container.querySelector(".demeter__headright a.demeter__navlink")).toBeTruthy();
  });

  it("the rail's bottom line holds new-conversation, language and settings", () => {
    // Owner rec (2026-08-22): the rail's two full-width buttons are retired
    // and these three share one row at its foot — the body tracks, the row
    // acts. /chat still has no nav and no footer, so the gear remains the
    // only route to the standing pages from inside the tool.
    const { container } = mountChat();
    const row = container.querySelector("#demeter-sidebar .demeter__railfoot")!;
    expect(row).toBeTruthy();
    expect(row.querySelector("button.demeter__railicon")?.getAttribute("aria-label")).toBe(T.en.clear);
    expect(row.querySelector("select.demeter__lang-select")).toBeTruthy();
    const gear = row.querySelector("details.demeter__gear")!;
    expect(gear.querySelector("a[href='/privacy']")).toBeTruthy();
    expect(gear.querySelector("a[href*='/feedback']")).toBeTruthy();
    // A native disclosure, so Escape and outside-click need no JS.
    expect(gear.querySelector("summary")).toBeTruthy();
    // The retired buttons are really gone, and the gear is not left behind
    // in the chrome row as a second copy.
    expect(container.querySelector(".demeter__sidebtns")).toBeNull();
    expect(container.querySelector(".demeter__head details.demeter__gear")).toBeNull();
  });

  it("Save is still MOUNTED with its button hidden — not deleted", () => {
    // The rail's Save button went, but the component owns the pendingSave
    // round trip after sign-in AND the save the transcript's nudge fires
    // through triggerSave. Unmounting it to hide a button would break both
    // silently, so this pins the distinction: no button in the DOM, and the
    // component still rendered with showButton={false}.
    //
    // Asserted at the source because DemeterSave renders null until there is
    // an answer to save — a DOM check on a fresh chat proves nothing either
    // way.
    const { container } = mountChat();
    expect(container.querySelector("button.demeter__save")).toBeNull();
    const src = readFileSync(join(__dirname, "..", "DemeterChat.tsx"), "utf8");
    expect(src).toMatch(/<DemeterSave\s+showButton=\{false\}/);
    expect(src).toMatch(/triggerSave=\{saveSignal\}/);
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
