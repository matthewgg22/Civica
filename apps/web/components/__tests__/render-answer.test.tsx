import { describe, it, expect } from "vitest";
import { isValidElement } from "react";
import { renderAnswer, splitFollowups, pendingQuestion } from "../DemeterChat";
import { stateName } from "../../lib/state-names";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

// renderAnswer returns React nodes (no DOM needed): <p> paragraph blocks and
// <hr>, with <strong>/<em>/text inside them for the markdown subset the engine
// emits.
//
// These helpers used to look exactly ONE level deep, which worked only while
// the output was a flat run of text and newline strings. Paragraphs are real
// elements now, so a one-level walk would report every answer as "one <p>" and
// quietly stop checking the things these tests exist for — that bold renders,
// and that HTML-looking content stays inert. They recurse.
type Nodes = ReturnType<typeof renderAnswer>;

function walk(nodes: unknown, visit: (n: unknown) => void): void {
  for (const n of Array.isArray(nodes) ? nodes : [nodes]) {
    // NESTED ARRAYS. A child can itself be an array — renderInline returns
    // one, so `children` is routinely [[...strings], <span/>]. This used to
    // visit the array itself, find it was not an element, and stop, silently
    // skipping every node inside it. It reported a paragraph as missing text
    // that was in fact rendering perfectly.
    if (Array.isArray(n)) {
      walk(n, visit);
      continue;
    }
    visit(n);
    if (isValidElement(n)) {
      walk((n.props as { children?: unknown }).children ?? [], visit);
    }
  }
}

/** Element tags in document order, paragraph wrappers excluded — the tests care
 *  about the markup INSIDE a paragraph, and about <hr>. */
function tags(nodes: Nodes): string[] {
  const out: string[] = [];
  walk(nodes, (n) => {
    if (isValidElement(n) && n.type !== "p") out.push(n.type as string);
  });
  return out;
}

/** All text, from any depth. */
function texts(nodes: Nodes): string {
  let out = "";
  walk(nodes, (n) => {
    if (typeof n === "string") out += n;
  });
  return out;
}

/** How many paragraph blocks an answer renders as — the readability property
 *  the <p> change exists for. */
function paragraphs(nodes: Nodes): number {
  let count = 0;
  walk(nodes, (n) => {
    if (isValidElement(n) && n.type === "p") count++;
  });
  return count;
}

describe("renderAnswer (chat markdown subset)", () => {
  it("renders **bold** and *italic* as elements, never literal asterisks", () => {
    const nodes = renderAnswer("FMV up to **$22,500 is exempt**; see *Sources as of: eCFR*.");
    expect(tags(nodes)).toEqual(["strong", "em"]);
    expect(texts(nodes)).not.toContain("*");
    expect(texts(nodes)).toContain("$22,500 is exempt");
  });

  it("moves everything after --- into the footnote block", () => {
    // The rule used to render as an <hr> with the trailer running on beneath
    // it in the answer's own face and size. It is reference, not answer, so it
    // is now a block of its own — the hairline is that block's top border.
    const nodes = renderAnswer("answer body\n\n---\n**Citation:**\n- ✓ ok");
    expect(tags(nodes)).toContain("div");
    expect(tags(nodes)).not.toContain("hr");
    // The content is all still there, and still marked up.
    expect(tags(nodes)).toContain("strong");
    expect(texts(nodes)).toContain("Citation:");
    expect(texts(nodes)).toContain("answer body");
  });

  it("leaves an answer with no trailer entirely alone", () => {
    const nodes = renderAnswer("just an answer");
    expect(tags(nodes)).not.toContain("div");
  });

  it("keeps HTML-looking content as inert text (no injection surface)", () => {
    const nodes = renderAnswer('<img src=x onerror=alert(1)> and <script>alert(1)</script>');
    // Everything comes back as plain strings — nothing element-shaped from input.
    expect(tags(nodes)).toEqual([]);
    expect(texts(nodes)).toContain("<script>");
  });

  it("does not treat mid-line hyphens or math asterisks as markup", () => {
    const nodes = renderAnswer("net income - deductions; 2 * 3 = 6");
    expect(tags(nodes)).toEqual([]);
    expect(texts(nodes)).toBe("net income - deductions; 2 * 3 = 6");
  });
});

