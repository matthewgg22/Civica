// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { DemeterSave } from "../DemeterSave";
import type { SavedMsg } from "../../lib/demeter-conversations";

// Save/resume on the public chat.
//
// The rule every one of these guards: NOBODY IS EVER BLOCKED FROM ASKING. The
// chat is free and anonymous, and an account buys exactly one thing — coming
// back later. A signed-out visitor who presses Save must get an invitation with
// a way out of it, never a wall, and the transcript has to survive the
// full-page navigation that signing in requires.

const COPY = {
  save: "Save this conversation",
  saving: "Saving…",
  saved: "Saved",
  viewSaved: "Your conversations",
  panelTitle: "Save this conversation",
  panelBody: "Make a free account and this conversation will be here when you come back.",
  panelStored: "We keep what you typed, word for word.",
  panelCta: "Sign in to save",
  panelDismiss: "Not now",
  limit: (n: number) => `You've saved ${n} conversations.`,
  error: "That didn't save. Please try again.",
} as const;

const CONVERSATION: SavedMsg[] = [
  { role: "user", content: "What's the income limit for my household?" },
  { role: "assistant", content: "For a household of two in California…" },
];

const fetchMock = vi.fn();

// vitest's jsdom environment does not expose window.localStorage on the Node
// versions this repo runs (probed: `typeof window.localStorage === "undefined"`
// even with a real http:// origin). Real browsers obviously have it, so the
// component is right to use it — the test environment is what needs the
// stand-in. Minimal on purpose: the component only ever gets/sets/removes.
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
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  installStorage();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderSave(props: Partial<Parameters<typeof DemeterSave>[0]> = {}) {
  return render(
    <DemeterSave
      messages={CONVERSATION}
      state="CA"
      lang="en"
      busy={false}
      pendingSave={false}
      initialSavedId={null}
      onRestore={props.onRestore ?? (() => {})}
      copy={COPY}
      {...props}
    />,
  );
}

const bodyOf = (i = 0) => JSON.parse((fetchMock.mock.calls[i]![1] as RequestInit).body as string);

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("when there is nothing to save", () => {
  it("shows no button before an answer has arrived", () => {
    renderSave({ messages: [{ role: "user", content: "hello?" }] });
    expect(screen.queryByRole("button", { name: COPY.save })).toBeNull();
  });

  it("shows no button while the first answer is still streaming", () => {
    // The chat appends an EMPTY assistant bubble as a placeholder. Offering
    // Save then would capture a half-written answer.
    renderSave({
      messages: [{ role: "user", content: "hello?" }, { role: "assistant", content: "" }],
      busy: true,
    });
    expect(screen.queryByRole("button", { name: COPY.save })).toBeNull();
  });
});

