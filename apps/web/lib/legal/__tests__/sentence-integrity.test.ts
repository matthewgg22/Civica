// The legal documents must be made of sentences.
//
// #1007 replaced every em-dash in shipping copy, which was right — its own
// rule was "a clause separator became two sentences, a parenthetical became a
// comma, an appositive became a colon". Applied to these three files, the
// automated pass used a full stop for ALL of them, which turned parentheticals
// into fragments and left two sentences ending on the word "and".
//
// That is not a style problem here. It broke the survival clause (the operative
// verb ended up in a sentence with no subject), the indemnity (the condition
// was severed from its consequence), and the mass-arbitration procedure. In
// each, sentence structure WAS the legal meaning.
//
// These rules are deliberately narrow. A grammar checker would drown this file
// in false positives — the product voice legitimately opens sentences with
// "And", and legal drafting legitimately opens with "Except that". What is
// pinned is the specific shape the bad pass produced, plus the three clauses
// that matter most, held verbatim.
import { describe, expect, it } from "vitest";
import { DOCUMENTS } from "..";
import type { Block, LegalDocument } from "../types";

/** Every string a reader can see, from every block type. */
function readableText(doc: LegalDocument): string[] {
  const out: string[] = [doc.title, doc.lede];
  const fromBlock = (b: Block): string[] => {
    switch (b.kind) {
      case "p":
      case "callout":
        return [b.text];
      case "ul":
        return b.items;
      case "table":
        return [...b.columns, ...b.rows.flat()];
    }
  };
  for (const s of doc.sections) {
    out.push(s.heading);
    for (const b of s.blocks) out.push(...fromBlock(b));
  }
  return out;
}

const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

const ALL: { slug: string; text: string }[] = DOCUMENTS.flatMap((d) =>
  readableText(d).map((text) => ({ slug: d.slug, text })),
);

describe("no sentence ends on a conjunction", () => {
  // "…disclose only what that process actually compels, and." — an actual
  // sentence that shipped in the privacy policy, describing what we do when
  // served with legal process.
  it.each(DOCUMENTS.map((d) => [d.slug] as const))("%s", (slug) => {
    const dangling = ALL.filter((e) => e.slug === slug).flatMap((e) =>
      sentences(e.text).filter((s) => /[ ,](and|or|but)\.$/i.test(s)),
    );
    expect(dangling, `sentences ending on a conjunction:\n${dangling.join("\n")}`).toEqual([]);
  });
});

describe("no sentence begins with a relative pronoun", () => {
  // "Which generally means very low income and few resources." — what is left
  // when a "— which … —" parenthetical is cut with full stops.
  it.each(DOCUMENTS.map((d) => [d.slug] as const))("%s", (slug) => {
    const orphans = ALL.filter((e) => e.slug === slug).flatMap((e) =>
      sentences(e.text).filter((s) => /^(Which|Whose|Whom)\b/.test(s)),
    );
    expect(orphans, `sentences opening on a relative pronoun:\n${orphans.join("\n")}`).toEqual([]);
  });
});

describe("the clauses where sentence structure IS the meaning", () => {
  const text = (slug: string) => ALL.filter((e) => e.slug === slug).map((e) => e.text).join("\n");

  it("the survival clause has a subject and a verb in one sentence", () => {
    const t = text("terms");
    expect(t).toContain(
      "The sections that by their nature should survive (disclaimers, limitation of liability, " +
        "the license in Section 5, dispute resolution, and governing law) survive termination.",
    );
    expect(t, "the operative verb is stranded again").not.toContain("Survive termination.");
  });

  it("the indemnity keeps its condition attached to its consequence", () => {
    const t = text("terms");
    expect(t).toContain(
      "If you misuse Demeter (by breaking the rules in Section 6, by violating the law, or by " +
        "infringing someone else's rights) and a third party brings a claim against us because " +
        "of it, you agree to defend and indemnify us",
    );
    expect(t, "the condition is severed again").not.toContain("If you misuse Demeter.");
  });

  it("the mass-arbitration selection is one instruction", () => {
    const t = text("terms");
    expect(t).toContain(
      "select 20 notices, 10 chosen by each side, to proceed as initial arbitrations",
    );
  });

  it("the legal-process response says what we do, in one sentence", () => {
    expect(text("privacy")).toContain(
      "disclose only what that process actually compels, and, unless a court forbids it or " +
        "there is a risk to someone's safety, tell the affected person.",
    );
  });
});

describe("#1007's win is not undone by fixing its output", () => {
  it("no em-dash comes back into shipping copy", () => {
    // The repair uses commas, colons and parentheses — the punctuation #1007
    // said each dash should have become. Reintroducing the dash would be the
    // easy way to fix a fragment and would undo the pass it came from.
    const withDash = ALL.filter((e) => e.text.includes("—"));
    expect(withDash.map((e) => `${e.slug}: ${e.text.slice(0, 80)}`)).toEqual([]);
  });
});
