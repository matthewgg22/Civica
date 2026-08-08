import { describe, it, expect } from "vitest";
import { isValidElement } from "react";
import { renderAnswer } from "../DemeterChat";

// renderAnswer returns React nodes (no DOM needed): strings for plain text,
// <strong>/<em>/<hr> elements for the markdown subset the engine emits.
function tags(nodes: ReturnType<typeof renderAnswer>): string[] {
  return nodes.filter(isValidElement).map((el) => el.type as string);
}
function texts(nodes: ReturnType<typeof renderAnswer>): string {
  return nodes
    .map((n) =>
      isValidElement(n) ? String((n.props as { children?: unknown }).children ?? "") : String(n),
    )
    .join("");
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