describe("paragraphs are blocks, so they can be given space", () => {
  it("splits on a blank line", () => {
    // A blank line under `white-space: pre-wrap` is one empty line-height,
    // which is not enough to separate two paragraphs of prose — which is most
    // of what made a correctly-shaped answer still read as a wall.
    const nodes = renderAnswer("First point.\n\nSecond point.\n\nThird.");
    expect(paragraphs(nodes)).toBe(3);
  });

  it("keeps a single newline inside a paragraph of prose", () => {
    const nodes = renderAnswer("Line one\ncontinues here");
    expect(paragraphs(nodes)).toBe(1);
    expect(texts(nodes)).toContain("Line one\ncontinues here");
  });

  it("does not emit an empty paragraph for trailing or repeated blank lines", () => {
    expect(paragraphs(renderAnswer("Just this.\n\n\n\n"))).toBe(1);
    expect(paragraphs(renderAnswer(""))).toBe(0);
  });

  it("the citation rule closes the paragraph before it", () => {
    const nodes = renderAnswer("The answer.\n---\n7 CFR 273.9");
    // Still two paragraphs — one in the answer, one inside the footnote.
    expect(paragraphs(nodes)).toBe(2);
    expect(tags(nodes)).toContain("div");
  });
});

// Seen in production: an answer carrying TWO certainty banners — its own
// "⚠ UNCERTAIN — do not treat as settled; confirm with your county caseworker"
// and ours right under it — plus two "Check it yourself" lines. Told the same
// caveat twice in two wordings, which reads as the page arguing with itself.
describe("a trailer the model wrote alongside ours", () => {
  const doubled = [
    "The answer.",
    "",
    "⚠ UNCERTAIN — do not treat as settled; confirm with your county caseworker.",
    "Check it yourself: 7 CFR 273.11",
    "---",
    "⚠ **UNCERTAIN** — These are real authorities, but we did not have their text.",
    "_Check it yourself:_ 7 CFR 273.11",
  ].join("\n");

  it("keeps one certainty banner — ours, which is appended last", () => {
    const { body } = splitFollowups(doubled);
    expect(body).toContain("These are real authorities");
    expect(body).not.toContain("do not treat as settled");
  });

  it("keeps one Check it yourself line", () => {
    expect(splitFollowups(doubled).body.match(/Check it yourself/g) ?? []).toHaveLength(1);
  });

  it("leaves an answer with a single trailer untouched", () => {
    const single = "The answer.\n---\n✓ **CERTAIN** — checked.\n_Check it yourself:_ 7 CFR 273.9";
    const { body } = splitFollowups(single);
    expect(body).toContain("CERTAIN");
    expect(body.match(/Check it yourself/g) ?? []).toHaveLength(1);
  });
});

describe("the question the composer echoes", () => {
  it("drops the bullet marker when the closing question is a list item", () => {
    // Answers very often end in a list of options, so the last sentence is the
    // last bullet — and the marker came with it, putting a stray hyphen at the
    // start of the composer on a large share of real answers.
    const q = pendingQuestion("Some answer.\n\n- One thing?\n- Are you ready to apply now?");
    expect(q).toBe("Are you ready to apply now?");
  });

  it("leaves an ordinary closing question alone", () => {
    expect(pendingQuestion("A sentence. Which state are you in?")).toBe(
      "Which state are you in?",
    );
  });

  it("returns null when the answer does not end in a question", () => {
    expect(pendingQuestion("A statement, and then another.")).toBeNull();
  });
});