describe("signed in", () => {
  it("saves and offers the way back to the list", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { conversation: { id: "conv-1" } }));
    renderSave();

    fireEvent.click(screen.getByRole("button", { name: COPY.save }));

    await screen.findByText(COPY.saved);
    expect(screen.getByRole("link", { name: COPY.viewSaved })).toHaveProperty(
      "search",
      "?lang=en",
    );
    expect(bodyOf()).toMatchObject({ messages: CONVERSATION, state: "CA", lang: "en" });
  });

  it("saves when triggerSave changes, without a click on its own button (#833 audit)", async () => {
    // The chat's inline save-nudge banner has no way to press THIS button —
    // it lives in a side panel the reader may never have scrolled to. This
    // is the plumbing that lets "Save it" on the nudge reach the same
    // save() the button itself calls, without a second, drifting copy of
    // the save logic living in DemeterChat.
    fetchMock.mockResolvedValue(jsonResponse(201, { conversation: { id: "conv-1" } }));
    const { rerender } = renderSave({ triggerSave: 0 });
    expect(fetchMock).not.toHaveBeenCalled();

    rerender(
      <DemeterSave
        messages={CONVERSATION}
        state="CA"
        lang="en"
        busy={false}
        pendingSave={false}
        initialSavedId={null}
        onRestore={() => {}}
        triggerSave={1}
        copy={COPY}
      />,
    );

    await screen.findByText(COPY.saved);
    expect(bodyOf()).toMatchObject({ messages: CONVERSATION, state: "CA", lang: "en" });
  });

  it("keeps the saved conversation up to date as the chat continues", async () => {
    // Saving a prefix and never updating it would mean resume shows the
    // conversation as it was at the moment they pressed the button, not as
    // they left it.
    fetchMock.mockResolvedValue(jsonResponse(201, { conversation: { id: "conv-1" } }));
    const { rerender } = renderSave();
    fireEvent.click(screen.getByRole("button", { name: COPY.save }));
    await screen.findByText(COPY.saved);

    const longer: SavedMsg[] = [
      ...CONVERSATION,
      { role: "user", content: "and if my rent goes up?" },
      { role: "assistant", content: "Then the shelter deduction…" },
    ];
    rerender(
      <DemeterSave
        messages={longer}
        state="CA"
        lang="en"
        busy={false}
        pendingSave={false}
        initialSavedId={null}
        onRestore={() => {}}
        copy={COPY}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    // Same row, not a second conversation.
    expect(bodyOf(1)).toMatchObject({ id: "conv-1", messages: longer });
  });

  it("does not re-save while an answer is still streaming", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { conversation: { id: "conv-1" } }));
    const { rerender } = renderSave();
    fireEvent.click(screen.getByRole("button", { name: COPY.save }));
    await screen.findByText(COPY.saved);

    rerender(
      <DemeterSave
        messages={[...CONVERSATION, { role: "assistant", content: "partial…" }]}
        state="CA"
        lang="en"
        busy
        pendingSave={false}
        initialSavedId={null}
        onRestore={() => {}}
        copy={COPY}
      />,
    );
    // Still just the original save.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("signed out — an invitation, never a wall", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "sign_in_required" }));
  });

  it("offers sign-in and a way to decline it", async () => {
    renderSave();
    fireEvent.click(screen.getByRole("button", { name: COPY.save }));

    await screen.findByText(COPY.panelTitle);
    expect(screen.getByRole("link", { name: COPY.panelCta })).toBeTruthy();

    // "Not now" must return them to the chat with the offer gone — the whole
    // premise is that declining costs nothing.
    fireEvent.click(screen.getByRole("button", { name: COPY.panelDismiss }));
    // By role, not by text: the panel's heading and the button share the same
    // wording, so a text query matches the button that replaces the panel.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: COPY.save })).toBeTruthy();
  });

  it("holds the transcript so it survives the trip through sign-in", async () => {
    renderSave();
    fireEvent.click(screen.getByRole("button", { name: COPY.save }));
    await screen.findByText(COPY.panelTitle);

    const stash = JSON.parse(window.localStorage.getItem("demeter:pending-save")!);
    expect(stash).toMatchObject({ messages: CONVERSATION, state: "CA", lang: "en" });
    expect(typeof stash.at).toBe("number");
  });

  it("sends them back to the page they were on, not always the English one", async () => {
    window.history.replaceState({}, "", "/es/screen/ask");
    renderSave({ lang: "es" });
    fireEvent.click(screen.getByRole("button", { name: COPY.save }));

    await screen.findByText(COPY.panelTitle);
    const href = screen.getByRole("link", { name: COPY.panelCta }).getAttribute("href");
    expect(href).toBe(
      `/sign-in?next=${encodeURIComponent("/es/screen/ask?save=pending")}&lang=es`,
    );
    window.history.replaceState({}, "", "/");
  });

  it("carries the chat's language to the sign-in page itself (#694)", async () => {
    // The sign-in page can sniff /vi/… from next, but the explicit param is
    // what keeps a Vietnamese reader in Vietnamese even if the path shape
    // ever changes — same belt-and-braces as /screen/saved?lang=.
    renderSave({ lang: "vi" });
    fireEvent.click(screen.getByRole("button", { name: COPY.save }));
    await screen.findByText(COPY.panelTitle);
    const href = screen.getByRole("link", { name: COPY.panelCta }).getAttribute("href");
    expect(href).toContain("&lang=vi");
  });
});

