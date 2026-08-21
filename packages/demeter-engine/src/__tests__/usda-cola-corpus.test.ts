// @vitest-environment node
// FY 2026 dollar tables in the corpus (#785).
//
// "Someone gives a household of 2 and $74,000/year gross and asks whether
// they qualify. $6,167/month is far over every gross limit in the country,
// and Demeter cannot say so — it can only restate the percentage." The
// percentage grounded (7 CFR 273.9(a) is in the corpus); the DOLLAR tables it
// points at were not, and the numeric gate rightly refuses figures never
// retrieved. These figures come from the real published FY 2026 COLA memo —
// signed 2025-08-14, effective 2025-10-01 through 2026-09-30, fetched from
// USDA's guidance portal via an Internet Archive snapshot (the same citable
// pattern the state packs use) after the live PDF URL bot-blocked direct
// fetches. They must never be edited from memory; refetch instead (#803
// tracks the FY27 refresh).
import { describe, it, expect } from "vitest";
import { retrieve } from "../retrieval";
import cola from "../corpus/usda-cola-fy26.json";

const allText = () => (cola as { topics: { text: string }[] }).topics.map((t) => t.text).join("\n");

describe("FY26 COLA artifact shape", () => {
  it("carries provenance: source, snapshot, effective window, and the no-memory rule", () => {
    const p = (cola as { _provenance: Record<string, string> })._provenance;
    expect(p.source_url).toMatch(/usda\.gov/);
    expect(p.retrieved_via).toMatch(/web\.archive\.org/);
    expect(p.effective_from).toBe("2025-10-01");
    expect(p.effective_to).toBe("2026-09-30");
  });

  it("holds the published figures, spot-checked against three independent confirmations", () => {
    const t = allText();
    // 48 states + DC gross/net — matches USDA's own eligibility page.
    expect(t).toContain("$1,696");
    expect(t).toContain("$2,292");
    expect(t).toContain("$1,305");
    // Alaska and Hawaii gross columns — the memo's page 3.
    expect(t).toContain("$2,118");
    expect(t).toContain("$1,949");
    // Max allotments — HH-4 $994 and the HH-5 pair the #898 P0-1 arithmetic
    // reconstructed from a live screenshot ($1,183 max, $261 standard
    // deduction), now grounded from the published table instead.
    expect(t).toContain("$994");
    expect(t).toContain("$1,183");
    expect(t).toContain("$261");
  });

  it("is still in its effective window — when this fails, refetch FY27 (#803), never hand-edit", () => {
    const to = (cola as { _provenance: { effective_to: string } })._provenance.effective_to;
    expect(
      Date.now() <= new Date(`${to}T23:59:59Z`).getTime(),
      `FY26 COLA figures expired ${to}. Fetch the FY27 memo (#803) — do not edit these from memory.`,
    ).toBe(true);
  });
});

describe("dollar-limit questions retrieve the tables (#785)", { timeout: 60_000 }, () => {
  it("a federal income-limit question surfaces the standards", async () => {
    const r = await retrieve("What is the income limit for a family of 3?");
    expect(r.some((c) => /FY 2026 COLA/i.test(c.citation) && /income eligibility/i.test(c.citation + c.heading))).toBe(true);
  });

  it("the #785 autopsy shape — over-limit gross income — can finally ground a dollar answer", async () => {
    const r = await retrieve("We are a household of 2 making $74,000 a year. Do we qualify for SNAP?");
    const text = r.map((c) => c.text).join("\n");
    expect(text).toContain("$2,292");
  });

  it("Alaska and Hawaii route to their own columns", async () => {
    const r = await retrieve("What is the SNAP income limit in Alaska?");
    expect(r.map((c) => c.text).join("\n")).toContain("$2,118");
  });

  it("a maximum-benefit question surfaces the allotment table", async () => {
    const r = await retrieve("What is the maximum SNAP benefit for a family of 4?");
    expect(r.map((c) => c.text).join("\n")).toContain("$994");
  });
});
