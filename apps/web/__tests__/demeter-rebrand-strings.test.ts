// Regression guard for the Demeter rebrand (issue #646): these five files had
// no test coverage before the fix, so rather than build full render harnesses
// for marketing pages and a canvas-animated hero, this pins the literal
// corrected strings as source text. Cheap, and it's the thing that actually
// broke — a careless revert (or a copy-paste of the old CTA block) flips one
// of these back to "Mae" and this catches it without mocking React/canvas.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (relPath: string) => readFileSync(join(root, relPath), "utf8");

describe("Demeter branding — marketing copy says Demeter, not Mae", () => {
  it("welcome page's own-section CTA and disclaimer", () => {
    const src = read("app/welcome/page.tsx");
    expect(src).toContain("Ask Demeter: Civica&rsquo;s AI guide");
    expect(src).toContain("Demeter&rsquo;s answers are based on federal SNAP citations");
  });

  it("why-civica page's feature card", () => {
    const src = read("app/why-civica/page.tsx");
    expect(src).toContain("Demeter, your AI guide");
    expect(src).toContain("Ask Demeter any eligibility question");
  });

  it("the hero milestone label, in both the static and animated variant", () => {
    for (const rel of ["components/StaticGeminiHero.tsx", "components/ui/google-gemini-effect.tsx"]) {
      expect(read(rel), rel).toContain('"Demeter guides every answer"');
    }
  });

  it("MaeHelpButton's open/title copy, in every locale", () => {
    const src = read("components/MaeHelpButton.tsx");
    const markers = [
      'open: "Ask Demeter"',
      'title: "Hi, I\'m Demeter"',
      'open: "Pregúntale a Demeter"',
      'title: "Hola, soy Demeter"',
      'open: "询问 Demeter"',
      'title: "你好,我是 Demeter"',
      'open: "Hỏi Demeter"',
      'title: "Chào, tôi là Demeter"',
      'open: "Tanungin si Demeter"',
      'title: "Kumusta, ako si Demeter"',
    ];
    for (const marker of markers) {
      expect(src, marker).toContain(marker);
    }
  });
});
