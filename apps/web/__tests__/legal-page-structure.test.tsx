// @vitest-environment jsdom
//
// The three legal documents share one renderer, so every one of these is a
// fact about /privacy, /terms and /safety at once.
//
// What they pin is a set of things that look like styling and are not: a
// contents list that printed its numbers twice, a "current document" chip
// styled louder than everything around it, capitalised blocks that a future
// tidy-up would sentence-case, and a page whose only exit was three screens
// below an arbitration clause.
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, cleanup, within } from "@testing-library/react";
import { LegalPage } from "../components/LegalPage";
import { DOCUMENTS, TERMS_OF_SERVICE as TERMS } from "../lib/legal";

// Every shipped document, from the registry — so a fourth one is covered the
// day it is added rather than the day someone remembers this file.
const DOCS = DOCUMENTS;
const CSS = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");

afterEach(cleanup);

describe("the contents list", () => {
  it("does not number every entry twice", () => {
    // The headings carry their own numbers ("1. This agreement"), and the list
    // was an <ol> with visible markers, so it rendered "1. 1. This agreement".
    const { container } = render(<LegalPage doc={TERMS} />);
    const first = container.querySelector(".lgl__toc-list li")!;
    expect(first.textContent).toBe(TERMS.sections[0].heading);
    expect(first.textContent).not.toMatch(/^\d+\.\s*\d+\./);
  });

  it("suppresses the marker in CSS rather than stripping numbers from headings", () => {
    // The numbers must stay IN the text: the body cross-references them
    // ("Section 13.10"), and a list marker is not selectable or searchable.
    expect(CSS).toMatch(/\.lgl__toc-list\s*\{[^}]*list-style:\s*none/);
    for (const doc of DOCS) {
      const numbered = doc.sections.filter((s) => /^\d+\./.test(s.heading));
      if (numbered.length) expect(numbered[0].heading).toMatch(/^\d+\./);
    }
  });

  it("comes BEFORE the document in the DOM, wherever it sits visually", () => {
    // Grid moves it into the right margin on desktop. Reading order — screen
    // readers, and the phone layout — must still be contents, then text.
    const { container } = render(<LegalPage doc={TERMS} />);
    const html = container.innerHTML;
    expect(html.indexOf("lgl__toc")).toBeLessThan(html.indexOf("lgl__body"));
  });

  it("links every section, and every link has a target", () => {
    for (const doc of DOCS) {
      const { container } = render(<LegalPage doc={doc} />);
      const links = [...container.querySelectorAll(".lgl__toc-list a")];
      expect(links).toHaveLength(doc.sections.length);
      for (const a of links) {
        const id = a.getAttribute("href")!.slice(1);
        expect(container.querySelector(`#${id}`), `${doc.slug} #${id}`).toBeTruthy();
      }
      cleanup();
    }
  });
});

describe("the document switcher", () => {
  it("does not link the document you are already reading", () => {
    for (const doc of DOCS) {
      const { container } = render(<LegalPage doc={doc} />);
      const current = container.querySelector(".lgl__docnav-current")!;
      expect(current.tagName).toBe("SPAN");
      expect(current.getAttribute("aria-current")).toBe("page");
      expect(container.querySelectorAll(".lgl__docnav-link")).toHaveLength(2);
      cleanup();
    }
  });

  it("is not a filled control", () => {
    // Three separate agreements, not three tabs of one — and the current item
    // was styled as the loudest thing on a page you are already on.
    expect(CSS).not.toMatch(/\.lgl__docnav-link\.is-current/);
  });
});

describe("the way out", () => {
  it("every legal page has a back link, first", () => {
    for (const doc of DOCS) {
      const { container } = render(<LegalPage doc={doc} />);
      const back = container.querySelector("a.vback")!;
      expect(back.getAttribute("href")).toBe("/chat");
      const firstLink = container.querySelector("a")!;
      expect(firstLink).toBe(back);
      cleanup();
    }
  });

  it("anchors do not clear a nav these pages never had", () => {
    // scroll-margin-top was 5rem, compensating for a sticky site nav that is
    // not on these pages, so every contents jump landed 80px low.
    const m = CSS.match(/\.lgl__section\s*\{[^}]*scroll-margin-top:\s*([\d.]+)rem/);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBeLessThan(3);
  });
});

describe("the capitalised blocks", () => {
  it("are still capitalised", () => {
    // NOT a styling choice. The warranty disclaimer and the arbitration and
    // class-action waiver are capitalised to meet conspicuousness
    // requirements; sentence-casing them would weaken the document. If this
    // fails, someone tidied up a legal control.
    const shouty = TERMS.sections
      .flatMap((s) => s.blocks)
      .filter((b): b is Extract<typeof b, { kind: "callout" }> => b.kind === "callout")
      .filter((b) => b.tone === "warning");
    expect(shouty.length).toBeGreaterThan(0);
    const caps = shouty.filter((b) => b.text === b.text.toUpperCase());
    expect(caps.length).toBeGreaterThan(0);
  });

  it("are given a shorter measure and more leading, which is the part that helps", () => {
    expect(CSS).toMatch(/\.lgl__callout--warning\s*\{[^}]*max-width:\s*\d+ch/);
    expect(CSS).toMatch(/\.lgl__callout--warning\s*\{[^}]*line-height:\s*1\.[5-9]/);
  });
});

describe("the reading column", () => {
  it("never widens past its measure, however wide the page gets", () => {
    // The empty half of a wide screen is an argument for putting something in
    // it, not for longer lines.
    expect(CSS).toMatch(/\.lgl\s*\{[^}]*max-width:\s*680px/);
    expect(CSS).toMatch(/grid-template-columns:\s*minmax\(0,\s*680px\)/);
  });
});

describe("all three documents render", () => {
  it.each(DOCS.map((d) => [d.slug, d] as const))("%s", (_slug, doc) => {
    render(<LegalPage doc={doc} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(doc.title);
    const nav = screen.getByRole("navigation", { name: "Contents" });
    expect(within(nav).getAllByRole("link").length).toBe(doc.sections.length);
  });
});
