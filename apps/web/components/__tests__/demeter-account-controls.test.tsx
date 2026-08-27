// @vitest-environment jsdom
//
// The two things an account was missing (owner, 2026-08-26):
//
//   1. A WAY BACK OUT. Signing in had no matching exit anywhere in the
//      product. The route existed — POST /api/auth/sign-out — and only
//      /status ever called it. On a shared or borrowed device, which this
//      product's readers use, an account you cannot leave is worse than none.
//
//   2. SAVING THAT HAPPENS. Save was a button in a side rail, and the report
//      was simply "there is no way to save the conversation" — which is what
//      a control nobody finds amounts to. Signed in, the conversation keeps
//      itself now.
//
// Both hang off the same fact: authEmail, probed once from the Supabase
// session. NULL IS THE DEFAULT AND THE FAILURE VALUE, so everything here errs
// toward signed-out — which for auto-save is the safe direction, since a save
// attempt without a session opens the sign-in panel, and putting a login in
// front of someone mid-answer is the one thing this product promises not to do.
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";

const mockGetSession = vi.fn();
vi.mock("../../lib/supabase-browser", () => ({
  supabaseBrowser: () => ({ auth: { getSession: mockGetSession } }),
}));

import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

function signedIn(email = "someone@example.org") {
  mockGetSession.mockResolvedValue({ data: { session: { user: { email } } } });
}
function signedOut() {
  mockGetSession.mockResolvedValue({ data: { session: null } });
}

const TURN = [
  { role: "user" as const, content: "Do I qualify?" },
  { role: "assistant" as const, content: "It depends on your household size." },
];

function chat(initialMessages: typeof TURN = []) {
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
  ).container;
}

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchSpy);
  // jsdom refuses a real navigation; the component only needs the call.
  vi.stubGlobal("location", { ...window.location, assign: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mockGetSession.mockReset();
});

describe("signing out", () => {
  it("is offered with the identity it ends", async () => {
    signedIn();
    const c = chat();
    const out = await waitFor(() => {
      const b = c.querySelector("button.demeter__signout");
      expect(b, "no sign-out control while signed in").not.toBeNull();
      return b!;
    });
    expect(out.textContent).toBe(T.en.sidebarSignOut);
    // It sits with the email, not off in a menu somewhere.
    expect(out.closest(".demeter__sidebarauth")?.textContent).toContain("someone@example.org");
  });

  it("posts to the route that already existed, then reloads", async () => {
    signedIn();
    const c = chat();
    const out = await waitFor(() => {
      const b = c.querySelector("button.demeter__signout");
      expect(b).not.toBeNull();
      return b!;
    });
    fireEvent.click(out);
    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/auth/sign-out" &&
            (init as RequestInit | undefined)?.method === "POST",
        ),
        "sign-out was not posted",
      ).toBe(true);
    });
    // A full navigation, so no signed-in state survives in memory.
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith("/chat"));
  });

  it("is absent while signed out — there is nothing to leave", async () => {
    signedOut();
    const c = chat();
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
    expect(c.querySelector("button.demeter__signout")).toBeNull();
    expect(c.querySelector(".demeter__sidebarauth")).toBeNull();
  });
});

describe("auto-save", () => {
  const savePosts = () =>
    fetchSpy.mock.calls.filter(([url]) => String(url) === "/api/demeter/conversations");

  it("keeps the conversation without being asked, once signed in", async () => {
    signedIn();
    chat(TURN);
    await waitFor(() => expect(savePosts().length).toBeGreaterThan(0));
  });

  it("says that it is doing so", async () => {
    signedIn();
    const c = chat(TURN);
    await waitFor(() =>
      expect(c.querySelector(".demeter__sidebarauth")?.textContent).toContain(
        T.en.sidebarAutosaved,
      ),
    );
  });

  it("NEVER fires signed out — that would put a login in front of an answer", async () => {
    signedOut();
    chat(TURN);
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
    // Give any stray effect the same window the signed-in case needed.
    await new Promise((r) => setTimeout(r, 50));
    expect(savePosts().length, "a save was attempted with no session").toBe(0);
  });

  it("saves a completed turn exactly once", async () => {
    // HONEST ABOUT ITS REACH: with the effect keyed on [authEmail, busy,
    // messages], nothing here re-runs it for an unchanged turn, so this
    // passes with the autoSavedCount guard REMOVED — checked, 2026-08-26.
    // That guard is for the case this test cannot reach from outside: a
    // `messages` array that gets a new identity without changing, which
    // would re-fire the effect and upsert again. Kept as belt-and-braces,
    // not as something this asserts.
    //
    // What it does pin is the count. One completed turn, one save — so a
    // future change that fires per render shows up here as a number rather
    // than as an upsert storm nobody sees.
    signedIn();
    chat(TURN);
    await waitFor(() => expect(savePosts().length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 60));
    expect(savePosts().length, "one finished turn should be one save").toBe(1);
  });
});
