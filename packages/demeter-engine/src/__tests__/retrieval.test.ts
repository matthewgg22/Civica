// @vitest-environment node
// The local embedding model (onnxruntime) needs Node's typed-array realm — jsdom
// swaps Float32Array and the tensor check fails. The route runs on Node anyway.
import { describe, it, expect } from "vitest";
import { retrieve, formatRetrievedSources, CORPUS_EFFECTIVE_DATE } from "../retrieval";

// Runs against the REAL vendored corpus + the REAL local embedding model, so it
// guards the whole retrieval stack: a dropped corpus section or a broken
// descriptor will fail here. The first call loads the model (~1s, downloads on
// first ever run), so the suite gets a generous timeout.
const topCite = async (q: string) => (await retrieve(q, { k: 1 }))[0]?.citation;

describe("Mae eCFR retrieval", { timeout: 60_000 }, () => {
  it("vendored corpus is dated (post-OBBBA issue)", () => {
    expect(CORPUS_EFFECTIVE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("routes eligibility/benefit phrasing to the right subsection", async () => {
    expect(await topCite("what counts as a shelter deduction?")).toBe("7 CFR 273.9(d)(6)");
    expect(await topCite("how is the earned income deduction calculated")).toBe("7 CFR 273.9(d)(2)");
    expect(await topCite("when does expedited service apply")).toContain("273.2(i)");
    expect(await topCite("how do ABAWD time limits work")).toContain("273.24");
    expect(await topCite("student eligibility rules")).toContain("273.5");
    expect(await topCite("what is the asset / resource limit")).toContain("273.8");
  });

  it("routes procedural caseworker phrasing to the right section", async () => {
    expect(await topCite("how do I recertify or renew CalFresh")).toContain("273.14");
    expect(await topCite("my client was denied, how do they appeal")).toContain("273.15");
    expect(await topCite("reporting requirements when income changes")).toContain("273.12");
    expect(await topCite("general work registration requirements")).toContain("273.7");
    expect(await topCite("does my client need a social security number")).toContain("273.6");
  });

  it("is paraphrase-robust on lay phrasing (semantic layer)", async () => {
    expect(await topCite("I need food this week, any way to get SNAP faster?")).toContain("273.2(i)");
    expect(await topCite("I moved and had a baby, what do I do?")).toContain("273.12");
    expect(await topCite("it's been past 30 days and still no decision")).toContain("273.2(g)");
    expect(await topCite("do I count my roommate if we don't buy and cook food together?")).toContain("273.1");
  });

  // Edge-case taxonomy audit (2026-08-15): these five topics have real
  // corpus text (strikers is its own chunk, 273.1(e); live-in attendants,
  // DV-shelter separation, and boarders/roomers are all bundled inside the
  // single 273.1(b) chunk) but had zero retrieval hint before this — live
  // testing found the model handling them reasonably well anyway via
  // semantic retrieval alone, but a bare-facts or terse phrasing (the #766
  // failure shape) has no lexical hint to fall back on without this.
  it("routes strikers to the striker-specific subsection, not just anywhere in 273.1", async () => {
    // 273.1's five subsections are five separate corpus chunks sharing one
    // coarse `section` field — a bare "273.1" hint would boost all five
    // equally and this specifically checks the sharpened citation-level hint
    // actually wins, not just that SOME household-composition text surfaces.
    expect(await topCite("I'm a union worker on strike right now, no paycheck. Can I still get SNAP?")).toBe(
      "7 CFR 273.1(e)",
    );
  });

  it("surfaces 273.1(b) for live-in attendants and DV-shelter household separation", async () => {
    const attendantHits = await retrieve("I rent a spare room to someone who provides live-in caregiving for my mother", { k: 4 });
    expect(attendantHits.some((h) => h.citation === "7 CFR 273.1(b)")).toBe(true);

    const dvHits = await retrieve("I left my abusive husband and I'm staying at a domestic violence shelter now", { k: 4 });
    expect(dvHits.some((h) => h.citation === "7 CFR 273.1(b)")).toBe(true);
  });

  it("routes sponsor-deeming questions to 273.4(c), not the general immigration hint", async () => {
    expect(
      await topCite("My sister sponsored me with an affidavit of support. Does her income count against me?"),
    ).toBe("7 CFR 273.4(c)");
  });

  it("honors an explicitly typed section number", async () => {
    const hits = await retrieve("explain 7 CFR 273.10(e)(2)", { k: 3 });
    expect(hits.some((h) => h.citation.startsWith("7 CFR 273.10(e)"))).toBe(true);
  });

  it("does not let 273.1 capture 273.10 (boundary safety)", async () => {
    const hits = await retrieve("household composition under 273.1", { k: 4 });
    expect(hits.every((h) => !h.citation.startsWith("7 CFR 273.10"))).toBe(true);
  });

  it("returns nothing for clearly off-topic queries", async () => {
    expect((await retrieve("what's the weather in Sacramento")).length).toBe(0);
  });

  it("formats an authoritative, cited, URL-bearing source block", async () => {
    const block = formatRetrievedSources(await retrieve("shelter deduction"));
    expect(block).toContain("Verbatim regulatory source text");
    expect(block).toContain("7 CFR 273.9(d)(6)");
    expect(block).toContain("ecfr.gov");
  });

  // Regression (2026-08-15, LA County DPSS CPRA production / CDSS ACL 25-50):
  // Demeter was explaining the pre-OBBBA "any LIHEAP payment triggers the
  // full Heating/Cooling SUA" rule as current — OBBBA §10103 narrowed that,
  // eff. 2025-10-31, to households with an elderly or disabled member. The
  // fix is a citation-level entry in retrieval.ts's OBBBA_SUPERSEDED map, NOT
  // a section-level one, because 273.9(d)(6) shares its coarse `section`
  // field ("273.9") with 34 OTHER corpus chunks (income counting, every
  // other deduction) that OBBBA never touched — a section-level key would
  // manufacture false uncertainty on all of them.
  it("flags the LIHEAP/heat-and-eat SUA subsection as superseded, without over-broadening to sibling 273.9 subsections", async () => {
    // The block's own boilerplate header always mentions the PHRASE
    // "SUPERSEDED IN PART" (explaining what the marker means generically) —
    // the actual per-chunk injected warning is the only place "⚠️" appears,
    // so that's what distinguishes "this chunk is flagged" from "the block
    // explains the concept exists."
    const shelterHits = await retrieve("what counts as a shelter deduction?", { k: 1 });
    expect(shelterHits[0]?.citation).toBe("7 CFR 273.9(d)(6)");
    const shelterBlock = formatRetrievedSources(shelterHits);
    expect(shelterBlock).toContain("⚠️");
    expect(shelterBlock).toContain("LIHEAP");
    expect(shelterBlock).toContain("elderly or disabled");

    // Same section, an OBBBA-untouched subsection — must NOT inherit the
    // warning. This is the actual regression guard: it fails if the fix is
    // ever "simplified" back to a section-level key.
    const medicalHits = await retrieve("unreimbursed medical expense deduction for elderly household", {
      k: 3,
    });
    expect(medicalHits.some((h) => h.citation.includes("273.9(d)(3)"))).toBe(true);
    const medicalBlock = formatRetrievedSources(medicalHits.filter((h) => h.citation.includes("273.9(d)(3)")));
    expect(medicalBlock).not.toContain("⚠️");
  });

  it("respects the char budget", async () => {
    const hits = await retrieve("income deductions shelter expedited verification", { charBudget: 4000 });
    const total = hits.reduce((n, h) => n + h.text.length, 0);
    expect(hits.length).toBeGreaterThan(0);
    expect(total).toBeLessThan(4000 + 3500);
  });

  // #622: the bare "what counts" hint fired on ANY "what counts as X"
  // question regardless of domain, injecting 273.9(b)/(c) (income exclusions)
  // with enough weight to push the actually-relevant section out of the
  // top-k entirely. Dropped the bare phrase; kept income-specific "what
  // counts as ___ income" variants so genuine income questions still route.
  it("'what counts as X' only routes to income exclusions when X actually is income (#622)", async () => {
    // The exact failing case from #622 — a disqualification question must
    // route to its OWN section, not income-exclusion text. (#629, a
    // separate scoring defect with the same symptom, is fixed too — see
    // its own dedicated test below — so this now asserts the real answer.)
    expect(await topCite("what counts as a fleeing felon on this form?")).toContain("273.11(n)");

    // Other off-domain "what counts as X" phrasings must route to X's own
    // section, not get hijacked into income exclusions either.
    expect(await topCite("what counts as a student on this form?")).toContain("273.5");
    expect(await topCite("what counts as a resource on this form?")).toContain("273.8");
    expect(await topCite("what counts as an intentional program violation?")).toContain("273.16");
    expect(await topCite("what counts as a boarder?")).toContain("273.1");

    // But a genuine income question must still route correctly — the bare
    // "what counts" term is gone, replaced with income-specific variants.
    expect(await topCite("what counts as income on this form?")).toContain("273.9");
    expect(await topCite("what counts as household income on this form?")).toContain("273.9");
    expect(await topCite("what counts as a shelter deduction?")).toBe("7 CFR 273.9(d)(6)");
  });

  it("routes every phrasing of 'fleeing felon' to 273.11(n), not 273.4 (#629)", async () => {
    // Before the fix: zero TOPIC_HINTS fired for any of these (confirmed via
    // direct instrumentation), yet all four landed on 273.4 (immigration) —
    // the semantic layer had nowhere correct to route since
    // section-descriptors.ts had no 273.11(n) entry at all. Fixed with both
    // a dedicated hint AND a descriptor, per the issue's own suggested (c).
    for (const q of [
      "fleeing felon",
      "the application asks about a fleeing felon",
      "what does fleeing felon mean on the form",
      "what counts as a fleeing felon on this form?",
    ]) {
      expect(await topCite(q), q).toContain("273.11(n)");
    }
  });
});
