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

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** useLayoutEffect warns when React renders this on the server; useEffect
 *  would let a layout land a frame late. Pick per environment. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
import {
  RECOMPOSE_MARKER,
  FOLLOWUP_MARKER,
  ANSWER_LANGS,
  LANG_NATIVE_NAME,
  LANG_SHORT_CODE,
  type PackMeta,
  type AnswerLang,
} from "@civica/demeter-engine/packs";
// TYPE-ONLY from the root barrel: erased at compile time, so this costs the
// browser bundle nothing. A VALUE import here would drag the 1MB eCFR corpus
// onto every phone — the reason the client-safe /packs entry exists at all.
import type { ScreeningClassification, PartialFacts } from "@civica/demeter-engine";
import { DemeterMark } from "./DemeterMark";
import { DemeterStatePicker } from "./DemeterStatePicker";
import { DemeterWelcome } from "./DemeterWelcome";
import { DemeterWorksheet, type WorksheetMode } from "./DemeterWorksheet";
import { DemeterFeedback } from "./DemeterFeedback";
import { DemeterSave } from "./DemeterSave";
import { T } from "../lib/i18n/demeter-chat-copy";
import { supabaseBrowser } from "../lib/supabase-browser";
import { DemeterSignInModal } from "./DemeterSignInModal";
import { stateName } from "../lib/state-names";
import { detectState, detectUncoveredPlace, type StateMention } from "../lib/detect-state";
import type { SavedMsg } from "../lib/demeter-conversations";
import { shieldCitations } from "../lib/no-translate";
import { welcomeSeen, markWelcomeSeen } from "../lib/welcome-seen";

import {
  saveChatSession,
  readChatSession,
  clearChatSession,
  type WorksheetSnapshot,
} from "../lib/chat-session";

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
    // EMPHASIS RECURSES. The freshness footer is emitted as
    // `*Source: [label](url).*` — the whole line, link included, inside one
    // pair of asterisks. Rendering the emphasis contents as a raw string meant
    // the link inside was never parsed, so every answer ended with its source
    // URL printed in brackets and parentheses as literal text. Visible on
    // every cited answer, which is all of them.
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return <strong key={`${keyBase}b${j}`}>{renderInline(p.slice(2, -2), `${keyBase}b${j}`)}</strong>;
    }
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
      return <em key={`${keyBase}i${j}`}>{renderInline(p.slice(1, -1), `${keyBase}i${j}`)}</em>;
    }
    if (p.startsWith("_") && p.endsWith("_") && p.length > 2) {
      return <em key={`${keyBase}u${j}`}>{renderInline(p.slice(1, -1), `${keyBase}u${j}`)}</em>;
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
          // The label is a source name or citation — an identifier, not text
          // for a translator (vercel-guidelines finding 1).
          translate="no"
        >
          {link[1]}
        </a>
      );
    }
    // Citation tokens in plain text get the same shield: "7 CFR 273.9(d)(2)"
    // stops being a citation the moment machine translation touches it.
    return shieldCitations(p, `${keyBase}t${j}`);
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
/** Drops trailer lines the MODEL wrote, keeping the ones Civica appends.
 *
 *  Seen in production: an answer carrying TWO certainty banners — its own
 *  "⚠ UNCERTAIN — do not treat as settled; confirm with your county caseworker"
 *  and ours immediately under it — plus two "Check it yourself" lines. The
 *  reader is told the same caveat twice in two different wordings, which reads
 *  less like care and more like the page arguing with itself.
 *
 *  Ours is appended LAST, in the trailer frame, so for each of these the final
 *  occurrence is the one that survives. Same rule as the source footer below,
 *  applied to the two other lines the model imitates. */
function dropDuplicateTrailerLines(text: string): string {
  const MARKERS = [
    // Certainty banner: keyed off the MARK, which certainty.ts does not
    // localize, so this holds as languages are added.
    /^\s*[✓⚠]\s/,
    // "Check it yourself:" and its translations, with or without emphasis.
    /^\s*[*_]?(Check it yourself|Compruébalo tú mismo|Tự kiểm tra|自己核对)/i,
  ];
  let out = text;
  for (const marker of MARKERS) {
    const lines = out.split("\n");
    const hits = lines.map((l, i) => (marker.test(l) ? i : -1)).filter((i) => i >= 0);
    if (hits.length < 2) continue;
    const keep = hits[hits.length - 1];
    out = lines.filter((_, i) => !hits.includes(i) || i === keep).join("\n");
  }
  return out;
}

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
  const text = dropDuplicateTrailerLines(dropDuplicateFooter(rawText));
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
  // A closing question is very often the last BULLET, and the marker came with
  // it — the composer read "- Otherwise, are you ready to apply now?", a stray
  // hyphen at the start of the field on any answer that ended in a list.
  return last.replace(/^[-•*]\s+/, "");
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
/** Parenthetical legal citations, stripped from the BODY at display time
 *  (#898 P1-4, the third audit pass to flag citation weight for lay
 *  applicants). Head-token anchored so ordinary parentheticals survive, and
 *  tolerant of one level of nested subsection parens — "(7 CFR
 *  273.9(d)(4))" is one match. The raw text keeps every citation: the
 *  server-side verifier reads them there, and the collapsed footnote still
 *  shows the full breakdown. */
const INLINE_CITE_RE =
  /\s*\((?:see |under |per )?(?:(?:7|8)\s?CFR|ACL|ACIN|MPP|FNS Handbook|Pub\.?\s?L\.?)[^()]*(?:\([^()]*\)[^()]*)*\)/g;

/** How many trailing words settle independently at the streaming edge.
 *
 *  Sized against the drain: at the catch-up ceiling a short word is revealed
 *  every ~70–100ms, so five words cover the full 420ms settle — a word is
 *  always finished fading before it leaves the window, and nothing ever
 *  jumps from mid-fade to opaque. */
const STREAM_WINDOW_WORDS = 5;

/** Split a streaming line into a head (rendered normally) and a window of
 *  trailing words, each destined for its own settle span. `at` is the word's
 *  character offset in the line — text only ever appends, so offsets are
 *  stable across renders and make React keys that mount each word exactly
 *  once. (One reused span was the choppiness: the settle animation ran on
 *  first mount only, and every word after it popped in at full opacity.) */
function splitStreamWindow(line: string): {
  head: string;
  window: { at: number; text: string }[];
} {
  if (line === "") return { head: "", window: [] };
  const starts: number[] = [];
  let i = line.length;
  while (starts.length < STREAM_WINDOW_WORDS) {
    const sp = line.lastIndexOf(" ", i - 1);
    if (sp <= 0) {
      starts.unshift(0);
      break;
    }
    starts.unshift(sp);
    i = sp;
  }
  return {
    head: line.slice(0, starts[0]!),
    window: starts.map((at, k) => ({
      at,
      text: line.slice(at, starts[k + 1] ?? line.length),
    })),
  };
}

