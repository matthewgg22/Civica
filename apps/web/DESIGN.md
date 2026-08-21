---
version: alpha
name: Demeter-design-system
description: The design language of Demeter AI, a public SNAP benefits assistant. A printed-paper editorial system — warm off-white ground, near-shadowless bordered surfaces, a variable serif (Newsreader) for everything that speaks and a workhorse sans (Be Vietnam Pro) for everything that labels, with terracotta as the single action color and a wheat gold reserved for the brand mark and clarifying callouts. Built for trust under stress; every visual choice defers to legibility, citation integrity, and four-language parity (en/es/vi/zh).
---

<!--
  MACHINE-READABLE COMPANION, not the source of truth. The governing design
  document for this surface is DEMETER-DESIGN.md in this directory — it
  carries the reasoning; this file carries the measured tokens and rules in
  the DESIGN.md format (per Google Stitch / awesome-design-md) so AI agents
  can generate UI consistent with the live product. When the two disagree,
  DEMETER-DESIGN.md wins and this file is stale — regenerate it from the
  live stylesheet (app/globals.css --demeter-* tokens), never from memory.
-->

colors:
  paper: "#F7F6F4"
  card: "#FFFFFF"
  ink: "#241E1A"
  body: "#55504C"
  muted: "#6E655E"
  rule: "#E3E0DB"
  rule-strong: "#C9C4BD"
  terracotta: "#C0553B"
  terracotta-deep: "#8E3A26"
  wheat: "#E8C547"
  on-terracotta: "#FFFFFF"

typography:
  display-h1:
    fontFamily: "Newsreader, 'Noto Serif SC', Georgia, serif"
    fontSize: "clamp(1.9rem, 4.2vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  section-h2:
    fontFamily: "Newsreader, 'Noto Serif SC', Georgia, serif"
    fontWeight: 600
    fontSize: "clamp(1.4rem, 2.6vw, 1.9rem)"
    letterSpacing: "-0.015em"
  lede:
    fontFamily: "Newsreader, 'Noto Serif SC', Georgia, serif"
    fontSize: "clamp(1.05rem, 1.6vw, 1.2rem)"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Newsreader, 'Noto Serif SC', Georgia, serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.6
  answer:
    fontFamily: "Newsreader, 'Noto Serif SC', Georgia, serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.62
  eyebrow:
    fontFamily: "'Be Vietnam Pro', 'Noto Sans SC', system-ui, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 400
    letterSpacing: "0.1em"
    textTransform: uppercase
  label:
    fontFamily: "'Be Vietnam Pro', 'Noto Sans SC', system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.1em"
    textTransform: uppercase
  ui:
    fontFamily: "'Be Vietnam Pro', 'Noto Sans SC', system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.5
  micro:
    fontFamily: "'Be Vietnam Pro', 'Noto Sans SC', system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.5

rounded:
  pill: 999px
  card: 12px
  card-large: 14px
  inner: 10px
  input: 8px

spacing:
  measure-body: "46ch"
  measure-lede: "52ch"
  measure-heading: "20–22ch"
  card-padding: "1.1rem 1.25rem"
  section-gap: "clamp(2.5rem, 6vw, 4rem)"
  touch-target: "44px"

components:
  cta-card: "Full-width wheat-gold card, serif title + sans body, 16px radius, links to the chat"
  answer-card: "White card, 1px rule border, 14px radius; sans question bubble on paper, serif answer, terracotta-deep citation links, sans micro footer"
  trust-list: "Definition rows — uppercase sans label left (terracotta-deep), serif body right"
  callout: "White card with a 3px wheat left rule for clarification; brick-red left rule only for urgent-need asides"
  chat-bubble: "User: sans on paper, 10px radius. Demeter: serif ink on transparent, no bubble"
  worksheet-rail: "White card rail; uppercase sans section labels, serif verdict line, tonal result band"
  footnote: "Native <details>; sans summary with rotating ▸ marker, citation lines inside"

## Overview

Demeter answers SNAP (food assistance) questions with the governing regulation attached. The design job is **trust under stress**: readers are often anxious, on phones, and deciding whether to hand a government-adjacent tool their details. The system therefore reads as a *printed explainer, not an app* — warm paper ground, bordered (almost never shadowed) white surfaces, generous measure caps, and a strict two-voice type system. Nothing pulses, floats, or auto-animates. One accent acts (terracotta); one accent clarifies (wheat); everything else is ink on paper.

Four languages are first-class (English, Spanish, Vietnamese, Chinese): every string ships in all four, CJK serif/sans stacks pair with the Latin faces, and citation tokens are shielded from machine translation with `translate="no"`.

## Colors

- `{colors.paper}` **#F7F6F4** — the page. A quarter-strength warm tint; never pure white.
- `{colors.card}` **#FFFFFF** — every raised surface. Elevation is a border, not a shadow.
- `{colors.ink}` **#241E1A** — headings and Demeter's own answers. Never pure black.
- `{colors.body}` **#55504C** / `{colors.muted}` **#6E655E** — running text / labels & placeholders.
- `{colors.rule}` **#E3E0DB** / `{colors.rule-strong}` **#C9C4BD** — card borders & dividers / inputs and emphasized edges.
- `{colors.terracotta}` **#C0553B** — the single action color: CTAs, active states, marks. **Fill and border only — never running text** (4.22:1 on paper; a stylesheet test enforces this).
- `{colors.terracotta-deep}` **#8E3A26** — the readable terracotta: links, hover, small text, the wordmark's "AI".
- `{colors.wheat}` **#E8C547** — the brand's gold. The logo mark, the hand-off CTA card, and the 3px left rule on clarifying callouts. A clarification, never an alarm; **never a text color**.

