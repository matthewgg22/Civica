# Demeter AI — Design System

**Surface:** the public web product (`apps/web`) — `/screen/ask`, `/questions`, `/guides/[state]`, `/verify`, `/sign-in`, `/screen/saved`, in EN/ES/VI/ZH.
**Written:** 2026-08-11, by `/design-consultation`.

This documents the system that **already exists** in `app/globals.css` rather than
proposing a new one. The visual language came out of a deliberate four-stage rebuild;
the gap was that none of it was written down, so every new surface re-derived it and
drifted.

## Not this document

| File | Governs |
|---|---|
| `DESIGN.md` (repo root) | the **iOS** app (SwiftUI, Civica target), audited 2026-05-20 |
| `apps/dashboard/DESIGN.md` | the navigator/CBO dashboard — **PARKED**, do not edit |
| **this file** | the Demeter public web product |

The three are allowed to differ. iOS carries the Civica brand and its "government-grade
trust" principles; Demeter is a consumer product with its own name and palette.

---

## 1. What this product is

A free, anonymous, public chatbot that answers SNAP questions and **shows the rule
behind every answer**. Federal regulation always; the state's own manual where a pack
has been adversarially verified. Answers are marked certain or uncertain mechanically,
from the citation verifier, never from model self-report.

**Who reads it:** people deciding whether to apply for food assistance, often under
stress, often on a phone, frequently not in English. Also caseworkers and CBO staff
checking a rule.

**The memorable thing:** *it showed me the actual rule.* Every other tool in this
category returns an estimate or a screening result. Demeter hands you the regulation
you can take to a caseworker who disagrees. **Every design decision serves that.**

---

## 2. Principles

Applied in order when two choices conflict.

### 2.1 The citation is the product, not a footnote
A claim without its rule is the thing we exist to replace. Citations render verbatim
and never translate. They are visible in the answer, in the FAQ cards, in the JSON-LD.
Never collapse them behind a disclosure.

### 2.2 Honesty about uncertainty, structurally
The certainty banner is derived, not decorative. When the sources retrieved do not
cover a question, the page says so instead of guessing. Never style uncertainty as
failure, and never hide it to look more confident.

### 2.3 Say what is stored, accurately
Retention copy is load-bearing on a benefits service. `redactPii` strips structured
identifiers but deliberately **not names**, so no surface may claim personal details
are removed. Understating retention is the harmful direction. (See #703 — a privacy
line was true when written and quietly became false.)

### 2.4 Nobody is blocked from asking
The chat is free and anonymous and stays that way. An account buys exactly one thing:
coming back later. A signed-out visitor who presses Save gets an invitation and a "not
now", never a wall.

### 2.5 The product before the category
The page introduces Demeter, then SNAP. Not the reverse. See §6.

---

## 3. Color

Ten tokens. Pruned from sixteen; the removed ones were unused or near-duplicates. Do
not add an eleventh without deleting one.

| Token | Hex | Use |
|---|---|---|
| `--demeter-terracotta` | `#C0553B` | CTAs, links, marks |
| `--demeter-terracotta-deep` | `#8E3A26` | wordmark "AI", hover, error, small text |
| `--demeter-wheat` | `#EFB544` | **logo mark + a 2px rule under a source link. Nothing else. Never a fill, never text.** |
| `--demeter-ink` | `#241E1A` | headings, answers |
| `--demeter-body` | `#55504C` | running text |
| `--demeter-muted` | `#6E655E` | labels, placeholder text |
| `--demeter-paper` | `#F7F6F4` | page background |
| `--demeter-card` | `#FFFFFF` | cards |
| `--demeter-rule` | `#E3E0DB` | cards, dividers |
| `--demeter-rule-strong` | `#C9C4BD` | inputs, table heads |

**Approach: restrained.** One accent (terracotta) plus warm neutrals. Wheat is a
signature, not a palette member — the moment it becomes a background fill the mark
stops meaning anything.

**Semantic tints** are literal hexes at their use sites, not tokens, because there are
only four: `#F3F8F1`/`#C9DCC4` (certain), `#FBF6EA`/`#E6D3A9` (warning),
`#FBEAE5`/`#E9C2B4` (deny, error). Promote to tokens only when a fifth appears.

