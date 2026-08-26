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
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";

// jsdom has no Element.scrollTo; the transcript's follow-scroll calls it.
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

afterEach(cleanup);

// THE CHAT RESTORES ITSELF FROM STORAGE ON MOUNT. Without this, a test that
// mounts with a message leaks into every test after it — the next mount
// restores that conversation, hasChat is true, and the empty state never
// renders. Pre-existing; surfaced by the first test in this file to assert on
// the empty state.
beforeEach(() => {
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    /* storage disabled in this environment */
  }
});

const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");

type Msg = { role: "user" | "assistant"; content: string };

function mountChat(initialMessages: Msg[] = []) {
  // THE CHAT RESTORES ITSELF FROM sessionStorage ON MOUNT, so a test that
  // mounts with a message leaks into every test after it: the next mount
  // restores that conversation, hasChat is true, and the empty state never
  // renders. Cleared HERE rather than in beforeEach because the save is
  // written by an effect whose timing relative to the hooks is not something
  // a test should have to reason about.
  try {
    window.sessionStorage.clear();
    window.localStorage.clear();
  } catch {
    /* storage disabled in this environment */
  }
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
    // Inside the disclaimer paragraph since 2026-08-26 rather than its own
    // block, so it carries a trailing space. The invariant is that the hint
    // is SHOWN before the first message, not that it owns a <p>.
    expect(container.querySelector(".demeter__piihint")?.textContent?.trim()).toBe(T.en.piiHint);
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
    // And the hint is INSIDE it, not a second block above it.
    expect(container.querySelectorAll("p.demeter__piihint")).toHaveLength(0);
    // Both halves live in that one paragraph.
    const text = paras[0]!.textContent ?? "";
    expect(text).toContain(T.en.disclaimer);
    expect(text).toContain(T.en.termsNotice.before.trim());
  });
});

// The chrome row's second link is GONE (owner, 2026-08-22).
//
// It was "Application questions", renamed to "What is SNAP?" the day before —
// and then removed outright, because both versions did the same thing: send
// someone OUT of the chat to read something. The definition it pointed at is
// now the first paragraph of the empty state and the body of the first-visit
// card, so the trip has no destination worth the leaving.
describe("the chrome row is sign-in and nothing else", () => {
  it("carries no second link", () => {
    const { container } = mountChat();
    expect(container.querySelector(".demeter__navlink")).toBeNull();
  });

  it("still carries sign-in — removing the link removed ONE thing", () => {
    const { container } = mountChat();
    expect(container.querySelector(".demeter__headright")).toBeTruthy();
    expect(container.textContent).toContain(T.en.signin);
  });

  it("the definition it used to point at is on the page instead", () => {
    // The whole justification for removing it. If this ever stops being true
    // the link should come back, not quietly vanish along with the content.
    const { container } = mountChat();
    expect(container.querySelector(".demeter__emptywhat")?.textContent).toBe(
      T.en.emptyWhatIsSnap,
    );
  });

  it("every language has that definition", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      expect(T[lang].emptyWhatIsSnap?.trim(), lang).toBeTruthy();
      expect(T[lang].emptyWhatIsSnap, `${lang} names the program`).toContain("SNAP");
    }
  });
});
