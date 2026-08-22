// @vitest-environment jsdom
//
// The composer footer, after the 2026-08-22 compression (owner request:
// "compress space of the three lines at the bottom … and if possible move
// some to be in the gear section").
//
// Two of the three lines moved or merged. THE THIRD DID NOT, and this file
// exists to keep it that way.
//
// The assent notice — "By sending a message you agree to our Terms and Privacy
// Policy" — has to stay adjacent to the composer, because sending the first
// message is the act that manifests agreement for an anonymous user who never
// signs in. Terms reachable only from a settings menu is browsewrap, which
// courts routinely refuse to enforce, and an unenforceable agreement takes the
// arbitration clause and every disclaimer in it down with it. The gear now
// carries a Terms link too — that is an ADDITION, not a relocation, and the
// difference is the whole point of this test.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";

// jsdom has no Element.scrollTo; the transcript's follow-scroll calls it.
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

afterEach(cleanup);

const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");

type Msg = { role: "user" | "assistant"; content: string };

function mountChat(initialMessages: Msg[] = []) {
  return render(
    <DemeterChat
      states={VERIFIED_STATES}
      initialState={null}
      initialQuestion={null}
      initialMessages={initialMessages}
      initialWorksheet={null}
      savedConversationId={null}
      pendingSave={false}
      geoHint={null}
    />,
  );
}

describe("the assent notice stays at the composer", () => {
  it("renders next to the composer, not inside the settings menu", () => {
    const { container } = mountChat();
    const assent = container.querySelector(".demeter__assent")!;
    expect(assent, "the assent notice is gone entirely").toBeTruthy();

    // Both documents reachable from the notice itself.
    expect(assent.querySelector("a[href='/terms']")).toBeTruthy();
    expect(assent.querySelector("a[href='/privacy']")).toBeTruthy();

    // And NOT tucked inside the gear.
    expect(
      assent.closest(".demeter__gear"),
      "the assent notice was moved into the settings menu — that turns " +
        "clickwrap into browsewrap and takes the arbitration clause with it",
    ).toBeNull();
  });

  it("the gear's Terms link is an addition, not the only copy", () => {
    const { container } = mountChat();
    const gear = container.querySelector("details.demeter__gear")!;
    expect(gear.querySelector("a[href='/terms']")).toBeTruthy();
    // The composer copy still exists independently of the menu one.
    const atComposer = container.querySelector(".demeter__assent a[href='/terms']");
    expect(atComposer).toBeTruthy();
    expect(gear.contains(atComposer)).toBe(false);
  });

  it("is not styled smaller or fainter than the disclaimer it now shares a line with", () => {
    // Conspicuousness is the basis for enforceability. Merging the two lines
    // is fine; making one of them recede is not.
    const i = css.indexOf("\n.dmchat .demeter__assent {");
    expect(i, "no .demeter__assent rule").toBeGreaterThan(-1);
    const body = css.slice(i, css.indexOf("}", i));
    expect(body).toMatch(/font-size:\s*inherit/);
    expect(body).toMatch(/color:\s*inherit/);
    expect(body, "assent must not be shrunk").not.toMatch(/font-size:\s*0?\.\d+rem/);
    expect(body, "assent must not be faded").not.toMatch(/opacity:\s*0?\.\d/);
  });
});

describe("the footer is one line at rest", () => {
  it("shows the PII hint before the first message, when it can still help", () => {
    const { container } = mountChat();
    expect(container.querySelector(".demeter__piihint")?.textContent).toBe(T.en.piiHint);
  });

  it("drops the hint once a conversation exists — that is the compression", () => {
    // THE CLAIM THIS FILE HAS TO BACK. Before: three stacked lines, forever.
    // After: two before the first message, one for the rest of the session.
    // Asserted against a real mount rather than taken on trust.
    const { container } = mountChat([{ role: "user", content: "hi" }]);
    expect(container.querySelector(".demeter__piihint")).toBeNull();
    expect(container.querySelectorAll("p.demeter__disclaimer").length).toBe(1);
    // The assent survives the compression. It is the one that cannot go.
    expect(container.querySelector(".demeter__assent a[href='/terms']")).toBeTruthy();
  });

  it("keeps the safety hint permanently reachable in the gear", () => {
    // It stops taking a line under the composer, so it must not stop existing.
    const { container } = mountChat();
    const gear = container.querySelector("details.demeter__gear")!;
    expect(gear.querySelector(".demeter__gearnote")?.textContent).toBe(T.en.piiHint);
  });

  it("the disclaimer and the assent occupy a single paragraph", () => {
    const { container } = mountChat();
    const paras = container.querySelectorAll("p.demeter__disclaimer");
    expect(paras.length, "the footer grew a second disclaimer line back").toBe(1);
    // Both halves live in that one paragraph.
    const text = paras[0]!.textContent ?? "";
    expect(text).toContain(T.en.disclaimer);
    expect(text).toContain(T.en.termsNotice.before.trim());
  });
});

// The chrome row's second link, renamed 2026-08-22 ("change the Application
// Questions to What is SNAP?").
//
// The rename forced a retarget. /questions is the page about what the
// APPLICATION asks; a link labelled "What is SNAP?" pointing there would
// disagree with itself, which is worse than the clumsy label it replaced. It
// now goes to the landing band that answers the question it names — and that
// band renders on /screen/ask, NOT on "/", which is still the older Civica
// marketing page.
describe("the What is SNAP? link goes where it says", () => {
  it("is labelled for the question it answers", () => {
    const { container } = mountChat();
    const link = container.querySelector(".demeter__navlink")!;
    expect(link.textContent).toBe(T.en.navQuestions);
    expect(T.en.navQuestions).toBe("What is SNAP?");
  });

  it("targets the band carrying that heading, not the application-questions page", () => {
    const { container } = mountChat();
    const href = container.querySelector(".demeter__navlink")!.getAttribute("href")!;
    expect(href).toContain("#what-is-snap");
    expect(href, "/ is the Civica marketing page; the band is on /screen/ask").toContain(
      "/screen/ask",
    );
    expect(href, "the label no longer describes /questions").not.toContain("/questions");
  });

  it("the anchor it points at actually exists in the rendered band", () => {
    // A hash link is only as good as its target. Read from source rather than
    // trusted: SnapOverview is where the heading lives.
    const overview = readFileSync(
      join(__dirname, "..", "SnapOverview.tsx"),
      "utf8",
    );
    expect(overview).toContain('id="what-is-snap"');
  });

  it("every language got the rename", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      expect(T[lang].navQuestions, lang).toBeTruthy();
      // The old label named the application; none of the new ones should.
      expect(T[lang].navQuestions, lang).not.toBe(T[lang].save?.panelDismiss);
    }
    expect(T.es.navQuestions).toBe("¿Qué es SNAP?");
    expect(T.vi.navQuestions).toBe("SNAP là gì?");
    expect(T.zh.navQuestions).toBe("什么是 SNAP？");
  });
});
