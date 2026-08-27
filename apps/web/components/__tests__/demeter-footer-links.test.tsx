// @vitest-environment jsdom
//
// Footer link targets per language (#837). The href() helper prefixed the
// Supporters link by language (/es/supporters) exactly like Verify and
// Questions — but no app/[lang]/supporters route exists, so the footer's
// "Patrocinadores"/"Nhà tài trợ"/"支持者" link 404'd from every localized
// page. Until a localized route exists, supporters gets the same
// always-canonical treatment as privacy and feedback.
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

const supportersHref = (container: HTMLElement) => hrefFor(container, "supporters");

describe("footer links from localized pages (#837)", () => {
  afterEach(cleanup);

  it("supporters stays canonical from every language — the localized route does not exist", () => {
    for (const lang of ["es", "vi", "zh"] as const) {
      const { container } = render(<DemeterFooter lang={lang} />);
      expect(supportersHref(container), lang).toBe("/supporters");
      cleanup();
    }
  });

  it("and from English too", () => {
    const { container } = render(<DemeterFooter />);
    expect(supportersHref(container)).toBe("/supporters");
  });

  it("states IS prefixed, now that app/[lang]/states exists", () => {
    // This assertion is the reverse of what it was, deliberately. /verify was
    // on the canonical list because it had no localized route and its link
    // 404'd from every non-English page. The page is /states now and the
    // localized route was built, so prefixing is correct again — and a path
    // must come OFF the canonical list the day it gets a route, or the
    // translated page nobody can reach is the new bug.
    for (const lang of ["es", "vi", "zh"] as const) {
      const { container } = render(<DemeterFooter lang={lang} />);
      expect(hrefFor(container, "states"), lang).toBe(`/${lang}/states`);
      cleanup();
    }
  });

  it("and questions still IS prefixed, because that route exists", () => {
    // The point of the list is that it names the paths WITHOUT a localized
    // route. A test that only checked the canonical ones would still pass if
    // someone emptied href() out entirely.
    const { container } = render(<DemeterFooter lang="es" />);
    expect(hrefFor(container, "questions")).toBe("/es/questions");
  });
});

describe("the footer is grouped, not one column of seven", () => {
  it("has three named groups", () => {
    // Two columns (1.4fr / 1fr) gave the brand more room than three lines
    // could fill and stacked every link down the right, so the middle was
    // empty and the right was a menu.
    const { container } = render(<DemeterFooter />);
    const groups = [...container.querySelectorAll(".dmft__group")];
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.querySelector(".dmft__grouphead")!.textContent)).toEqual([
      T.en.footerGroupReference,
      T.en.footerGroupLegal,
      T.en.footerGroupAbout,
    ]);
  });

  it("every link is inside a group — none left loose", () => {
    const { container } = render(<DemeterFooter />);
    const all = container.querySelectorAll(".dmft__link");
    const grouped = container.querySelectorAll(".dmft__group .dmft__link");
    expect(all.length).toBe(grouped.length);
    expect(all.length).toBe(7);
  });

  it("uses NOUNS, not the in-page sentences", () => {
    // The ragged mix of "See the states we have checked" beside "Privacy" was
    // the footer's real slop tell. The long forms still earn their place
    // in-page, where they are the call to action.
    const { container } = render(<DemeterFooter />);
    const text = container.textContent ?? "";
    expect(text).toContain(T.en.footerStates);
    expect(text).not.toContain(T.en.statesLink);
    expect(text).toContain(T.en.footerQuestions);
  });

  it("carries one mission line, not the product lede again", () => {
    const { container } = render(<DemeterFooter />);
    const mission = container.querySelector(".dmft__mission")!;
    expect(mission.textContent).toBe(T.en.footerMission);
    expect(mission.textContent).not.toBe(T.en.productLede);
  });

  it("keeps every language complete", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      for (const key of [
        "footerStates", "footerQuestions", "footerMission",
        "footerGroupReference", "footerGroupLegal", "footerGroupAbout",
      ] as const) {
        expect(T[lang][key]?.trim(), `${lang}.${key}`).toBeTruthy();
      }
    }
  });
});