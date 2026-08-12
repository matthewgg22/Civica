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
  FOLLOWUP_MARKER,
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
import { DemeterWorksheet, type WorksheetMode } from "./DemeterWorksheet";
import { DemeterFeedback } from "./DemeterFeedback";
import { DemeterSave } from "./DemeterSave";
import { T } from "../lib/i18n/demeter-chat-copy";
import { stateName } from "../lib/state-names";
import { detectState, type StateMention } from "../lib/detect-state";
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
  // _underscores_ as well as *asterisks*. The system-appended trailer writes
  // "_Check it yourself:_", which rendered with its underscores showing —
  // visible in the product, on every cited answer, for as long as that trailer
  // has existed.
  //
  // Underscores are matched only at a word boundary, so snake_case identifiers
  // in a citation (7_CFR_273) are not mistaken for emphasis.
  const parts = line.split(
    /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\b_[^_\s][^_]*_\b)/g,
  );
  return parts.map((p, j) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return <strong key={`${keyBase}b${j}`}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
      return <em key={`${keyBase}i${j}`}>{p.slice(1, -1)}</em>;
    }
    if (p.startsWith("_") && p.endsWith("_") && p.length > 2) {
      return <em key={`${keyBase}u${j}`}>{p.slice(1, -1)}</em>;
    }
    // [label](https://…). Only http(s), matched by the split above, so nothing
    // else can become an href — no javascript:, no data:, no relative paths.
    // Citations are worth nothing if the reader cannot go and look.
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(p);
    if (link) {
      return (
        <a
          key={`${keyBase}a${j}`}
          className="demeter__link"
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link[1]}
        </a>
      );
    }
    return p;
  });
}

/** Splits the model's suggested follow-ups off the visible answer.
 *
 *  The model ends with "⟶ one | two | three". Those become buttons, so the
 *  marker line must never render as text — and it must be stripped even when
 *  the line is still half-streamed, or the reader watches a stray arrow and a
 *  pipe character type themselves out mid-answer.
 *
 *  Returns the follow-ups only once the line is COMPLETE (a newline after it,
 *  or the stream has finished). Offering half a question would be worse than
 *  offering none. */
/** Drops a freshness footer the MODEL wrote, keeping the one Civica appends.
 *
 *  The prompt tells it not to write its own "Sources as of" line. It sometimes
 *  does anyway — seen in production, the same answer carrying the line twice —
 *  and an instruction a model can ignore is not a guarantee. Ours is appended
 *  last, in the trailer frame, so every occurrence but the final one goes. */
function dropDuplicateFooter(text: string): string {
  // Both labels: the footer was shortened from "Sources as of" to "Source", and
  // a saved conversation can still hold answers written under the old one.
  const marker = /^\s*\*?(Sources? as of|Source|Fuentes? al|Fuente|Nguồn|来源)\b/;
  const lines = text.split("\n");
  const hits = lines.map((l, i) => (marker.test(l) ? i : -1)).filter((i) => i >= 0);
  if (hits.length < 2) return text;
  const keep = hits[hits.length - 1];
  return lines.filter((_, i) => !hits.includes(i) || i === keep).join("\n");
}

export function splitFollowups(
  rawText: string,
  opts?: { streaming?: boolean },
): { body: string; followups: string[] } {
  const text = dropDuplicateFooter(rawText);
  // ANYWHERE, not only at the start of a line. This looked for "\n⟶", and the
  // model does not reliably put the marker on its own line — when it wrote
  // "…confirm those with your local district or OTDA. ⟶ What documents will I
  // need? | …" the whole thing sailed through and the reader saw the raw arrow
  // and the pipes printed in the answer. Seen in production.
  const at = text.lastIndexOf(FOLLOWUP_MARKER);
  if (at < 0) return { body: text, followups: [] };

  const body = text.slice(0, at);
  const rest = text.slice(at + FOLLOWUP_MARKER.length);
  const end = rest.indexOf("\n");
  const complete = end >= 0 || !opts?.streaming;
  if (!complete) return { body, followups: [] };

  const line = end >= 0 ? rest.slice(0, end) : rest;
  const tail = end >= 0 ? rest.slice(end) : "";
  const followups = line
    .split("|")
    .map((q) => q.trim())
    .filter((q) => q.length > 1 && q.length <= 80)
    .slice(0, 3);

  // Anything after the follow-ups line (the appended citation trailer) stays.
  return { body: (body.replace(/[ \t]+$/, "") + tail), followups };
}