describe("the streaming edge", () => {
  // Was a blinking block caret — the loudest thing on a page of quiet type,
  // sitting at the end of every sentence as it arrived. A cursor belongs in a
  // field you type into, not in prose being read to you. The newest word now
  // arrives dimmed and settles instead.
  it("wraps the newest word, inside the last paragraph", () => {
    const nodes = renderAnswer("First.\n\nStill writing", { streaming: true });
    expect(paragraphs(nodes)).toBe(2);
    expect(tags(nodes)).toEqual(["span"]);
  });

  it("keeps every word — the edge is a wrapper, not a truncation", () => {
    // The tail is split off the last paragraph and re-rendered. If that split
    // dropped or duplicated a word the reader would watch text corrupt itself
    // in front of them, which is worse than any caret.
    const nodes = renderAnswer("First.\n\nStill writing here", { streaming: true });
    expect(texts(nodes).replace(/\s+/g, " ")).toContain("Still writing here");
  });

  it("handles a last paragraph that is a single word", () => {
    const nodes = renderAnswer("Sure", { streaming: true });
    expect(texts(nodes)).toContain("Sure");
  });

  it("is absent once the answer is finished", () => {
    const nodes = renderAnswer("All done.");
    expect(tags(nodes)).toEqual([]);
  });

  it("does not render a caret — that was the thing being replaced", () => {
    const nodes = renderAnswer("Still writing", { streaming: true });
    expect(JSON.stringify(nodes)).not.toContain("demeter__caret");
  });

  it("does not appear on an empty answer", () => {
    expect(tags(renderAnswer("", { streaming: true }))).toEqual([]);
  });
});

describe("underscore emphasis", () => {
  it("renders _italics_, which the appended trailer actually uses", () => {
    // "_Check it yourself:_" shipped with its underscores showing on every
    // cited answer — the renderer only knew about asterisks.
    const nodes = renderAnswer("_Check it yourself:_ Pub. L. 119-21");
    expect(tags(nodes)).toEqual(["em"]);
    expect(texts(nodes)).not.toContain("_");
    expect(texts(nodes)).toContain("Check it yourself:");
  });

  it("leaves snake_case identifiers alone", () => {
    // A citation like 7_CFR_273 is not emphasis, and turning half of it italic
    // would corrupt the one thing on the line that has to stay exact.
    const nodes = renderAnswer("see 7_CFR_273 for the rule");
    expect(tags(nodes)).toEqual([]);
    expect(texts(nodes)).toBe("see 7_CFR_273 for the rule");
  });
});

describe("suggested follow-ups", () => {
  it("takes the line off the answer and returns the questions", () => {
    const { body, followups } = splitFollowups(
      "SNAP is monthly help with groceries.\n⟶ How do I apply? | What counts as income?",
    );
    expect(followups).toEqual(["How do I apply?", "What counts as income?"]);
    expect(body).not.toContain("⟶");
    expect(body).not.toContain("|");
  });

  it("keeps the citation trailer that follows it", () => {
    // The trailer is appended by the server AFTER the model's answer, so the
    // follow-ups line lands in the middle. Cutting to the end would take the
    // citations with it.
    const { body, followups } = splitFollowups(
      "Answer.\n⟶ How do I apply?\n---\n7 CFR 273.9",
    );
    expect(followups).toEqual(["How do I apply?"]);
    expect(body).toContain("7 CFR 273.9");
    expect(body).toContain("---");
  });

  it("offers nothing while the line is still streaming", () => {
    // Half a question is worse than no question — and the raw marker must not
    // type itself out in the answer either.
    const { body, followups } = splitFollowups("Answer.\n⟶ How do I app", {
      streaming: true,
    });
    expect(followups).toEqual([]);
    expect(body).not.toContain("⟶");
  });

  it("leaves an answer without the marker untouched", () => {
    const { body, followups } = splitFollowups("Just an answer.");
    expect(followups).toEqual([]);
    expect(body).toBe("Just an answer.");
  });

  it("caps at three, since a wall of buttons is still a wall", () => {
    const { followups } = splitFollowups("A.\n⟶ one? | two? | three? | four? | five?");
    expect(followups).toHaveLength(3);
  });
});

