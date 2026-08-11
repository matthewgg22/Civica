# Demeter chatbot page — accessibility & trust criteria

**Source:** Matthew's criteria list, 2026-08-11.
**Status:** plan. Intent, not evidence — findings belong in `docs/findings/`.
**Surface:** `/chat`, `/screen/ask`, `/questions` (EN/ES/VI/ZH).
**Design system:** `apps/web/DEMETER-DESIGN.md` governs. Anything here that changes a rule there updates that file in the same PR.

The audience assumption behind every item: someone under stress, often on an old
phone, often on prepaid data, sometimes on a shared library terminal, frequently
not reading in English. Ordered by **how many people currently cannot use the
product**, not by effort.

---

## Decisions taken before planning

Recorded so they are not silently re-litigated. Four items from the criteria are
deliberately **not** being implemented as written.

| Criterion | Decision | Reason |
|---|---|---|
| Native device font stacks | **Rejected** | Fonts were just self-hosted (#697): 288KB Latin woff2 with `size-adjust` fallback metrics, so zero CLS and one cached round trip. System stacks would save little and cost the entire type system, which is the product's visual identity. The underlying concern is real and is addressed by P3-2 (page-weight budget) instead. |
| Typing indicator capped at 1.5s | **Rejected** | Answers retrieve, verify citations, and sometimes recompose; 5–15s is normal. An indicator that vanishes at 1.5s makes a working system look broken. Replaced by: indicator persists until the first token, after which streaming text IS the progress signal. |
| 48×48 touch targets "per WCAG 2.2 AA" | **Corrected, then decided** | WCAG 2.2 AA (2.5.8) is 24×24 CSS px. 44×44 is Apple HIG; 48×48 is Material. We are at 44 in 21 places and exceed the standard. Moving to 48 is a taste call, tracked as P3-3, not a compliance item. |
| Persistent "not the official portal" banner | **Rejected as written** | A permanent banner is a permanent alarm, which contradicts the trauma-informed principle in the same list. The disclosure exists under the composer and in the graphite footer. Revisit only if user testing shows people believe they have applied. |

**Open product question, not scheduled here:** chunked micro-questions vs. an
open "ask anything" chatbot. Chunking is better UX for eligibility and is a
different product from the one that hands you the rule. Needs a product
decision before it becomes a work item.

---

## P0 — people who cannot use the product today

### P0-1 · Screen readers are never told an answer arrived
**The gap.** `components/DemeterChat.tsx` has no `aria-live` region. Only the
state-change divider carries `role="status"`. A screen reader user asks a
question and hears nothing: no announcement that a reply started, finished, or
what it says. On a product whose entire value is the answer, this is the most
serious item on the list.

**Do.** `aria-live="polite"` + `aria-atomic="false"` on the transcript
container. Announce *completed* answers, not every streamed token — a live
region fed token-by-token produces unusable stuttering speech. Practically:
render the streaming bubble outside the live region, then move the finished
text in, or gate announcement on the stream's end.

**Also.** The certainty verdict (`✓ CERTAIN` / `⚠ UNCERTAIN`) must be part of
what is announced. An answer read aloud without its certainty is exactly the
overconfidence the verifier exists to prevent.

**Verify.** VoiceOver on Safari and NVDA on Firefox: ask, confirm the answer is
announced once, in full, with its verdict, and that typing is not interrupted.
Automated check cannot prove this; a real screen reader run is required.

### P0-2 · Link colour fails 4.5:1
**Measured.** `--demeter-terracotta` `#C0553B` on `--demeter-paper` `#F7F6F4` =
**4.22:1**. Below AA for normal text. Used as link text in ~8 rules
(`.dmx__link`, `.dment__verify`, `.demeter__how`, `.screen-auth__links a`, …).
On `--demeter-card` white it is 4.56 — a marginal pass.

**Do.** Links become `--demeter-terracotta-deep` `#8E3A26` (6.99 on paper, 7.54
on card). Terracotta stays for fills, marks and hover. Update
`DEMETER-DESIGN.md` §3, which currently implies terracotta is the link colour.

**Verify.** A contrast test over the token table, run in CI, asserting every
foreground/background pair the design actually uses clears 4.5:1. Cheap and it
prevents the next palette edit from reintroducing this.

### P0-3 · 200% zoom is untested
**The gap.** Never checked. WCAG 1.4.10 (reflow) requires no horizontal scroll
at 320px-equivalent width, which 200% zoom on a 1280 viewport reproduces.

**Do.** Audit at 200% and 400%. Highest-risk surfaces: the `/chat` two-column
grid, the `.dmst` picker panel, the estimate rail, and the 13-monogram grid in
the orientation bar.

**Verify.** Playwright at 640×800 with `deviceScaleFactor`, asserting
`document.body.scrollWidth <= clientWidth` on every Demeter route.

---

## P1 — trust on a shared machine

### P1-1 · No way to clear the session
**The gap.** Nothing clears the conversation. On a library terminal the next
person sees the previous person's questions about their income, their household,
their felony record.

**Do.** A "Clear this conversation" control in the chat header. Clears
transcript, facts ref, classification, and the `demeter:pending-save` localStorage
stash.

**The honest-copy constraint, and it is the hard part.** We log every question
and answer to `mae_query_log` server-side. The button clears *this browser*, not
our records. It must say so, or it is the retention lie #703 fixed, rebuilt as a
button. Proposed: "Clear this conversation — removes it from this browser. We
still keep the question and answer to check our accuracy."

**Verify.** Regression test: after clearing, transcript is empty, the stash key
is gone, and the copy names the limit.

### P1-2 · PII warning is in the wrong place
**The gap.** "Avoid typing names or personal details" lives in the estimate
rail. Not above the box where people type, and absent entirely on `/chat` at
narrow widths where the rail stacks below.

**Do.** Move it under the composer, where the decision is made. Keep it quiet —
this is guidance, not a warning banner.

**Note.** `redactPii` strips structured identifiers but deliberately not names
(`packages/demeter-engine/src/pii.ts`). The copy must keep asking rather than
promising, per DEMETER-DESIGN §2.3.

### P1-3 · Error states
**Check, then act.** Current errors render as `.demeter__error`. Audit against
"soft banner with an actionable recovery step" — particularly the at-capacity
and rate-limited paths, where the honest message is "try again shortly", not a
failure the reader will read as their fault.

---

## P2 — coverage gaps that produce wrong answers

### P2-1 · US territories are absent
**The gap.** Guam, Puerto Rico, USVI, American Samoa, CNMI are not in the
picker. **Puerto Rico runs NAP, not SNAP** — a substantively different program
with different rules. Silence there is worse than for an unverified state,
because the federal floor we fall back to does not apply.

**Do.** Add territories to the picker with an explicit label. PR/AS/CNMI get a
NAP note and a hand-off; GU/USVI run SNAP and can take the federal floor.

**Engine boundary.** Any change to eligibility maths is `packages/snap-rules`,
which is PARKED — file an issue first, do not edit
(`feedback_engine_math_file_issue_first`).

### P2-2 · Optional location assistance
**Do.** A "Use my location" affordance that is never required and never
auto-fires. People help family in other states; a forced geolocation gets the
wrong answer confidently. Manual selection stays the primary path.

### P2-3 · Selection confirmation
**Partial today.** The trigger shows the program name after selection. The
criteria asks for program + agency + portal link inline.
`SNAPAgencyDirectory` already holds all three and the agency section renders
them — surface them at the moment of selection.

---

## P3 — measurable polish

- **P3-1 · Message measure.** Bubbles are `max-width: 88%` of the column, which
  at 940px is a long line. Cap the measure in `ch`, per DEMETER-DESIGN §4's
  existing rule that every other text block is capped.
- **P3-2 · Page-weight budget.** Replaces "use system fonts". Measure real
  transferred bytes for `/screen/ask` and `/chat` on a cold cache, set a budget,
  and enforce it. If we are over, cut from wherever is heaviest — which is an
  evidence question, not an assumption about fonts.
- **P3-3 · 44 → 48px targets.** A taste call now that the standard is known.
  21 rules.
- **P3-4 · Drawer for secondary content.** The estimate rail is arguably already
  this on desktop; on mobile it stacks below the conversation. Worth deciding
  whether it becomes a real drawer or stays inline.

---

## Sequencing

P0 ships first and together — it is one accessibility PR with a screen-reader
run and a contrast test. P1 second, as the shared-machine trust pass. P2 is
per-item and can go in parallel with anything. P3 is opportunistic.

Every PR carries its preview URL (`web-git-<branch>-civica-app.vercel.app`)
before any merge request, so visual changes are reviewable without merging.
