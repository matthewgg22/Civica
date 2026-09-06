import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Launch-audit a11y for the streaming chat (the live-region and stop-generating
// controls were already correct). Source-level guards — the component is too
// entangled to mount in a node test, but these pin the two fixes so a refactor
// can't silently drop them.
const src = readFileSync(join(__dirname, "..", "DemeterChat.tsx"), "utf8");

describe("DemeterChat a11y: per-message language + focus restore", () => {
  it("tags each message bubble with its own language (WCAG 3.1.2)", () => {
    expect(src).toContain("lang={m.lang ?? lang}");
  });

  it("stamps the answer language on the streaming placeholder", () => {
    expect(src).toContain('{ role: "assistant", content: "", lang }');
  });

  it("keeps lang across streaming rebuilds by spreading the prior message", () => {
    // Every rebuild of the last assistant bubble must spread ...last, not
    // reconstruct { role, content } and drop lang.
    expect(src).not.toMatch(/copy\[copy\.length - 1\] = \{\s*role: "assistant", content:/);
  });

  it("re-homes focus to the composer after a stream ends, only if it was lost", () => {
    expect(src).toContain("wasBusyRef");
    expect(src).toContain("active === document.body");
    expect(src).toContain("inputRef.current?.focus({ preventScroll: true })");
  });
});
