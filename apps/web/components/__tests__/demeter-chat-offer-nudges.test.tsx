// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { PackMeta } from "@civica/demeter-engine/packs";
import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";
import { makePack } from "../../__tests__/fixtures/pack";
import { WELCOME_SEEN_KEY } from "../../lib/welcome-seen";

// Regression for the #833 audit (2026-08-15): a real 15-turn conversation,
// with real content in it, never once saw either offer a second time.
//
// - The "just asking, or build my estimate?" banner fired ONCE after the
//   first answer and never returned regardless of which button was pressed,
//   even much later once household + income were both established.
// - The Save button lives in a side panel nobody notices mid-conversation —
//   the chat had no INLINE nudge to save at all, ever, at any length.
//
// This drives the real component through enough turns to cross both
// thresholds and asserts each banner reappears/appears on schedule, and
// stays gone once genuinely dismissed for good.
//
// EXPLICIT TIMEOUTS (#892): each test runs 8-14 sequential real
// sendQuestion round-trips through the full component (paced-streaming
// reveal + async state settling per turn). Locally that lands anywhere
// from ~4.3s to ~9.3s per test; CI runners are slower still, and vitest's
// 5000ms default flaked two unrelated PRs in a row (#890, #896) before
// these were added.

const STATES: PackMeta[] = [
  makePack({ code: "NH", program: "New Hampshire SNAP", agency: "NH DHHS" }),
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

Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

// #1020: this jsdom has sessionStorage but not localStorage, and since #1015 the
// welcome card shows whenever it cannot positively read that it has been seen —
// so with no localStorage it renders over these mounts and intercepts the Send
// click, timing out sendQuestion's waitFor. A sibling (demeter-welcome.test)
// installs its OWN localStorage stub at module load, so whether the card appears
// here at all depended on vitest worker scheduling: intermittent, ~1 in 6. Own a
// seeded localStorage for the duration of each test — the card is then always
// already-seen, independent of any sibling's stub.
let savedLocalStorage: PropertyDescriptor | undefined;

beforeEach(() => {
  savedLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  const store = new Map<string, string>([[WELCOME_SEEN_KEY, "1"]]);
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    },
  });

  let turn = 0;
  fetchMock.mockReset().mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/api/demeter/conversations")) {
      return new Response(JSON.stringify({ conversation: { id: "conv-1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    turn += 1;
    return streamedResponse(`answer ${turn}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // Restore whatever localStorage descriptor was there before (often nothing),
  // so this suite's seeded stub never leaks into a sibling the way #1020's did.
  if (savedLocalStorage) Object.defineProperty(window, "localStorage", savedLocalStorage);
  else delete (window as unknown as Record<string, unknown>).localStorage;
});

async function sendQuestion(text: string, expectAnswer: string) {
  // role, not placeholder text: the placeholder changes turn to turn.
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.getAllByText(expectAnswer).length).toBeGreaterThan(0));
}

describe("mode-offer re-offers instead of retiring forever (#833)", () => {
  it("re-offers after MODE_REOFFER_AFTER_TURNS following a 'just asking' dismissal", { timeout: 30_000 }, async () => {
    render(<DemeterChat states={STATES} initialState="NH" />);

    await sendQuestion("q1", "answer 1");
    expect(screen.getByRole("group", { name: T.en.modeOffer })).toBeTruthy();

    // Dismiss with "Just asking".
    fireEvent.click(screen.getByRole("button", { name: T.en.modeOfferAsk }));
    expect(screen.queryByRole("group", { name: T.en.modeOffer })).toBeNull();

    // Not back yet at turn 2-6 (fewer than 6 further answers).
    for (let i = 2; i <= 6; i++) {
      await sendQuestion(`q${i}`, `answer ${i}`);
      expect(screen.queryByRole("group", { name: T.en.modeOffer })).toBeNull();
    }

    // Turn 7 = 6 answers after the dismissal at turn 1 — re-offered.
    await sendQuestion("q7", "answer 7");
    expect(screen.getByRole("group", { name: T.en.modeOffer })).toBeTruthy();

    // Dismissing the RE-offer retires it for good.
    fireEvent.click(screen.getByRole("button", { name: T.en.modeOfferAsk }));
    for (let i = 8; i <= 14; i++) {
      await sendQuestion(`q${i}`, `answer ${i}`);
      expect(screen.queryByRole("group", { name: T.en.modeOffer })).toBeNull();
    }
  });
});

describe("save nudge (#833)", () => {
  it("appears after SAVE_NUDGE_AFTER_TURNS answers, saves on demand, and can be waved off", { timeout: 30_000 }, async () => {
    render(<DemeterChat states={STATES} initialState="NH" />);

    for (let i = 1; i <= 7; i++) {
      await sendQuestion(`q${i}`, `answer ${i}`);
      expect(screen.queryByRole("group", { name: T.en.saveNudge })).toBeNull();
    }

    await sendQuestion("q8", "answer 8");
    expect(screen.getByRole("group", { name: T.en.saveNudge })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: T.en.saveNudgeYes }));
    await screen.findByText(T.en.save.saved);
    // Saving dismisses the nudge along with actually saving.
    expect(screen.queryByRole("group", { name: T.en.saveNudge })).toBeNull();
  });

  it("does not reappear once waved off with 'not now', even though not saved", { timeout: 30_000 }, async () => {
    render(<DemeterChat states={STATES} initialState="NH" />);
    for (let i = 1; i <= 8; i++) await sendQuestion(`q${i}`, `answer ${i}`);
    expect(screen.getByRole("group", { name: T.en.saveNudge })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: T.en.saveNudgeNo }));
    expect(screen.queryByRole("group", { name: T.en.saveNudge })).toBeNull();

    await sendQuestion("q9", "answer 9");
    expect(screen.queryByRole("group", { name: T.en.saveNudge })).toBeNull();
  });
});
