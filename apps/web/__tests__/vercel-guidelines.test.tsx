// @vitest-environment jsdom
//
// Vercel Web Interface Guidelines audit, findings 1-8 (2026-08-21, report:
// claude.ai/code/artifact/26d5e20d…). Scope per Matthew: the Demeter website
// pages. Each block names its finding.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderAnswer } from "../components/DemeterChat";
import { SnapDetail, SnapOrientation } from "../components/SnapOverview";
import { DemeterNav } from "../components/DemeterNav";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

const css = () => readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");

Element.prototype.scrollTo = Element.prototype.scrollTo ?? (vi.fn() as never);

afterEach(cleanup);

// ── Finding 1: shield citations and proper nouns from machine translation ──
describe("translate=\"no\" shields (finding 1)", () => {
  it("citation tokens in a rendered answer sit inside translate=\"no\"", () => {
    const { container } = render(
      <>{renderAnswer("The gross limit is set under 7 CFR 273.9(a) for most households.")}</>,
    );
    const shield = [...container.querySelectorAll('[translate="no"]')].find((el) =>
      /7 CFR 273\.9/.test(el.textContent ?? ""),
    );
    expect(shield).toBeTruthy();
  });

  it("the state roster lines are wholly shielded — codes, programs, agencies, portals", () => {
    const { container } = render(<SnapDetail states={VERIFIED_STATES} />);
    const items = [...container.querySelectorAll(".dmx__sronly li")];
    expect(items.length).toBeGreaterThan(50);
    for (const li of items) {
      expect(li.closest('[translate="no"]') ?? li.getAttribute("translate"), li.textContent?.slice(0, 40)).toBeTruthy();
    }
  });

  it("the hero example's citation is shielded without shielding the prose", () => {
    const { container } = render(<SnapOrientation />);
    const a = container.querySelector(".dmex__a")!;
    expect(a.getAttribute("translate")).toBeNull();
    const shield = [...a.querySelectorAll('[translate="no"]')].find((el) =>
      /7 CFR 273\.1/.test(el.textContent ?? ""),
    );
    expect(shield).toBeTruthy();
  });

  it("the brand name is shielded in the nav", () => {
    const { container } = render(<DemeterNav />);
    const brand = [...container.querySelectorAll('[translate="no"]')].find((el) =>
      /Demeter/.test(el.textContent ?? ""),
    );
    expect(brand).toBeTruthy();
  });
});

// ── Finding 2: skip link ──
describe("skip link (finding 2)", () => {
  it("the nav's first focusable is a skip link targeting main content", () => {
    const { container } = render(<DemeterNav />);
    const first = container.querySelector("a");
    expect(first?.getAttribute("href")).toBe("#main-content");
  });

  it("both Demeter pages give main the target id", () => {
    for (const page of ["app/screen/ask/page.tsx", "app/chat/page.tsx"]) {
      const src = readFileSync(join(__dirname, "..", page), "utf8");
      expect(src, page).toMatch(/id="main-content"/);
    }
  });
});

// ── Findings 4, 5, 7: CSS-level pins ──
describe("stylesheet pins (findings 4, 5, 7)", () => {
  it("the document declares its light color-scheme (finding 4)", () => {
    expect(css()).toMatch(/color-scheme:\s*light/);
  });

  it("both Demeter pages declare a themeColor viewport (finding 4)", () => {
    for (const page of ["app/screen/ask/page.tsx", "app/chat/page.tsx"]) {
      const src = readFileSync(join(__dirname, "..", page), "utf8");
      expect(src, page).toMatch(/themeColor/);
    }
  });

  it("interactive elements opt out of double-tap zoom and the default tap flash (finding 5)", () => {
    const s = css();
    expect(s).toMatch(/touch-action:\s*manipulation/);
    expect(s).toMatch(/-webkit-tap-highlight-color/);
  });

  it("the sidetools verify link keeps its 44px hit area while staying visually quiet (finding 7)", () => {
    const s = css();
    const block = s.slice(s.indexOf(".dmchat .demeter__sidetools .demeter__how"));
    const rule = block.slice(0, block.indexOf("}"));
    expect(rule).not.toMatch(/min-height:\s*0/);
    expect(rule).toMatch(/min-height:\s*44px/);
  });

  it("inline answer links carry an expanded hit area (finding 7)", () => {
    expect(css()).toMatch(/\.demeter__link\s*\{[^}]*padding-block/);
  });
});
