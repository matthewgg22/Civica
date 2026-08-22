// @vitest-environment jsdom
//
// Vercel Web Interface Guidelines audit, findings 1-8 (2026-08-21, report:
// claude.ai/code/artifact/26d5e20d…). Scope per Matthew: the Demeter website
// pages. Each block names its finding.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { renderAnswer } from "../components/DemeterChat";
import { shieldCitations } from "../lib/no-translate";
import { SnapDetail } from "../components/SnapOverview";
import { DemeterWorksheet } from "../components/DemeterWorksheet";
import { T } from "../lib/i18n/demeter-chat-copy";
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

  it("shieldCitations wraps the citation and only the citation", () => {
    // EVOLVED: this used to assert against the hero example card's answer,
    // but the mini chat replaced that card (2026-08-21) and no citations
    // render on the landing anymore. The shield still guards the CHAT's
    // trailer (DemeterChat renders through shieldCitations), so the
    // invariant is pinned at the function: the citation is shielded, the
    // prose around it is not.
    const nodes = shieldCitations("Households apply separately (7 CFR 273.1(a)) in most cases.", "t");
    const html = renderToStaticMarkup(<>{nodes}</>);
    expect(html).toMatch(/translate="no"[^>]*>[^<]*7 CFR 273\.1/);
    expect(html).not.toMatch(/translate="no"[^>]*>[^<]*Households/);
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

  it("the verify link keeps its 44px hit area — at the selector that actually matches it", () => {
    // FINDING 7 fixed a target silently shrunk to 21px. This test then kept
    // passing after the link MOVED (2026-08-22) out of .demeter__sidetools
    // and into the worksheet card's foot — because it only grepped the
    // stylesheet. A rule that matches nothing passes a text search happily.
    // So: assert the rule, AND assert the element really lives where the
    // rule can reach it.
    const s = css();
    const block = s.slice(s.indexOf(".dmw__footlinks .demeter__how"));
    const rule = block.slice(0, block.indexOf("}"));
    expect(rule).toMatch(/min-height:\s*44px/);

    const { container } = render(
      <DemeterWorksheet
        classification={null}
        stateSelected={false}
        copy={T.en.worksheet}
        mode="ask"
        onModeChange={() => {}}
        footLinks={<a className="demeter__how" href="/verify">{T.en.howWeVerify}</a>}
      />,
    );
    expect(container.querySelector(".dmw__footlinks .demeter__how")).toBeTruthy();
  });

  it("inline answer links carry an expanded hit area (finding 7)", () => {
    expect(css()).toMatch(/\.demeter__link\s*\{[^}]*padding-block/);
  });
});

// ── awesome-design-md recommendations 1+2, and palette B (approved 2026-08-21) ──
describe("radius scale + design-doc linkage + palette sync", () => {
  it("Demeter declares its four radius tokens and no stray mid-band raw radii remain", () => {
    const s = css();
    for (const t of ["--demeter-radius-pill", "--demeter-radius-card", "--demeter-radius-inner", "--demeter-radius-input"]) {
      expect(s).toContain(`${t}:`);
    }
    // The consolidated band: 9-20px raw values (and their rem equivalents)
    // all resolve to a token now. Values ≤6px are structural hairline
    // details; 50% is a circle; the retailer map's concentric set is nested
    // geometry — all documented exceptions, not scale members.
    const strays = [...s.matchAll(/border-radius:\s*(9px|14px|16px|18px|20px|0\.6rem|0\.7rem|0\.75rem|0\.85rem|0\.9rem|1rem|1\.25rem)\s*;/g)];
    expect(strays.map((m) => m[1]), "raw mid-band radii should use the tokens").toEqual([]);
  });

  it("the governing design doc names its machine-readable companion", () => {
    const doc = readFileSync(join(__dirname, "..", "DEMETER-DESIGN.md"), "utf8");
    expect(doc).toMatch(/DESIGN\.md/);
    expect(doc).toMatch(/regenerat/i);
  });

  it("the PDF renderers' hardcoded palette matches the live tokens — palette drift guard", () => {
    const s = css();
    const token = (name: string) => new RegExp(`--demeter-${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(s)?.[1]?.toUpperCase();
    for (const file of ["lib/outline-pdf.tsx", "lib/screening-pdf.tsx"]) {
      const src = readFileSync(join(__dirname, "..", file), "utf8");
      const c = (name: string) => new RegExp(`const ${name} = "(#[0-9A-Fa-f]{6})"`).exec(src)?.[1]?.toUpperCase();
      expect(c("INK"), `${file} INK`).toBe(token("ink"));
      expect(c("BODY"), `${file} BODY`).toBe(token("body"));
      expect(c("MUTED"), `${file} MUTED`).toBe(token("muted"));
      expect(c("RULE"), `${file} RULE`).toBe(token("rule"));
    }
  });
});
