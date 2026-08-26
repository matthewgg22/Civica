// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { PackMeta } from "@civica/demeter-engine/packs";
import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";
import { makePack, makePortal } from "../../__tests__/fixtures/pack";

// State-switch spec (T12 / T-C): switching scope mid-conversation must
// (1) insert a visible divider — earlier answers may no longer apply — and
// (2) thread the NEW state into the next request. No silent re-scoping.
//
// The interaction moved from a radio chip row to a searchable combobox
// (2026-08-09) — the CONTRACT under test is unchanged, so these assertions are
// the same; only the two lines that pick a state were rewritten.

const STATES: PackMeta[] = [
  makePack({
    code: "CA",
    program: "CalFresh",
    agency: "California Department of Social Services",
    adminModel: "county",
    portal: makePortal({ name: "BenefitsCal", url: "https://benefitscal.com" }),
  }),
  makePack({
    code: "TX",
    program: "Texas SNAP",
    agency: "Texas Health and Human Services Commission",
  }),
];

function streamedResponse(text: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(text));
      c.close();
    },
  });
  return new Response(stream, { status: 200 });
}

const fetchMock = vi.fn();

// jsdom implements neither element scrolling nor smooth-scroll options.
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async () => streamedResponse("an answer"));
  vi.stubGlobal("fetch", fetchMock);
  // The chat now survives a page change by writing the transcript to
  // sessionStorage (lib/chat-session.ts). Every real browser tab starts empty;
  // jsdom carries one store across the whole file, so without this each test
  // would restore the previous test's conversation and assert against it.
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function sendQuestion(text: string) {
  // role, not placeholder text: the placeholder changes turn to turn.
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.getAllByText("an answer").length).toBeGreaterThan(0));
}

/** Open the picker and choose an option by visible name. */
function pickState(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: "Your state" }));
  fireEvent.click(screen.getByRole("option", { name }));
}