export function renderAnswer(text: string, opts?: { streaming?: boolean }): ReactNode[] {
  // Strip inline citations from the BODY only — everything before the first
  // trailer rule. The trailer keeps its citations; that is where they live.
  const ruleAt = text.indexOf("\n---\n");
  text =
    ruleAt >= 0
      ? text.slice(0, ruleAt).replace(INLINE_CITE_RE, "") + text.slice(ruleAt)
      : text.replace(INLINE_CITE_RE, "");
  const out: ReactNode[] = [];
  let para: string[] = [];
  let n = 0;
  let lastPara = -1;
  /** The source lines of the paragraph at `lastPara`, kept so the streaming
   *  edge can be re-rendered with its final word faded — see below. */
  let lastParaLines: string[] = [];
  /** Whether out[lastPara] IS the prose paragraph lastParaLines describes.
   *  flushBullets moves lastPara without touching lastParaLines, so without
   *  this flag the streaming-edge branch below rebuilt the PREVIOUS prose
   *  paragraph over the top of a freshly-streamed bullet list — the reader
   *  saw the same sentence twice and the list vanish until the stream
   *  finished (#898 P1-3, screenshot-confirmed on a real conversation). */
  let lastBlockIsProse = false;
  /** The source items of the list at `lastPara` when the last block is a
   *  list, so the streaming edge can rebuild its final item with the settle
   *  window — the list edge previously had no settle at all (#898 P1-3 fixed
   *  content loss here, not motion), and SNAP answers are bullet-heavy. */
  let lastListItems: string[] = [];
  let lastListKey = 0;

  /** A run of "- " lines is a LIST, and should be one.
   *
   *  These used to fall through as ordinary text, so the reader saw literal
   *  hyphens down the left of the answer with no indent and no hanging
   *  alignment — a wrapped item lined up under the dash instead of under its
   *  own first word, which is most of why a three-item list read as a wall. */
  const BULLET = /^[-•*]\s+/;

  const flushBullets = (items: string[], key: number) => {
    lastPara = out.length;
    lastBlockIsProse = false;
    lastListItems = items;
    lastListKey = key;
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
    /** A line that is NOTHING BUT a link is a place to go, not a sentence.
     *
     *  The one that matters is the state portal, handed over the moment a state
     *  is chosen — the single most consequential link in the product, and it
     *  rendered as underlined text in the middle of a paragraph, looking like
     *  any citation. As a filled block in the logo's wheat it reads as the door
     *  it is. Structural rather than a special message type, so it needs no new
     *  role in the saved-conversation shape. */
    const SOLE_LINK = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/;

    const flushProse = () => {
      if (prose.length === 0) return;
      const solo = prose.length === 1 ? SOLE_LINK.exec(prose[0]!.trim()) : null;
      if (solo) {
        prose = [];
        out.push(
          <a
            className="demeter__gocta"
            key={`cta${key}-${out.length}`}
            href={solo[2]}
            target="_blank"
            rel="noopener noreferrer"
          >
            {solo[1]}
            <span aria-hidden> →</span>
          </a>,
        );
        return;
      }
      const p = prose;
      prose = [];
      lastPara = out.length;
      lastParaLines = p;
      lastBlockIsProse = true;
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

  // THE EDGE FADES IN. There used to be a blinking block caret here, which was
  // the loudest thing on a page of quiet type and sat at the end of every
  // sentence as it arrived — a cursor is right for a thing you are typing into
  // and wrong for a thing being read to you.
  //
  // Instead the newest words arrive dimmed and settle. Reveal is on WORD
  // boundaries too (see drawStream), so words appear whole rather than letter
  // by letter; between the two, text arrives the way it is read rather than
  // the way it is typed. Something still has to say "more is coming" — an
  // answer that had finished and one that had stalled used to look identical —
  // and a word that has not finished settling says it without a mark.
  //
  // A WINDOW of words, not one reused span: React kept the single tail node
  // across renders, so its settle animation ran once per answer and every
  // word after ~400ms popped in fully opaque — the pacing work upstream
  // (drawStream) made no visual difference. Each word in the window has its
  // own span keyed by character offset; a word mounts once, fades once, and
  // sits settled while newer words fade in behind it.
  //
  // The window words render as PLAIN TEXT (no renderInline): inline markup
  // spanning a word boundary cannot be split across spans. Any raw markers
  // are on screen for the few hundred ms the window covers, same as the old
  // single-word tail. Guarded to the FINAL block only — a trailing CTA link
  // or the trailer rule ends the fade rather than re-animating text above it.
  if (
    opts?.streaming &&
    lastBlockIsProse &&
    lastPara === out.length - 1 &&
    lastParaLines.length > 0
  ) {
    const lines = lastParaLines.slice();
    const last = lines[lines.length - 1] ?? "";
    const { head, window } = splitStreamWindow(last);
    lines[lines.length - 1] = head;
    // Offsets are within the PARAGRAPH, not the line — a soft line break must
    // not re-key (and so re-fade) words that have already settled.
    const base = lines.slice(0, -1).reduce((n, l) => n + l.length + 1, 0);
    out[lastPara] = (
      <p className="demeter__para" key="p-stream">
        {lines.flatMap((line, i) => [
          ...(i > 0 ? ["\n"] : []),
          ...renderInline(line, `pstream${i}`),
        ])}
        {window.map((w) => (
          <span className="demeter__streamtail" key={`stw${base + w.at}`}>
            {w.text}
          </span>
        ))}
      </p>
    );
  } else if (
    // THE LIST EDGE SETTLES TOO. #898 P1-3 stopped this branch's predecessor
    // from destroying a streaming list; it left the list with no settle at
    // all, so the bullet-heavy answers — most of the corpus — were the ones
    // that still popped. Same window, applied to the final item; finished
    // items above it keep their keys and are not re-animated.
    opts?.streaming &&
    !lastBlockIsProse &&
    lastPara === out.length - 1 &&
    lastPara >= 0 &&
    lastListItems.length > 0
  ) {
    const items = lastListItems;
    const key = lastListKey;
    const lastIdx = items.length - 1;
    const { head, window } = splitStreamWindow(items[lastIdx]!.replace(BULLET, ""));
    out[lastPara] = (
      <ul className="demeter__list" key={`ul${key}`}>
        {items.slice(0, lastIdx).map((item, i) => (
          <li key={`ul${key}i${i}`}>{renderInline(item.replace(BULLET, ""), `ul${key}i${i}`)}</li>
        ))}
        <li key={`ul${key}i${lastIdx}`}>
          {renderInline(head, `ul${key}i${lastIdx}`)}
          {window.map((w) => (
            <span className="demeter__streamtail" key={`stw${w.at}`}>
              {w.text}
            </span>
          ))}
        </li>
      </ul>
    );
  }

  // THE TRAILER IS A FOOTNOTE, not more answer. Certainty, the sections we
  // checked, and where they came from were set in the same face and size as
  // the answer itself, so every reply ended in four lines of apparatus
  // competing with the thing the reader came for. It is not less important —
  // it is what makes the answer checkable — but it is reference, and
  // reference is read differently from prose.
  //
  // Split at the rule the engine already emits, so nothing here has to know
  // what the trailer contains.
  const cut = out.findIndex(
    (n) => (n as React.ReactElement<{ className?: string }>)?.props?.className === "demeter__rule",
  );
  if (cut === -1) return out;
  // Collapsed by default (#898 P1-4): the verdict line is the summary, the
  // full citation breakdown and source line sit one tap away. <details> is
  // native — keyboard and screen-reader accessible with no JS.
  const trailer = out.slice(cut + 1);
  return [
    ...out.slice(0, cut),
    <details className="demeter__footnote" key="footnote">
      <summary className="demeter__footnote-summary">{trailer[0]}</summary>
      {trailer.slice(1)}
    </details>,
  ];
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
const STREAM_TICK_MS = 34;
const STREAM_MAX_STEP = 2;



/** Wrap the two mode labels wherever they appear in a sentence.
 *
 *  Keyed off the copy table's labels, not off quote characters: Spanish uses
 *  «», Chinese uses 「」, and a regex over punctuation would emphasise the
 *  wrong span in half the languages. */
function emphasiseModes(text: string, labels: string[]): ReactNode[] {
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${labels.filter(Boolean).map(esc).join("|")})`, "g");
  return text.split(re).map((part, i) =>
    labels.includes(part) ? (
      <em className="demeter__modename" key={i}>
        {part}
      </em>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function DemeterChat({
  states,
  initialState = null,
  initialQuestion = null,
  initialLang = "en",
  initialMessages = [],
  initialWorksheet = null,
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
  /** The resumed conversation's drafted application (#905), from the saved
   *  row. The sessionStorage restore path deliberately yields to a resumed
   *  conversation (initialMessages short-circuits it), so this prop is the
   *  only way the worksheet comes back on a next-day resume. */
  initialWorksheet?: WorksheetSnapshot | null;
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
  // The right rail's state. Facts live in a ref rather than state: nothing
  // renders them directly (the rail renders the CLASSIFICATION), and a ref is
  // always current inside the async callback, where a state value would be a
  // stale closure a turn behind. Persistence: the per-tab session store and
  // the sign-in stash carry a WorksheetSnapshot (#898 P2-9), and a SAVED
  // conversation stores one on its row (#905) — the saved-state privacy line
  // says so.
  const factsRef = useRef<PartialFacts>(initialWorksheet?.facts ?? {});
  // A STATE MIRROR of factsRef, purely so the panel re-renders when the facts
  // change. The ref stays the source of truth for what gets POSTED (it must be
  // readable synchronously inside send()), but mutating a ref renders nothing
  // — and the panel's new "from what you've told me" section would otherwise
  // update only on the turns that also produced a classification, which is
  // exactly the turns where the reader least needs it.
  const [factsView, setFactsView] = useState<PartialFacts>(
    initialWorksheet?.facts ?? {},
  );
  const rememberFacts = useCallback((next: PartialFacts) => {
    factsRef.current = next;
    setFactsView(next);
  }, []);
  const [classification, setClassification] = useState<ScreeningClassification | null>(
    initialWorksheet?.classification ?? null,
  );
  /** Defaults to "ask" DELIBERATELY. The rail used to read household facts out
   *  of the conversation from the moment a state was picked, whether or not
   *  anyone had asked for an estimate — a reasonable thing to offer and an
   *  unreasonable thing to do quietly to someone who came to find out how the
   *  system works before telling it anything about themselves. */
  const [worksheetMode, setWorksheetMode] = useState<WorksheetMode>(
    // A resumed conversation reopens in the mode it was left in (#905) — the
    // ask default protects a NEW visitor from quiet gathering, and a person
    // resuming their own estimate is the opposite of that case.
    initialWorksheet?.mode ?? "ask",
  );
  /** Whether the "just asking, or shall I work out a figure?" offer has been
   *  answered or waved away at least once — see the callout above the
   *  composer. Dismissing it no longer retires it forever: see
   *  modeReoffered/MODE_REOFFER_AFTER_TURNS below. A real 15-turn
   *  conversation waved this away at turn 2 and never saw it again, even
   *  after asking "then what's next?" with a full income and household
   *  already established (#833 audit, 2026-08-15) — the offer used to be a
   *  true one-shot with nothing bringing it back. */
  const [modeAsked, setModeAsked] = useState(false);
  /** True once the RE-offer (not the original) has itself been dismissed —
   *  after this, it stays gone for good. Asking a third time reads as
   *  nagging rather than a considered second chance. */
  const [modeReoffered, setModeReoffered] = useState(false);
  /** The answered-turn count at the moment the offer was first dismissed —
   *  compared against the current count to decide when enough of the
   *  conversation has happened that asking again is worth it, not a ref that
   *  needs to trigger its own render: answeredCount already re-renders this
   *  component as new answers land. */
  const modeOfferedAtTurnRef = useRef<number | null>(null);
  // ── Pi redesign chrome (2026-08-21) ──────────────────────────────────────
  // OPEN BY DEFAULT (owner refinement): the sidebar IS the tracking panel —
  // state scope, the outlined application, the verify links — and someone
  // arriving should see what the product is keeping for them, not discover
  // it behind an icon. On narrow screens it becomes an overlay and starts
  // closed instead (the effect below), because an auto-open overlay covering
  // the composer is the drawer deciding for the reader.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  /** Sign-in opens OVER the chat (owner rec 2026-08-22) so the conversation
   *  being saved stays visible, blurred, behind the card. The route is still
   *  the fallback: every sign-in link keeps its href and this only takes over
   *  when JavaScript is there to handle it. */
  const [signInOpen, setSignInOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false);
  }, []);
  /** Signed-in email, or null. NULL IS THE DEFAULT AND THE FALLBACK: the
   *  probe runs once, and any failure — missing env (jsdom, CI builds), a
   *  network error, a thrown client — leaves the chat signed-out rather
   *  than broken. Auth is never load-bearing for asking questions. */
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  useEffect(() => {
    try {
      supabaseBrowser()
        .auth.getSession()
        .then(({ data }) => setAuthEmail(data.session?.user?.email ?? null))
        .catch(() => setAuthEmail(null));
    } catch {
      setAuthEmail(null);
    }
  }, []);
  // THE RAIL'S STATE, PUBLISHED ON THE DOCUMENT.
  //
  // The layout shift that clears the rail used to hang off
  // `.dmchat__body:has(.demeter__sidebar--open)` — CSS inferring, from a
  // descendant's class, a state React already owns. Publishing it instead is
  // the shorter path, and it keeps load-bearing layout off :has(), which
  // only reached Firefox in 121; this service's readers are often on old
  // devices.
  //
  // Layout effect, not effect, so it lands before paint and the rail's
  // default-open state does not flash unpadded on arrival.
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.demeterRail = sidebarOpen ? "open" : "closed";
    return () => {
      delete root.dataset.demeterRail;
    };
  }, [sidebarOpen]);

  // Escape closes the drawer ONLY while it is an overlay (narrow screens):
  // there it covers the chat and Escape is the reflex. As a desktop column
  // it covers nothing, and Escape vanishing a standing panel would read as
  // the page breaking.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && window.innerWidth < 1024) setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);
  const signInHref = `/sign-in?next=${encodeURIComponent(lang === "en" ? "/chat" : `/${lang}/chat`)}`;
  /** Narrow-viewport flag for the in-column picker instance. STATE, not
   *  CSS-only: two picker instances in the DOM read as two controls to the
   *  accessibility tree (and to every role query in the tests) even when a
   *  stylesheet hides one — so exactly one instance ever renders. False on
   *  the server and wherever matchMedia is missing; phones pick it up at
   *  hydration. */
  const [narrowViewport, setNarrowViewport] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 900px)");
    setNarrowViewport(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setNarrowViewport(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /** Emailing the outline to yourself: idle → sending → sent | signin | error.
   *  Mirrors DemeterSave's shape deliberately — they are the same decision
   *  ("keep this") reached from two directions, and behaving differently would
   *  make one of them look broken. */
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "signin" | "error">(
    "idle",
  );
  const [emailDetail, setEmailDetail] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<"idle" | "working" | "error">("idle");

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
  /** Whether the inline save-nudge banner has been waved off. The Save
   *  button itself is never hidden — this only retires the PROMPT, so
   *  someone who dismisses it can still save later from the side panel. */
  const [saveNudgeDismissed, setSaveNudgeDismissed] = useState(false);
  /** Bumped to tell DemeterSave "save now" from outside itself — see
   *  DemeterSave's triggerSave prop. Mirrors openPicker below. */
  const [saveSignal, setSaveSignal] = useState(0);
  /* AUTO-SAVE WHILE SIGNED IN (owner, 2026-08-26). Saving was a button in a
     side rail, and the report was simply "there is no way to save the
     conversation" — which is what a control nobody finds amounts to.
     Signed in, the conversation now keeps itself.

     It reuses DemeterSave's own save() through triggerSave rather than
     posting again from here: the upsert, the pending-save handoff, the 401
     and the 409-at-the-cap all live there, and a second copy of that logic is
     a second thing to get wrong.

     SIGNED OUT IT MUST NOT FIRE. A save attempt without a session opens the
     sign-in invitation panel, so bumping this on every answer would put a
     login in front of a product whose whole promise is that you never need
     one. authEmail is null until the probe returns, and null is also its
     failure value, so this errs toward not saving.

     AT THE CAP IT STOPS, and says so (owner's call, 2026-08-26): the API
     answers 409 with the limit, DemeterSave renders copy.limit(n), and
     nothing of theirs is deleted to make room. */
  const autoSavedCount = useRef(0);
  useEffect(() => {
    if (authEmail === null) return;
    if (busy) return;
    if (messages.length === 0) return;
    // Only once a turn has actually COMPLETED — the last message is the
    // assistant's, and it is no longer streaming.
    if (messages[messages.length - 1]?.role !== "assistant") return;
    if (autoSavedCount.current === messages.length) return;
    autoSavedCount.current = messages.length;
    setSaveSignal((n) => n + 1);
  }, [authEmail, busy, messages]);
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
  /** The first-visit card. Starts CLOSED and is opened by an effect, not by
   *  initial state: reading localStorage during render would differ between
   *  server and client and hydrate mismatched. Never shown over an existing
   *  conversation — someone resuming has already met the product. */
  const [showWelcome, setShowWelcome] = useState(false);

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
    // WORD BOUNDARIES. Revealing mid-word is what made this read as typing:
    // the eye tries to read a fragment, fails, and waits. Backing up to the
    // last space costs at most a few characters of latency and means words
    // arrive whole. Never backs past what is already on screen, so text cannot
    // appear to un-type itself, and never holds back the final word once the
    // whole answer has arrived.
    let cut = shownRef.current;
    if (cut < full.length) {
      const space = full.lastIndexOf(" ", cut);
      if (space > 0) cut = space + 1;
    }
    const text = full.slice(0, cut);
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
  // SURVIVE A PAGE CHANGE. Reading the header's other tab and coming back used
  // to destroy the conversation silently — see lib/chat-session.ts on why a
  // beforeunload warning would not have caught that case. Restores only when
  // this render started empty, so a saved conversation opened by id and a
  // ?q= deep link both still win.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (initialMessages.length > 0) return;
    const prior = readChatSession();
    if (!prior) return;
    setMessages(prior.messages);
    setState(prior.state);
    setLang(prior.lang as AnswerLang);
    // The drafted application comes back WITH the transcript (#898 P2-9) —
    // restoring the conversation while wiping the worksheet read as the
    // product deleting someone's work at the moment they tried to keep it.
    if (prior.worksheet) {
      setWorksheetMode(prior.worksheet.mode);
      rememberFacts(prior.worksheet.facts);
      setClassification(prior.worksheet.classification);
    }
  }, [initialMessages, rememberFacts]);

  // Written on every change rather than on unload, because a client-side
  // navigation gives no unload to hook. factsRef is a ref, so it cannot
  // appear in the dependency list — but facts only ever change alongside
  // `classification` (both are set together in refreshWorksheet and cleared
  // together on mode switch), so writing on classification changes carries
  // the fresh facts too.
  useEffect(() => {
    if (busy) return; // mid-stream, the last message is a half-typed answer
    saveChatSession({
      messages,
      state,
      lang,
      worksheet: { mode: worksheetMode, facts: factsRef.current, classification },
    });
  }, [messages, state, lang, busy, worksheetMode, classification]);

  // The gate lives in lib/welcome-seen so the landing page asks the SAME
  // question of the SAME key — being introduced twice, once per door, is the
  // one thing a first-visit card must not do.
  useEffect(() => {
    if (initialMessages.length > 0) return;
    if (!welcomeSeen()) setShowWelcome(true);
  }, [initialMessages.length]);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    // Straight into the box. Someone who has just read what the program is has
    // a question; landing them at the top of the document to go find the
    // composer is a step for no reason.
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    markWelcomeSeen();
  }, []);

  useEffect(() => () => clearTimeout(rafRef.current), []);

  // THE URL CLAIMS WHAT THE SCREEN SHOWS (vercel-guidelines finding 3).
  // Inbound ?state= always worked; picking a state never wrote it back, so
  // share/refresh/Back silently dropped the scope. replaceState, not
  // pushState — scope is a property of the page, not a navigation. The
  // conversation itself stays OUT of the URL on purpose.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (state) url.searchParams.set("state", state);
    else url.searchParams.delete("state");
    if (url.toString() !== window.location.href) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [state]);

  // AUTOFOCUS, DESKTOP ONLY (vercel-guidelines finding 6): this surface is a
  // screen with one primary input, so arriving should mean typing. Coarse
  // pointers skip it — the keyboard shoves the layout around — and
  // preventScroll keeps a restored conversation where the reader left it.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    // NOT WHILE THE FIRST-VISIT CARD IS UP. It is a modal and holds focus; two
    // effects racing for it leaves a keyboard reader in the conversation
    // behind a dialog they cannot see past. Dismissing hands focus to the
    // composer instead, which is where they were headed anyway.
    if (showWelcome) return;
    inputRef.current?.focus({ preventScroll: true });
    // Mount-only on purpose: refocusing on later state changes would steal
    // focus mid-conversation.
     
  }, [showWelcome]);
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
    // the computed outcome is dropped.
    setClassification(null);
    // ...AND IT RECOMPUTES NOW, not on the next message. "The next turn
    // recomputes it" left the panel on its empty template after a state
    // change, which reads as the estimate having been thrown away rather than
    // rescoped — the same failure as switching INTO estimate mode and seeing
    // nothing happen. The facts needed are already here; only the state
    // changed. Estimate mode only: ask mode extracts nothing, and a state
    // change is not consent to start.
    if (next && worksheetMode === "estimate") {
      const turns = messages.filter(
        (x): x is { role: "user" | "assistant"; content: string } =>
          x.role !== "divider" && Boolean(x.content),
      );
      let window = turns.slice(-20);
      if (window[0]?.role !== "user") window = window.slice(1);
      if (window.length) void refreshWorksheetFor(window, next, window.length === turns.length);
    }
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
      // SHOW `short`, NOT `name`. The pack's own contract says so — `name` is
      // model-facing and "may carry a trailing annotation", `short` is the
      // portal as it is branded. Using `name` put the annotation INSIDE the
      // button, so New York's read "Apply at myBenefits.ny.gov (statewide
      // EXCEPT NYC; NYC uses ACCESS HRA)" — a two-line label in a pill, and
      // the most important word in it was a warning nobody reads in a button.
      //
      // The annotation is never dropped, which the pack also says: it just
      // gets its own line, where it can be read as the caveat it is.
      const cta = (label: string, url: string) =>
        t.portalCta.replace("{portal}", label).replace(/^(.*)$/, `[$1](${url})`);
      // A paragraph that is EXACTLY a link becomes the wheat button (see
      // SOLE_LINK); anything sharing its paragraph would demote it to an
      // inline link. So each condition gets its own line above its button.
      const alt = pack?.portal?.alternate;
      const portal =
        pack?.portal && name
          ? [
              t.portalLead.replace("{state}", name).replace("{agency}", pack.agencyShort),
              // TWO PORTALS ARE A QUESTION, NOT A FOOTNOTE. Where a state runs
              // more than one, asserting the statewide one and burying "except
              // NYC" hands roughly eight million people the wrong form.
              ...(alt
                ? [
                    t.portalTwo.replace("{state}", name),
                    `**${alt.when}**`,
                    cta(alt.short, alt.url),
                    `**${alt.otherwise}**`,
                    cta(pack.portal.short, pack.portal.url),
                  ]
                : [
                    cta(pack.portal.short, pack.portal.url),
                    ...(pack.portal.note ? [`_${pack.portal.note}_`] : []),
                  ]),
              t.portalStay,
            ].join("\n\n")
          : null;

      const hasSaidSomething = messages.some((m) => m.role !== "divider");
      const inserts = [
        ...(hasSaidSomething
          ? [
              {
                role: "divider" as const,
                content: name ? t.dividerTo(name) : t.dividerFederal,
              },
            ]
          : []),
        ...(portal ? [{ role: "assistant" as const, content: portal }] : []),
      ];
      // A STREAM IN FLIGHT OWNS THE LAST SLOT. Every streaming write targets
      // messages[length - 1] if it is an assistant, so appending behind a
      // half-written answer hands the stream this portal message to overwrite
      // — and strands the empty placeholder in the middle of the transcript,
      // where it becomes an invalid turn on the next request (a 400 that
      // sticks). Going in FRONT of the placeholder keeps the answer landing
      // where it was meant to and the divider where it belongs: before it.
      setMessages((m) => {
        if (!inserts.length) return m;
        const tail = m[m.length - 1];
        const streaming = tail?.role === "assistant" && tail.content === "";
        return streaming ? [...m.slice(0, -1), ...inserts, tail] : [...m, ...inserts];
      });
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
    rememberFacts({});
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
    // And the per-tab copy, or "start a new conversation" would hand the next
    // page load the old one straight back.
    clearChatSession();
    setAnnouncement(t.cleared);
  }, [t, resetInputHeight, rememberFacts]);

  /** Send the outlined application to the address on the account.
   *
   *  NEVER takes an address: the route reads it from the session, so there is
   *  no field to mistype and no way to mail one person's household and income
   *  to another. That also means a signed-out reader gets the sign-in panel
   *  rather than a form, which is the honest order — you cannot be sent
   *  something until we know where.
   */
  const emailOutline = useCallback(async () => {
    setEmailState("sending");
    setEmailDetail(null);
    try {
      const pack = state ? states.find((x) => x.code === state) ?? null : null;
      const res = await fetch("/api/demeter/email-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facts: factsRef.current,
          stillNeeded: classification?.completeness?.stillNeeded ?? [],
          stateName: state ? stateName(state) : null,
          agency: pack?.agencyShort ?? null,
          portalName: pack?.portal?.name ?? null,
          portalUrl: pack?.portal?.url ?? null,
        }),
      });
      if (res.status === 401) return setEmailState("signin");
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
        setEmailDetail(b.reason ?? b.error ?? `http_${res.status}`);
        return setEmailState("error");
      }
      setEmailState("sent");
      setAnnouncement(t.emailSent);
    } catch {
      setEmailDetail("network");
      setEmailState("error");
    }
  }, [state, states, classification, t]);

  /** Download the outline as a PDF.
   *
   *  No account needed, unlike the emailed copy. The document is built from
   *  the facts already on this screen and nothing is read from or written to
   *  the database — so locking the one artefact someone can walk away with
   *  behind a sign-in would be exactly the wrong thing to gate for a person
   *  who came here worried about being tracked.
   */
  const downloadOutline = useCallback(async () => {
    setPdfState("working");
    try {
      const pack = state ? states.find((x) => x.code === state) ?? null : null;
      const res = await fetch("/api/demeter/outline-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facts: factsRef.current,
          stillNeeded: classification?.completeness?.stillNeeded ?? [],
          stateName: state ? stateName(state) : null,
          agency: pack?.agencyShort ?? null,
          portalName: pack?.portal?.name ?? null,
          portalUrl: pack?.portal?.url ?? null,
        }),
      });
      if (!res.ok) return setPdfState("error");
      // Read the filename the route chose rather than inventing one here —
      // it carries the state and date, and two copies of that logic would
      // drift.
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const named = /filename="([^"]+)"/.exec(disposition)?.[1];
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = named ?? "outlined-application.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking immediately can cancel the download in some browsers; a beat
      // later is safe and the object is gone with the tab regardless.
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setPdfState("idle");
      setAnnouncement(t.pdfDownloaded);
    } catch {
      setPdfState("error");
    }
  }, [state, states, classification, t]);

  const restoreConversation = useCallback(
    (
      restored: Msg[],
      restoredState: string | null,
      restoredLang: AnswerLang,
      worksheet?: WorksheetSnapshot,
    ) => {
      setMessages(restored);
      setState(restoredState);
      setLang(restoredLang);
      // The drafted application, back exactly as it was left (#898 P2-9).
      if (worksheet) {
        setWorksheetMode(worksheet.mode);
        rememberFacts(worksheet.facts);
        setClassification(worksheet.classification);
      }
    },
    [rememberFacts],
  );

  /** The worksheet as it stands RIGHT NOW, for the sign-in stash (#898 P2-9).
   *  A getter so DemeterSave reads it at write time; stable identity because
   *  it reads a ref and state via the render closure would go stale. So it
   *  reads refs and the setters' current values through a second ref. */
  const worksheetSnapRef = useRef<WorksheetSnapshot>({
    mode: "ask",
    facts: {},
    classification: null,
  });
  worksheetSnapRef.current = { mode: worksheetMode, facts: factsRef.current, classification };
  const snapshotWorksheet = useCallback(() => worksheetSnapRef.current, []);

  /** Update the right rail. Never throws into the caller and never surfaces an
   *  error in the chat: a quiet rail is an acceptable degradation, a chat that
   *  reports "something went wrong" because a side panel failed is not. */
  /** Recompute against an EXPLICIT state.
   *
   *  changeState calls this, and at that moment the `state` STATE still holds
   *  the old code. SetState has not applied yet. So a version closing over
   *  it would rescope the estimate to the state the reader just left. */
  const refreshWorksheetFor = useCallback(
    async (
      apiMessages: Array<{ role: "user" | "assistant"; content: string }>,
      forState: string | null,
      /** True when apiMessages IS the whole conversation, not a tail window.
       *  Callers compute it by comparing what they held against what they
       *  sent, see #966. Guessing here would defeat the point. */
      windowComplete = false,
    ) => {
      if (!forState) return;
      try {
        const res = await fetch("/api/demeter/worksheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            facts: factsRef.current,
            state: forState,
            windowComplete,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          facts?: PartialFacts;
          classification?: ScreeningClassification | null;
        };
        if (data.facts) rememberFacts(data.facts);
        // Null classification = the route soft-failed or found nothing yet.
        // Keep whatever is already on screen rather than blanking the panel.
        if (data.classification) setClassification(data.classification);
      } catch {
        /* soft by design */
      }
    },
    [rememberFacts],
  );

  const refreshWorksheet = useCallback(
    (apiMessages: Array<{ role: "user" | "assistant"; content: string }>, complete = false) =>
      refreshWorksheetFor(apiMessages, state, complete),
    [state, refreshWorksheetFor],
  );

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || busy) return;
    setError(null);
    setBusy(true);
    setInput("");
    resetInputHeight();

    // EMPTY TURNS ARE DROPPED, not just dividers. An assistant message with
    // no content is rejected by the server ("message.content must be a
    // non-empty string"), which returns a 400 carrying no `reason` — so the
    // reader sees "Demeter couldn't read that (http_400)" and the chat is
    // stuck: every retry resends the same invalid history.
    //
    // One can be left behind by changing state WHILE AN ANSWER IS STREAMING,
    // which is exactly what "flickering through states" does. changeState has
    // always filtered `Boolean(x.content)` when it builds its own window; this
    // path did not, and the two disagreeing is the whole bug.
    const chatTurns = messages.filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        m.role !== "divider" && Boolean(m.content),
    );
    // Tail-window to the server's MAX_MESSAGES (20). A strictly alternating,
    // user-first history is ALWAYS odd length once the new question is
    // appended, and slicing an odd-length array to an even window (20) drops
    // an odd number of leading elements. Meaning the surviving array starts
    // with the assistant every single time this branch is taken, forever,
    // for any conversation that ever reaches 10 exchanges. Server-side,
    // that's a hard 400 ("Conversation must start with a user message") on
    // every following turn, permanently locking the chat (#833). Dropping
    // one more leading message when the slice lands on assistant keeps the
    // window user-first without the server ever seeing it.
    let apiMessages = [...chatTurns, { role: "user" as const, content: question }].slice(-20);
    if (apiMessages[0]?.role !== "user") {
      apiMessages = apiMessages.slice(1);
    }
    // Did they name somewhere? Offered, not applied. And only when it
    // disagrees with the scope they are already on.
    const mentioned = detectState(question);
    setStateOffer(mentioned && mentioned.code !== state ? mentioned : null);

    // A place we do NOT cover has to be said out loud. "Washington DC" used to
    // match the word "washington" and quietly answer for Washington State. A
    // different agency, a different portal, different figures, and nothing on
    // screen admitting it. Saying "not yet, here is what still applies" is a
    // worse answer and a far better outcome than a confident wrong one.
    const uncovered = detectUncoveredPlace(question);
    const alreadySaid =
      uncovered !== null &&
      messages.some((m) => m.role === "divider" && m.content.includes(uncovered));

    // Fresh buffer per answer, or the next one types out on top of the last.
    clearTimeout(rafRef.current);
    rafRef.current = 0;
    rawRef.current = "";
    fullRef.current = "";
    shownRef.current = 0;

    setMessages((m) => [
      ...m,
      { role: "user", content: question },
      ...(uncovered && !alreadySaid
        ? [{ role: "divider" as const, content: t.dividerUncovered(uncovered) }]
        : []),
      { role: "assistant", content: "" },
    ]);

    // The rail updates ALONGSIDE the answer, not after it: a second round trip
    // in series would make every reply feel slower for a panel that is
    // supplementary. It is intentionally not awaited and intentionally cannot
    // throw into this scope. The answer must not depend on it.
    // THE GATE. In "ask" mode this call never happens, so no facts are
    // extracted, nothing lands in factsRef, and the paid extraction round trip
    // is not made either.
    // windowComplete: did the tail-window drop anything? chatTurns + the new
    // question is everything there is; apiMessages is that, sliced to 20 and
    // possibly one more off the front to stay user-first (#833).
    if (state && worksheetMode === "estimate") {
      void refreshWorksheet(apiMessages, apiMessages.length === chatTurns.length + 1);
    }

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
     *  message stranded in the transcript above an error. So someone on a
     *  flaky prepaid connection, which is most of this audience, had to retype
     *  a question they had already carefully worded. That is the opposite of an
     *  actionable recovery step.
     *
     *  Drops their turn from the transcript as well as the empty assistant
     *  bubble, because the honest state after a failed send is "you typed this
     *  and it did not go", not "you asked this and were ignored". And leaving
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
          // Counts ANSWERS, not attempts, because an audit row is written per
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
        // "give it a minute" for both. So someone who had hit the daily cap
        // was told to wait a minute for something that resets tomorrow, and
        // would sit there retrying. The route's own comment calls the two
        // "distinct ON PURPOSE"; this is where that distinction was being lost.
        //
        // WHOSE FAULT IT IS. Everything unmapped used to fall through to
        // "Something went wrong. Please try again.". Which was also the copy
        // for a genuine connection failure, so a 500 on our side and a dropped
        // wifi connection were indistinguishable. They call for different
        // actions, and neither reader could tell which they had.
        const message =
          reason === "at_capacity"
            ? t.errCapacity
            : reason === "ip_daily_cap"
              ? t.errDailyCap
              : reason === "rate_limited" || res.status === 429
                ? t.err429
                : res.status === 503
                  ? t.errConfig
                  : res.status >= 500
                    ? t.errServer
                    : t.errRequest;
        // The code, so a report is actionable. Same reasoning as the save
        // failure: "it says something went wrong" cannot be acted on by
        // anybody, and the reader is the only one who can see it.
        setError(`${message} (${reason || `http_${res.status}`})`);
        // Hand the question back only where trying again can actually work.
        // A per-minute limit clears; a daily cap, a spent monthly budget and an
        // unconfigured service do not, and offering a retry there loops someone
        // instead of sending them to the 211 number the message gives them.
        const retryable = message === t.err429 || message === t.errServer;
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
          // screen. The display may legitimately be behind.
          const markerAt = rawRef.current.lastIndexOf(RECOMPOSE_MARKER);
          const next =
            markerAt >= 0
              ? rawRef.current.slice(markerAt + RECOMPOSE_MARKER.length).replace(/^\s+/, "")
              : rawRef.current;

          // If the recomposed answer does not continue what is already shown,
          // the draft was thrown away. So the display starts over and the
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
      // throttled hard there, and an unbounded wait would leave busy stuck on , 
      // Stop showing instead of Send. For as long as the tab stayed hidden.
      if (shownRef.current < fullRef.current.length) {
        // A STALL WATCHDOG, not a deadline. A fixed ceiling would truncate a
        // long answer that is pacing correctly. At reading pace a 2,000
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
      // An abort is the user pressing Stop, not a failure. Their question was
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

  /** The pack for whichever state is selected, or null on the federal floor.
   *  agencyHref (the disclaimer's link) and the "Apply at {portal}" link
   *  next to "How we verify" both read off this. One lookup, not two. */
  const selectedPack = state ? states.find((x) => x.code === state) ?? null : null;
  /** The agency the disclaimer points at. Their own state's, once one is set , 
   *  a generic "your state agency" is exactly the sort of advice that sounds
   *  complete and leaves someone with nowhere to go. */
  const agencyHref = selectedPack?.portal?.url ?? "/states";

  const hasChat = messages.length > 0;
  /** The newest assistant message with content. Follow-ups hang off this one
   *  alone — see the comment at their render. */
  const lastAnswerIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m && m.role === "assistant" && m.content) return i;
    }
    return -1;
  })();

  /** At least one answer has finished. The mode offer waits for this: before an
   *  answer exists there is nothing to have an opinion about. */
  const answeredOnce = messages.some((m) => m.role === "assistant" && m.content !== "");
  const answeredCount = messages.filter((m) => m.role === "assistant" && m.content !== "").length;
  /** How much more conversation has to happen, after a "just asking" dismissal,
   *  before it is worth asking again. Six answered turns is deliberately a
   *  while. This must not feel like nagging. But not "never": the real
   *  transcript that found this gap ran fifteen turns deep with a full income
   *  and household established and was never asked a second time. */
  const MODE_REOFFER_AFTER_TURNS = 6;
  const showModeOffer =
    answeredOnce &&
    !busy &&
    worksheetMode === "ask" &&
    (!modeAsked ||
      (!modeReoffered &&
        modeOfferedAtTurnRef.current !== null &&
        answeredCount - modeOfferedAtTurnRef.current >= MODE_REOFFER_AFTER_TURNS));
  /** How many answered turns before the save nudge earns its place. Lower
   *  than MODE_REOFFER_AFTER_TURNS deliberately: losing the WHOLE
   *  conversation is a bigger loss than not getting a structured estimate,
   *  so it is worth mentioning sooner. A real 15-turn conversation with real
   *  content in it never once saw this (#833 audit, 2026-08-15). The Save
   *  button existed the whole time, tucked in the side panel. Started at 4;
   *  real feedback the same day was that it fired too soon (felt like
   *  turn 4-5 of an ordinary conversation, not yet "long enough to lose"),
   *  so raised to 8. */
  const SAVE_NUDGE_AFTER_TURNS = 8;
  const showSaveNudge =
    !busy && !conversationSaved && !saveNudgeDismissed && answeredCount >= SAVE_NUDGE_AFTER_TURNS;

  // What the composer asks for. If Demeter's last answer ended in a question,
  // that question. Otherwise the standing invitation. Never while an answer is
  // still arriving: the placeholder would change under the person mid-read.
  const lastAssistant = busy
    ? null
    : [...messages].reverse().find((m) => m.role === "assistant" && m.content)?.content ?? null;
  // The standing invitation, worded for the mode you are actually in. The two
  // modes do different things with what you type. One gathers it into a
  // document, one deliberately does not. And the box you type into was the
  // one place that never said which was happening.
  //
  // t.inputPlaceholder is a FIRST-TIME invitation ("Happy to answer any
  // questions about SNAP…") — right for an empty box, and wrong for turn 8:
  // real feedback (2026-08-15) was that it read as though Demeter had
  // forgotten the conversation was already going, every time the last answer
  // didn't end in a specific question to fall back on. Once there IS a chat,
  // a shorter, conversation-aware line takes its place instead.
  const standingPrompt =
    worksheetMode === "estimate"
      ? t.inputPlaceholderEstimate
      : hasChat
        ? t.inputPlaceholderContinue
        : t.inputPlaceholder;
  const composerPrompt =
    (lastAssistant ? pendingQuestion(lastAssistant) : null) ?? standingPrompt;

  return (
    <div className="demeter">
      <header className="demeter__head">
        {/* Pi redesign (2026-08-21): the head was display:none on /chat (the
            nav is the brand chrome there), which left it vestigial. It is now
            the CHAT's own chrome row: sidebar toggle left, language + sign-in
            right; the brand block stays for any surface without the nav and
            is CSS-hidden under .dmchat where the nav already carries it. */}
        {/* THE PAGE'S ONLY TOP ROW (owner rec 2026-08-22): the site nav is
            gone from /chat — it duplicated the rail's brand and languages and
            cost a band of height on the one surface that wants the height.
            What the nav carried that this surface still needs lives here:
            the way to the reference page, and the way to sign in.

            FIRST focusable, and it now earns its keep more than the nav's did:
            a keyboard reader would otherwise cross the toggle, two links and
            the entire rail — picker, mode switch, template, settings — before
            reaching the box they came to type in. */}
        <a className="demeter__skip" href="#demeter-composer">
          {t.skipToComposer}
        </a>
        {/* Universal LEFT. Rendered only while the rail is closed (open, the
            rail's own head carries it in the same screen position) — and
            COLORED when closed: as a bare outline on white it read as page
            furniture, and nobody found the panel behind it. */}
        {!sidebarOpen && (
          <button
            type="button"
            className="demeter__sidebartoggle demeter__sidebartoggle--closed"
            aria-expanded={sidebarOpen}
            aria-controls="demeter-sidebar"
            aria-label={t.sidebarLabel}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
              <line x1="7.5" y1="3.5" x2="7.5" y2="16.5" />
            </svg>
          </button>
        )}
        {/* Universal RIGHT: sign in (boxed, so it reads as a control rather
            than a stray underline), then the reference page beyond it. */}
        <div className="demeter__headright">
          {/* UNIVERSAL, both rail states (owner rec 2026-08-22 — this
              supersedes the earlier one-sign-in-on-screen rule): the top
              right always offers it, and the rail's settings bar groups a
              second one with privacy and feedback, where someone looking
              for account things goes. */}
          {authEmail === null && (
            <a
              className="demeter__signin"
              href={signInHref}
              onClick={(e) => {
                // Modifier-clicks and middle-clicks still mean "open the
                // route", which is what the href is for.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                setSignInOpen(true);
              }}
            >
              {t.signin}
            </a>
          )}
          {/* The "What is SNAP?" link is GONE (owner, 2026-08-22). It sent
              someone out of the chat to read a definition — and the definition
              is now the first thing the empty state says, alongside the
              first-visit card, so the trip is pointless. The chrome row is
              sign-in and nothing else. */}
        </div>
      </header>

      {/* One control, one selected state — replaces the chip row that ate a
          full row and still clipped this link off the right edge at 1280px. */}

      <div className={`demeter__body${sidebarOpen ? " demeter__body--sb" : ""}`}>
        <div className="demeter__main">
          {/* The controls live INSIDE the conversation column, not in a full-width
              row above it. Out here they started 68px above the rail and left
              "How we verify" floating alone in the right column, belonging to
              neither. In here both columns begin on the same line. */}
          {/* THE PICKER STAYS VISIBLE ON PHONES. Moving the tracking panel
              into the drawer buried the state control behind a closed
              overlay on narrow screens — and the state is the fact every
              figure in every answer depends on, so it must stay SEEN. Caught by
              the mobile-first e2e suite (Pixel profile), which pins the old
              decision: the picker goes first, above the transcript. Same
              lifted state as the sidebar's instance; CSS shows exactly one
              of the two at any width. */}
          {narrowViewport && (
            <div className="demeter__mobilepicker">
              <DemeterStatePicker
                states={states}
                value={state}
                onChange={changeState}
                copy={t.picker}
                hint={geoHint}
                openSignal={openPicker}
              />
            </div>
          )}
      <div className="demeter__scroll" ref={scrollRef}>
        {!hasChat && (
          // A composed block, centred in the space rather than three buttons
          // left in it. Measured: 414px of the 565px transcript was empty, and
          // whichever end the chips were pinned to, they read as controls
          // someone forgot rather than as the start of a conversation.
          <div className="demeter__empty">
            {/* MARK AND TITLE ON ONE LINE (owner, 2026-08-26). Stacked, the
                mark sat alone above the heading and read as a spacer. */}
            <div className="demeter__emptyhead">
              <DemeterMark size={40} />
              <h2 className="demeter__emptytitle">{t.emptyTitle}</h2>
            </div>
            {/* WHAT THE PROGRAM IS, then what this is (owner, 2026-08-22).
                The "What is SNAP?" link is gone, so the definition it pointed
                at leads here instead — someone who has just been told to
                "apply for SNAP" may not know what the letters mean, and
                sending them off the page to find out was the old answer. */}
            <p className="demeter__emptywhat">{t.emptyWhatIsSnap}</p>
            <p className="demeter__emptylede">{t.emptyLede}</p>
            {/* Framing before the first word is typed (#898 P2-6): SNAP is
                formula work this chat can walk through, and there are two
                modes. A full-length real conversation ended without the
                tester ever learning either. */}
            {/* The two labels are the SWITCH's own words, so they are set
                apart from the sentence around them: someone scanning for what
                to press finds them without reading the line. Split on the copy
                table's own labels rather than on quote marks, so it stays
                right in a language that quotes differently. */}
            <p className="demeter__emptymodes">
              {emphasiseModes(t.emptyModes, [t.worksheet.modeAsk, t.worksheet.modeEstimate])}
            </p>
            {/* THE ASK-STATE LINE IS GONE (owner, 2026-08-26). It told people to
                "choose it above" — and the picker it points at is the first
                thing in the rail, labelled "Your state", so the line was a
                caption for a control that already says what it is. The
                federal-floor caveat it also carried survives on the picker's
                own scope line and in the divider the moment a state is set. */}
            {/* NO STARTER QUESTIONS. There were three — "Do I earn too much to
                qualify?", "I need food this week", "Will I have to do an
                interview?" — and none of them is what someone actually opens
                with. Two carry a discouraging premise before a word has been
                exchanged: that they probably earn too much, or that an
                interview is looming. Putting those in front of a person who
                has not yet decided whether they are allowed to ask is a way to
                lose them at the door.

                An empty composer asks nothing of anyone. The model's own
                opening question does the guiding, where it can respond to what
                the person actually says. */}
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
                    {/* THIRD ATTEMPT. Three dots read as a stall; a rule that
                        filled and receded read as a progress bar lying about
                        progress — both were separate objects next to the words,
                        competing for the eye while nothing happened.

                        Nothing is added here now. The words themselves carry a
                        slow light across them, left to right, the way something
                        working looks rather than the way something loading
                        looks. One element, no jumping, and under
                        prefers-reduced-motion it is simply the text. */}
                    <span className="demeter__thinkingtext">{t.thinking}</span>
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
              {/* ONLY UNDER THE NEWEST ANSWER (owner, 2026-08-26: "I don't need
                  it for every prompt follow-up"). Every assistant message kept
                  its own set, so scrolling back through a long conversation
                  walked past a row of stale suggestions under each one —
                  answered questions still offering themselves. The follow-ups
                  are about where the conversation is NOW, so only the last
                  answer carries them. */}
              {m.role === "assistant" && m.content && i === lastAnswerIndex && !busy && (
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

      {/* WHICH OF THE TWO THINGS THIS IS, asked after the first answer — and
          again, once, later on. The toggle for it lives in the right-hand
          panel, which nobody looks at while reading their first reply — so
          the product's two modes were a control most people never knowingly
          chose between, and everyone stayed in "just asking" by default even
          when they wanted a number.

          After the FIRST answer, deliberately: before one, there is nothing to
          have an opinion about. But "just asking" dismissed once does not mean
          "never offer again" — a real conversation ran fifteen turns deep,
          with a full income and household established, asked "then what's
          next?", and was never offered this a second time even though it was
          exactly the moment it would have helped (#833 audit, 2026-08-15). So
          this re-offers ONCE more after MODE_REOFFER_AFTER_TURNS further
          answers, then stays quiet for good if waved away again — a second
          considered chance, not a nag. Choosing "work out a figure" opens the
          state picker straight away, because an estimate without a state is a
          federal-floor guess and the picker is the next thing needed either
          way. */}
      {showWelcome && (
        <DemeterWelcome
          copy={t.welcome}
          onDismiss={dismissWelcome}
          signInHref={`/sign-in?next=${encodeURIComponent(lang === "en" ? "/chat" : `/${lang}/chat`)}&lang=${lang}`}
        />
      )}
      {showModeOffer && (
        <div
          className="demeter__modeoffer"
          role="group"
          aria-label={t.modeOffer}
        >
          <span className="demeter__modeoffer-text">{t.modeOffer}</span>
          <span className="demeter__modeoffer-actions">
            {/* ORDER MIRRORS THE PANEL. The toggle in the right-hand column
                reads "Just asking | Build my estimate"; this read the other way
                round, so the same choice appeared twice on one screen with its
                sides swapped. */}
            <button
              type="button"
              className="demeter__modeoffer-no"
              onClick={() => {
                if (modeAsked) {
                  // This IS the re-offer — dismissing it retires it for good.
                  setModeReoffered(true);
                } else {
                  modeOfferedAtTurnRef.current = answeredCount;
                  setModeAsked(true);
                }
              }}
            >
              {t.modeOfferAsk}
            </button>
            <button
              type="button"
              className="demeter__modeoffer-yes"
              onClick={() => {
                setWorksheetMode("estimate");
                setModeAsked(true);
                setModeReoffered(true);
                setAnnouncement(t.modeOfferEstimate);
                // An estimate is scoped to a state or it is a federal-floor
                // guess wearing a figure's confidence.
                if (state === null) setOpenPicker((n) => n + 1);
              }}
            >
              {t.modeOfferEstimate}
            </button>
          </span>
        </div>
      )}

      {/* THE SAVE NUDGE. Reuses the mode-offer's own classes deliberately —
          same banner shape, no new CSS, and the reader has already learned
          what this row looks like from the offer above. The Save button
          itself lives in the side panel (see demeter__side below) and stays
          there; this is a second, INLINE way to reach the same action for
          the person who never notices a rail while reading a reply — the
          exact gap a real 15-turn, never-saved conversation exposed (#833
          audit, 2026-08-15). Dismissing it only retires the PROMPT, not the
          button — there is no cost to waving it off. */}
      {showSaveNudge && (
        <div className="demeter__modeoffer" role="group" aria-label={t.saveNudge}>
          <span className="demeter__modeoffer-text">{t.saveNudge}</span>
          <span className="demeter__modeoffer-actions">
            <button
              type="button"
              className="demeter__modeoffer-no"
              onClick={() => setSaveNudgeDismissed(true)}
            >
              {t.saveNudgeNo}
            </button>
            <button
              type="button"
              className="demeter__modeoffer-yes"
              onClick={() => {
                setSaveNudgeDismissed(true);
                setSaveSignal((n) => n + 1);
              }}
            >
              {t.saveNudgeYes}
            </button>
          </span>
        </div>
      )}

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

      {/* THE QUESTION YOU ARE ANSWERING, kept visible while you answer it.
          It was already the composer's placeholder — which disappears the
          instant you start typing, i.e. exactly when you need it. Someone
          halfway through a long reply had nothing on screen telling them what
          was asked. Shown only while there is something in the box, so an empty
          composer is not carrying a second copy of its own placeholder. */}
      {input.trim().length > 0 && composerPrompt !== standingPrompt && (
        <p className="demeter__answering">{composerPrompt}</p>
      )}

      <form
        id="demeter-composer"
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
            aria-label={t.stop}
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
            {/* CENTRED. The old path ran y=1 to y=15 in an 18-high box — one
                pixel of air above, three below — so the hexagon sat visibly
                high in a round button, which is where it shows most. Its
                centre was (9, 8) against a viewBox centre of (9, 9). Same
                shape, moved down one. */}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="currentColor">
              <path d="M6.2 2h5.6L16 6.2v5.6L11.8 16H6.2L2 11.8V6.2z" />
            </svg>
          </button>
        ) : (
          // A compact arrow, Pi's own control — the accessible name stays
          // "Send" (tests and screen readers agree), the visual is the icon.
          <button
            type="submit"
            className="demeter__send"
            disabled={!input.trim()}
            aria-label={t.send}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 15V3M4 8l5-5 5 5" />
            </svg>
          </button>
        )}
      </form>
      {/* Under the composer, where the decision to type is made. It used to be
          in the estimate rail only, which is the wrong place and — at narrow
          widths where the rail stacks below the conversation — no place at all.
          redactPii strips structured identifiers but deliberately NOT names, so
          this asks rather than promises. */}
      {/* COMPRESSED (owner, 2026-08-22): this used to be the first of three
          stacked lines under the composer. It now shows only before the first
          message — the moment someone is most likely to paste an SSN or a case
          number — and lives permanently in the gear menu after that, so the
          resting state of an ongoing conversation is a single line. */}

      {/* "Demeter is AI" leads, because someone who knows that reads
          everything above it differently. And the agency is a real link:
          telling somebody to check with an office without saying which office
          is the same as not telling them. It points at their own state's
          agency once one is set, and at the directory otherwise. */}
      {/* ONE line, not two. The AI disclaimer and THE ASSENT NOTICE now share a
          paragraph — but the assent is still HERE, adjacent to the composer and
          visible at the moment someone decides to type, because sending the
          first message is the act that manifests agreement for a user who never
          signs in. It is not in the gear menu and must not be moved there:
          terms reachable only from a menu is browsewrap, which courts routinely
          refuse to enforce, and an unenforceable agreement takes the
          arbitration clause and every disclaimer in it down together. Merging
          the two lines costs nothing legally — both remain conspicuous, and
          neither is smaller than the other. Burying one would. */}
      <p className="demeter__disclaimer">
        {/* ONE PARAGRAPH, not two (owner, 2026-08-26). The safety hint had its
            own line above this one; both are the same register and the same
            size, so the break bought nothing but height under the composer.
            Still first-message-only: it is advice for the moment someone is
            about to type, and it lives permanently in the gear menu. */}
        {!hasChat && <span className="demeter__piihint">{t.piiHint} </span>}
        {t.disclaimer}{" "}
        <a
          className="demeter__link"
          href={agencyHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.disclaimerAgency}
        </a>
        .{" "}
        <span className="demeter__assent">
          {t.termsNotice.before}
          <a className="demeter__link" href="/terms">
            {t.termsNotice.terms}
          </a>
          {t.termsNotice.between}
          <a className="demeter__link" href="/privacy">
            {t.termsNotice.privacy}
          </a>
          {t.termsNotice.after}
        </span>
      </p>
        </div>
        {/* THE SIDEBAR IS THE TRACKING PANEL (owner refinement, 2026-08-21):
            which state this is scoped to, the outlined application, and the
            keep/verify tools — everything the product is holding for the
            reader — branded, toggleable, and OPEN by default on desktop
            (someone arriving should see what is being kept for them, not
            discover it behind an icon). A layout column when there is room;
            an off-canvas overlay on narrow screens, starting closed there,
            inert while closed so it holds no tab stops. The standing-context
            rationale survives from the old right rail: the state is the fact
            every figure depends on, and it stays in view while you scroll. */}
        <aside
          id="demeter-sidebar"
          className={`demeter__sidebar${sidebarOpen ? " demeter__sidebar--open" : ""}`}
          aria-hidden={!sidebarOpen}
          aria-label={t.sidebarLabel}
          {...(!sidebarOpen ? { inert: true } : {})}
        >
          <div className="demeter__sbhead">
            {/* Brand flush left, toggle at the rail's top right — Pi's own
                head order. The brand is the way home: tapping the mark or
                the name leaves the tool for the main page, same as the nav
                brand above — two doors, one destination. */}
            {/* Brand and its line stack together (owner, 2026-08-22). The
                tagline was defined in all four languages and rendered nowhere
                — it used to sit under the wordmark in the site nav, which
                /chat no longer has, so removing the nav orphaned the string
                and left the rail's head reading as a bare label. */}
            <div className="demeter__sbident">
              <a
                className="demeter__sbbrand"
                href={lang === "en" ? "/screen/ask" : `/${lang}/screen/ask`}
              >
                <DemeterMark size={34} />
                <span className="demeter__sbword" translate="no">
                  Demeter
                </span>
              </a>
              {/* BACK INSIDE THE IDENT COLUMN, which was built for it — a flex
                  column with a 0.1rem gap, sitting empty while the tagline was
                  rendered as a sibling of the whole head row and dragged back
                  up by a negative margin. Six of them accumulated, each a
                  later session tightening the gap the previous one had left.
                  It was moved out when the label read "SNAP ENROLLMENT AND
                  ELIGIBILITY ASSISTANCE" and wrapped beside the toggle; at
                  ~195px the shorter label clears the ~289px the column has,
                  so the reason is gone and the layout can do the spacing. */}
              <p className="demeter__sbtag">{t.tagline}</p>
            </div>
            <button
              type="button"
              className="demeter__sidebartoggle"
              aria-expanded={sidebarOpen}
              aria-controls="demeter-sidebar"
              aria-label={t.sidebarLabel}
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
                <line x1="7.5" y1="3.5" x2="7.5" y2="16.5" />
              </svg>
            </button>
          </div>
          <div className="demeter__side">
          {/* Yields to the in-column instance on narrow viewports — exactly
              one picker in the DOM at any width (see narrowViewport). */}
          {!narrowViewport && (
            <DemeterStatePicker
              states={states}
              value={state}
              onChange={changeState}
              copy={t.picker}
              hint={geoHint}
              openSignal={openPicker}
            />
          )}
        <DemeterWorksheet
          classification={classification}
          stateSelected={state !== null}
          saved={conversationSaved}
          copy={t.worksheet}
          footLinks={
            <>
              {selectedPack?.portal && (
                <a
                  className="demeter__how"
                  href={selectedPack.portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.picker.scopeApply} {selectedPack.portal.name} ↗
                </a>
              )}
            </>
          }
          onPickState={() => setOpenPicker((n) => n + 1)}
          facts={factsView}
          onAskFor={(prompt) => {
            // Into the composer, focused, NOT sent. The person stays the
            // author of every message in their own conversation.
            setInput(prompt);
            requestAnimationFrame(() => {
              const el = inputRef.current;
              if (!el) return;
              el.focus();
              el.setSelectionRange(prompt.length, prompt.length);
            });
          }}
          mode={worksheetMode}
          onModeChange={(m) => {
            setWorksheetMode(m);
            // TURNING IT ON READS THE CONVERSATION YOU ALREADY HAD.
            // Extraction used to run only inside send(), so switching to
            // "Build my estimate" after a full conversation changed the
            // heading and nothing else — the outline sat on its empty
            // template until you happened to send another message, which
            // reads as broken at the exact moment you asked for the feature.
            // The facts were already there: state, household size and income
            // are usually settled long before anyone thinks to switch.
            //
            // Consistent with the privacy line, not a hole in it: ask mode
            // still extracts NOTHING and makes no paid call. Switching is the
            // consent, and this acts on it immediately instead of waiting for
            // an unrelated keystroke. Same tail-window and user-first repair
            // as send() — the server rejects a history that opens on the
            // assistant (#833).
            if (m === "estimate" && state) {
              const turns = messages.filter(
                (x): x is { role: "user" | "assistant"; content: string } =>
                  x.role !== "divider" && Boolean(x.content),
              );
              let window = turns.slice(-20);
              if (window[0]?.role !== "user") window = window.slice(1);
              if (window.length) void refreshWorksheet(window, window.length === turns.length);
            }
            // Turning it OFF throws away what was gathered. Leaving the last
            // estimate on screen under "Just asking" would contradict the
            // sentence right beneath it, and keeping the facts in memory
            // against a later switch-back would make "nothing is gathered"
            // mean "nothing is gathered from now on", which is not what it
            // says.
            if (m === "ask") {
              rememberFacts({});
              setClassification(null);
              setAnnouncement(t.worksheet.switchedToAsk);
            }
          }}
        />
        {/* WHAT YOU DO WITH THE CONVERSATION, under what it knows about it.
            These used to sit above the transcript with the scope controls. A
            reader lost an entire conversation by navigating away, having never
            passed anything that offered to keep it — the offer was up at the
            top, before there was anything to save, and scrolled off before
            there was. Down here it stays beside the thing it acts on. */}
        <div className="demeter__sidetools">
          {/* Two small buttons on one line: keeping this, and starting over.
              Both act on the WHOLE conversation, which is why they belong to
              the panel that tracks it rather than under the composer, which
              acts on the next thing typed. */}
          {/* The rail's Save and New-conversation buttons are retired (owner
              rec 2026-08-22) — the rail tracks, the bottom row acts. Save is
              still MOUNTED and still saves: the transcript's nudge fires it
              through triggerSave, and the pendingSave round trip after
              sign-in restores through it. Only its button is gone. */}
          <DemeterSave
            showButton={false}
            messages={messages}
            state={state}
            lang={lang}
            busy={busy}
            pendingSave={pendingSave}
            initialSavedId={savedConversationId}
            onRestore={restoreConversation}
            onSavedChange={setConversationSaved}
            triggerSave={saveSignal}
            worksheet={snapshotWorksheet}
            copy={t.save}
          />
          {/* TAKE IT WITH YOU. The outline existed only on the screen it was
              built on — close the tab and the one thing someone most wants to
              keep was the one thing they could not carry away. Shown only once
              there is something in it: mailing an empty template reads as the
              product failing rather than as there being nothing yet. */}
          {worksheetMode === "estimate" && (factsView.household?.length ?? 0) > 0 && (
            <div className="demeter__emailrow">
              <button
                type="button"
                className="demeter__emailbtn"
                onClick={() => void emailOutline()}
                disabled={emailState === "sending" || emailState === "sent"}
              >
                {emailState === "sending"
                  ? t.emailSending
                  : emailState === "sent"
                    ? t.emailSent
                    : t.emailOutline}
              </button>
              {/* next = the page we're on — '/chat' was a dead route from an
                  old layout, and (not being /screen-prefixed) it ALSO flipped
                  the sign-in page to the wrong product's branding (#898 P1-5). */}
              {emailState === "signin" && (
                <a
                  className="demeter__emailsignin"
                  href={`/sign-in?next=${encodeURIComponent(
                    typeof window !== "undefined" ? window.location.pathname : "/screen/ask",
                  )}&lang=${lang}`}
                >
                  {t.emailSignIn}
                </a>
              )}
              {emailState === "error" && (
                <span className="demeter__save-error" role="alert">
                  {t.emailError}
                  {emailDetail && <span className="demeter__save-code"> ({emailDetail})</span>}
                </span>
              )}
              {/* The copy that needs no account. Quieter than the emailed one
                  only because it is the second line, not because it matters
                  less — for someone who does not want to hand over an address,
                  this is the whole deliverable. */}
              <button
                type="button"
                className="demeter__pdfbtn"
                onClick={() => void downloadOutline()}
                disabled={pdfState === "working"}
              >
                {pdfState === "working" ? t.pdfWorking : t.pdfDownload}
              </button>
              {pdfState === "error" && (
                <span className="demeter__save-error" role="alert">
                  {t.pdfError}
                </span>
              )}
            </div>
          )}
          {/* Underneath both, quieter than either: these are standing facts
              about the current scope, not something you do right now. "Apply
              at {portal}" used to sit right under the state picker, stacked
              with the agency line — moved here (real feedback, 2026-08-15)
              since both this and "How we verify" are the same kind of thing:
              a fact about where this answer comes from / where to check it,
              not an action for the moment you pick a state. */}
        </div>
        </div>
          {/* THE MIDDLE ZONE — saved conversations, Pi's own geography (their
              rail's middle is the conversation list). The label is the link;
              the sign-in invitation rides under it while signed out. */}
          <div className="demeter__sbmid">
            <a
              className={`demeter__sblabel${authEmail === null ? " demeter__sblabel--signin" : ""}`}
              href={authEmail === null ? signInHref : "/screen/saved"}
              onClick={(e) => {
                if (authEmail !== null) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                setSignInOpen(true);
              }}
            >
              {authEmail === null ? t.sidebarSavedSignin : t.sidebarSaved} →
            </a>
          </div>
          {/* ONE BOTTOM LINE (owner rec 2026-08-22): new conversation,
              language, settings — everything you DO to the conversation, at
              a size that says so. The rail's body above it only tracks. */}
          {/* SAYS WHAT IT DOES, AND ONLY WHEN IT CAN (owner, 2026-08-26).
              This was a bare "+" in the foot's icon row, immediately left of
              "EN / ES / VI / 中文" — so the one unlabelled glyph on the rail
              sat inside the language picker and read as part of it. Worse, it
              was rendered DISABLED whenever there was no conversation yet,
              which is most first visits: a greyed, borderless plus next to
              four language codes is not a control, it is lint.

              Now it carries its own words and appears only once there is a
              conversation to end. The accessible name is unchanged, which is
              what the clear-behaviour tests key on. */}
          {hasChat && !confirmClear && (
            <button
              type="button"
              className="demeter__railnew"
              onClick={() => setConfirmClear(true)}
              aria-label={t.clear}
            >
              <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 4.5v11M4.5 10h11" />
              </svg>
              {t.clear}
            </button>
          )}
          <div className="demeter__railfoot">
            {confirmClear ? (
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
              <>
                {/* ALL FOUR, VISIBLE, NO DISCLOSURE (owner, 2026-08-26).
                    This was a globe and the current code behind a popover, and
                    before that a native <select>. Both hid three of the four
                    languages behind an interaction — on a product where the
                    person who most needs another language is the least likely
                    to go hunting for a control to find it. Four initials and
                    three slashes cost less width than the globe did, and the
                    terracotta fill on the current one does the job the tick
                    inside the old menu did: says which you are reading in,
                    without being opened.

                    The BUTTON shows the short code; the accessible name is the
                    language's own name, so a screen reader announces "Tiếng
                    Việt" rather than the letters "VI". */}
                <div className="demeter__langrow" role="group" aria-label={t.languageLabel}>
                  {ANSWER_LANGS.map((code, i) => (
                    <span key={code} className="demeter__langitem">
                      {i > 0 && (
                        <span className="demeter__langsep" aria-hidden>
                          /
                        </span>
                      )}
                      <button
                        type="button"
                        className="demeter__langpick"
                        aria-pressed={lang === code}
                        aria-label={LANG_NATIVE_NAME[code]}
                        title={LANG_NATIVE_NAME[code]}
                        onClick={() => setLang(code)}
                      >
                        {LANG_SHORT_CODE[code]}
                      </button>
                    </span>
                  ))}
                </div>
          {/* SETTINGS, on the same line as sign-in (owner rec): a gear that
              discloses the standing pages. <details> rather than custom
              popover state — Escape and outside-click come free, and it
              works with no JavaScript. */}
          <details className="demeter__gear">
            <summary className="demeter__gearbtn" aria-label={t.settingsLabel}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </summary>
            <div className="demeter__gearmenu">
              <a className="demeter__settingslink" href="/states">
                {t.statesLink}
              </a>
              <a className="demeter__settingslink" href="/terms">
                {t.termsLink}
              </a>
              <a className="demeter__settingslink" href="/privacy">
                {t.privacyLink}
              </a>
              <a
                className="demeter__settingslink"
                href={lang === "en" ? "/feedback" : `/${lang}/feedback`}
              >
                {t.feedbackLink}
              </a>
              {/* The safety hint lived here too. Removed (owner, 2026-08-26):
                  it already shows under the composer, where it is actionable,
                  and a settings menu is not where anyone looks before typing. */}
            </div>
          </details>
              </>
            )}
          </div>
          {/* Signed OUT this rendered an empty div that still carried a
              border-top and a flex gap — a stray hairline at the rail's floor,
              and a second margin-top:auto competing with the one on the row
              above (two auto margins SPLIT the free space, which is why the
              controls floated in the middle instead of sitting on the floor). */}
          {authEmail !== null && (
          <div
            className="demeter__sidebarauth"
            role="group"
            aria-label={`${t.sidebarSignedIn} ${authEmail}`}
          >
            {/* WHAT IS HAPPENING, then WHO IT IS HAPPENING TO with the way out
                beside them — two lines where there were four (owner,
                2026-08-26). "Signed in as" is gone from the visible row: an
                address with an exit next to it already says that, and the
                phrase was spending a line to repeat what the row beneath it
                meant. It stays as this group's accessible name. */}
            <p className="demeter__authnote">
              <span className="demeter__authtick" aria-hidden>
                ✓
              </span>
              {t.sidebarAutosaved}
            </p>
            <div className="demeter__authrow">
              <span className="demeter__authmail" translate="no" title={authEmail}>
                {authEmail}
              </span>
              {/* A WAY BACK OUT. Signing in had no matching exit anywhere in
                  the product: the route existed and only /status called it. On
                  a shared or borrowed device an account you cannot leave is
                  worse than no account. A full navigation follows, so no
                  signed-in state survives in memory. */}
              <button
                type="button"
                className="demeter__signout"
                onClick={async () => {
                  try {
                    await fetch("/api/auth/sign-out", { method: "POST" });
                  } catch {
                    /* Reloading re-probes the session either way; pretending
                       the cookie is gone when it is not would be worse. */
                  }
                  window.location.assign(lang === "en" ? "/chat" : `/${lang}/chat`);
                }}
              >
                {t.sidebarSignOut}
              </button>
            </div>
          </div>
          )}
        </aside>
      </div>
      {signInOpen && (
        <DemeterSignInModal
          next={lang === "en" ? "/chat" : `/${lang}/chat`}
          lang={lang}
          onClose={() => setSignInOpen(false)}
        />
      )}
    </div>
  );
}
