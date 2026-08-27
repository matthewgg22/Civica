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
import { VERIFIED_STATES, ANSWER_LANGS } from "@civica/demeter-engine/packs";

import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";

afterEach(cleanup);

// jsdom has no Element.scrollTo; the transcript's follow-scroll calls it on
// every render (same stub as the other DemeterChat suites).
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

function mountChat(initialMessages: Array<{ role: "user" | "assistant"; content: string }> = []) {
  return render(
    <DemeterChat
      states={VERIFIED_STATES}
      initialState={null}
      initialQuestion={null}
      initialMessages={initialMessages}
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
    // A <details> disclosure since 2026-08-22, not a native <select> — the OS
    // dropdown ignored the design system. What is pinned is the INVARIANT,
    // not the element: the picker is in the drawer, it offers every answer
    // language, and the chrome row has no second copy of it.
    // ALL FOUR INLINE since 2026-08-26 — no disclosure at all. The invariant
    // is unchanged: the picker is in the drawer, it offers every answer
    // language, and the chrome row has no second copy.
    const picker = drawer.querySelector(".demeter__langrow")!;
    expect(picker).toBeTruthy();
    expect(picker.querySelectorAll("button.demeter__langpick").length).toBe(ANSWER_LANGS.length);
    expect(container.querySelector(".demeter__head select")).toBeNull();
    expect(container.querySelector(".demeter__head .demeter__langrow")).toBeNull();
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
  it("the empty state never asks for a name", () => {
    // THE ASK-STATE LINE IS GONE (owner, 2026-08-26): it captioned a picker
    // that already says "Your state". What must NOT come back is the thing
    // this test was really built for — the retention line says avoid names, so
    // the greeting may never ask for one.
    const { container } = mountChat();
    const empty = container.querySelector(".demeter__empty")!;
    expect(empty.textContent!.toLowerCase()).not.toMatch(/your name|first name/);
    expect(empty.querySelector(".demeter__emptyask")).toBeNull();
  });

  it("the ask-state line exists in all four languages and never asks a name", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      // The line is retired, but the copy key stays until every locale's
      // replacement is settled — what is pinned is that NO empty-state string
      // asks for a name, which is the retention promise, not this one line.
      const s = [T[lang].emptyTitle, T[lang].emptyWhatIsSnap, T[lang].emptyLede, T[lang].emptyModes].join(" ");
      expect(s.toLowerCase(), lang).not.toMatch(/your name|nombre completo|tên của bạn|您的姓名/);
    }
  });

  it("keeps the framing block — the redesign restyles it, it does not delete it", () => {
    mountChat();
    expect(screen.getByText(T.en.emptyTitle)).toBeTruthy();
    // The mode labels are wrapped in their own elements now, so the sentence
    // is split across nodes — match on the paragraph's assembled text.
    const modes = document.querySelector(".demeter__emptymodes");
    expect(modes?.textContent).toBe(T.en.emptyModes);
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
    expect(container.querySelectorAll(".demeter__langrow").length).toBe(1);
  });

  it("the chrome row carries the skip link and a boxed sign-in, and nothing else", () => {
    // What the retired nav is replaced by: the composer skip target (a
    // keyboard reader would otherwise cross the whole rail to reach the box)
    // and sign-in. The "What is SNAP?" link went too (owner, 2026-08-22) —
    // it sent someone out of the chat to read a definition that the empty
    // state and the first-visit card now both carry.
    const { container } = mountChat();
    const skip = container.querySelector("a.demeter__skip")!;
    expect(skip.getAttribute("href")).toBe("#demeter-composer");
    expect(container.querySelector("form#demeter-composer")).toBeTruthy();
    expect(container.querySelector(".demeter__headright a.demeter__navlink")).toBeNull();
  });

  it("the rail's bottom line holds language and settings, and new-conversation says what it does", () => {
    // Owner rec (2026-08-22): the rail's two full-width buttons are retired
    // and the row at its foot acts while the body tracks. /chat still has no
    // nav and no footer, so the gear remains the only route to the standing
    // pages from inside the tool.
    //
    // NEW-CONVERSATION LEFT THAT ROW (owner, 2026-08-26). It was a bare "+"
    // immediately left of "EN / ES / VI / 中文", so the rail's one unlabelled
    // glyph sat inside the language picker and read as part of it — and on a
    // first visit it rendered DISABLED, a greyed borderless plus beside four
    // language codes. It carries its own words now, above the foot, and only
    // once there is something to end.
    const { container } = mountChat();
    const row = container.querySelector("#demeter-sidebar .demeter__railfoot")!;
    expect(row).toBeTruthy();
    expect(row.querySelector("button.demeter__railicon"), "the bare + is gone").toBeNull();
    expect(
      container.querySelector(".demeter__railnew"),
      "nothing to end yet, so nothing offers to end it",
    ).toBeNull();

    // With a conversation, it appears — labelled, and above the foot.
    cleanup();
    const withChat = mountChat([
      { role: "user", content: "Do I qualify?" },
      { role: "assistant", content: "It depends on your household size." },
    ]).container;
    const nw = withChat.querySelector("button.demeter__railnew")!;
    expect(nw, "the control is there once there is a conversation").toBeTruthy();
    expect(nw.getAttribute("aria-label")).toBe(T.en.clear);
    // Its words are VISIBLE, not only announced — that was the whole defect.
    expect(nw.textContent).toContain(T.en.clear);
    expect(
      nw.nextElementSibling?.classList.contains("demeter__railfoot"),
      "it sits directly above the foot",
    ).toBe(true);
    expect(row.querySelector(".demeter__langrow")).toBeTruthy();
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

  it("puts the rail on the page's own white, with the cards held by hairlines", () => {
    // The rail was the last surface still on the old grey ground: #F6F5F3
    // across 366px of a 1280px window, a third of the screen reading darker
    // than the product it frames. The white-ground decision (2026-08-21)
    // moved card separation to hairlines, and every card in this rail already
    // carries one — so the tint was no longer doing the job it was kept for.
    const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");
    const rail = css.match(/^\.demeter__sidebar\s*\{[^}]*\}/m)?.[0] ?? "";
    expect(rail, "the rail rule is declared").not.toBe("");
    expect(rail).toMatch(/background:\s*var\(--demeter-paper\)/);
    expect(rail, "the right edge is what separates rail from thread now").toMatch(
      /border-right:\s*1px solid var\(--demeter-rule\)/,
    );
    // The cards that sit on it must each carry their own edge, or whitening
    // the ground would dissolve them into it.
    for (const sel of [".demeter__sidebarlink", ".demeter__railicon", ".demeter__railnew"]) {
      const rule = css.match(new RegExp(`^\\${sel}\\s*\\{[^}]*\\}`, "m"))?.[0] ?? "";
      expect(rule, `${sel} is declared`).not.toBe("");
      expect(rule, `${sel} needs a hairline on a white ground`).toMatch(/border:\s*1px solid/);
    }
  });

  it("lets the layout space the rail's tagline instead of six negative margins", () => {
    // `.demeter__sbtag` had SIX rule blocks, each a later session pulling the
    // label further up (-0.75 -> -0.85 -> -1.15 -> -1.4rem) because it was
    // rendered outside `.demeter__sbident` — the flex column built to hold it,
    // sitting empty. It is back inside that column, so the 0.1rem gap does the
    // spacing and no negative margin is needed at all.
    const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");
    const blocks = css.match(/^\.demeter__sbtag\s*\{[^}]*\}/gm) ?? [];
    expect(blocks.length, "one rule, not six").toBe(1);
    expect(blocks[0], "the layout spaces it now").not.toMatch(/margin-top:\s*-/);

    const { container } = mountChat();
    const tag = container.querySelector(".demeter__sbtag")!;
    expect(tag, "the tagline renders").toBeTruthy();
    expect(
      tag.parentElement?.classList.contains("demeter__sbident"),
      "it sits in the column built for it",
    ).toBe(true);
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