describe("the composer echoes the question Demeter asked", () => {
  it("uses the closing question", () => {
    // A composer still saying "Happy to answer any questions about SNAP" after
    // Demeter asked something has forgotten its own last sentence.
    expect(
      pendingQuestion("It depends which status you hold. Which of those is yours?"),
    ).toBe("Which of those is yours?");
  });

  it("ignores an answer that did not ask anything", () => {
    expect(pendingQuestion("SNAP is monthly help with groceries.")).toBeNull();
  });

  it("looks past the citation trailer and the follow-up chips", () => {
    const answer =
      "Which state are you in?\n⟶ How do I apply?\n---\n7 CFR 273.9";
    expect(pendingQuestion(answer)).toBe("Which state are you in?");
  });

  it("declines a question too long to sit in a field", () => {
    const long = "A".repeat(95) + "?";
    expect(pendingQuestion(long)).toBeNull();
  });

  it("strips bold so the placeholder is plain text", () => {
    expect(pendingQuestion("Tell me: **which state are you in**?")).toBe(
      "Tell me: which state are you in?",
    );
  });
});

describe("the follow-up marker leaked into a real conversation", () => {
  // Shipped and seen: the model put the marker INLINE after the last sentence
  // rather than on its own line, and splitFollowups only ever looked for
  // "\n⟶". So the reader got the raw arrow and the pipe separators printed in
  // the middle of the answer.
  const inline =
    "I don't have New York's exact income limits loaded here, so confirm those with your local district or OTDA. ⟶ What documents will I need? | Do I qualify for expedited service? | What happens at the interview?";

  it("strips the marker even when it is not at the start of a line", () => {
    const { body, followups } = splitFollowups(inline);
    expect(body).not.toContain("⟶");
    expect(body).not.toContain("|");
    expect(followups).toEqual([
      "What documents will I need?",
      "Do I qualify for expedited service?",
      "What happens at the interview?",
    ]);
    expect(body.trim().endsWith("OTDA.")).toBe(true);
  });

  it("does not leave the marker in the composer placeholder either", () => {
    expect(pendingQuestion(inline) ?? "").not.toContain("⟶");
  });
});

describe("a duplicated freshness footer", () => {
  it("keeps only the one Civica appends", () => {
    // Seen in production: the model wrote its own "Sources as of" line despite
    // the prompt telling it not to, so the answer carried it twice.
    const doubled =
      "In Nevada, SNAP is run by DWSS.\nSources as of: eCFR 2026-06-02.\nSources as of: eCFR 2026-06-02.";
    const { body } = splitFollowups(doubled);
    expect(body.match(/Sources as of/g)).toHaveLength(1);
    expect(body).toContain("DWSS");
  });

  it("leaves a single footer alone", () => {
    const one = "Answer.\nSources as of: eCFR 2026-06-02.";
    expect(splitFollowups(one).body).toBe(one);
  });
});

