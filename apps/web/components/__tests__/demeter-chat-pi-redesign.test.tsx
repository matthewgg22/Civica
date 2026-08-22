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

describe("the sidebar drawer", () => {
  it("toggles from the chat's top-left, closes on Escape, and is inert when closed", () => {
    const { container } = mountChat();
    const toggle = container.querySelector("button.demeter__sidebartoggle")!;
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const drawer = container.querySelector("#demeter-sidebar")!;
    expect(drawer.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(drawer.getAttribute("aria-hidden")).toBe("false");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("carries the saved-conversations link and, signed out, the sign-in invitation", () => {
    const { container } = mountChat();
    fireEvent.click(container.querySelector("button.demeter__sidebartoggle")!);
    const drawer = container.querySelector("#demeter-sidebar")!;
    expect(drawer.querySelector("a[href*='/screen/saved']")).toBeTruthy();
    const signin = drawer.querySelector("a[href*='/sign-in']");
    expect(signin).toBeTruthy();
    expect(signin!.getAttribute("href")).toContain("next=");
  });
});

describe("sign-in at the top right", () => {
  it("shows a sign-in link in the chat header while signed out", () => {
    const { container } = mountChat();
    const head = container.querySelector(".demeter__head")!;
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
    expect(container.querySelector(".demeter__head a[href*='/sign-in']")).toBeTruthy();
    spy.mockRestore();
  });
});
