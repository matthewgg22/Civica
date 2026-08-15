"use client";

// Save this conversation — launch criterion #6.
//
// THE RULE THIS COMPONENT EXISTS TO KEEP: nobody is ever blocked from asking a
// question. The chat is free and anonymous and stays that way. An account buys
// exactly one thing, which is coming back later. So a signed-out visitor who
// presses Save is met with an INVITATION and a "not now", never a wall, and the
// chat behind it keeps working either way.
//
// Signed-in state is never asked for up front. The button just posts, and a 401
// IS the answer — which keeps the page free of a cookie read it would otherwise
// need on every render (including every crawl of a page whose whole job is to
// be indexed) and cannot drift out of date the way a render-time flag can.
//
// THE HANDOFF. Signing in is a full-page navigation — PKCE needs one — so the
// transcript has to survive leaving the page. It goes to localStorage, not
// sessionStorage, because a magic link is very often opened in a DIFFERENT TAB
// (the inbox is already open in one), and sessionStorage does not cross tabs;
// the whole email half of the sign-in story would silently lose people's
// conversations. That is a real privacy cost on a shared or borrowed device, so
// it is bounded on both ends: a 30-minute TTL, and the entry is deleted the
// moment it is consumed, or found stale, or the save fails.

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerLang } from "@civica/demeter-engine/packs";
import { MAX_CONVERSATIONS, type SavedMsg } from "../lib/demeter-conversations";

export interface SaveCopy {
  save: string;
  saving: string;
  saved: string;
  viewSaved: string;
  panelTitle: string;
  panelBody: string;
  panelStored: string;
  panelCta: string;
  panelDismiss: string;
  /** Takes the cap rather than hardcoding it, so MAX_CONVERSATIONS can move
   *  without four translations quietly starting to lie about the number. */
  limit: (n: number) => string;
  error: string;
}

const STASH_KEY = "demeter:pending-save";
const STASH_TTL_MS = 30 * 60_000;

type Stash = {
  at: number;
  messages: SavedMsg[];
  state: string | null;
  lang: AnswerLang;
};

/** Exported for the test: the round trip is only correct if what one side
 *  writes is exactly what the other side is prepared to read back. */
