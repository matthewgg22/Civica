// @vitest-environment jsdom
//
// P1: what happens on a shared machine, and what happens when a request fails.
//
// Both behaviours are invisible when they regress. A clear button that leaves
// the localStorage stash behind still LOOKS like it cleared; a failed send that
// eats the question still shows an error, just with an empty box underneath.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";

const STATES = [
  {
    code: "CA",
    program: "CalFresh",
    agency: "California Department of Social Services",
    verification: { verified_on: "2026-01-01", sources: [] },
  },
] as never;

const STASH = "demeter:pending-save";

function typeAndSend(text: string) {
  fireEvent.change(screen.getByPlaceholderText(T.en.inputPlaceholder), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: T.en.send }));
}

// Same stand-in demeter-save.test.tsx documents: vitest's jsdom does not expose
// window.localStorage on the Node this repo runs, even with a real origin. The
// component is right to use it; the environment is what needs the shim.
function installStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
}

beforeEach(() => {
  installStorage();
  // jsdom implements no scrolling at all, and the transcript calls
  // Element.scrollTo to follow a new message (the P0 judder fix). Real browsers
  // have it; this is the same category of environment gap as localStorage.
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = function scrollTo() {
      /* no layout in jsdom, so there is nothing to scroll */
    } as typeof Element.prototype.scrollTo;
  }
  vi.restoreAllMocks();
});
afterEach(cleanup);

describe("clear this conversation", () => {
  it("confirms before destroying anything", async () => {
    // Irreversible: an unsaved conversation is gone. One stray tap on a phone
    // should not cost someone the answer they were reading.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, body: null, status: 200 }),
    );
    render(<DemeterChat states={STATES} initialMessages={[{ role: "user", content: "hi" }]} />);
    fireEvent.click(screen.getByRole("button", { name: T.en.clear }));
    // The note is the point of the confirm step — it is the last moment where
    // "we still keep the question and answer" can change a decision.
    expect(screen.getByText(T.en.clearNote)).toBeTruthy();
    expect(screen.getByText("hi")).toBeTruthy();
  });

  it("says what it does NOT clear", () => {
    // Every question and answer is written to mae_query_log server-side. A
    // button labelled "clear" that implied otherwise would be the retention lie
    // #703 fixed, rebuilt as a button.
    expect(T.en.clearNote).toMatch(/still keep the question and answer/i);
    for (const lang of ["es", "vi", "zh"] as const) {
      expect(T[lang].clearNote.trim(), `${lang} clearNote`).not.toBe("");
    }
  });

  it("empties the transcript AND the localStorage stash", async () => {
    // The stash holds a full transcript for 30 minutes (DemeterSave). Leaving
    // it behind would mean "cleared" left the conversation sitting in this
    // browser's storage, which on a library terminal is the whole risk.
    window.localStorage.setItem(STASH, JSON.stringify({ at: Date.now(), messages: [] }));
    render(<DemeterChat states={STATES} initialMessages={[{ role: "user", content: "hi" }]} />);
    fireEvent.click(screen.getByRole("button", { name: T.en.clear }));
    fireEvent.click(screen.getByRole("button", { name: T.en.clear }));
    await waitFor(() => expect(screen.queryByText("hi")).toBeNull());
    expect(window.localStorage.getItem(STASH)).toBeNull();
  });

  it("tells a screen reader it happened", async () => {
    // Clearing is a change with no visual replacement — the screen just
    // empties. Without an announcement a screen reader user gets silence and
    // cannot tell whether the button worked.
    render(<DemeterChat states={STATES} initialMessages={[{ role: "user", content: "hi" }]} />);
    fireEvent.click(screen.getByRole("button", { name: T.en.clear }));
    fireEvent.click(screen.getByRole("button", { name: T.en.clear }));
    await waitFor(() => expect(screen.getByText(T.en.cleared)).toBeTruthy());
  });
});

describe("a failed send hands the question back", () => {
  it("restores the text so the next tap is Send, not retyping", async () => {
    // The audience is disproportionately on prepaid data and flaky connections.
    // Losing a carefully worded question to a dropped request, and having to
    // type it again, is the opposite of an actionable recovery step.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<DemeterChat states={STATES} />);
    typeAndSend("Do I qualify with two kids?");

    await waitFor(() =>
      expect(
        (screen.getByPlaceholderText(T.en.inputPlaceholder) as HTMLTextAreaElement).value,
      ).toBe("Do I qualify with two kids?"),
    );
    expect(screen.getByRole("alert").textContent).toContain(T.en.errNetwork);
  });

  it("does not leave the unanswered turn in the transcript", async () => {
    // Otherwise sending again duplicates it, and the honest state after a
    // failed send is "you typed this and it did not go" — not "you asked this
    // and were ignored".
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { container } = render(<DemeterChat states={STATES} />);
    typeAndSend("Do I qualify?");
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(container.querySelectorAll(".demeter__msg--user")).toHaveLength(0);
  });

  it("does NOT hand back when the month's budget is spent", async () => {
    // Retrying cannot work, and offering it would loop someone instead of
    // sending them to the 211 number the capacity message gives.
    // 503 + at_capacity is what the route actually returns.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ reason: "at_capacity" }),
      }),
    );
    render(<DemeterChat states={STATES} />);
    typeAndSend("Do I qualify?");
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toContain("211");
    expect(
      (screen.getByPlaceholderText(T.en.inputPlaceholder) as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("tells a daily-capped user it resets TOMORROW, not in a minute", async () => {
    // The route returns 429 for BOTH a per-minute rate limit and a per-IP daily
    // cap, with different bodies and Retry-After values (60s vs 3600s), and its
    // own comment calls them "distinct ON PURPOSE". The client keyed on status
    // alone and showed "give it a minute" for both — so someone who had hit the
    // daily cap sat retrying something that resets tomorrow.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ reason: "ip_daily_cap" }),
      }),
    );
    render(<DemeterChat states={STATES} />);
    typeAndSend("Do I qualify?");
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    const shown = screen.getByRole("alert").textContent ?? "";
    expect(shown).toContain("resets tomorrow");
    expect(shown).not.toContain("give it a minute");
  });

  it("still says 'a minute' for an ordinary rate limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ reason: "rate_limited" }),
      }),
    );
    render(<DemeterChat states={STATES} />);
    typeAndSend("Do I qualify?");
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toContain("give it a minute");
  });
});
