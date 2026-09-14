// @vitest-environment jsdom
//
// The crisis control belongs on BOTH front doors.
//
// It shipped on /chat only, which left it off the page the bare domain
// actually redirects to — so the most likely first screen for someone with no
// food had no route to a food bank above the fold. /screen/ask has no sign-in,
// so there was no right-hand cluster to put it beside; .dmpage__topbar makes
// one and holds it in the same screen position /chat uses.
//
// Mounted from ONE component on both surfaces: two copies would agree only
// until someone edited one of them, and the thing they would drift on is the
// crisis path.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { FoodNowButton } from "../../../../components/FoodNowButton";
import { FOODNOW_T, FOOD_BANK_URL, URL_211 } from "../../../../lib/i18n/demeter-foodnow-copy";
import { readFileSync } from "node:fs";
import { join } from "node:path";

afterEach(() => cleanup());

const ASK = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const ASK_LOCALIZED = readFileSync(
  join(__dirname, "..", "..", "..", "[lang]", "screen", "ask", "page.tsx"),
  "utf8",
);

describe("the ask pages carry the crisis control", () => {
  it("mounts it on the English front door, in the header row", () => {
    expect(ASK).toMatch(/<FoodNowButton\s+lang="en"\s*\/>/);
    expect(ASK, "not inside the topbar row").toMatch(
      /dmpage__topbar[\s\S]*<FoodNowButton/,
    );
  });

  it("mounts it on the localized front doors, in the reader's language", () => {
    // lang={l}, not a hardcoded "en": a reader who needs food this week needs
    // it in their own language too.
    expect(ASK_LOCALIZED).toMatch(/<FoodNowButton\s+lang=\{l\}\s*\/>/);
  });

  it("is the same component the chat mounts, not a second copy", () => {
    const chat = readFileSync(
      join(__dirname, "..", "..", "..", "..", "components", "DemeterChat.tsx"),
      "utf8",
    );
    expect(chat).toMatch(/<FoodNowButton\s+lang=\{lang\}\s*\/>/);
    // The inline version is gone; a re-inlined copy would reintroduce the drift.
    expect(chat).not.toMatch(/className="demeter__foodnow"/);
  });

  it("opens the same dialog with both resources, wherever it is mounted", () => {
    const c = render(<FoodNowButton lang="en" />).container;
    fireEvent.click(c.querySelector("button.demeter__foodnow")!);
    const hrefs = [...document.querySelectorAll(".dmfn__card a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain(FOOD_BANK_URL);
    expect(hrefs).toContain(URL_211);
  });

  it("labels itself in every locale it can be mounted in", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      cleanup();
      const c = render(<FoodNowButton lang={lang} />).container;
      const btn = c.querySelector("button.demeter__foodnow")!;
      expect(btn.getAttribute("aria-label")).toBe(FOODNOW_T[lang].label);
    }
  });

  it("styles the control unscoped, so it renders outside .dmchat", () => {
    const css = readFileSync(
      join(__dirname, "..", "..", "..", "globals.css"),
      "utf8",
    );
    // The regression: a .dmchat-scoped rule renders an unstyled button on the
    // front door, which has no .dmchat ancestor.
    expect(css).not.toMatch(/\.dmchat\s+\.demeter__foodnow/);
    expect(css).toMatch(/(^|\n)\.demeter__foodnow\s*\{/);
  });
});