**Semantics:** warnings and cautions are wheat (clarify) or brick-red left-rules (urgency) — the system has no green/amber/red status triad. Verdicts are carried by words and tone bands, never by color alone.

## Typography

**The one rule that generates every other: serif speaks, sans labels.** Anything with a voice — headlines, ledes, body, Demeter's answers, verdict sentences — is Newsreader (variable weight 100–900, used at 400/500/600). Anything functional — eyebrows, labels, buttons, form UI, captions, legal lines — is Be Vietnam Pro. CJK pages substitute Noto Serif SC / Noto Sans SC in the same roles.

- Display: `{typography.display-h1}` — one `<h1>` per page, in the orientation bar, `text-wrap: balance`, 20–22ch measure.
- Ledes cap at 52ch, body at 46ch, `text-wrap: pretty`.
- Uppercase micro-labels (`{typography.eyebrow}`, `{typography.label}`) carry 0.1em tracking and weight 600 when they must outrank adjacent serif body — an uppercase label lighter than its own definition reads inverted.
- Numbers in comparative positions use `font-variant-numeric: tabular-nums`.
- Copy discipline is part of the type system: typographic quotes, the real `…` character, and an **em-dash budget** (≤4 on the landing page, test-enforced) — dashes are kept only where they carry a genuine beat.

## Layout

- Single-column editorial flow with a hard measure cap; the hero runs two columns at ≥980px (orientation left, one real product exchange right).
- Section rhythm by whitespace and 1px top rules — not background stripes. The page never changes theme mid-scroll.
- `44px` minimum touch targets everywhere, including invisibly (inline links expand via `padding-block`; visually quiet controls keep full hit areas via negative block margins).
- Safe-area insets respected on the chat shell; `overflow-x` contained per widget; the page body never scrolls sideways.

## Elevation & Depth

Demeter is **nearly shadowless by conviction** (19 `box-shadow` uses in the whole stylesheet, mostly focus rings and the map). Depth is expressed by:
1. Border color: `{colors.rule}` for resting cards, `{colors.rule-strong}` for inputs and engaged edges.
2. Ground shift: white card on warm paper.
3. The wheat left-rule for callouts.

Do not add drop shadows to cards; a shadowed card reads as a different, glossier product.

## Shapes

- `{rounded.pill}` for chips and pill controls; `{rounded.card}`/`{rounded.card-large}` for cards; `{rounded.inner}` for nested surfaces (child radius always ≤ parent); `{rounded.input}` for fields.
- The brand mark is a wheat circle bearing a grain glyph; it appears at 28–52px and is the only circular brand element.

## Components

- **Hand-off CTA** `{components.cta-card}`: the page's one loud moment. Serif title with a long arrow (→), sans supporting line. Repeats at page bottom with the *identical label* — one label per intent, everywhere.
- **Example answer card** `{components.answer-card}`: a real, pipeline-generated exchange with its citation and — only when the pipeline graded it CERTAIN — the verdict line. Never fabricate its content; regenerate it.
- **Trust list** `{components.trust-list}`: label-left / body-right rows, a deliberately different family from the stacked label-over-body definition grids.
- **Chat**: user turns are sans in paper-colored bubbles; Demeter's turns are serif ink directly on the ground — the product speaks in the page's own voice, not from a bubble.
- **Certainty & citations**: answers end with a ✓/◑/⚠ verdict line and a native-`<details>` citation footnote. Citation tokens always render inside `translate="no"`.
- **Worksheet rail**: the estimate builder; uppercase sans labels, serif verdict, "an estimate, not a decision" persistent disclaimer.

## Do's and Don'ts

**Do**
- Keep the two-voice type rule absolute; when in doubt, ask "does this text speak or label?"
- Route every dollar figure through the verified corpus with a citation. **Never hardcode benefit or limit figures in UI copy** — they rotate every October and vary by state.
- State retention honestly everywhere data is kept; the privacy line changes when storage changes.
- Ship all four languages together; parity is test-enforced.
- Let whitespace and rules structure the page; sections earn eyebrows rarely (≤1 per 3 sections).

**Don't**
- No shadows on cards, no gradients, no glassmorphism, no decorative motion, no autoplaying anything.
- Never terracotta or wheat as running-text colors.
- Never a second `<h1>`, a centered wall of feature cards, or a theme flip mid-page.
- Never fake a screenshot, a testimonial, a metric, or a verdict badge the pipeline didn't issue.
- Never let machine translation touch citations, program names, or the brand (shield with `translate="no"`).

## Responsive Behavior

- Hero collapses to single column below 980px; the example card stacks between lede and CTA.
- All multi-column grids collapse to one column ≤640–860px (per-section breakpoints; nothing relies on JS measurement).
- Composer font stays ≥16px on mobile (no iOS zoom); nothing sticks on phones — pinned panels surrender the viewport.
- Light-only by commitment: `color-scheme: light` is declared, `theme-color` matches the paper, and dark-mode devices get a light page with matching chrome rather than an unconsidered inversion.

## Iteration Guide

To extend this system: start from the copy (four languages, honest about retention and uncertainty), set it in the two voices, place it on paper or on one bordered card, and reach for terracotta only when something must be pressed. If a new element wants a shadow, a gradient, a third typeface, or an unearned badge, the answer is no. When the live stylesheet and this file disagree, re-measure from `app/globals.css` — this file is an extraction, not an aspiration.
