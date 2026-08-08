import { describe, it, expect } from "vitest";
import { retrieve } from "../retrieval";

// Passage selection over oversized corpus entries (regression).
//
// 7 CFR 273.2(i) is a 22,184-char entry and the per-chunk cap is 3,500. Naive
// head-truncation kept §273.2's delay-fault boilerplate and cut the
// expedited-service entitlement thresholds sitting at offset ~8,600 — so the
// grounding for the single highest-stakes SNAP question ("how fast can I get
// food") contained no $150 / $100 at all. Answers then supplied those figures
// from model memory: unverifiable-but-silent in English, and in Spanish a
// numeric-equivalence failure that degraded the answer intermittently
// (live eval, es-expedited: passed, passed, then degraded).

describe("expedited-service grounding carries its own thresholds", () => {
  it.each([
    ["en", "How fast can I get benefits in an emergency?"],
    ["es", "¿Qué tan rápido puedo recibir CalFresh en una emergencia?"],
  ] as const)("%s: the entitlement rule survives truncation", async (lang, q) => {
    const chunks = await retrieve(q, { state: "CA", lang });
    const expedited = chunks.find((c) => c.citation.includes("273.2(i)"));
    expect(expedited, "expedited section should be retrieved at all").toBeTruthy();
    const text = expedited!.text;
    // The operative entitlement test — the part that answers "do I qualify".
    expect(text).toMatch(/entitled to expedited service/i);
    expect(text).toContain("$150"); // monthly gross income threshold
    expect(text).toContain("$100"); // liquid resources threshold
    expect(text.length).toBeLessThanOrEqual(3700); // still within budget + markers
  });

  it("marks excerpted entries so the model knows text was elided", async () => {
    const chunks = await retrieve("How fast can I get benefits in an emergency?", {
      state: "CA",
    });
    const expedited = chunks.find((c) => c.citation.includes("273.2(i)"));
    expect(expedited!.text).toContain("[…");
  });

  it("leaves entries that already fit completely untouched", async () => {
    // A short section should come back whole — no excerpt markers.
    const chunks = await retrieve("What is the standard deduction?", { state: "CA" });
    const short = chunks.find((c) => c.text.length < 1000);
    if (short) expect(short.text).not.toContain("[…excerpted");
  });
});
