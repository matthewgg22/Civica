// @vitest-environment jsdom
//
// The hero mini chat + the deep-ink band (owner redesign, 2026-08-21;
// inspiration: FeelBetterBot's landing chat card and band treatment).
//
// THE MINI CHAT replaces the cycling example card: the real way in beats a
// demo of it. It is a plain GET form aimed at /chat — the handoff works with
// no JavaScript at all (progressive enhancement; chips need JS, typing does
// not), and there is still exactly ONE chat: nothing here answers, it only
// carries the question and state to the room where answers happen.
//
// ONBOARDING IS STATE-ONLY (decided over the Pi inspiration's name-first
// open): Demeter's own retention line says "avoid names", and a name we
// invited is a name we keep. The greeting asks for the one thing answers
// actually depend on.
//
// THE STARTERS are the three vetted example questions — the same exchanges
// the old card cycled, whose answers all graded CERTAIN through the live
// pipeline. They populate the composer rather than firing (a suggestion you
// can edit is a suggestion; one that sends on touch is a decision made for
// you — same rule as the chat's own suggestions).
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

import { SnapOrientation, SnapDetail } from "../components/SnapOverview";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import { readFileSync } from "node:fs";
import { join } from "node:path";

afterEach(cleanup);

describe("the hero mini chat", () => {
  it("is a no-JS-safe GET form aimed at the one chat", () => {
    const { container } = render(<SnapOrientation states={VERIFIED_STATES} />);
    const form = container.querySelector("form.dmc");
    expect(form).toBeTruthy();
    expect(form!.getAttribute("action")).toBe("/chat");
    expect((form!.getAttribute("method") ?? "get").toLowerCase()).toBe("get");
    expect(form!.querySelector("input[name='q']")).toBeTruthy();
    expect(form!.querySelector("select[name='state']")).toBeTruthy();
    expect(form!.querySelector("button[type='submit']")).toBeTruthy();
  });

  it("asks for the state, not a name, and offers every verified jurisdiction", () => {
    const { container } = render(<SnapOrientation states={VERIFIED_STATES} />);
    const text = container.querySelector(".dmc")!.textContent ?? "";
    expect(text).toContain(PAGE_COPY.en.miniChat.greeting);
    expect(text.toLowerCase()).not.toMatch(/your name|first name/);
    const select = container.querySelector("select[name='state']")!;
    // Every verified jurisdiction plus the federal "" option.
    expect(select.querySelectorAll("option").length).toBe(VERIFIED_STATES.length + 1);
    expect(select.querySelector("option[value='']")).toBeTruthy();
  });

  it("preselects the geo-hinted state when one is passed", () => {
    const { container } = render(
      <SnapOrientation states={VERIFIED_STATES} initialState="CA" />,
    );
    const select = container.querySelector("select[name='state']") as HTMLSelectElement;
    expect(select.value).toBe("CA");
  });

  it("offers the three vetted questions as starters that populate, not send", () => {
    const { container } = render(<SnapOrientation states={VERIFIED_STATES} />);
    const chips = [...container.querySelectorAll("button.dmc__starter")];
    expect(chips.length).toBe(3);
    for (const [i, chip] of chips.entries()) {
      expect(chip.getAttribute("type"), `chip ${i} must not submit`).toBe("button");
      expect(chip.textContent).toBe(PAGE_COPY.en.example.items[i]!.q);
    }
    fireEvent.click(chips[1]!);
    const input = container.querySelector("input[name='q']") as HTMLInputElement;
    expect(input.value).toBe(PAGE_COPY.en.example.items[1]!.q);
  });

  it("routes localized pages to their own chat", () => {
    const { container } = render(
      <SnapOrientation lang="es" states={VERIFIED_STATES} />,
    );
    expect(container.querySelector("form.dmc")!.getAttribute("action")).toBe("/es/chat");
  });

  it("the rotator is gone — no cycling stack, no dots", () => {
    const { container } = render(<SnapOrientation states={VERIFIED_STATES} />);
    expect(container.querySelector(".dmex__stack")).toBeNull();
    expect(container.querySelector(".dmex__dot")).toBeNull();
  });

  it("carries the mini-chat copy in every language, with no invented numbers", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      const mc = PAGE_COPY[lang].miniChat;
      for (const [k, v] of Object.entries(mc)) {
        expect(String(v).trim(), `${lang}.${k}`).not.toBe("");
        expect(String(v), `${lang}.${k} no dollars`).not.toMatch(/\$\s?\d/);
      }
    }
  });
});

describe("the deep-ink band (What SNAP is)", () => {
  it("wraps the definition in a band inside the section", () => {
    const { container } = render(<SnapDetail states={VERIFIED_STATES} />);
    const band = container.querySelector("section .dmband");
    expect(band).toBeTruthy();
    // The four facts live inside the band.
    expect(band!.querySelectorAll(".dmx__def").length).toBeGreaterThanOrEqual(4);
    // The USDA attribution box stays OUTSIDE the band — it is a legal
    // disclaimer, not brand theater.
    expect(band!.textContent).not.toMatch(/USDA|not affiliated/i);
  });

  it("the band is deep ink with light type — Demeter's own palette, no borrowed pine", () => {
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
    const band = css.slice(css.indexOf(".dmband"));
    expect(band).toMatch(/\.dmband\s*\{[^}]*background:\s*var\(--demeter-ink\)/);
    // Light-on-dark overrides exist for the copy inside it.
    expect(band).toMatch(/\.dmband\s+\.dmx__h2/);
    expect(band).toMatch(/\.dmband\s+\.dmx__def/);
  });
});
