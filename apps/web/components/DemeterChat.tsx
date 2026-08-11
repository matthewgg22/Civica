"use client";

// Demeter — the public SNAP answers chat (mobile-first: F8 acceptance criteria).
//
// Behaviors wired to the engine protocol:
//  - streaming plain text; the RECOMPOSE marker REPLACES the unverified draft;
//  - state selector: verified states carry a ✓ badge; "All states" = the
//    federal floor (the engine never defaults a public user to any state);
//  - switching state mid-chat inserts a visible divider (answers re-scope);
//  - EN/ES toggle (answers only — citations stay verbatim);
//  - 429 / at-capacity / unconfigured states render honest, warm errors.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  RECOMPOSE_MARKER,
  ANSWER_LANGS,
  LANG_NATIVE_NAME,
  type PackMeta,
  type AnswerLang,
} from "@civica/demeter-engine/packs";
// TYPE-ONLY from the root barrel: erased at compile time, so this costs the
// browser bundle nothing. A VALUE import here would drag the 1MB eCFR corpus
// onto every phone — the reason the client-safe /packs entry exists at all.
import type { ScreeningClassification, PartialFacts } from "@civica/demeter-engine";
import { DemeterMark } from "./DemeterMark";
import { DemeterStatePicker } from "./DemeterStatePicker";
import { DemeterWorksheet } from "./DemeterWorksheet";
import { DemeterFeedback } from "./DemeterFeedback";
import { DemeterSave } from "./DemeterSave";
import { T } from "../lib/i18n/demeter-chat-copy";
import type { SavedMsg } from "../lib/demeter-conversations";

/** Read the certainty verdict back off a finished answer.
 *
 *  Keys off the ✓ / ⚠ MARK, not the label: certainty.ts localizes the label
 *  ("CERTAIN" / "SEGURO" / "CHẮC CHẮN" / "确定") but the mark is the same in
 *  every language, so this stays correct as languages are added. Returns null
 *  while an answer is still streaming and the trailer has not arrived. */
export function readCertainty(answer: string): "certain" | "uncertain" | null {
  if (answer.includes("\n✓ **")) return "certain";
  if (answer.includes("\n⚠ **")) return "uncertain";
  return null;
}

/** What a screen reader is told when an answer finishes.
 *
 *  Built ENTIRELY from text already on screen — the certainty banner line as
 *  certainty.ts localized it, plus the answer body. No new strings, so this
 *  cannot drift from what a sighted reader sees and needs no fifth translation
 *  of anything.
 *
 *  The citation trailer is deliberately EXCLUDED. It is a list of links after a
 *  `---` rule; read aloud it is a long recitation of section numbers between
 *  the reader and the next thing they want to do. It stays in the transcript,
 *  which is navigable — a screen reader user reaches it by moving through the
 *  document, which is how they would want to read a reference list anyway.
 *
 *  The VERDICT leads. An answer spoken without "certain" or "uncertain" is the
 *  overconfidence the citation verifier exists to prevent; a sighted reader
 *  sees that banner, so a screen reader user has to hear it, and hear it first.
 *
 *  Markdown emphasis is stripped: a screen reader reads `**` aloud as "star
 *  star" or, worse, silently changes voice mid-sentence. */
export function announcementFor(answer: string): string {
  const lines = answer.split("\n");
  const banner = lines.find((l) => l.startsWith("✓ **") || l.startsWith("⚠ **")) ?? "";
  const body = answer.split(/\n-{3,}\n/)[0] ?? "";
  const strip = (s: string) => s.replace(/\*\*/g, "").replace(/(^|\s)\*(\S[^*]*)\*/g, "$1$2").trim();
  return [strip(banner), strip(body)].filter(Boolean).join(". ");
}

// The saved-conversation shape IS the chat's shape, deliberately: resume is
// then a straight hydrate with no translation layer, and a message that can be
// rendered is by construction a message that can be saved and read back.
type Msg = SavedMsg;