export function readStash(now = Date.now()): Stash | null {
  try {
    const raw = window.localStorage.getItem(STASH_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(STASH_KEY);
    const parsed = JSON.parse(raw) as Partial<Stash>;
    if (typeof parsed?.at !== "number" || !Array.isArray(parsed.messages)) return null;
    // Stale means they signed in much later, or on another day entirely, and
    // restoring a conversation they have moved on from would be a surprise.
    if (now - parsed.at > STASH_TTL_MS) return null;
    return {
      at: parsed.at,
      messages: parsed.messages,
      state: parsed.state ?? null,
      lang: (parsed.lang ?? "en") as AnswerLang,
    };
  } catch {
    // Storage disabled, quota, or corrupt JSON. Losing the stash costs one
    // re-press of Save; throwing here would break the page.
    return null;
  }
}

function writeStash(stash: Stash): void {
  try {
    window.localStorage.setItem(STASH_KEY, JSON.stringify(stash));
  } catch {
    /* storage disabled — sign-in still works, the save just won't carry over */
  }
}

/** Cheap change detector for the auto-update. Length alone misses the last
 *  answer growing as it streams; this is only ever consulted once the stream
 *  has finished, but a fingerprint that can't see the difference would make
 *  "keep it up to date" quietly mean "keep the first version". */
function fingerprint(messages: SavedMsg[]): string {
  return `${messages.length}:${messages[messages.length - 1]?.content.length ?? 0}`;
}

export function DemeterSave({
  messages,
  state,
  lang,
  busy,
  pendingSave,
  initialSavedId,
  onRestore,
  onSavedChange,
  triggerSave,
  copy,
}: {
  messages: SavedMsg[];
  state: string | null;
  lang: AnswerLang;
  busy: boolean;
  /** Set by ?save=pending — we have just come back from signing in. */
  pendingSave: boolean;
  /** Set when the page was opened as ?c=<id>: already saved, keep it current. */
  initialSavedId: string | null;
  onRestore: (messages: SavedMsg[], state: string | null, lang: AnswerLang) => void;
  /** Reported upward only so the worksheet's privacy line can stop saying the
   *  conversation is gone when the tab closes (#703). Deliberately a
   *  notification, not a lift: whether a row exists is this component's fact,
   *  and a second copy of it in the parent is a second thing to get wrong. */
  onSavedChange?: (saved: boolean) => void;
  /** Bumped by the composer's own save-nudge banner (#833 audit,
   *  2026-08-15) — the Save button lives in a side rail nobody notices
   *  mid-conversation, so pressing "Save it" on the inline nudge has to
   *  reach this button's own `save()` without duplicating its logic.
   *  Mirrors openPicker's signal-number pattern: any CHANGE triggers a
   *  save, the value itself is meaningless. Undefined/unset never fires. */
  triggerSave?: number;
  copy: SaveCopy;
}) {
  const [savedId, setSavedId] = useState<string | null>(initialSavedId);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "signin" | "limit" | "error">(
    initialSavedId ? "saved" : "idle",
  );
  const savedFingerprintRef = useRef<string | null>(initialSavedId ? fingerprint(messages) : null);
  // Where sign-in should send them back to. The localized pages are real URLs
  // (/es/screen/ask), so a hardcoded /screen/ask would quietly drop a Spanish
  // speaker onto the English page as the reward for making an account. Resolved
  // after mount; the server-rendered default is the English path, which is
  // correct for the page that default is rendered on.
  /** The server's own reason for a failed save, shown to the reader and
   *  therefore reportable. Null until something fails. */
  const [failure, setFailure] = useState<string | null>(null);
  const [limitValue, setLimitValue] = useState(MAX_CONVERSATIONS);
  const [returnPath, setReturnPath] = useState("/screen/ask");
  useEffect(() => setReturnPath(window.location.pathname), []);
  // Guards the mount-time restore against React 18/19 double-invoked effects in
  // development, which would otherwise post the restored transcript twice and
  // leave two identical conversations in the list.
  const restoredRef = useRef(false);

  useEffect(() => onSavedChange?.(savedId !== null), [savedId, onSavedChange]);

  const post = useCallback(
    async (
      payload: { messages: SavedMsg[]; state: string | null; lang: AnswerLang },
      id: string | null,
    ): Promise<"ok" | "signin" | "limit" | "error"> => {
      try {
        const res = await fetch("/api/demeter/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: id ?? undefined }),
        });
        if (res.status === 401) return "signin";
        if (res.status === 409) {
          const body = (await res.json().catch(() => ({}))) as { limit?: number };
          if (typeof body.limit === "number") setLimitValue(body.limit);
          return "limit";
        }
        if (!res.ok) {
          // WHY it failed, kept. Every non-401 failure produced the same
          // sentence — "That didn't save. Please try again." — so a rejected
          // payload, a database error and a dropped connection were
          // indistinguishable to the reader AND to anyone they reported it to.
          // Retrying is the right advice for exactly one of those three.
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setFailure(body.error ?? `http_${res.status}`);
          return "error";
        }
        const data = (await res.json()) as { conversation?: { id?: string } };
        if (data.conversation?.id) {
          setSavedId(data.conversation.id);
          savedFingerprintRef.current = fingerprint(payload.messages);
        }
        return "ok";
      } catch {
        setFailure("network");
        return "error";
      }
    },
    [],
  );

  const save = useCallback(async () => {
    if (messages.length === 0) return;
    setStatus("saving");
    const outcome = await post({ messages, state, lang }, savedId);
    if (outcome === "ok") return setStatus("saved");
    if (outcome === "signin") {
      writeStash({ at: Date.now(), messages, state, lang });
      return setStatus("signin");
    }
    setStatus(outcome === "limit" ? "limit" : "error");
  }, [messages, state, lang, savedId, post]);

  // Fired by the composer's inline save-nudge banner (#833 audit,
  // 2026-08-15). A ref, not state, tracks the last value acted on: this
  // only reacts to a CHANGE (mirrors DemeterChat's openPicker signal),
  // so the effect doesn't re-fire on every unrelated re-render just
  // because `triggerSave` is still the same number it was last render.
  const lastTriggerRef = useRef(triggerSave);
  useEffect(() => {
    if (triggerSave === undefined || triggerSave === lastTriggerRef.current) return;
    lastTriggerRef.current = triggerSave;
    void save();
  }, [triggerSave, save]);

  // Coming back from sign-in: put the conversation back on screen FIRST, then
  // save it. Landing on an empty chat with a "saved" badge would be a worse
  // outcome than not offering this at all.
  useEffect(() => {
    if (!pendingSave || restoredRef.current) return;
    restoredRef.current = true;
    const stash = readStash();
    if (!stash || stash.messages.length === 0) return;
    onRestore(stash.messages, stash.state, stash.lang);
    setStatus("saving");
    void post({ messages: stash.messages, state: stash.state, lang: stash.lang }, null).then(
      (outcome) => {
        // Still signed out after signing in means something is genuinely
        // wrong; the stash is already consumed, so offer the plain error
        // rather than looping them back through sign-in.
        setStatus(outcome === "ok" ? "saved" : outcome === "limit" ? "limit" : "error");
      },
    );
  }, [pendingSave, onRestore, post]);

  // Once saved, stay saved: each finished answer updates the row, so resuming
  // shows the whole conversation and not the prefix that existed at the moment
  // they pressed the button.
  useEffect(() => {
    if (!savedId || busy || messages.length === 0) return;
    if (fingerprint(messages) === savedFingerprintRef.current) return;
    void post({ messages, state, lang }, savedId);
  }, [savedId, busy, messages, state, lang, post]);

  // Nothing worth saving until an answer has actually arrived.
  const hasAnswer = messages.some((m) => m.role === "assistant" && m.content !== "");
  if (!hasAnswer && status === "idle") return null;

  if (status === "signin") {
    // next= carries the marker the effect above keys off, so the save resumes
    // by itself on return. Same-origin relative path — /api/auth/magic-link and
    // /auth/callback both re-validate it before redirecting anywhere.
    const next = encodeURIComponent(`${returnPath}?save=pending`);
    return (
      <div className="demeter__savepanel" role="dialog" aria-label={copy.panelTitle}>
        <p className="demeter__savepanel-title">{copy.panelTitle}</p>
        <p className="demeter__savepanel-body">{copy.panelBody}</p>
        <p className="demeter__savepanel-stored">{copy.panelStored}</p>
        <div className="demeter__savepanel-actions">
          <a className="demeter__savepanel-cta" href={`/sign-in?next=${next}`}>
            {copy.panelCta}
          </a>
          <button
            type="button"
            className="demeter__savepanel-dismiss"
            onClick={() => setStatus("idle")}
          >
            {copy.panelDismiss}
          </button>
        </div>
      </div>
    );
  }

  if (status === "saved") {
    return (
      <span className="demeter__saved">
        <span className="demeter__saved-mark" aria-hidden>✓</span>
        {copy.saved}
        {/* ?lang carries the chat's language to the list, which has no route
            of its own per language — otherwise saving from /vi/screen/ask
            hands someone an English page as the reward for making an account. */}
        <a className="demeter__saved-link" href={`/screen/saved?lang=${lang}`}>
          {copy.viewSaved}
        </a>
      </span>
    );
  }

  return (
    <span className="demeter__savewrap">
      <button
        type="button"
        className="demeter__save"
        onClick={() => void save()}
        disabled={status === "saving"}
      >
        {status === "saving" ? copy.saving : copy.save}
      </button>
      {(status === "limit" || status === "error") && (
        <span className="demeter__save-error" role="alert">
          {status === "limit" ? copy.limit(limitValue) : copy.error}
          {status === "error" && failure && (
            <span className="demeter__save-code"> ({failure})</span>
          )}
        </span>
      )}
    </span>
  );
}
