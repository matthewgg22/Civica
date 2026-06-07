// @vitest-environment node
// Embedding model needs Node's typed-array realm (not jsdom's). See retrieval.test.ts.
import { describe, it, expect } from "vitest";
import { retrieve, formatRetrievedSources } from "../retrieval";
import { FRONTDOOR_EVAL } from "../eval/frontdoor-questions";

// Runs the front-door question set through the real reference layer (corpus +
// local embedding model) and checks the citations. Scores retrieval grounding
// (the runnable proxy for "can Mae answer this") + verifies the OBBBA-superseded
// warnings fire on stale sections. Prints a coverage table so regressions show.

const topSection = async (q: string): Promise<string | null> => (await retrieve(q, { k: 1 }))[0]?.section ?? null;
const topCitation = async (q: string): Promise<string | null> => (await retrieve(q, { k: 1 }))[0]?.citation ?? null;

describe("Mae front-door eval — retrieval coverage + citation check", { timeout: 60_000 }, () => {
  it("prints a coverage report", async () => {
    const rows = await Promise.all(
      FRONTDOOR_EVAL.map(async (c) => {
        const ex = c.expect;
        const cite = (await topCitation(c.question)) ?? "—";
        if (ex.kind === "defer") {
          return `  [${c.category}] ${c.id}: defer → top ${cite} (gap — defer, OK)`;
        }
        if (ex.kind === "external") {
          const ok = cite.includes(ex.citation) ? "✓" : `✗ got ${cite}`;
          return `  [${c.category}] ${c.id}: want ${ex.citation} → top ${cite} ${ok}`;
        }
        const top = (await topSection(c.question)) ?? "—";
        const ok = top === ex.section ? "✓" : `✗ got ${top}`;
        return `  [${c.category}] ${c.id}: want ${ex.section} → top ${cite} ${ok}`;
      }),
    );
    // eslint-disable-next-line no-console
    console.log("\nFRONT-DOOR COVERAGE\n" + rows.join("\n"));
    expect(rows.length).toBe(FRONTDOOR_EVAL.length);
  });

  it("grounds federal eligibility/benefit/procedural questions on the right section", async () => {
    for (const c of FRONTDOOR_EVAL) {
      if (c.expect.kind !== "grounded") continue;
      expect(await topSection(c.question), `${c.id} → ${c.expect.section}`).toBe(c.expect.section);
    }
  });

  it("surfaces H.R.1/OBBBA-superseded sections WITH the superseded warning", async () => {
    for (const c of FRONTDOOR_EVAL) {
      if (c.expect.kind !== "superseded") continue;
      const section = c.expect.section; // narrow before the closure below
      const hits = await retrieve(c.question, { k: 4 });
      const hitSection = hits.some((h) => h.section === section);
      expect(hitSection, `${c.id} should surface ${section}`).toBe(true);
      const block = formatRetrievedSources(hits);
      expect(block, `${c.id} must carry the SUPERSEDED warning`).toContain("SUPERSEDED IN PART");
    }
  });

  it("answers external-authority questions with the correct curated cite (not a 7 CFR distractor)", async () => {
    for (const c of FRONTDOOR_EVAL) {
      if (c.expect.kind !== "external") continue;
      const top = await topCitation(c.question);
      expect(top, `${c.id} → ${c.expect.citation}`).toContain(c.expect.citation);
    }
  });

  it("suppresses the 7 CFR 273.4 distractor on a public-charge question", async () => {
    const hits = await retrieve("will applying for SNAP hurt my immigration status / public charge");
    expect(hits.every((h) => !h.section.startsWith("273.4"))).toBe(true);
    expect(hits[0]?.citation).toContain("8 CFR 212.21");
  });

  it("the superseded warning states the corrected ABAWD age and removed exemptions", async () => {
    const block = formatRetrievedSources(await retrieve("am I exempt from the ABAWD time limit as a 60 year old veteran"));
    expect(block).toMatch(/age ceiling is now 64|65\+/);
    expect(block.toLowerCase()).toContain("veteran");
    expect(block.toLowerCase()).toContain("eliminated");
  });

  it("the only remaining defers are genuinely operational portal mechanics", () => {
    const gaps = FRONTDOOR_EVAL.filter((c) => c.expect.kind === "defer").map((c) => c.id).sort();
    expect(gaps).toEqual(["mech-account-vs-apply", "mech-status"]);
  });
});
