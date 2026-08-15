# Demeter — work tranches, from the 2026-08-12 review

Source: a 42-item review from Matthew after live testing, plus three items
carried over from the previous round. This file is INTENT (see CLAUDE.md);
evidence lives in `docs/findings/`, open work in GitHub issues.

**The organizing goal is item 42**, which is not an item:

> Someone who has never heard of SNAP should be able to reach a full outlined
> draft they feel confident about, in one conversation, without it breaking.

Everything in T0 and T1 is in service of that. T2–T4 are surfaces around it.

---

## Status of the previous round

Landed on `claude/demeter-answer-shape` (PR #778), all green:

- numeric gate: user-supplied figures, cadence conversions, and pairwise
  arithmetic on their own numbers (two separate deadlocks, both from real
  transcripts)
- "Washington DC" no longer answered as Washington State; "VA benefits" no
  longer offers Virginia
- conversation survives a header-link navigation (sessionStorage)
- citation renders as a real hyperlink (emphasis now recurses); duplicate
  certainty banners and "Check it yourself" lines de-duplicated
- household composition, ineligible-student, gross-vs-net and implausible-value
  rules in the system prompt
- Zod paths no longer printed to readers as "Missing: household.0.age"
- context column, nav callout, footnote treatment, mode callout, button design

### Carried over, NOT done

1. **Tone / abandonment set** — see T0.
2. **Streaming fade** — half done. The caret is soft now; the text still types
   character-by-character at `STREAM_TICK_MS = 25`, unchanged. What was asked
   for is text arriving *faded*, and slower.
3. **CA→FL "discarding facts"** — investigated, and it was NOT a state-switch
   bug. `changeState` clears only the computed verdict (deliberately — it was
   computed against the old state's parameters). Facts survive. The real cause
   is that facts were never gathered: extraction is gated on
   `worksheetMode === "estimate"` (DemeterChat.tsx ~line 842) and that
   conversation was in "just asking" throughout. The mode callout may already
   have closed this. **Re-test rather than fix.**

---

## T0 — the product is not doing its job

| # | Item | Notes |
|---|---|---|
| 42 | The through-line: never-heard-of-it → confident draft | The goal, not a ticket |
| 1 | Tone: abandonment, blame-shifting, jargon, the degrade copy | See below |
| 12 | Save still broken | **Blocked on a reason code — see below** |
| 4 | Sign in → email the draft, AND resume the session | |
| 38 | Download the outline as a PDF | Pairs with the rename in #36 |
| 8 | Cost | **Measure first — see below** |
| 9 | "Something went wrong. Please try again." | Say which side the fault is on |

### 1 — the tone set, in detail

All prompt and copy, no new mechanism:

- **Abandonment.** Asked to draft an application, it stopped drafting the
  moment the arithmetic failed and posted links instead. The drafting task has
  to survive a failure in one part of it.
- **Blame-shifting.** "Ask me something narrower." "That is a gap on my side,
  go ask your state agency." Both hand the work back to the person who came for
  help. The pivot should be to what it CAN do — e.g. how to prepare Uber
  earnings statements so a caseworker can compute quickly.
- **The degrade copy is the worst offender.** `DEGRADE_AGAIN` in
  `packages/demeter-engine/src/lang.ts` says "I do not want to keep saying that
  in the same words" while being itself a generic block. Matthew called this
  gaslighting and he is right.
- **No empathy under stress.** An undocumented mother asking about food for her
  citizen children received clinical legal breakdowns.
- **Jargon instead of a mental model.** "A formula that excludes a share for
  your own needs" → "they will not count all your earnings against your kids,
  because they know you need money to live too."
- **Metadata on every turn.** A citation trailer appended to an error message
  cites nothing. This one is partly code: suppress the trailer on a degraded
  answer.

### 12 — what is known about the save failure

Ruled out by inspection on 2026-08-12:

- `snap_enrollment.demeter_conversations` exists, RLS on, 4 policies
- every CHECK constraint is satisfiable by what the client sends

The client now appends the server's reason in parentheses — `save_failed`,
`http_502`, `network`, or a 400 body message. **Matthew reported no code
appeared.** Three explanations, in order of likelihood:

1. They were on a deploy predating that commit (`d7f8d7a1`). Confirm the
   preview is current before concluding anything.
2. It returned 401, which shows the sign-in PANEL rather than the error — a
   different path with no code by design.
3. It hit the `limit` path (409), which shows the limit copy, also no code.

**Next step: reproduce on a current preview and read the reason.** Do not
start rewriting the save path before that.

### 8 — cost, and why it cannot be cut yet

Reported: fewer than 30 short prompts cost about a dollar.

`snap_enrollment.mae_query_log` has 20 columns and **none of them are token
counts**. The orchestrator computes usage and fires `events.onUsage`, but
nothing persists it. So spend cannot currently be attributed to a turn, a
state, the retry path, or the facts-extraction call.

Order of work:

1. Persist input/output tokens (and the model) per query.
2. Then measure, and look first at: the size of the system block (persona
   prompt + state pack + retrieved chunks), the citation-failure retry (a
   second full generation), the separate facts-extraction round trip in
   estimate mode, and thinking configuration.

Also worth noting: prod has only **13 audit rows total**, June to August,
across 4 sessions. Matthew's testing is not landing in that table — find out
where it is going before drawing conclusions from either number.

---

## T1 — the chat surface

| # | Item |
|---|---|
| 2 | Remove the three starter questions — not what someone asks first, and discouraging |
| 3 | The "just asking" copy is MISLEADING and must be corrected: we do keep and train on that text. It is "not added to the document we build for you", not "not kept" |
| 36 | Rename the panel → **"Your outlined application"** |
| 35 | Standardise on **"Just asking"** (not "just questions") everywhere |
| 37 | Composer subtext changes with the mode |
| 5 | Centre "Choose your state" in the estimate panel |
| 6 | Portal copy: say the submission link will also be on the estimate paper; end on a bolded italic question |
| 7 | Animate the mode toggle rather than swapping it |
| 10 | Remove the checkmark beside the state in the picker |
| 11 | Padding on the clear-confirmation box |
| 39 | Reduce the gap between the two lines under the composer |
| 35b | Footer line → "Demeter is AI and can make mistakes. Please double-check cited sources and your state agency." with the agency as a real link |

**Note on #3 and #35b together:** both are honesty corrections. #3 in
particular currently tells people their words are not kept when they are.
Treat it as a retention-copy change and check it against
`components/__tests__/demeter-retention-copy.test.tsx`, which exists to stop
exactly this class of understatement (#703).

---

## T2 — /verify ("How we verify")

A whole-page pass, in roughly this order:

| # | Item |
|---|---|
| 28 | The page is missing the nav bar |
| 27 | Bottom section should use the standard dark-brown footer; it is over-condensed |
| 29 | /verify should be linked from every page's footer |
| 21 | Spacing/sizing pass — many font conventions are not being followed |
| 30 | Rewrite the intro: lead with why accuracy matters to someone seeking assistance, THEN the machinery, and close by inviting correction |
| 22a | Two buttons per state card: Ask Demeter (wheat) → and the state administrator's site (terracotta) →. Currently returns to the main page, which is wrong |
| 22b | Spell out each state name with its initials in parentheses; larger flag (possibly a state outline beside it) |
| 24 | Verified badge: colour fill, plus a check or star |
| 25 | USDA above, spanning the width of two state cards, to read as the umbrella |
| 26 | Equal card heights across a row |
| 23 | Drop "BEFORE IT SHIPPED — passed an adversarial refute gate" from every card; it is on all of them and can be assumed |

Governing doc: `apps/web/DEMETER-DESIGN.md`. Read it before touching.

---

## T3 — landing page

| # | Item |
|---|---|
| 18 | **Reorder to follow a person's questions:** what it is → who decides → how you use it. Move the state-agency section up to just below "What is SNAP"; move "Where the card works" near the end |
| 19 | Reframe "The reasons people don't apply" as the questions people actually have. Proportional bubbles sized by how often each is asked, seeded from real Reddit questions; wheat CTA bar to the chatbot beneath |
| 20 | "Why we show you the rule instead of just answering" → **"Better answers than traditional AI assistants"**, led by the miss-rate statistic |
| 16 | Whitespace: awkward blank patches after the intro text |
| 17 | Remove the state maps and initials from the top right |
| 33 | Intro line → "…quotes the federal regulation behind every claim and your state's own manual to help explain to you the benefit program" |
| 34 | Design pass on "What the application is actually asking", "Privacy", "Supporters" |
| 41 | "Why a straight answer is hard to find" is missing the main point: everyone has edge cases |
| 15 | "Worried about something else? Ask Demeter" → wheat CTA |
| 18b | "Ask Demeter about your situation" box → wheat CTA |
| 40 | Feedback section in the footer: ideas, improvements, services, stories |

**Caution on #19 and #20:** both want statistics. Bubble sizes must come from
real question counts and the miss-rate claim from a real source, or they do not
ship. See the retired "60% less" claim in auto-memory — a fabricated figure has
been shipped here before.

---

## T4 — the rest

| # | Item |
|---|---|
| 14/15 | Retailer search needs a real street map with pinned stores, not the zoomed-out political US map |
| 32 | Add Tagalog; order English → Español → 中文 → Tagalog → Tiếng Việt |
| 31 | Safari tab favicon has a white outline; remove it and increase the mark's size |

---

## Working notes

- Provide the Vercel preview link on every PR before asking about merge:
  `https://web-git-<branch>-civica-app.vercel.app`
- Every post-merge bug fix needs a separate `test(qa):` commit (CLAUDE.md).
- `packages/snap-rules` and `apps/dashboard` are PARKED — ask before touching,
  every time.
- #785 is still open: no dollar income thresholds in the corpus, so the
  gross-income reality check cannot ground. Blocked on USDA endpoints
  (timeout + 503 on 2026-08-12). Do not write those figures from memory.
