# Civica accessibility commitments

Source of truth for the floor every Civica surface clears before it
ships. Lifted from the canvas `AccessibilityBoard` so contributors
don't have to read the design surface to write code that lands.

> **Civica's users are disproportionately on cheap phones, glare-prone
> screens, with eye strain from filling out 12-page forms.
> WCAG AAA isn't aspirational here — it's the floor.**

The old `ACCESSIBILITY_NOTES.md` at the repo root is a VoteNow-era
record. It does not apply to Civica's SNAP surfaces and will be
retired when its sibling tokens are removed.

---

## Six commitments

1. **WCAG 2.2 AAA for text, AA for icons / dividers.** Ink (#1A1714)
   on Paper (#F5F2EC) → 15.8:1, AAA. Brick (#9C3A24) on Paper →
   6.42:1, AAA for normal text. Teal (#2A6F66) on Paper → 5.18:1,
   **AA only** — teal is reserved for accents (success state,
   deltas, +/−), never for paragraphs. Graphite (#5A544D) on Paper
   → 5.94:1, AA — acceptable for body copy but check at 16pt+.
2. **Hit targets.** 56px for primary buttons (mobile), 48px for
   secondary controls and list rows, **44px absolute floor** (Apple
   HIG). 8px minimum between adjacent targets. Anything smaller is a
   blocker, not a debate.
3. **Type & reading.** Body minimum **16pt**, never below. Line
   length 45–75 characters. Line height 1.5 for body, 1.2 for
   display. Surface reflows clean to **320px width at 200% zoom**.
   Honor OS Dynamic Type up to **XXXL** without truncation.
4. **Motion.** No parallax. No autoplay video.
   `accessibilityReduceMotion` kills all transitions — instant state
   change, never a still image of motion.
5. **Screen reader.** VoiceOver tested on every new surface before
   merge. Money announced as **"two hundred ninety-one dollars per
   month"**, never *"two ninety-one slash em-oh"* — route through
   `CivicaMoney`, which encodes this spoken form in `accessibilityLabel`.
6. **Color is never the only signal.** Red/green deltas always pair
   with a sign or label. Status pills always carry an icon + text,
   not just a colored dot. No CAPTCHAs. No time-limited sessions.
   No PDF as the only path.

---

## Color contrast matrix

| Pair                          | Ratio   | Grade |
| ----------------------------- | ------- | ----- |
| Ink on Paper                  | 15.8:1  | AAA   |
| Ink on White                  | 17.4:1  | AAA   |
| Brick on Paper                | 6.42:1  | AAA * |
| Brick on White                | 7.06:1  | AAA   |
| Teal on Paper                 | 5.18:1  | AA    |
| Teal on White                 | 5.69:1  | AA    |
| Graphite on Paper             | 5.94:1  | AA    |
| Paper on Ink (dark surfaces)  | 15.8:1  | AAA   |
| Brick-light on Ink            | 7.18:1  | AAA   |

\* Brick on Paper at 6.42:1 passes AAA for normal text (≥14pt
regular / ≥18pt bold). Teal as a body color falls short of AAA, so
teal is reserved for accents (deltas, success state, +/−), never
paragraphs. The only AA-only pairs in the system are non-text
affordances — icons, dividers, and the optional teal accent on
success badges.

---

## How to use this doc

When adding a new surface or modifying an existing one:

1. Read the six commitments above.
2. Use only color pairs from the matrix. If a new pair is needed,
   compute the contrast first and add it to the table.
3. Tap-test every interactive element on a real device — eyeballing
   in the simulator doesn't catch sub-44px taps.
4. Run the rules-of-thumb checklist below before merging.

### Rules-of-thumb checklist (before merging UI)

- [ ] Every interactive element is ≥44pt tall (≥56pt for primary
      CTAs).
- [ ] Adjacent tap targets have ≥8pt spacing.
- [ ] No text below `CivicaTypography.footnote` (16pt) for body copy.
- [ ] Money strings route through `CivicaMoney` for spoken-form
      accessibility labels.
- [ ] Icons paired with descriptive labels; decorative icons marked
      `.accessibilityHidden(true)`.
- [ ] Status pills / banners use icon + text, not just color.
- [ ] Surface renders without truncation at Dynamic Type XXXL.
- [ ] Surface renders without overlapping at 200% zoom (320pt
      effective width).
- [ ] Custom transitions honor `@Environment(\.accessibilityReduceMotion)`.
- [ ] Composite views use `.accessibilityElement(children: .combine)`
      with a single descriptive label, not 6 separate VoiceOver stops.
- [ ] EN and ES strings both pass the checklist — Spanish runs ~28%
      longer than English on average, which is the failure mode for
      single-line buttons and headlines.

If a surface fails any of these, fix it — don't ship it.

---

## What we won't ship

- Color-only state changes. (Red text by itself, no sign / label.)
- CAPTCHAs of any kind.
- Time-limited sessions or modal dialogs that auto-dismiss.
- Mouse-only or hover-only affordances.
- PDF as the only path through any flow.
- Sub-44pt tap targets.
- Body copy below 16pt.

If a feature can't be built without one of these, it's the wrong
feature for Civica's users. Find the version that works for someone
filling out an application on a five-year-old Android in a parking
lot at sunset.

---

## When in doubt

Test with VoiceOver on. Test at Dynamic Type XXXL. Test in direct
sunlight on the device. The cheapest test in the world is to actually
use the thing the way the user does.
