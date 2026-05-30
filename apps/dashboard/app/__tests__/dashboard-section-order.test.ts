/**
 * Pins the /dashboard section order from /plan-ceo-review D9: the
 * morning-triage surfaces lead, the brand-celebration ImpactCounter
 * follows. Specifically UrgentBanner > Funnel > ImpactCounter, and each
 * data section is wrapped in its own Suspense boundary (the streaming
 * contract — no shared page-level Promise.all blocking every paint).
 *
 * Lint-as-test: reads page source, asserts on ordering + structure.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = join(__dirname, "..", "dashboard", "page.tsx");

describe("/dashboard section order + streaming contract", () => {
  const raw = readFileSync(PAGE, "utf8");
  const src = raw; // for index-ordering checks (comments don't affect order)
  // For "absence" assertions, strip line + block comments so prose that
  // mentions Promise.all / snap_packets (explaining what was removed)
  // doesn't trip the matcher.
  const code = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

  it("orders UrgentBanner before Funnel before ImpactCounter (D9)", () => {
    const urgent = src.indexOf("UrgentBannerSection");
    const funnel = src.indexOf("FunnelSection");
    const impact = src.indexOf("ImpactCounterSection");
    expect(urgent).toBeGreaterThan(-1);
    expect(funnel).toBeGreaterThan(urgent);
    expect(impact).toBeGreaterThan(funnel);
  });

  it("does NOT do a page-level Promise.all (data lives in sections)", () => {
    // The only awaits at page level should be cookies() + auth.getUser().
    expect(code).not.toMatch(/Promise\.all/);
    expect(code).not.toMatch(/from\("snap_packets"\)/);
  });

  it("wraps each data section in a Suspense boundary", () => {
    const suspenseCount = (src.match(/<Suspense /g) ?? []).length;
    // 9 sections: UrgentBanner, Funnel, ImpactCounter, Map, Activity,
    // TimeToHandoff, Language, QC, DocAI.
    expect(suspenseCount).toBeGreaterThanOrEqual(9);
  });

  it("uses responsive grids (md: prefix) so the page stacks on mobile", () => {
    expect(src).toMatch(/md:grid-cols-3/);
    expect(src).toMatch(/md:grid-cols-2/);
    // No bare non-responsive multi-col grids.
    expect(src).not.toMatch(/className="grid grid-cols-3/);
    expect(src).not.toMatch(/className="grid grid-cols-2/);
  });
});
