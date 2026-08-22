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

import type { PartialFacts } from "@civica/demeter-engine";
import type { ScreeningClassification } from "@civica/demeter-engine";
import type { SavedMsg } from "./demeter-conversations";

const KEY = "demeter:chat";

/** The estimate rail's whole state, as one carriable value (#898 P2-9). The
 *  transcript used to survive a page change while the drafted application did
 *  not — mode reset, facts remounted empty, verdict gone — which read as the
 *  product deleting someone's work at exactly the moment they tried to keep
 *  it. Everything in here is plain JSON already (facts and classification
 *  both cross the worksheet API as JSON). */
export interface WorksheetSnapshot {
  mode: "ask" | "estimate";
  facts: PartialFacts;
  classification: ScreeningClassification | null;
}

export interface ChatSession {
  messages: SavedMsg[];
  state: string | null;
  lang: string;
  worksheet?: WorksheetSnapshot;
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
    const { messages, state, lang, worksheet } = parsed as Partial<ChatSession>;
    if (!Array.isArray(messages) || messages.length === 0) return null;
    const session: ChatSession = {
      messages,
      state: state ?? null,
      lang: typeof lang === "string" ? lang : "en",
    };
    // Tolerant on purpose: sessions stored before the worksheet existed, or a
    // hand-corrupted mode, restore as a plain conversation rather than not at
    // all.
    if (worksheet && (worksheet.mode === "ask" || worksheet.mode === "estimate")) {
      session.worksheet = {
        mode: worksheet.mode,
        facts: worksheet.facts ?? {},
        classification: worksheet.classification ?? null,
      };
    }
    return session;
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
