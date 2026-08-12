// A conversation surviving a trip to another page.
//
// THE FAILURE: someone spent a long conversation working out their situation,
// clicked "Application questions" in the header to read something, came back,
// and the whole thing was gone. Nothing warned them. Nothing had offered to
// keep it — the save control was above the transcript, where it appears before
// there is anything to save and scrolls away once there is.
//
// A beforeunload warning does not fix that case AT ALL. Next.js navigates
// between /chat and /questions on the client, so the page never unloads and
// the browser never asks. The component simply unmounts and the state is gone.
// So the transcript is written to sessionStorage and read back on mount, and
// the navigation stops losing anything instead of warning about it.
//
// sessionStorage, not localStorage, and that is the whole privacy argument:
// it is scoped to this tab and dies when the tab closes. That is exactly what
// the panel already promises — "close this tab and you cannot return to this
// conversation" — so this changes nothing about what is retained, only about
// whether an in-tab page change counts as closing it. On a shared machine the
// next person still gets nothing.

import type { SavedMsg } from "./demeter-conversations";

const KEY = "demeter:chat";

export interface ChatSession {
  messages: SavedMsg[];
  state: string | null;
  lang: string;
}

/** Cheap ceiling so a very long conversation cannot fill the tab's quota and
 *  start throwing on every keystroke. Well above any real transcript. */
const MAX_CHARS = 200_000;

export function saveChatSession(session: ChatSession): void {
  try {
    if (session.messages.length === 0) return void window.sessionStorage.removeItem(KEY);
    const raw = JSON.stringify(session);
    if (raw.length > MAX_CHARS) return;
    window.sessionStorage.setItem(KEY, raw);
  } catch {
    /* storage disabled or full — the conversation still works, it just will
       not survive a page change. Never worth throwing into a render for. */
  }
}

export function readChatSession(): ChatSession | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { messages, state, lang } = parsed as Partial<ChatSession>;
    if (!Array.isArray(messages) || messages.length === 0) return null;
    return { messages, state: state ?? null, lang: typeof lang === "string" ? lang : "en" };
  } catch {
    return null;
  }
}

export function clearChatSession(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing was stored either */
  }
}
