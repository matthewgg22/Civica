// @vitest-environment jsdom
//
// Footer link targets per language (#837). The href() helper prefixed the
// Supporters link by language (/es/supporters) exactly like Verify and
// Questions — but no app/[lang]/supporters route exists, so the footer's
// "Patrocinadores"/"Nhà tài trợ"/"支持者" link 404'd from every localized
// page. Until a localized route exists, supporters gets the same
// always-canonical treatment as privacy and feedback.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { DemeterFooter } from "../DemeterFooter";

const supportersHref = (container: HTMLElement) =>
  [...container.querySelectorAll("a")].map((a) => a.getAttribute("href")).find((h) => h?.includes("supporters"));

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
});