**No link token.** Links are terracotta with an underline. The retired `link` color sat
5 points away and read as indistinguishable.

**Dark mode: not implemented.** The public surface is light-only today. Do not add a
partial dark mode — a half-themed benefits page is worse than a light one.

---

## 4. Typography

Two faces, loaded via **`next/font/local`** in `layout.tsx` from woff2 committed under
`app/fonts/`, exposed as `.variable` classes on `<html>`. Never redeclared in CSS.

**Self-hosted, and it must stay that way (#697).** `next/font/google` downloads the
files *during the build*, so an unreachable `fonts.gstatic.com` did not degrade
typography — it failed the deploy. Do not reintroduce a `next/font/google` import;
`app/__tests__/fonts.test.ts` guards it.

The two CJK faces are the deliberate exception: they come from `@fontsource/noto-*-sc`
on npm, because `localFont` cannot express `unicode-range`. Their ~165 pre-subsetted
files mean a browser fetches only the glyph ranges a page uses; a single CJK file would
be ~5MB for every `/zh` visitor, and 10MB of binary does not belong in git.

| Variable | Face | Role |
|---|---|---|
| `--demeter-font-display` | **Newsreader** (serif) | anything that **speaks** |
| `--demeter-font-sans` | **Be Vietnam Pro** | anything that **labels or operates** |

### The rule: serif speaks, sans labels

Answers, headings, page titles, body copy, FAQ answers, the PDF → Newsreader.
Buttons, inputs, eyebrows, table heads, toolbars, badges, disclaimers → Be Vietnam Pro.

**There is no mono face.** The two former `--demeter-font-mono` sites were both labels
and moved to sans. Do not reintroduce one for "technical" feel — citations are speech,
not code, and they set in the serif.

Every use site appends its own CJK fallback after the var:
`var(--demeter-font-display), var(--demeter-font-serif-cjk), Georgia, serif`.
Omitting it silently drops Chinese to a system default mid-paragraph.

### Scale

| Class | Size | Family |
|---|---|---|
| `.dmo__h1` | `clamp(1.9rem, 4.2vw, 3rem)` / 1.08 / `-0.025em` / 600 | display |
| `.dmx__h2` | `clamp(1.6rem, 3.4vw, 2.35rem)` / 1.12 / `-0.02em` / 600 | display |
| `.dmx__h3` | `1.15rem` / 1.25 / `-0.01em` / 600 | display |
| `.dmo__lede`, `.dmx__lede` | `clamp(1.05rem, 1.6vw, 1.2rem)` / 1.6 | display |
| `.dmx__body` | `1rem` / 1.65 | display |
| `.dmo__snap` | `0.98rem` / 1.6, muted | display |
| `.dmx__note` | `0.85rem` / 1.6, muted | sans |
| eyebrows | `0.7rem`, `0.1em` tracking, uppercase, muted | sans |

**Measure is capped everywhere.** `max-width: 46ch` on body, `52ch` on ledes,
`20–22ch` on headings. `text-wrap: pretty` on body, `balance` on the h1. A full-width
line of Newsreader at 1180px is unreadable and the caps are why it never happens.

---

## 5. Spacing, layout, motion

- **Container:** `max-width: 1180px`, padding `clamp(1rem, 4vw, 3.5rem)`.
- **Section rhythm:** `.dmx` = `clamp(2.5rem, 6vw, 4.5rem)` vertical, separated by a
  1px `--demeter-rule` top border. `.dmo` (orientation) carries no rule and tighter
  padding — it is the frame, not depth.
- **Radius:** 20px cards and panels, 16px inputs, 999px pills/CTAs, 12px result blocks.
- **Grids:** `repeat(auto-fit, minmax(15–21rem, 1fr))`. Never a fixed 3-column grid.
- **Touch targets:** 44px minimum, enforced on every control.
- **Shadow:** exactly one, on the chat card:
  `0 30px 60px -34px rgba(72, 32, 18, 0.4)`. Elevation marks the product, and only the
  product.
- **Motion: minimal-functional.** Transitions that aid comprehension only. No entrance
  animations, no scroll choreography. People read this page while deciding whether they
  can afford groceries.

---

## 6. Page structure

### The order is a decision, not a layout

```
orientation (h1, ~45 words)  →  chat  →  depth  →  JSON-LD
```

**The orientation bar states the product first, then SNAP.** Two statements, ~45 words,
carrying the page's only `<h1>`.

This inverts what the page did before 2026-08-11, when it opened with an `<h2>` about
SNAP and named the product only inside the chat card's own `<h1>` at ~15% page depth —
an `<h2>` before the `<h1>` in document order, which misleads heading navigation and
told search engines the page was a SNAP explainer containing a chatbot.

Category research settled the order. GetCalFresh leads with comprehension
("Understand CalFresh before you apply", "You can't apply on this website") **because
it gave its application away to BenefitsCal and comprehension is all it still owns.**
mRelief puts a single zip-code field above the fold. Consensus opens with the input and
one credentialed trust line. Demeter owns the answering, so it belongs with the second
group.

### Rules

1. **One `<h1>` per page, in the orientation bar.** Components mounted inside a page
   never emit `<h1>`.
2. **Everything except the chat is server-rendered.** Content that exists only after
   hydration is content a generative engine never sees, and being quotable is an
   explicit acquisition goal.
3. **Depth goes below the tool, never above it.**
4. **Move content, do not delete it.** When a section leaves a page it gets its own
   route, a sitemap entry, its own hreflang set, and an inbound link from the page it
   left. A moved section with no link is a deleted section.
5. **Structured data describes the page it is on.** JSON-LD claiming content the page
   does not render is cloaking and is worth less than none.
6. **One page per topic, not one page per card.** 17 cards at ~40 words each is one
   good page, not 17 thin ones.

### Localization

English is un-prefixed (`/screen/ask`, `/questions`); others are `/es|/vi|/zh/…`.
Every page family carries its **own** reciprocal hreflang set — pass the right URL
builder to `alternateLanguages()`. Annotating `/es/questions` as a translation of
`/screen/ask` tells a search engine two different pages are the same page.

Quoted **form phrases stay English** inside localized headings: that is the literal
text printed on the form the reader is holding.

---

## 7. Voice

- **Second person.** "Your income", not "gross monthly income for the household".
- **Plain words over legal ones**, with the legal phrase quoted when that is the thing
  the person is looking at.
- **No dollar figures in static copy, ever.** They move every October and vary by
  state. Figures come from `snap-rules` at runtime or they do not appear.
- **Name the limit.** "Federal rules still answer. Figures that vary by state are
  deferred to your agency rather than guessed."
- **No marketing metaphors**, no urgency, no testimonials-as-proof.
- **Never promise what the code does not do.** See §2.3.

---

## 8. Anti-patterns

Do not ship:

- A second `<h1>`, or a component that emits one.
- Wheat as a fill or as text.
- A mono face.
- A dollar figure in static copy.
- Full-width running text (missing `max-width`).
- A CJK-fallback-less `font-family`.
- Shadow on anything but the chat card.
- A fixed 3-column icon grid.
- A privacy or retention claim that has not been checked against what is actually
  stored.
- Structured data richer than the page.
- A partial dark mode.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-11 | Fonts self-hosted; `next/font/google` banned | The build downloaded them, so a Google outage failed the deploy (#697). CJK stays on `@fontsource` for `unicode-range`. |
| 2026-08-11 | This file created | Three surfaces had drifted with no written system; `/design-consultation` |
| 2026-08-11 | Orientation bar carries the h1; product stated before SNAP | Fixed an inverted heading hierarchy; category research (GetCalFresh vs mRelief/Consensus) |
| 2026-08-11 | Form-question cards + "why this is hard" moved to `/questions` | ~1,300 → ~600 words on the entry page; moved, not cut; better GEO on a focused URL |
| 2026-08-11 | One `/questions` page, not 17 per-card pages | ~40 words each would be thin content |
| 2026-08-11 | FAQPage JSON-LD moved with the cards | Structured data must describe the page it is on |
| 2026-08-10 | Public model pinned to `claude-sonnet-5` | Measured: beat Opus 4.8 on pass rate and uncertain share at 60% of the cost |
| 2026-08-09 | Type rule "serif speaks, sans labels"; mono retired | Four-stage page rebuild |
| 2026-08-09 | Palette pruned 16 → 10 tokens | Near-duplicates and unused values |