// Answers arrive as light markdown (the engine's prompt asks for bold, bullets,
// and a `---` rule before the citation trailer). Render exactly that subset as
// React nodes — never raw HTML, so streamed content has no injection surface.
// Bullets and line breaks come free from the bubble's `white-space: pre-wrap`.
function renderInline(line: string, keyBase: string): ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return parts.map((p, j) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return <strong key={`${keyBase}b${j}`}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
      return <em key={`${keyBase}i${j}`}>{p.slice(1, -1)}</em>;
    }
    return p;
  });
}

export function renderAnswer(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (line.trim() === "---") {
      out.push(<hr key={`hr${i}`} className="demeter__rule" />);
      return;
    }
    if (i > 0 && lines[i - 1]?.trim() !== "---") out.push("\n");
    out.push(...renderInline(line, `l${i}`));
  });
  return out;
}

// The copy table lives in lib/i18n/demeter-chat-copy.ts, NOT here.
// This is a "use client" module, and a server component cannot import a plain
// value across that boundary — it arrives undefined at runtime. /screen/ask
// renders the entry card on the server and needs it.
// Re-exported so existing imports of `T` from this file keep working.
export { T };


export function DemeterChat({
  states,
  initialState = null,
  initialQuestion = null,
  initialLang = "en",
  initialMessages = [],
  savedConversationId = null,
  pendingSave = false,
  geoHint = null,
}: {
  states: PackMeta[];
  initialState?: string | null;
  initialQuestion?: string | null;
  /** Set by the localized routes so the chat opens in the page's language
   *  rather than rendering English and then flipping after hydration. */
  initialLang?: AnswerLang;
  /** A resumed conversation's transcript (?c=<id>), loaded server-side. */
  initialMessages?: Msg[];
  /** The id being resumed — new answers keep updating that same row. */
  savedConversationId?: string | null;
  /** ?save=pending — we have just come back from signing in and there is a
   *  conversation waiting in localStorage to be restored and saved. */
  pendingSave?: boolean;
  /** IP-derived state suggestion, resolved at the edge and passed in from the
   *  server component. OFFERED in the picker, never applied — see
   *  lib/geo-hint.ts for why this is not navigator.geolocation. */
  geoHint?: string | null;
}) {
  const [lang, setLang] = useState<AnswerLang>(initialLang);
  const [state, setState] = useState<string | null>(initialState);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState(initialQuestion ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The right rail's state. Held HERE and nowhere else — never persisted, so
  // it dies with the tab (see the worksheet route's header). Facts live in a
  // ref rather than state: nothing renders them directly (the rail renders the
  // CLASSIFICATION), and a ref is always current inside the async callback,
  // where a state value would be a stale closure a turn behind.
  const factsRef = useRef<PartialFacts>({});
  const [classification, setClassification] = useState<ScreeningClassification | null>(null);
  // Bumped by the estimate rail to open the state picker. Without a state
  // there is no benefit calculation at all, so this is the difference between
  // a live estimate and a dead rail for anyone who never touched the picker.
  const [openPicker, setOpenPicker] = useState(0);
  // Reported up by DemeterSave. Used for one thing only: the estimate rail's
  // privacy line, whose "close the tab and it is gone" half stops being true
  // the moment a row exists (#703). Seeded from the prop so resuming a saved
  // conversation reads correctly on the very first paint.
  const [conversationSaved, setConversationSaved] = useState(savedConversationId !== null);
  // Anonymous funnel key. Random, per-tab, dies with the tab, never sent to
  // the model — it exists only so the log can tell "asked once and left" from
  // "stayed and got somewhere", which nothing could distinguish before.
  // Lazy initialiser so it is generated once, not on every render.
  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current) {
    sessionIdRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "";
  }
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const t = T[lang];

  // What the live region below the transcript currently holds. Set ONLY when a
  // stream finishes — see the region's own comment for why announcing tokens is
  // worse than announcing nothing.
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    // While busy, the last bubble is still filling; announcing now would be
    // announcing a fragment, and would re-announce on every token.
    if (busy) return;
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant" || !last.content) return;
    setAnnouncement(announcementFor(last.content));
  }, [busy, messages]);

  // THE JUDDER FIX. This used to run on [messages, busy] with behavior:"smooth".
  // `messages` changes on EVERY streamed token, so every token started a new
  // smooth-scroll animation that cancelled the one still in flight — the scroll
  // never completed a single easing curve, which is what read as a jagged jump
  // rather than a conversation moving.
  //
  // Now: smooth ONLY when the number of messages changes (a new bubble appears,
  // which is a real event worth animating), and a plain instant follow while
  // text streams into the last bubble. Instant during streaming is not a
  // compromise — it is what makes it look like text arriving rather than the
  // viewport chasing it.
  const messageCount = messages.length;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messageCount]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !busy) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const changeState = (next: string | null) => {
    if (next === state) return;
    setState(next);
    // The verdict is state-specific — snap-rules computed it against the old
    // state's parameters, so keeping it on screen under a new state's heading
    // would be showing someone a number that no longer applies. The FACTS
    // survive (household size and income don't change with the scope); only
    // the computed outcome is dropped, and the next turn recomputes it.
    setClassification(null);
    if (messages.some((m) => m.role !== "divider")) {
      const name = next ? states.find((s) => s.code === next)?.program ?? next : null;
      setMessages((m) => [
        ...m,
        { role: "divider", content: name ? t.dividerTo(name) : t.dividerFederal },
      ]);
    }
  };

  /** Put a conversation back on screen after signing in. Stable identity: it
   *  sits in an effect's dependency list in DemeterSave, and a new function
   *  every render would re-run the restore. */
  // Clearing is DESTRUCTIVE and irreversible — an unsaved conversation is gone
  // — so it confirms rather than firing on one click. The confirm step is also
  // where the honest note belongs: it is the moment the sentence "we still keep
  // the question and answer" can still change what someone decides to do.
  const [confirmClear, setConfirmClear] = useState(false);
  const clearConversation = useCallback(() => {
    setMessages([]);
    setInput("");
    setError(null);
    setClassification(null);
    factsRef.current = {};
    setConfirmClear(false);
    // The pending-save stash holds a full transcript in localStorage for 30
    // minutes (see DemeterSave). Leaving it behind would mean "cleared" left
    // the conversation sitting in this browser's storage — which on a shared
    // machine is precisely the thing the button is for.
    try {
      window.localStorage.removeItem("demeter:pending-save");
    } catch {
      /* storage disabled — nothing was stored either */
    }
    setAnnouncement(t.cleared);
  }, [t]);

  const restoreConversation = useCallback(
    (restored: Msg[], restoredState: string | null, restoredLang: AnswerLang) => {
      setMessages(restored);
      setState(restoredState);
      setLang(restoredLang);
    },
    [],
  );

  /** Update the right rail. Never throws into the caller and never surfaces an
   *  error in the chat: a quiet rail is an acceptable degradation, a chat that
   *  reports "something went wrong" because a side panel failed is not. */
  const refreshWorksheet = useCallback(
    async (apiMessages: Array<{ role: "user" | "assistant"; content: string }>) => {
      if (!state) return;
      try {
        const res = await fetch("/api/demeter/worksheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, facts: factsRef.current, state }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          facts?: PartialFacts;
          classification?: ScreeningClassification | null;
        };
        if (data.facts) factsRef.current = data.facts;
        // Null classification = the route soft-failed or found nothing yet.
        // Keep whatever is already on screen rather than blanking the panel.
        if (data.classification) setClassification(data.classification);
      } catch {
        /* soft by design */
      }
    },
    [state],
  );

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || busy) return;
    setError(null);
    setBusy(true);
    setInput("");

    const chatTurns = messages.filter(
      (m): m is { role: "user" | "assistant"; content: string } => m.role !== "divider",
    );
    const apiMessages = [...chatTurns, { role: "user" as const, content: question }].slice(-20);
    setMessages((m) => [
      ...m,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);

    // The rail updates ALONGSIDE the answer, not after it: a second round trip
    // in series would make every reply feel slower for a panel that is
    // supplementary. It is intentionally not awaited and intentionally cannot
    // throw into this scope — the answer must not depend on it.
    if (state) void refreshWorksheet(apiMessages);

    const controller = new AbortController();
    abortRef.current = controller;
    const dropPlaceholder = () =>
      setMessages((m) =>
        m[m.length - 1]?.role === "assistant" && m[m.length - 1]?.content === ""
          ? m.slice(0, -1)
          : m,
      );

    /** Hand the question back so the next tap is Send, not retyping it.
     *
     *  Without this a failed request left the composer EMPTY and the user's
     *  message stranded in the transcript above an error — so someone on a
     *  flaky prepaid connection, which is most of this audience, had to retype
     *  a question they had already carefully worded. That is the opposite of an
     *  actionable recovery step.
     *
     *  Drops their turn from the transcript as well as the empty assistant
     *  bubble, because the honest state after a failed send is "you typed this
     *  and it did not go", not "you asked this and were ignored" — and leaving
     *  it would duplicate the turn when they send again.
     *
     *  Only for failures where trying again can actually work. At capacity for
     *  the month, or unconfigured, retrying is a worse offer than the error's
     *  own advice to call 211. */
    const handBackForRetry = () => {
      setMessages((m) => {
        const withoutPlaceholder =
          m[m.length - 1]?.role === "assistant" && m[m.length - 1]?.content === ""
            ? m.slice(0, -1)
            : m;
        return withoutPlaceholder[withoutPlaceholder.length - 1]?.role === "user"
          ? withoutPlaceholder.slice(0, -1)
          : withoutPlaceholder;
      });
      setInput(question);
    };

    try {
      const res = await fetch("/api/demeter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          state,
          lang,
          sessionId: sessionIdRef.current || undefined,
          // Counts ANSWERS, not attempts — because an audit row is written per
          // answer, so this has to agree with what actually lands in the log.
          //
          // Two wrong versions came before this one, both of which inflate the
          // survival curve (backwards for a metric whose job is drop-off):
          //   - a ref incremented per send: a 429 burns a turn number;
          //   - counting USER turns: a failed request leaves its user message
          //     in the history (only the assistant placeholder is dropped), so
          //     it still counts.
          // Completed assistant turns + 1 is the answer this request will be.
          turnIndex:
            chatTurns.filter((m) => m.role === "assistant" && m.content).length + 1,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        dropPlaceholder();
        let reason = "";
        try {
          reason = ((await res.json()) as { reason?: string }).reason ?? "";
        } catch { /* non-JSON error body */ }
        // REASON FIRST, status second. Keying on status alone flattened a
        // distinction the route makes on purpose: it returns 429 for BOTH a
        // per-minute rate limit and a per-IP DAILY cap, with different bodies
        // and different Retry-After values (60s vs 3600s). The client showed
        // "give it a minute" for both — so someone who had hit the daily cap
        // was told to wait a minute for something that resets tomorrow, and
        // would sit there retrying. The route's own comment calls the two
        // "distinct ON PURPOSE"; this is where that distinction was being lost.
        const message =
          reason === "at_capacity"
            ? t.errCapacity
            : reason === "ip_daily_cap"
              ? t.errDailyCap
              : reason === "rate_limited" || res.status === 429
                ? t.err429
                : res.status === 503
                  ? t.errConfig
                  : t.errNetwork;
        setError(message);
        // Hand the question back only where trying again can actually work.
        // A per-minute limit clears; a daily cap, a spent monthly budget and an
        // unconfigured service do not, and offering a retry there loops someone
        // instead of sending them to the 211 number the message gives them.
        const retryable = message === t.err429 || message === t.errNetwork;
        if (retryable) handBackForRetry();
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((m) => {
            const copy = m.slice();
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              const combined = last.content + chunk;
              const markerAt = combined.lastIndexOf(RECOMPOSE_MARKER);
              copy[copy.length - 1] = {
                role: "assistant",
                content:
                  markerAt >= 0
                    ? combined.slice(markerAt + RECOMPOSE_MARKER.length).replace(/^\s+/, "")
                    : combined,
              };
            }
            return copy;
          });
        }
      }
    } catch (err) {
      // An abort is the user pressing Stop, not a failure — their question was
      // answered as far as they wanted it to be, so nothing is handed back.
      if (err instanceof DOMException && err.name === "AbortError") {
        dropPlaceholder();
      } else {
        // A thrown fetch is the flaky-connection case, which is the one this
        // audience hits most and the one where retyping hurts most.
        setError(t.errNetwork);
        handBackForRetry();
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
    // refreshWorksheet is memoized on [state], which is already here, so
    // listing it adds no extra invalidation. It is listed anyway because the
    // two staying in sync is currently a coincidence of their dep lists
    // matching: give refreshWorksheet one dependency send does not have, and
    // send would silently hold a stale copy with no warning.
  }, [input, busy, messages, state, lang, t, refreshWorksheet]);

  const hasChat = messages.length > 0;

  return (
    <div className="demeter">
      <header className="demeter__head">
        <div className="demeter__brand">
          <span className="demeter__avatar" aria-hidden>
            <DemeterMark size={40} />
          </span>
          <div>
            {/* A <p>, not an <h1>. The page's <h1> is the orientation bar
                above this card (SnapOrientation). This used to BE the h1, which
                put it after the SNAP <h2> in document order — an inverted
                heading hierarchy, and a card that claimed to be the page. Both
                mount points render the orientation bar, so nothing is left
                without a heading. */}
            <p className="demeter__title">{t.title}</p>
            <p className="demeter__tagline">{t.tagline}</p>
          </div>
        </div>
        {/* A real picker, not a two-way toggle: the engine now answers in four
            languages, and a toggle cannot express that. Each option is labelled
            in its OWN language — someone looking for Tiếng Việt is not helped by
            the word "Vietnamese". */}
        <label className="demeter__lang">
          <span className="sr-only">{t.languageLabel}</span>
          <select
            className="demeter__lang-select"
            value={lang}
            aria-label={t.languageLabel}
            onChange={(e) => setLang(e.target.value as AnswerLang)}
          >
            {ANSWER_LANGS.map((code) => (
              <option key={code} value={code}>
                {LANG_NATIVE_NAME[code]}
              </option>
            ))}
          </select>
        </label>
      </header>

      {/* One control, one selected state — replaces the chip row that ate a
          full row and still clipped this link off the right edge at 1280px. */}
      <div className="demeter__scope">
        <DemeterStatePicker
          states={states}
          value={state}
          onChange={changeState}
          copy={t.picker}
          hint={geoHint}
          openSignal={openPicker}
        />
        <a className="demeter__how" href="/verify">
          {t.howWeVerify}
        </a>
        {/* Sits with the scope controls rather than under the composer: it acts
            on the WHOLE conversation, like the state and language pickers, not
            on the next thing typed. Renders nothing until an answer exists. */}
        <DemeterSave
          messages={messages}
          state={state}
          lang={lang}
          busy={busy}
          pendingSave={pendingSave}
          initialSavedId={savedConversationId}
          onRestore={restoreConversation}
          // Plain setter, not an inline arrow: it lands in an effect's
          // dependency list in DemeterSave, and React guarantees a state
          // setter's identity is stable across renders.
          onSavedChange={setConversationSaved}
          copy={t.save}
        />
        {/* CLEAR, for shared and public machines. On a library terminal the
            next person otherwise sees the previous person's questions about
            their income, their household, their felony record.
            Renders only once there is something to clear. */}
        {hasChat &&
          (confirmClear ? (
            <span className="demeter__clearconfirm" role="group" aria-label={t.clear}>
              <span className="demeter__clearnote">{t.clearNote}</span>
              <button type="button" className="demeter__clearyes" onClick={clearConversation}>
                {t.clear}
              </button>
              <button
                type="button"
                className="demeter__clearno"
                onClick={() => setConfirmClear(false)}
              >
                {t.save.panelDismiss}
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="demeter__clear"
              onClick={() => setConfirmClear(true)}
            >
              {t.clear}
            </button>
          ))}
      </div>

      <div className="demeter__body">
        <div className="demeter__main">
      <div className="demeter__scroll" ref={scrollRef}>
        {!hasChat && (
          <div className="demeter__empty">
            {[t.empty1, t.empty2, t.empty3].map((q) => (
              <button key={q} type="button" className="demeter__suggest" onClick={() => setInput(q)}>
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "divider" ? (
            <div key={i} className="demeter__divider" role="status">
              {m.content}
            </div>
          ) : (
            <div key={i}>
              <div className={`demeter__msg demeter__msg--${m.role}`}>
                {m.content ? (
                  m.role === "assistant" ? (
                    renderAnswer(m.content)
                  ) : (
                    m.content
                  )
                ) : m.role === "assistant" && busy && i === messages.length - 1 ? (
                  <span className="demeter__thinking">{t.thinking}</span>
                ) : (
                  m.content
                )}
              </div>
              {/* Feedback only on a FINISHED assistant answer: the trailer has
                  to have arrived (readCertainty returns null until it does),
                  and asking someone to rate a half-streamed answer is asking
                  about something they haven't read. */}
              {m.role === "assistant" && m.content && !(busy && i === messages.length - 1) && (
                <DemeterFeedback
                  question={
                    // The user turn this answered. Divider turns are never
                    // adjacent to an assistant message, but guard anyway.
                    messages[i - 1]?.role === "user" ? messages[i - 1]!.content : ""
                  }
                  answer={m.content}
                  state={state}
                  lang={lang}
                  certainty={readCertainty(m.content)}
                  copy={t.feedback}
                />
              )}
            </div>
          ),
        )}
        {error && (
          <div className="demeter__error" role="alert">
            {error}
          </div>
        )}
      </div>

      {/* THE ANSWER, FOR SCREEN READERS. Until now nothing on this page was a
          live region, so a screen reader user asked a question and was told
          NOTHING — not that a reply had started, not that it had finished, not
          what it said. On a product whose entire value is the answer, that made
          it unusable rather than merely awkward.

          Why a SEPARATE region instead of aria-live on the transcript: the
          transcript mutates on every streamed token, and a live region fed
          token-by-token produces continuous stuttering speech that is worse
          than silence — most screen readers restart the utterance on each
          change. So the transcript stays silent and this announces the
          FINISHED answer once.

          Why the certainty verdict is included: an answer read aloud without
          "certain" or "uncertain" is exactly the overconfidence the citation
          verifier exists to prevent. A sighted reader sees the banner; a screen
          reader user must hear it.

          `polite` (not assertive) so it waits for a pause rather than cutting
          off someone mid-sentence in the composer — the criteria's own point
          about not interrupting input. */}
      <div className="demeter__sr" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <form
        className="demeter__inputrow"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          className="demeter__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={t.inputPlaceholder}
          rows={1}
          aria-label={t.inputPlaceholder}
        />
        {busy ? (
          <button
            type="button"
            className="demeter__send demeter__send--stop"
            onClick={() => abortRef.current?.abort()}
          >
            {t.stop}
          </button>
        ) : (
          <button type="submit" className="demeter__send" disabled={!input.trim()}>
            {t.send}
          </button>
        )}
      </form>
      {/* Under the composer, where the decision to type is made. It used to be
          in the estimate rail only, which is the wrong place and — at narrow
          widths where the rail stacks below the conversation — no place at all.
          redactPii strips structured identifiers but deliberately NOT names, so
          this asks rather than promises. */}
      <p className="demeter__piihint">{t.piiHint}</p>
      <p className="demeter__disclaimer">{t.disclaimer}</p>
        </div>
        <DemeterWorksheet
          classification={classification}
          stateSelected={state !== null}
          saved={conversationSaved}
          copy={t.worksheet}
          onPickState={() => setOpenPicker((n) => n + 1)}
        />
      </div>
    </div>
  );
}
