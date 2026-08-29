// @vitest-environment jsdom
//
// Footer link targets per language (#837). The href() helper prefixed the
// Supporters link by language (/es/supporters) exactly like Verify and
// Questions — but no app/[lang]/supporters route exists, so the footer's
// "Patrocinadores"/"Nhà tài trợ"/"支持者" link 404'd from every localized
// page. Until a localized route exists, supporters gets the same
// always-canonical treatment as the legal documents. (Feedback was on that
// list until the launch-audit follow-up gave it app/[lang]/feedback — it is
// prefixed now, asserted below.)
//
// Verify turned out to have exactly the same defect, missed at the time
// because the fix looked at supporters alone: /es/verify, /vi/verify and
// /zh/verify never existed either. That link is the state directory — the page
// a non-English reader is most likely to want — so it 404'd for precisely the
// people it was for. It has since been given a real localized route and is
// prefixed again, which is the other half of the rule and is asserted below.
// The cases are tested together because the next path added to LINK_PATHS will
// make one mistake or the other.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { DemeterFooter } from "../DemeterFooter";
import { PAGE_COPY as T } from "../../lib/i18n/snap-page";

const hrefFor = (container: HTMLElement, path: string) =>
  [...container.querySelectorAll("a")]
    .map((a) => a.getAttribute("href"))
    .find((h) => h?.includes(path));


describe("footer links from localized pages (#837)", () => {
  afterEach(cleanup);

  // THE RULE, which outlived the two links that taught it: a path is linked
  // canonically for exactly as long as it has no localized route, and gets
  // prefixed the day it gets one. Supporters (#837) and Verify both 404'd
  // from every localized page by being on the wrong side of it. Neither is in
  // the footer any more, so the rule is asserted against what is.
  it("the legal documents stay canonical — none has a localized route", () => {
    for (const lang of ["es", "vi", "zh"] as const) {
      const { container } = render(<DemeterFooter lang={lang} />);
      for (const path of ["privacy", "terms", "safety"]) {
        expect(hrefFor(container, path), `${lang} ${path}`).toBe(`/${path}`);
      }
      cleanup();
    }
  });

  it("feedback IS prefixed now, because app/[lang]/feedback exists", () => {
    // It used to be canonical (no localized route); the launch-audit follow-up
    // shipped /[lang]/feedback, so it came off UNLOCALIZED in the same change.
    for (const lang of ["es", "vi", "zh"] as const) {
      const { container } = render(<DemeterFooter lang={lang} />);
      expect(hrefFor(container, "feedback"), lang).toBe(`/${lang}/feedback`);
      cleanup();
    }
  });

  it("states IS prefixed, because app/[lang]/states exists", () => {
    // The other half of the rule. A test that only checked the canonical ones
    // would still pass if href() stopped localizing anything at all.
    for (const lang of ["es", "vi", "zh"] as const) {
      const { container } = render(<DemeterFooter lang={lang} />);
      expect(hrefFor(container, "states"), lang).toBe(`/${lang}/states`);
      cleanup();
    }
  });

  it("and English is un-prefixed throughout", () => {
    const { container } = render(<DemeterFooter />);
    for (const path of ["states", "privacy", "terms", "safety", "feedback"]) {
      expect(hrefFor(container, path), path).toBe(`/${path}`);
    }
  });
});

describe("the footer is one row of five", () => {
  it("carries exactly the five destinations that survived", () => {
    // "Application questions" and "Supporters" were removed (owner,
    // 2026-08-27). At five short nouns the named groups became more chrome
    // than content, so the headings went with them.
    const { container } = render(<DemeterFooter />);
    const links = [...container.querySelectorAll(".dmft__link")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/states",
      "/privacy",
      "/terms",
      "/safety",
      "/feedback",
    ]);
    expect(container.querySelectorAll(".dmft__grouphead")).toHaveLength(0);
  });

  it("no longer offers supporters or the application questions", () => {
    const { container } = render(<DemeterFooter />);
    const html = container.innerHTML;
    expect(html).not.toContain("/supporters");
    expect(html).not.toContain("/questions");
  });

  it("uses NOUNS, not the in-page sentence", () => {
    const { container } = render(<DemeterFooter />);
    const text = container.textContent ?? "";
    expect(text).toContain(T.en.footerStates);
    expect(text).not.toContain(T.en.statesLink);
  });

  it("carries one mission line, not the product lede again", () => {
    const { container } = render(<DemeterFooter />);
    const mission = container.querySelector(".dmft__mission")!;
    expect(mission.textContent).toBe(T.en.footerMission);
    expect(mission.textContent).not.toBe(T.en.productLede);
  });

  it("keeps every language complete", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      for (const key of ["footerStates", "footerMission"] as const) {
        expect(T[lang][key]?.trim(), `${lang}.${key}`).toBeTruthy();
      }
      expect(T[lang].directory.howItWorks.trim(), `${lang}.howItWorks`).toBeTruthy();
    }
  });
});
