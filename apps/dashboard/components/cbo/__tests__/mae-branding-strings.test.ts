// Regression guard for the dashboard staff assistant's name (2026-08-09: back
// to "Mae", distinct from the public "Demeter AI" product — was briefly
// "Demeter" here too during the Mae->Demeter rebrand, issue #646, before that
// overlap was caught and reverted for this one surface). ApplicationsQueue's
// case-detail panel and AskMaeButton (the button that opens it) had no test
// coverage before the original #646 fix. ApplicationsQueue is large enough
// that a full render harness (case data, engine mocks, auth) is
// disproportionate to pinning one string, so this checks source text
// instead — cheap, and it's the exact thing that regressed once already.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const componentsRoot = join(__dirname, "..", "..");
const appRoot = join(__dirname, "..", "..", "..", "app");

describe("Mae branding — cbo-preview case UI says Mae, not Demeter", () => {
  it("ApplicationsQueue's case-detail 'Ask Mae about this case' link", () => {
    const src = readFileSync(join(componentsRoot, "cbo/ApplicationsQueue.tsx"), "utf8");
    expect(src).toContain("Ask Mae about this case →");
  });

  it("AskMaeButton's visible label", () => {
    const src = readFileSync(
      join(appRoot, "cbo-preview/application/[id]/AskMaeButton.tsx"),
      "utf8",
    );
    expect(src).toContain("Ask Mae");
  });
});
