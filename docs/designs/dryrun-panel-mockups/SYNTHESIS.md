# Civica · DryRunPanel — Variant Synthesis

Six SNAP DryRunPanel states × three visual directions = 18 mockups. All
strictly use the Civica token system (no improvised colors). Below is the
synthesis of design principles derived from this session.

---

## States covered

| ID | State | File |
|----|-------|------|
| A  | Dry-run PASS — ready to submit                 | `A-ready.html`     |
| B  | Mixed PASS/FAIL — two cure-asks                | `B-fix.html`       |
| C  | Async resolve — 1 row still resolving          | `C-checking.html`  |
| D  | Route to navigator — handoff                   | `D-navigator.html` |
| E  | First-time entry — educational                 | `E-entry.html`     |
| F  | Lease photo capture — cure detail              | `F-lease.html`     |

## Three visual directions

**V1 — Quiet ledger.** Hairline-divided rows. No card chrome. Right-aligned
values. Total-style summary lines. Reads as a government form / itemized
receipt. Best when the data IS the story.

**V2 — Stacked notices.** iOS-Settings cadence: grouped rounded panels with
section headers above each. Each row gets surface chrome. Best when items
are independently navigable / each has its own state.

**V3 — Status timeline.** Vertical hairline thread on the left rail; pine,
brick, amber dots punctuate it. Reads as compliance check or shipping
tracker. Best when sequence and forward motion matter.

---

## Semantic rules (applied across all 18)

### Color

- **pine** — verified, ready, approved. Used as: small stroked checkmark
  glyphs, primary CTA fill, verified dots on timeline.
- **brick / warning** (same hex `#B5511E`) — recovery or process-pending.
  Brick = "you need to act"; warning = "the system is working on it."
  Same color, different semantic — context disambiguates.
- **amber** — positive *outcome* only (e.g. awarded benefit amount on State A,
  $315/mo). Never used for warnings, never for chrome, never for unverified
  claims like first-submission approval rates. Always paired with
  `amberSurface` when it's structural.
- **graphite** — secondary text; secondary actions (text buttons); 
  deprioritized section headings ("Already verified" on the cure state).
- **paper / surfacePrimary / hairline** — neutrals only. Hairline is the
  default divider; surfacePrimary lifts content when V2 needs it.

### Anti-patterns hit during iteration

1. **Too much green.** First A pass had pine-filled disc checkmarks for 6
   rows + pine status pill + pine submit CTA — too saturated. Pine is now
   reserved for: stroked checkmark glyphs (no fill), the primary CTA, and
   in-card cure action buttons (you reverted my attempt to switch those
   to ink).
2. **pineSurface chrome on inline status lines.** The "Verified — ready to
   submit" line started in a tinted rounded pill. We dropped the pill and
   border — pine glyph + pine text on paper reads cleaner.
3. **Card-wrapped lists.** The list IS the design when items share rhythm
   (verified rows, requirements). V1 (ledger) leans into this.
4. **Unsupportable quantitative claims.** The first E-entry draft used a
   "96% approved on first submission" amber trust strip. Pulled in v2 —
   Civica has no measured cohort outcomes at launch and a stat the first
   auditor or applicant can't be shown the source for breaks trust faster
   than any visual treatment can restore. Replaced with a qualitative
   explainer + CDSS-handler certification footnote.

### Typography

- Display 28/34/700 — canvas/page titles only, not in-frame.
- Title 22/28/600 — every screen's top H1.
- Headline 17/22/600 — section headings. Drops to 500/graphite for
  deprioritized sections ("Already verified" on State B).
- Body 16/22/400 — never smaller, even for detail rows.
- Footnote 13/18/400 — CFR cites, source attributions, metadata.
  Tabular-nums on all numeric footnotes.

### Iconography

- The only "always-on" glyph is the stroked pine checkmark (16px, no fill).
- Cure cards use an outlined brick warning triangle (not filled — too
  alarming).
- The trust stat uses an outlined amber star — quiet, not a badge.
- The CTA on State F (Lease photo) gets a camera glyph; no other CTAs do.
- No filled-circle iconography anywhere — outlined throughout.

### Layout

- 393×852 iPhone 15 Pro viewport, 44px corner radius.
- Status bar (54px) + nav (44px) at top; home indicator at bottom.
- Footer pinned with 1px hairline top border so primary CTAs never
  scroll off.
- Spacing scale strictly 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48.

### CTAs

- Primary: pine fill, white text, 56pt tall, 12px radius, Headline weight.
- Secondary: graphite text button below primary, 44pt min target.
- Tertiary / dual: graphite outline button (1px hairline) for "Submit
  anyway" on State B.
- Disabled: hairline fill, graphite text, `not-allowed` cursor.

---

## Recommended pairings

| State | Best variant for production | Why |
|-------|-----------------------------|-----|
| A     | V1 Quiet ledger             | Receipt metaphor fits "we tallied everything you'll be asked." Total line for $315/mo lands. |
| B     | V2 Stacked notices          | Brick cards must read as discrete actionable items; V1 risks burying the cure-asks among verified rows. |
| C     | V1 or V3                    | Inline status strip (V1) is unobtrusive; timeline (V3) reads as "we're still on it." V2 over-elevates the spinner. |
| D     | V3 Status timeline          | "What happens next" IS a timeline — making it look like one is honest. |
| E     | V2 Stacked notices          | First-time user; iOS-native cadence reduces friction. V1 too dense for an entry screen. |
| F     | V1 Quiet ledger             | Capture screen needs the viewfinder to dominate; flat checklist below stays out of the way. |

## Things to consider next

- Empty state (intake incomplete, can't run yet)
- Failed-submit state (network or county system unavailable)
- Cure-resolved transition — what State B looks like after both items
  flip to pine; does the screen auto-advance to State A?
- Dark mode pass across all 18 (the v2 enrolled dark-mode file in the
  project root is a good starting palette)
- Tablet/landscape (393 is the narrowest case; what scales gracefully?)
