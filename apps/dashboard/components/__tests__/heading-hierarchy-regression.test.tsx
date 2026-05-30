/**
 * Regression: /dashboard must expose exactly one <h1> (the page title) and
 * level its section headings as <h2> — no missing top-level heading, no
 * h1->h3 skip. Live /design-review (FINDING-002) caught the page opening at
 * <h2> with section <h3>s and zero <h1> on the rendered outline.
 *
 * Lint-as-test: reads source and asserts on the heading tags, matching the
 * existing color-tokens / contrast regression pattern in this suite.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("heading hierarchy — /dashboard a11y outline", () => {
  it("dashboard page title is an <h1>, not <h2>", () => {
    const src = read("app/dashboard/page.tsx");
    expect(src).toMatch(
      /<h1 className="text-\[26px\] font-bold tracking-tight leading-none text-ink">/
    );
    expect(src).not.toMatch(
      /<h2 className="text-\[26px\] font-bold tracking-tight leading-none text-ink">/
    );
  });

  it("dashboard section titles are <h2>, never <h3> (no h1->h3 skip)", () => {
    const sections = read("components/dashboard/sections.tsx");
    const qc = read("components/QCOutcomesPanel.tsx");
    expect(sections).not.toMatch(/<h3 className="section-title"/);
    expect(qc).not.toMatch(/<h3 className="section-title"/);
    expect(sections).toMatch(/<h2 className="section-title"/);
    expect(qc).toMatch(/<h2 className="section-title"/);
  });
});