describe("DemeterChat state switching", () => {
  // "Apply at BenefitsCal ↗" used to render right under the state picker,
  // stacked with the "Answers from" agency line — moved down next to "How
  // we verify" in the side rail (real feedback, 2026-08-15). Guards the
  // move actually landed, not just that the old spot lost it.
  it("puts the 'Apply at' link next to 'How we verify', not under the picker", async () => {
    render(<DemeterChat states={STATES} initialState="CA" />);
    const link = screen.getByRole("link", { name: /BenefitsCal/ });
    expect(link.getAttribute("href")).toBe("https://benefitscal.com");
    // The point of the 2026-08-15 move was that this link sits with the
    // STANDING FACTS at the worksheet card's foot rather than stacked under
    // the picker with the agency line. It used to be pinned by sharing a
    // parent with "How we verify"; that link moved into the settings gear
    // (2026-08-22, it was duplicated in the rail), so the invariant is now
    // asserted directly: the foot links, not the picker.
    expect(link.closest(".dmw__footlinks")).toBeTruthy();
    expect(link.closest(".dmst")).toBeNull();
  });

  // Real feedback, 2026-08-15: once the chat was already going, a plain
  // answer with no closing question to fall back on reverted the composer to
  // the FIRST-TIME invitation ("Happy to answer any questions about
  // SNAP…") — reading as though Demeter had forgotten the conversation was
  // happening. It should read as mid-conversation instead.
  it("uses a conversation-aware placeholder once chatting, not the first-time invitation", async () => {
    render(<DemeterChat states={STATES} />);
    expect(screen.getByPlaceholderText(T.en.inputPlaceholder)).toBeTruthy();
    await sendQuestion("What is SNAP?"); // mock reply "an answer" — no closing "?"
    expect(screen.getByPlaceholderText(T.en.inputPlaceholderContinue)).toBeTruthy();
    expect(screen.queryByPlaceholderText(T.en.inputPlaceholder)).toBeNull();
  });

  it("starts on the federal floor and sends state: null", async () => {
    render(<DemeterChat states={STATES} />);
    // The trigger is ONE line since 2026-08-22 — unset it shows the label as a
    // placeholder rather than the old "All states (federal rules)" value. What
    // is pinned is that nothing is selected, which the next assertion proves
    // where it actually counts: the request carries state: null.
    const trigger = screen.getByRole("button", { name: "Your state" });
    expect(trigger.textContent).toContain(T.en.picker.label);
    expect(trigger.textContent, "no state may look chosen").not.toMatch(/California|Texas/);
    await sendQuestion("What is SNAP?");
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.state).toBeNull();
  });

  it("switching state mid-chat inserts a divider and re-scopes the next request", async () => {
    render(<DemeterChat states={STATES} />);
    await sendQuestion("What is SNAP?");
    // No divider yet.
    expect(screen.queryByRole("status")).toBeNull();

    pickState(/TX/);
    // The STATE, not the program. This asserted "Texas SNAP" and the code
    // interpolated `pack.program` — which for Massachusetts is the annotated
    // corpus string, so the divider shipped reading "Now answering for
    // Supplemental Nutrition Assistance Program (SNAP) — Massachusetts uses the
    // federal name; 'Food Stamps' survives only as the older, still-recognized
    // public name (formally retired federally in 2008) — earlier answers may
    // not apply."
    expect(screen.getByRole("status").textContent).toContain("Now answering for Texas");

    await sendQuestion("And in Texas?");
    const body = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(body.state).toBe("TX");
    // Divider turns never leak into the API message history.
    expect(
      (body.messages as Array<{ role: string }>).every((m) => m.role !== "divider"),
    ).toBe(true);
  });

  it("switching back to federal inserts the federal divider", async () => {
    render(<DemeterChat states={STATES} initialState="CA" />);
    await sendQuestion("What is CalFresh?");
    pickState(/All states/);
    expect(screen.getByRole("status").textContent).toContain("federal rules only");
  });

  it("does not insert a divider before any chat exists", () => {
    render(<DemeterChat states={STATES} />);
    pickState(/TX/);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("numbers turns from the conversation, so a failed request burns no turn", async () => {
    // REGRESSION (second-pass review): turnIndex used to come from a counter
    // that incremented on every ATTEMPT. An audit row is only written on a
    // SUCCESSFUL answer, so a 429 consumed a turn number and max(turn_index)
    // then reported the session as deeper than it got — inflating the survival
    // curve, which is backwards for a drop-off metric.
    render(<DemeterChat states={STATES} />);
    await sendQuestion("first");
    expect(JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string).turnIndex).toBe(1);

    // A rejected turn: no answer, so no audit row.
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ reason: "rate_limited" }), { status: 429 }),
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "rejected" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await sendQuestion("second");
    const third = JSON.parse((fetchMock.mock.calls[2]![1] as RequestInit).body as string);
    // The failed turn left no assistant message, so this is still turn 2.
    expect(third.turnIndex).toBe(2);
  });

  it("sends one session id for the whole conversation", async () => {
    render(<DemeterChat states={STATES} />);
    await sendQuestion("first");
    await sendQuestion("second");
    const a = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    const b = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(a.sessionId).toBeTruthy();
    expect(b.sessionId).toBe(a.sessionId);
  });

  it("filters the list by state, program, or agency", () => {
    render(<DemeterChat states={STATES} />);
    fireEvent.click(screen.getByRole("button", { name: "Your state" }));
    // Agency text is searchable, not just the code — someone types what they
    // know ("Health and Human Services") and still finds their state.
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "health and human" },
    });
    expect(screen.queryByRole("option", { name: /CalFresh/ })).toBeNull();
    expect(screen.getByRole("option", { name: /Texas SNAP/ })).toBeTruthy();
  });
});

// The chat card is no longer the page's <h1>. It used to be, which put it
// after the SNAP <h2> in document order — an inverted heading hierarchy, and a
// card claiming to be the whole page. The <h1> now lives in the orientation bar
// above it (SnapOrientation), on both mount points.
describe("an annotated pack never reaches the transcript (#931)", () => {
  // THE WORST OF THE LEAKS. Picking a state posts a hand-off message into
  // the conversation — "In {state}, you apply through {agency}." — built
  // from the RAW field. Iowa's agency string continues "— no rebrand-lag
  // issue this pack found: Iowa HHS is the current, consistent name used
  // throughout the Employees' Manual…", so an Iowa reader was told about
  // this pack's research inside an answer.
  // The model-facing fields keep their annexe; the reader-facing ones do not.
  // That split now lives in the PACK rather than in a render-time cut, so this
  // suite asserts the same thing it always did: what reaches a reader is the
  // short form, and no surface prints the raw field.
  const ANNOTATED: PackMeta[] = [
    makePack({
      code: "IA",
      program: "Food Assistance — Iowa's own public-facing name; see PROVENANCE.md Finding 3",
      programShort: "Food Assistance",
      agency:
        "Iowa Department of Health and Human Services (Iowa HHS) — no rebrand-lag issue this pack found: Iowa HHS is the current name used throughout the Employees' Manual",
      agencyShort: "Iowa Department of Health and Human Services (Iowa HHS)",
      portal: makePortal({ name: "Iowa HHS Services Portal", url: "https://hhs.iowa.gov" }),
    }),
  ];

  it("the portal hand-off carries the agency's NAME, not its annexe", async () => {
    render(<DemeterChat states={ANNOTATED} />);
    pickState(/IA/);
    const transcript = document.body.textContent ?? "";
    expect(transcript).toContain("Iowa Department of Health and Human Services (Iowa HHS)");
    expect(transcript).not.toContain("rebrand-lag");
    expect(transcript).not.toContain("PROVENANCE");
  });
});