describe("coming back from sign-in", () => {
  it("puts the conversation back on screen and then saves it", async () => {
    window.localStorage.setItem(
      "demeter:pending-save",
      JSON.stringify({ at: Date.now(), messages: CONVERSATION, state: "CA", lang: "en" }),
    );
    fetchMock.mockResolvedValue(jsonResponse(201, { conversation: { id: "conv-9" } }));
    const onRestore = vi.fn();

    renderSave({ messages: [], pendingSave: true, onRestore });

    // Restored FIRST: landing on an empty chat with a "saved" badge would be a
    // worse outcome than not offering this at all.
    // Fourth arg: the worksheet slot (#898 P2-9) — undefined for a stash
    // written before it existed, and the restore must still work.
    await waitFor(() =>
      expect(onRestore).toHaveBeenCalledWith(CONVERSATION, "CA", "en", undefined),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(bodyOf()).toMatchObject({ messages: CONVERSATION });
    // Consumed, so a later reload cannot resurrect someone's transcript.
    expect(window.localStorage.getItem("demeter:pending-save")).toBeNull();
  });

  it("ignores a stash left over from hours ago", async () => {
    window.localStorage.setItem(
      "demeter:pending-save",
      JSON.stringify({
        at: Date.now() - 60 * 60_000,
        messages: CONVERSATION,
        state: "CA",
        lang: "en",
      }),
    );
    const onRestore = vi.fn();
    renderSave({ messages: [], pendingSave: true, onRestore });

    await waitFor(() =>
      expect(window.localStorage.getItem("demeter:pending-save")).toBeNull(),
    );
    expect(onRestore).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// #898 P2-9: the tester saved at the END of a full conversation — the moment
// the drafted application matters most — and came back from sign-in to a
// restored transcript with the estimate rail wiped. The stash carried
// messages/state/lang and silently dropped the worksheet.
describe("the worksheet survives the trip through sign-in (#898 P2-9)", () => {
  const WORKSHEET = {
    mode: "estimate" as const,
    facts: { household: [{ member_id: "a", age: 45, role: "head" }] },
    classification: {
      outcome: "likely_eligible",
      summary: "Net income falls under the one-person limit.",
      completeness: { computable: true, stillNeeded: [], rawErrors: [] },
    },
  };

  it("stashes the worksheet beside the transcript", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "sign_in_required" }));
    renderSave({ worksheet: () => WORKSHEET } as Partial<Parameters<typeof DemeterSave>[0]>);
    fireEvent.click(screen.getByRole("button", { name: COPY.save }));
    await screen.findByText(COPY.panelTitle);

    const stash = JSON.parse(window.localStorage.getItem("demeter:pending-save")!);
    expect(stash.worksheet).toEqual(WORKSHEET);
  });

  // #905: the SAVED ROW carries the worksheet too, so a conversation reopened
  // days later gets its drafted application back — not only the same-session
  // stash paths P2-9 fixed.
  it("posts the worksheet with a signed-in save", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { conversation: { id: "conv-1" } }));
    renderSave({ worksheet: () => WORKSHEET } as Partial<Parameters<typeof DemeterSave>[0]>);
    fireEvent.click(screen.getByRole("button", { name: COPY.save }));
    await screen.findByText(COPY.saved);
    expect(bodyOf()).toMatchObject({ worksheet: WORKSHEET });
  });

  it("posts the stashed worksheet when completing a save after sign-in", async () => {
    window.localStorage.setItem(
      "demeter:pending-save",
      JSON.stringify({
        at: Date.now(),
        messages: CONVERSATION,
        state: "CA",
        lang: "en",
        worksheet: WORKSHEET,
      }),
    );
    fetchMock.mockResolvedValue(jsonResponse(201, { conversation: { id: "conv-9" } }));
    renderSave({ messages: [], pendingSave: true, onRestore: vi.fn() });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(bodyOf()).toMatchObject({ worksheet: WORKSHEET });
  });

  it("hands the worksheet back on return, with the conversation", async () => {
    window.localStorage.setItem(
      "demeter:pending-save",
      JSON.stringify({
        at: Date.now(),
        messages: CONVERSATION,
        state: "CA",
        lang: "en",
        worksheet: WORKSHEET,
      }),
    );
    fetchMock.mockResolvedValue(jsonResponse(201, { conversation: { id: "conv-9" } }));
    const onRestore = vi.fn();
    renderSave({ messages: [], pendingSave: true, onRestore });

    await waitFor(() =>
      expect(onRestore).toHaveBeenCalledWith(CONVERSATION, "CA", "en", WORKSHEET),
    );
  });
});

describe("when saving cannot succeed", () => {
  it("reports the cap with the number the server actually enforces", async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { error: "limit_reached", limit: 50 }));
    renderSave();
    fireEvent.click(screen.getByRole("button", { name: COPY.save }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "You've saved 50 conversations.",
    );
  });

  // A reader reported "it says that didn't save" and there was no way to act on
  // that: a rejected payload, a database failure and a dropped connection all
  // produced the same sentence, and "please try again" is the right advice for
  // exactly one of them. The reason now travels with the message.
  it("names the server's reason on a server error, and leaves the button usable", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: "save_failed" }));
    renderSave();
    fireEvent.click(screen.getByRole("button", { name: COPY.save }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(COPY.error);
    expect(alert.textContent).toContain("save_failed");
    expect(screen.getByRole("button", { name: COPY.save })).toHaveProperty("disabled", false);
  });

  it("falls back to the status code when the body carries no reason", async () => {
    fetchMock.mockResolvedValue(jsonResponse(502, {}));
    renderSave();
    fireEvent.click(screen.getByRole("button", { name: COPY.save }));
    expect((await screen.findByRole("alert")).textContent).toContain("http_502");
  });

  it("survives the network being gone, and says that is what happened", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    renderSave();
    fireEvent.click(screen.getByRole("button", { name: COPY.save }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(COPY.error);
    expect(alert.textContent).toContain("network");
  });
});
