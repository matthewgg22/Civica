import { describe, it, expect } from "vitest";
import { expandQuery } from "../lang";

// Regression for #685. A non-English query that matches NO glossary entry gets
// no expansion, embeds on its raw text, and can land in the wrong part of the
// corpus — producing an answer that is correct and correctly cited but shown to
// the reader as UNCERTAIN, because the authority it cites was never retrieved.
//
// The trigger is mundane: a word sitting between two glossary terms.

describe("query expansion tolerates words between glossary terms", () => {
  it("expands the Vietnamese phrasing that silently failed", () => {
    // "Trợ cấp SNAP tối đa" — the programme name splits "trợ cấp" from
    // "tối đa". Retrieved 273.8 (resources) instead of 273.10 (allotments).
    const q = "Trợ cấp SNAP tối đa cho gia đình 4 người là bao nhiêu?";
    expect(expandQuery(q, "vi")).toContain("maximum allotment");
  });

  it("still expands the contiguous Vietnamese phrasing", () => {
    const q = "Mức trợ cấp tối đa hàng tháng cho hộ gia đình 4 người là bao nhiêu?";
    expect(expandQuery(q, "vi")).toContain("maximum allotment");
  });

  it("expands Spanish with a programme name in the middle", () => {
    // Contiguous in the gold case, so this was never observed failing — fixed
    // alongside VI rather than waiting for it to surface in Spanish.
    expect(expandQuery("¿Cuál es la asignación de CalFresh máxima?", "es")).toContain(
      "maximum allotment",
    );
    expect(expandQuery("¿Cuál es la asignación máxima?", "es")).toContain("maximum allotment");
  });

  it("does not expand an unrelated query just because the terms are loose", () => {
    // The gap tolerance must not turn into a match-anything rule: both terms
    // still have to be present, in order.
    const q = "Tôi có cần đi phỏng vấn không?"; // "Do I need an interview?"
    expect(expandQuery(q, "vi")).not.toContain("maximum allotment");
  });

  it("leaves English untouched", () => {
    const q = "What is the maximum allotment for a family of 4?";
    expect(expandQuery(q, "en")).toBe(q);
  });
});
