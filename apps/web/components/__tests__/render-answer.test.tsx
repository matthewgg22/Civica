import { describe, it, expect } from "vitest";
import { isValidElement } from "react";
import { renderAnswer } from "../DemeterChat";

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
