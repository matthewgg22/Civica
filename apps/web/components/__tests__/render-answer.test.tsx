import { describe, it, expect } from "vitest";
import { isValidElement } from "react";
import { renderAnswer, splitFollowups, pendingQuestion } from "../DemeterChat";

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

  it("turns a standalone --- line into an <hr> (the citation-trailer rule)", () => {
    const nodes = renderAnswer("answer body\n\n---\n**Citation:**\n- ✓ ok");
    expect(tags(nodes)).toContain("hr");
    expect(tags(nodes)).toContain("strong");
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

  it("keeps a single newline inside its paragraph, so bullets stay together", () => {
    const nodes = renderAnswer("Bring:\n- ID\n- Proof of rent");
    expect(paragraphs(nodes)).toBe(1);
    expect(texts(nodes)).toContain("- ID\n- Proof of rent");
  });

  it("does not emit an empty paragraph for trailing or repeated blank lines", () => {
    expect(paragraphs(renderAnswer("Just this.\n\n\n\n"))).toBe(1);
    expect(paragraphs(renderAnswer(""))).toBe(0);
  });

  it("the citation rule closes the paragraph before it", () => {
    const nodes = renderAnswer("The answer.\n---\n7 CFR 273.9");
    expect(tags(nodes)).toContain("hr");
    expect(paragraphs(nodes)).toBe(2);
  });
});

describe("the streaming cursor", () => {
  it("sits inside the last paragraph, not after it", () => {
    // Appended AFTER the paragraph it lands on its own line and reads as a
    // stray mark rather than as the live end of the text.
    const nodes = renderAnswer("First.\n\nStill writing", { streaming: true });
    expect(paragraphs(nodes)).toBe(2);
    expect(tags(nodes)).toEqual(["span"]);
  });

  it("is absent once the answer is finished", () => {
    const nodes = renderAnswer("All done.");
    expect(tags(nodes)).toEqual([]);
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