/** The question Demeter is waiting on, if it ended by asking one.
 *
 *  When an answer closes with "which of those is yours?", a composer that still
 *  says "Happy to answer any questions about SNAP" has forgotten its own last
 *  sentence — and the person has to scroll back up to see what was asked. The
 *  placeholder becomes the question instead.
 *
 *  Only the FINAL sentence, only if it is a question, and only if it is short
 *  enough to read in a field. Everything else falls back to the standing
 *  placeholder rather than truncating something into nonsense. */
export function pendingQuestion(answer: string): string | null {
  // Body only — the citation trailer often ends in a question-free line, and
  // the follow-up chips are not what we are looking for either.
  const body = splitFollowups(answer).body.split(/\n-{3,}\n/)[0] ?? "";
  const sentences = body
    .replace(/\*\*/g, "")
    .split(/(?<=[?.!])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const last = sentences[sentences.length - 1] ?? "";
  if (!last.endsWith("?") || last.length > 90) return null;
  return last;
}

/** Answer text → nodes, with paragraphs as real <p> BLOCKS.
 *
 *  This used to emit one flat run of text and "\n" strings, leaning on the
 *  bubble's `white-space: pre-wrap` to do the breaking. That renders a blank
 *  line as exactly one empty line-height, so an answer that was correctly
 *  broken into paragraphs still read as a single block — most of what made
 *  answers look like a wall even when their shape was right. Paragraphs can't
 *  be given space until they're elements, so now they are.
 *
 *  Single newlines INSIDE a paragraph are preserved (bullets rely on them) and
 *  still render through pre-wrap. */
export function renderAnswer(text: string, opts?: { streaming?: boolean }): ReactNode[] {
  const out: ReactNode[] = [];
  let para: string[] = [];
  let n = 0;
  let lastPara = -1;

  /** A run of "- " lines is a LIST, and should be one.
   *
   *  These used to fall through as ordinary text, so the reader saw literal
   *  hyphens down the left of the answer with no indent and no hanging
   *  alignment — a wrapped item lined up under the dash instead of under its
   *  own first word, which is most of why a three-item list read as a wall. */
  const BULLET = /^[-•*]\s+/;

  const flushBullets = (items: string[], key: number) => {
    lastPara = out.length;
    out.push(
      <ul className="demeter__list" key={`ul${key}`}>
        {items.map((item, i) => (
          <li key={`ul${key}i${i}`}>{renderInline(item.replace(BULLET, ""), `ul${key}i${i}`)}</li>
        ))}
      </ul>,
    );
  };

  const flush = () => {
    if (para.length === 0) return;
    const lines = para;
    para = [];
    const key = n++;

    // A paragraph can open with prose and then list ("You can apply:" followed
    // by four options), so the two are split rather than the whole block being
    // treated as one or the other.
    let run: string[] = [];
    let prose: string[] = [];
    const flushProse = () => {
      if (prose.length === 0) return;
      const p = prose;
      prose = [];
      lastPara = out.length;
      out.push(
        <p className="demeter__para" key={`p${key}-${out.length}`}>
          {p.flatMap((line, i) => [
            ...(i > 0 ? ["\n"] : []),
            ...renderInline(line, `p${key}l${i}`),
          ])}
        </p>,
      );
    };

    for (const line of lines) {
      if (BULLET.test(line)) {
        flushProse();
        run.push(line);
      } else {
        if (run.length) {
          flushBullets(run, out.length);
          run = [];
        }
        prose.push(line);
      }
    }
    if (run.length) flushBullets(run, out.length);
    flushProse();
  };

  for (const line of text.split("\n")) {
    // A standalone rule separates the answer from the citation trailer; it is
    // not part of either paragraph, so it closes the one before it.
    if (line.trim() === "---") {
      flush();
      out.push(<hr key={`hr${n++}`} className="demeter__rule" />);
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    para.push(line);
  }
  flush();

  // The streaming cursor goes INSIDE the last paragraph, where a cursor
  // belongs — appended after the paragraph it would sit on its own line, which
  // reads as a stray mark rather than as "still writing".
  //
  // It exists because there was no signal at all once text started arriving:
  // an answer that had finished and an answer that had stalled looked
  // identical, and the only way to tell was to wait and see.
  if (opts?.streaming && lastPara >= 0) {
    const p = out[lastPara] as React.ReactElement<{ children?: ReactNode }>;
    out[lastPara] = (
      <p className="demeter__para" key={`p-stream`}>
        {p.props.children}
        <span className="demeter__caret" aria-hidden />
      </p>
    );
  }
  return out;
}

// The copy table lives in lib/i18n/demeter-chat-copy.ts, NOT here.
// This is a "use client" module, and a server component cannot import a plain
// value across that boundary — it arrives undefined at runtime. /screen/ask
// renders the entry card on the server and needs it.
// Re-exported so existing imports of `T` from this file keep working.
export { T };


/** How fast a streamed answer is REVEALED — deliberately slower than it
 *  arrives. ~40 characters a second at rest, ~120 catching up. Module scope so
 *  the drain callback closes over a genuine constant, and one place to tune,
 *  because "calm" is a judgement that will be revisited. */
const STREAM_TICK_MS = 25;
const STREAM_MAX_STEP = 3;

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
  /** Defaults to "ask" DELIBERATELY. The rail used to read household facts out
   *  of the conversation from the moment a state was picked, whether or not
   *  anyone had asked for an estimate — a reasonable thing to offer and an
   *  unreasonable thing to do quietly to someone who came to find out how the
   *  system works before telling it anything about themselves. */
  const [worksheetMode, setWorksheetMode] = useState<WorksheetMode>("ask");

  // A place named in the chat, waiting to be confirmed. An OFFER, never an
  // automatic switch: someone typed "im in boston" and the scope stayed on
  // CalFresh — one of the most generous state programs — while answering a
  // Massachusetts household. Re-scoping on a guess would have replaced that
  // with a different wrong answer held more confidently.
  const [stateOffer, setStateOffer] = useState<StateMention | null>(null);
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // ── PACED STREAMING ────────────────────────────────────────────────────────
  // The reader used to render every network chunk the instant it arrived, and
  // chunks arrive in bursts of wildly uneven size — so a sentence would sit
  // still, then a paragraph would land at once. Nothing was pacing it, which is
  // the whole of the choppiness: it is not the animation that is wrong, it is
  // that there is no animation, only network timing made visible.
  //
  // So the network fills a buffer and the SCREEN drains it on its own clock.
  //   rawRef   everything received, before the recompose marker is resolved
  //   fullRef  the authoritative answer text (after the marker)
  //   shownRef how much of it is on screen
  const rawRef = useRef("");
  const fullRef = useRef("");
  const shownRef = useRef(0);
  const rafRef = useRef(0);
  /** Resolved by the drain the instant the last character lands, so nothing
   *  downstream has to poll for "is it finished yet". */
  const drainedRef = useRef<(() => void) | null>(null);

  /** Someone who asked for less motion is asking for less of exactly this. */
  const paceStream = () =>
    typeof window !== "undefined" &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // setTimeout, not requestAnimationFrame. rAF is the usual instinct for
  // per-frame work, and it is the wrong one here: a BACKGROUNDED TAB stops
  // firing it entirely, so an answer would freeze half-written the moment
  // someone switches tabs to read something else, and nothing would restart it.
  // A timer is throttled in that state but still fires, so the reply finishes.
  // At ~16ms the visual result is identical.

  const finishDrain = () => {
    rafRef.current = 0;
    drainedRef.current?.();
    drainedRef.current = null;
  };

  const drawStream = useCallback(() => {
    const full = fullRef.current;
    if (shownRef.current >= full.length) {
      finishDrain();
      return;
    }
    // PROPORTIONAL WITH A CEILING, and the ceiling is the point.
    //
    // Uncapped, `behind / 8` meant thousands of characters a second —
    // technically "paced", indistinguishable from a dump. The first cap (4 per
    // 16ms = 250/sec) still cleared a short answer in about a second, which
    // still read as a dump: answers got shorter at the same time the pacing
    // landed, so the two changes cancelled out.
    //
    // Now ~40 characters a second at rest and ~120 catching up. That is slow
    // next to how fast the tokens actually arrive, and that is the intent —
    // this is for someone frightened of losing food assistance, and text
    // landing faster than it can be read is not calm, it is urgent.
    const behind = full.length - shownRef.current;
    const step = Math.min(STREAM_MAX_STEP, Math.max(1, Math.ceil(behind / 50)));
    shownRef.current = Math.min(full.length, shownRef.current + step);
    const text = full.slice(0, shownRef.current);
    setMessages((m) => {
      const copy = m.slice();
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant") copy[copy.length - 1] = { role: "assistant", content: text };
      return copy;
    });
    // Resolve in the SAME tick as the final render rather than on the next
    // scheduled one, so nothing observes a finished answer with busy still set.
    if (shownRef.current >= full.length) {
      finishDrain();
      return;
    }
    rafRef.current = window.setTimeout(drawStream, STREAM_TICK_MS);
  }, []);

  // A stream abandoned mid-flight must not keep painting into a component that
  // has moved on.
  useEffect(() => () => clearTimeout(rafRef.current), []);
  /** Back to one row. The composer grows as you type, so clearing the value
   *  without clearing the inline height leaves an empty box the size of the
   *  question you just sent. */
  const resetInputHeight = useCallback(() => {
    if (inputRef.current) inputRef.current.style.height = "";
  }, []);
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
  //
  // AND ONLY IF THE READER IS ALREADY AT THE BOTTOM. Following unconditionally
  // means someone who scrolls up to re-read an earlier answer gets yanked back
  // down on the next token — the transcript fighting the person reading it.
  // Being left behind is recoverable; being dragged away mid-sentence is not.
  const NEAR_BOTTOM = 120;
  const atBottom = (el: HTMLDivElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;

  const messageCount = messages.length;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // A new bubble is a real event, so it follows from a little further up —
    // but not from the top of a long transcript someone is reading.
    if (el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM * 3) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messageCount]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !busy) return;
    if (atBottom(el)) el.scrollTop = el.scrollHeight;
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
    // The DIVIDER is only meaningful once something has been said — it warns
    // that earlier answers may not apply. The PORTAL message is not: picking a
    // state before asking anything is the commonest way in, and that is exactly
    // when someone most wants to know where the application goes. So the two
    // are emitted on different conditions.
    {
      // The STATE's name. This used the pack's `program` field, which for
      // Massachusetts is the annotated corpus string — so the divider read
      // "Now answering for Supplemental Nutrition Assistance Program (SNAP) —
      // Massachusetts uses the federal name; 'Food Stamps' survives only as the
      // older, still-recognized public name (formally retired federally in
      // 2008) — earlier answers may not apply." Nobody needs the program's
      // etymology to be told the scope changed. They need "Massachusetts".
      const name = next ? stateName(next) : null;
      const pack = next ? states.find((x) => x.code === next) ?? null : null;

      // WHERE THE APPLICATION ACTUALLY GOES. This is the one moment we know
      // exactly which portal that is, so it should not be something the reader
      // has to ask for — and the answer they would otherwise get is a general
      // one about "your state's agency".
      //
      // With the invitation to stay attached, deliberately. Handing someone a
      // link to a government form and going quiet is the point at which most
      // people stop; the useful thing this can do is let them find out what
      // they will be asked before they are sitting in front of it.
      const portal =
        pack?.portal && name
          ? [
              t.portalLead.replace("{state}", name).replace("{agency}", pack.agency),
              t.portalCta
                .replace("{portal}", pack.portal.name)
                .replace(/^(.*)$/, `[$1](${pack.portal.url})`),
              t.portalStay,
            ].join("\n\n")
          : null;

      const hasSaidSomething = messages.some((m) => m.role !== "divider");
      setMessages((m) => [
        ...m,
        ...(hasSaidSomething
          ? [
              {
                role: "divider" as const,
                content: name ? t.dividerTo(name) : t.dividerFederal,
              },
            ]
          : []),
        ...(portal ? [{ role: "assistant" as const, content: portal }] : []),
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
    resetInputHeight();
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
  }, [t, resetInputHeight]);

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
    resetInputHeight();

    const chatTurns = messages.filter(
      (m): m is { role: "user" | "assistant"; content: string } => m.role !== "divider",
    );
    const apiMessages = [...chatTurns, { role: "user" as const, content: question }].slice(-20);
    // Did they name somewhere? Offered, not applied — and only when it
    // disagrees with the scope they are already on.
    const mentioned = detectState(question);
    setStateOffer(mentioned && mentioned.code !== state ? mentioned : null);

    // Fresh buffer per answer, or the next one types out on top of the last.
    clearTimeout(rafRef.current);
    rafRef.current = 0;
    rawRef.current = "";
    fullRef.current = "";
    shownRef.current = 0;

    setMessages((m) => [
      ...m,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);

    // The rail updates ALONGSIDE the answer, not after it: a second round trip
    // in series would make every reply feel slower for a panel that is
    // supplementary. It is intentionally not awaited and intentionally cannot
    // throw into this scope — the answer must not depend on it.
    // THE GATE. In "ask" mode this call never happens, so no facts are
    // extracted, nothing lands in factsRef, and the paid extraction round trip
    // is not made either.
    if (state && worksheetMode === "estimate") void refreshWorksheet(apiMessages);

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
          rawRef.current += chunk;

          // The marker REPLACES the unverified draft, so it is resolved against
          // everything received rather than against what is currently on
          // screen — the display may legitimately be behind.
          const markerAt = rawRef.current.lastIndexOf(RECOMPOSE_MARKER);
          const next =
            markerAt >= 0
              ? rawRef.current.slice(markerAt + RECOMPOSE_MARKER.length).replace(/^\s+/, "")
              : rawRef.current;

          // If the recomposed answer does not continue what is already shown,
          // the draft was thrown away — so the display starts over and the
          // replacement types out. Seeing it rewrite is the honest rendering of
          // what just happened.
          if (!next.startsWith(fullRef.current.slice(0, shownRef.current))) shownRef.current = 0;
          fullRef.current = next;

          if (!paceStream()) {
            shownRef.current = next.length;
            setMessages((m) => {
              const copy = m.slice();
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") copy[copy.length - 1] = { role: "assistant", content: next };
              return copy;
            });
          } else if (!rafRef.current) {
            rafRef.current = window.setTimeout(drawStream, 16);
          }
        }
      }

      // Let the screen catch up before anything treats the answer as finished:
      // the certainty verdict is read back off the rendered text, and the
      // feedback row asks about an answer the person has to have seen.
      //
      // BOUNDED anyway. The timer survives a backgrounded tab, but it is
      // throttled hard there, and an unbounded wait would leave busy stuck on —
      // Stop showing instead of Send — for as long as the tab stayed hidden.
      if (shownRef.current < fullRef.current.length) {
        // A STALL WATCHDOG, not a deadline. A fixed ceiling would truncate a
        // long answer that is pacing correctly — at reading pace a 2,000
        // character reply legitimately takes eight seconds. What actually needs
        // catching is the timer STOPPING (a hidden tab throttles it to
        // nothing), so this watches for no progress rather than for elapsed
        // time.
        let watchdog = 0;
        await Promise.race([
          new Promise<void>((resolve) => {
            drainedRef.current = resolve;
          }),
          new Promise<void>((resolve) => {
            let last = shownRef.current;
            watchdog = window.setInterval(() => {
              if (shownRef.current !== last) {
                last = shownRef.current;
                return;
              }
              resolve();
            }, 1200);
          }),
        ]);
        clearInterval(watchdog);
      }
      if (shownRef.current < fullRef.current.length) {
        clearTimeout(rafRef.current);
        rafRef.current = 0;
        shownRef.current = fullRef.current.length;
        const finalText = fullRef.current;
        setMessages((m) => {
          const copy = m.slice();
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") copy[copy.length - 1] = { role: "assistant", content: finalText };
          return copy;
        });
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
  }, [input, busy, messages, state, lang, t, refreshWorksheet, resetInputHeight, worksheetMode, drawStream]);

  const hasChat = messages.length > 0;

  // What the composer asks for. If Demeter's last answer ended in a question,
  // that question — otherwise the standing invitation. Never while an answer is
  // still arriving: the placeholder would change under the person mid-read.
  const lastAssistant = busy
    ? null
    : [...messages].reverse().find((m) => m.role === "assistant" && m.content)?.content ?? null;
  const composerPrompt =
    (lastAssistant ? pendingQuestion(lastAssistant) : null) ?? t.inputPlaceholder;

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

      <div className="demeter__body">
        <div className="demeter__main">
          {/* The controls live INSIDE the conversation column, not in a full-width
              row above it. Out here they started 68px above the rail and left
              "How we verify" floating alone in the right column, belonging to
              neither. In here both columns begin on the same line. */}
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
      <div className="demeter__scroll" ref={scrollRef}>
        {!hasChat && (
          // A composed block, centred in the space rather than three buttons
          // left in it. Measured: 414px of the 565px transcript was empty, and
          // whichever end the chips were pinned to, they read as controls
          // someone forgot rather than as the start of a conversation.
          <div className="demeter__empty">
            <DemeterMark size={52} />
            <h2 className="demeter__emptytitle">{t.emptyTitle}</h2>
            <p className="demeter__emptylede">{t.emptyLede}</p>
            <div className="demeter__suggests">
              {[t.empty1, t.empty2, t.empty3].map((q) => (
                <button
                  key={q}
                  type="button"
                  className="demeter__suggest"
                  onClick={() => setInput(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "divider" ? (
            <div key={i} className="demeter__divider" role="status">
              {m.content}
            </div>
          ) : (
            // THE WRAPPER CARRIES THE ALIGNMENT. It used to be a bare <div>,
            // which made IT the flex child of the transcript — so the bubble's
            // own `align-self: flex-end` was set correctly and reached nothing,
            // and every message rendered left-aligned at its full 68ch max.
            // Measured: "whats snap?" came out 635px wide, on the left.
            <div key={i} className={`demeter__turn demeter__turn--${m.role}`}>
              <div className={`demeter__msg demeter__msg--${m.role}`}>
                {m.content ? (
                  m.role === "assistant" ? (
                    renderAnswer(
                      splitFollowups(m.content, { streaming: busy && i === messages.length - 1 })
                        .body,
                      { streaming: busy && i === messages.length - 1 },
                    )
                  ) : (
                    m.content
                  )
                ) : m.role === "assistant" && busy && i === messages.length - 1 ? (
                  <span className="demeter__thinking">
                    {t.thinking}
                    {/* Three dots, so the wait has a heartbeat. The pulsing
                        text alone reads as a static label someone forgot to
                        remove when nothing arrives for a few seconds. */}
                    <span className="demeter__dots" aria-hidden>
                      <i />
                      <i />
                      <i />
                    </span>
                  </span>
                ) : (
                  m.content
                )}
              </div>
              {/* Feedback only on a FINISHED assistant answer: the trailer has
                  to have arrived (readCertainty returns null until it does),
                  and asking someone to rate a half-streamed answer is asking
                  about something they haven't read. */}
              {/* Suggested follow-ups, on a FINISHED answer only — offering
                  the next question while the current one is still arriving
                  reads as being hurried along.
                  They populate the composer rather than sending, matching the
                  starter questions: a suggestion you can edit before asking is
                  a suggestion, and one that fires on touch is a decision made
                  for you. */}
              {m.role === "assistant" && m.content && !(busy && i === messages.length - 1) && (
                <>
                  {splitFollowups(m.content).followups.length > 0 && (
                    <div className="demeter__followups">
                      {splitFollowups(m.content).followups.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className="demeter__followup"
                          onClick={() => {
                            setInput(q);
                            inputRef.current?.focus();
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
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

      {/* THE OFFER. Sits above the composer, where the next thing you would do
          is, and disappears either way once answered. It does not switch the
          scope by itself — see detect-state.ts: a silent re-scope on a guess
          answers the wrong state with more confidence than before. */}
      {stateOffer && !busy && (
        <div className="demeter__stateoffer" role="status">
          <span className="demeter__stateoffer-text">
            {t.stateOffer
              .replace("{place}", stateOffer.matched)
              .replace("{state}", stateOffer.name)}
          </span>
          <span className="demeter__stateoffer-actions">
            <button
              type="button"
              className="demeter__stateoffer-yes"
              onClick={() => {
                changeState(stateOffer.code);
                setStateOffer(null);
              }}
            >
              {t.stateOfferYes.replace("{state}", stateOffer.name)}
            </button>
            <button
              type="button"
              className="demeter__stateoffer-no"
              onClick={() => setStateOffer(null)}
            >
              {t.stateOfferNo}
            </button>
          </span>
        </div>
      )}

      <form
        className="demeter__inputrow"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          className="demeter__input"
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            // Grow with the question. `rows={1}` and a fixed min-height meant a
            // long question scrolled inside two visible lines on a page with
            // room to show all of it. Reset to auto first or the box can only
            // ever get taller, never shorter.
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={composerPrompt}
          rows={1}
          aria-label={composerPrompt}
        />
        {busy ? (
          <button
            type="button"
            className="demeter__send demeter__send--stop"
            onClick={() => {
              abortRef.current?.abort();
              // Stop pacing and show what already arrived. Continuing to type
              // out an answer someone has just told us to stop would be the
              // button not working.
              clearTimeout(rafRef.current);
              rafRef.current = 0;
              shownRef.current = fullRef.current.length;
              setMessages((m) => {
                const copy = m.slice();
                const last = copy[copy.length - 1];
                if (last && last.role === "assistant") {
                  copy[copy.length - 1] = { role: "assistant", content: fullRef.current };
                }
                return copy;
              });
            }}
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
          mode={worksheetMode}
          onModeChange={(m) => {
            setWorksheetMode(m);
            // Turning it OFF throws away what was gathered. Leaving the last
            // estimate on screen under "Just asking" would contradict the
            // sentence right beneath it, and keeping the facts in memory
            // against a later switch-back would make "nothing is gathered"
            // mean "nothing is gathered from now on", which is not what it
            // says.
            if (m === "ask") {
              factsRef.current = {};
              setClassification(null);
              setAnnouncement(t.worksheet.switchedToAsk);
            }
          }}
        />
      </div>
    </div>
  );
}
