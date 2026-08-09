// Regression guard for the Demeter rebrand (issue #646): ApplicationsQueue's
// case-detail panel and AskMaeButton (the button that opens it) had no test
// coverage before the fix. ApplicationsQueue is large enough that a full
// render harness (case data, engine mocks, auth) is disproportionate to
// pinning one string, so this checks source text instead — cheap, and it's
// the exact thing that regressed once already (issue #646).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const componentsRoot = join(__dirname, "..", "..");
const appRoot = join(__dirname, "..", "..", "..", "app");

describe("Demeter branding — cbo-preview case UI says Demeter, not Mae", () => {
  it("ApplicationsQueue's case-detail 'Ask Demeter about this case' link", () => {
    const src = readFileSync(join(componentsRoot, "cbo/ApplicationsQueue.tsx"), "utf8");
    expect(src).toContain("Ask Demeter about this case →");
  });

  it("AskMaeButton's visible label", () => {
    const src = readFileSync(
      join(appRoot, "cbo-preview/application/[id]/AskMaeButton.tsx"),
      "utf8",
    );
    expect(src).toContain("Ask Demeter");
  });
});
