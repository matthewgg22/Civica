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
    // NOT be answered with income-exclusion text. (It also doesn't yet route
    // to the CORRECT section, 273.11(n) — that's a separate defect, #629,
    // caused by scoring rather than by a hint; this assertion only covers
    // what #622 is actually about.)
    const felonHits = await topCite("what counts as a fleeing felon on this form?");
    expect(felonHits).not.toMatch(/273\.9\(b\)|273\.9\(c\)/);

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
});
