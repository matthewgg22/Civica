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
// /zh/verify have never existed either. That link is the state directory —
// the page a non-English reader is most likely to want — so it 404'd for
// precisely the people it was for. The two cases are tested together now,
// because the next path added to LINK_PATHS will make the same mistake.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { DemeterFooter } from "../DemeterFooter";

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

  it("verify stays canonical from every language — /es/verify has never existed", () => {
    for (const lang of ["es", "vi", "zh"] as const) {
      const { container } = render(<DemeterFooter lang={lang} />);
      expect(hrefFor(container, "verify"), lang).toBe("/verify");
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