describe("the scope divider names a STATE", () => {
  it("never uses the pack's annotated program string", () => {
    // Shipped: the divider read "Now answering for Supplemental Nutrition
    // Assistance Program (SNAP) — Massachusetts uses the federal name; 'Food
    // Stamps' survives only as the older, still-recognized public name
    // (formally retired federally in 2008) — earlier answers may not apply."
    // It was interpolating `pack.program`, which is corpus annotation.
    const ma = VERIFIED_STATES.find((s) => s.code === "MA")!;
    expect(ma.program.length, "MA's program field is the annotated one").toBeGreaterThan(60);
    expect(stateName("MA")).toBe("Massachusetts");
  });

  it("has a short, human name for every shipped pack", () => {
    for (const p of VERIFIED_STATES) {
      const n = stateName(p.code);
      expect(n.length, `${p.code} → ${n}`).toBeLessThanOrEqual(24);
      expect(n, `${p.code} kept an annotation`).not.toMatch(/—|\(/);
    }
  });
});

describe("bullets are a real list", () => {
  // Shipped as literal hyphens in a pre-wrap paragraph: no indent, no hanging
  // alignment, so a wrapped item lined up under the dash instead of under its
  // own first word. Three options read as a wall.
  it("turns a run of - lines into <ul><li>", () => {
    const nodes = renderAnswer("You can apply:\n- Online at DTAConnect.com\n- By phone\n- In person");
    expect(tags(nodes)).toEqual(["ul", "li", "li", "li"]);
    expect(texts(nodes)).not.toContain("- Online");
    expect(texts(nodes)).toContain("Online at DTAConnect.com");
  });

  it("keeps the prose that introduces the list as its own paragraph", () => {
    const nodes = renderAnswer("You can apply:\n- Online\n- By phone");
    expect(paragraphs(nodes)).toBe(1);
    expect(texts(nodes)).toContain("You can apply:");
  });

  it("resumes prose after the list", () => {
    const nodes = renderAnswer("Ways:\n- One\n- Two\nThe filing date is what counts.");
    expect(tags(nodes)).toContain("ul");
    expect(texts(nodes)).toContain("The filing date is what counts.");
  });

  it("renders markdown inside an item", () => {
    const nodes = renderAnswer("- **How many people** are in your household");
    expect(tags(nodes)).toEqual(["ul", "li", "strong"]);
  });

  it("accepts • and * as bullets too", () => {
    expect(tags(renderAnswer("• One\n• Two"))).toEqual(["ul", "li", "li"]);
  });

  it("does not treat a lone hyphenated sentence as a list", () => {
    // "net income - deductions" has no leading dash, so nothing changes.
    expect(tags(renderAnswer("net income - deductions"))).toEqual([]);
  });
});

// #898 P1-3 — the "says the same thing twice while loading" glitch, finally
// caught on a screenshot: "Apply. You have everything lined up to make a
// strong application:" rendered TWICE in one bubble during streaming, once
// in the final render. Mechanism (deterministic, no streaming required to
// prove): the streaming-edge fade branch replaces out[lastPara] with a
// paragraph rebuilt from lastParaLines — but flushBullets updates lastPara
// WITHOUT updating lastParaLines. So a prose line followed by a bullet list
// gets its list overwritten by a second copy of the preceding paragraph
// while the stream is live.
describe("streaming edge never duplicates the previous paragraph (#898 P1-3)", () => {
  const PROSE = "Apply. You have everything lined up to make a strong application:";
  const WITH_LIST = `${PROSE}\n- Apply at DTA Connect or by phone\n- Gather your documents before the interview`;

  function textOf(nodes: ReturnType<typeof renderAnswer>): string {
    let out = "";
    walk(nodes, (n) => {
      if (typeof n === "string") out += n;
    });
    return out;
  }

  it("prose followed by bullets, while streaming: the prose appears ONCE", () => {
    const text = textOf(renderAnswer(WITH_LIST, { streaming: true }));
    const occurrences = text.split("You have everything lined up").length - 1;
    expect(occurrences).toBe(1);
  });

  it("and the bullet items are still on screen mid-stream, not overwritten", () => {
    const text = textOf(renderAnswer(WITH_LIST, { streaming: true }));
    expect(text).toContain("Apply at DTA Connect");
  });

  it("a plain streaming paragraph still gets its fading tail", () => {
    const nodes = renderAnswer("The last word arrives dimmed and settles", { streaming: true });
    let sawTail = false;
    walk(nodes, (n) => {
      if (isValidElement(n) && (n.props as { className?: string }).className === "demeter__streamtail") sawTail = true;
    });
    expect(sawTail).toBe(true);
  });
});