describe("the state list says nothing that is true of every row", () => {
  it("carries no VERIFIED badge — every state offered here is verified", () => {
    // Owner rec (2026-08-22): a badge on all of them distinguished none of
    // them, and it crowded the program name it sat beside.
    const { container } = render(<DemeterChat states={STATES} />);
    fireEvent.click(screen.getByRole("button", { name: "Your state" }));
    expect(container.querySelector(".dmst__opt-badge")).toBeNull();
    // The state and its agency still identify the row.
    expect(screen.getByRole("option", { name: /TX/ })).toBeTruthy();
  });
});

describe("DemeterChat heading level", () => {
  it("renders its title as a non-heading, leaving the page h1 to the orientation bar", () => {
    render(<DemeterChat states={STATES} />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    // getAllByText: the Pi sidebar's wordmark also says "Demeter" now — the
    // assertion is that NONE of them is a heading, not that only one exists.
    expect(screen.getAllByText("Demeter").length).toBeGreaterThanOrEqual(1);
  });
});

describe("a transcript reads as a conversation", () => {
  it("puts the turn's alignment on the flex CHILD, not on the bubble", async () => {
    // The bubble used to sit inside a bare <div>, so THAT was the flex child
    // and the bubble's own `align-self: flex-end` reached nothing. Measured
    // before the fix: a three-word question rendered 635px wide, on the left,
    // in the same place and shape as the answer.
    //
    // Asserted structurally because the symptom is purely visual — every test
    // passed while it was broken, and it shipped for months.
    render(<DemeterChat states={STATES} />);
    await sendQuestion("whats snap?");
    const bubble = document.querySelector(".demeter__msg--user");
    expect(bubble, "no user bubble rendered").not.toBeNull();
    const turn = bubble!.parentElement!;
    expect(turn.className, "the bubble's parent must carry the turn class").toContain(
      "demeter__turn--user",
    );
  });
});

// Vercel-guidelines finding 3: the URL claims less than the screen shows.
// Inbound ?state= worked; the picker never wrote it back, so share/refresh
// silently dropped the scope. The conversation itself deliberately stays out
// of the URL — only the state parameter syncs.
describe("state scope syncs to the URL (vercel finding 3)", () => {
  it("picking a state writes ?state=, clearing writes it away", async () => {
    window.history.replaceState({}, "", "/chat");
    render(<DemeterChat states={STATES} />);
    pickState(/California/);
    await waitFor(() => expect(window.location.search).toContain("state=CA"));

    fireEvent.click(screen.getByRole("button", { name: "Your state" }));
    fireEvent.click(screen.getByRole("option", { name: /All states/ }));
    await waitFor(() => expect(window.location.search).not.toContain("state="));
    window.history.replaceState({}, "", "/");
  });
});

// Vercel-guidelines finding 6: /chat is the guideline's exact case — a screen
// whose single primary input should be focused on arrival, desktop only
// (mobile keyboards shift the layout).
describe("composer autofocus on desktop (vercel finding 6)", () => {
  it("focuses the composer when the pointer is fine", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: /pointer:\s*fine/.test(q),
      media: q, addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
    }));
    render(<DemeterChat states={STATES} />);
    await waitFor(() => expect(document.activeElement?.tagName).toBe("TEXTAREA"));
    vi.unstubAllGlobals();
  });

  it("leaves focus alone on coarse pointers", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: false,
      media: q, addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
    }));
    render(<DemeterChat states={STATES} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement?.tagName).not.toBe("TEXTAREA");
    vi.unstubAllGlobals();
  });
});
