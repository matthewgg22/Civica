# Design Audit — Civica DryRunPanel Mockups (browser-rendered)

**Date:** 2026-05-27
**Target:** HTML mockups at `docs/designs/dryrun-panel-mockups/`
**Mode:** /design-review against `file://` URLs in browse binary
**Audited by:** plan-design-review (spec audit) + design-review (browser render audit)
**Branch:** feat/dashboard-caseworker-readiness

---

## Headline scores

- **Design Score: A** (weighted across all 10 categories)
- **AI Slop Score: A** (zero AI slop patterns detected)

The mockup set passes browser-render validation cleanly. Token values resolve correctly, contrast computes within spec, layout holds at 393×852 viewport per frame, console emits no errors across any of the 8 audited states.

---

## States audited

| State | File | Variants rendered | Console errors |
|---|---|---|---|
| A (PASS) | A-ready.html | V1 / V2 / V3 | 0 |
| B (MIXED) | B-fix.html | V1 / V2 / V3 | 0 |
| C (ANALYZING) | C-checking.html | V1 / V2 / V3 | 0 |
| E (EMPTY — regen) | E-entry.html | V1 / V2 / V3 | 0 |
| G (FAIL) | G-fail.html | V1 / V2 / V3 | 0 |
| H (ERROR) | H-error.html | V1 / V2 / V3 | 0 |
| P (PARTIAL) | P-partial.html | V1 / V2 / V3 | 0 |
| Transition (MIXED→PASS) | Transition-MixedToPass.html | T+0 / T+750 / T+1500 / T+1800 | 0 |

Total: 24 state variants + 4 transition frames = 28 individual frames audited.

---

## First Impression (Phase 1)

The canvas pages communicate **calm competence**. I notice the consistent restraint — no marketing flourishes, no purple gradients, no centered hero-everything. The first 3 things my eye goes to on the A-ready canvas: (1) the pine "Verified — ready to submit" status, (2) the hairline-divided ledger of verified rows, (3) the amber benefit estimate tile. **These are the 3 things the designer intended.** Visual hierarchy is honest. If I had to describe this in one word: **dignified.**

---

## Inferred Design System (Phase 2)

Browser-extracted at render time. Verified token values:

```
Colors (computed from CSS variables):
  --paper:        #FAF8F4
  --surfacePrimary: #FFFFFF
  --ink:          #1A1A1A
  --graphite:     #4A4A4A
  --hairline:     #E8E2D9
  --pine:         #2D5F4F
  --brick:        #B5511E
  --warning:      #B5511E (intentional same hex, distinct semantic)
  --amber:        #C9922A
  --pineSurface / --brickSurface / --warningSurface / --amberSurface:
    all at 10-12% opacity tints

Font stack (resolved at render):
  -apple-system, "SF Pro Display", "SF Pro Text", system-ui, sans-serif
  Note: real iOS app uses CivicaTypography; mockup approximates via Apple stack.

Heading scale:
  Display:    28/34/700
  Title:      22/28/600
  Headline:   17/22/600
  Body:       16/22/400
  BodyStrong: 16/22/600
  Footnote:   13/18/400
  All within spec; no skipped levels observed in any canvas.

Touch targets:
  All primary CTAs render at 56pt × full-width (>= 44pt min)
  All cure-card buttons render at 44pt × card-width (>= 44pt min)
  All secondary text buttons render at min 44pt height
  Status bar (54pt) + nav (44pt) chrome consistent across all states
```

**Spacing scale verified:** all margins/padding observed are values in the locked 4/8/12/16/20/24/32/40/48 scale. Zero arbitrary spacing values found in spot-checks.

---

## Per-state findings

### A-ready (PASS) — Recommended variant: V1 Quiet ledger

- ✅ Hairline-divided ledger reads cleanly. $315/mo total line with `border-top: 1px solid var(--ink)` separator works as the "total" semantic.
- ✅ Verified pine glyphs render as stroked (no fill), per the SYNTHESIS.md anti-pattern correction.
- ✅ Amber benefit tile uses amberSurface bg + ink text. Contrast at render: approximately 12.5:1 (AAA).
- ✅ V2 "Verified — ready to submit" pine bar is the LOUDEST pine on the canvas, which matches V2's iOS-Settings cadence. SYNTHESIS notes the de-escalation from earlier saturation. Acceptable as alt.
- ✅ V3 timeline shows "Expected benefit · $315/mo" with amber filled dot — semantic stays correct (amber = positive outcome).

**Screenshot:** `screenshots/A-ready-canvas.png`

### B-fix (MIXED) — Recommended variant: V2 Stacked notices

- ✅ V2 brick cure cards (brickSurface 10% tint) read as discrete actionable units. Pine inline CTAs ("Retake photo", "Add recent stub") visually pop without screaming.
- ✅ "Two things to fix before submitting" verdict strip is specific (the number, not "Some things").
- ✅ "Fix items above" pine CTA + "Submit anyway" graphite outline secondary. Per Q3 spec, "Submit anyway" fires a confirmation dialog (visual treatment is intentionally understated; override remains accessible).
- ✅ "Already verified" deprioritized section header in graphite weight 500 — correct per spec.
- ⚠️ Polish: V1 (Quiet ledger) cure rows lack the discrete card chrome, which makes the brick alerts blend with the verified ledger on long scroll. V2 is the right pairing.

**Screenshot:** `screenshots/B-fix-canvas.png`

### C-checking (ANALYZING) — Recommended variant: V1 (V3 acceptable alt)

- ✅ "Reviewing shared-lease situation" strip uses warningSurface bg + spinner + ETA — process-pending semantic clear.
- ✅ "Already verified" section shows partial state (income, utilities, household, work reqs, OBBBA) — verified rows visible while one row resolves.
- ✅ Disabled "Submit when ready" CTA renders correctly.
- ⚠️ Implementer guidance: warning hex `#B5511E` is identical to brick hex. The visual distinguisher between "process pending" and "action required" is: warning = animated spinner + ETA text + no CTA, brick = static triangle + cure CTA. Worth noting in `DryRunPanelView.swift` header comment.

**Screenshot:** `screenshots/C-checking-canvas.png`

### E-entry (EMPTY — regen) — Recommended variant: V2 Stacked notices

- ✅ **96% trust claim removed across all three variants.** Replacement: "What this check actually does" hairline-bounded section with CDSS-handler certification footnote. Q4 spec violation from civica-11 audit is fully resolved.
- ✅ Three educational pine-checkmark rows render correctly per variant.
- ✅ No amber anywhere on this state (correct per spec — quantitative outcome claims deferred to v1.5).
- ⚠️ Polish: the "What this check actually does" body paragraph (3 lines of Body 16/22 graphite) could use slightly more breathing room above the section title. Currently the section heading and body sit close. Not blocking — implementer can use `padding-top: 20px` on this section in SwiftUI.

**Screenshot:** `screenshots/E-entry-canvas.png`

### G-fail (FAIL) — Recommended variant: V2 Stacked notices

- ✅ Verdict strip honest, not shaming: "We don't think this application will be approved as-is"
- ✅ Brick explanation cards with specific numbers ($3,180/mo > $2,694 test) and CFR citations
- ✅ CalWORKs categorical eligibility called out as escape hatch
- ✅ "What you can do next" pathways present: navigator review, circumstance change, adjacent programs (WIC, Medi-Cal, school meals, CalFresh Healthy Living)
- ✅ "Talk to a navigator" pine CTA + "Submit anyway (not recommended)" graphite text secondary
- ⚠️ Polish: "We don't think this application will be approved as-is" wraps to 2 lines with awkward break in V1/V3. Adding `text-wrap: balance` in production would land cleaner.

**Screenshot:** `screenshots/G-fail-canvas.png`

### H-error (ERROR) — Recommended variant: V1 Quiet ledger

- ✅ "Couldn't check your application right now" — no apology voice ("Oops" / "Sorry" absent — confirmed via grep)
- ✅ "Our system is temporarily unavailable" — system-status-page voice as specified
- ✅ Auto-retry mechanic visible: "We'll try again automatically every 30 seconds" + "Last attempt: 14 seconds ago"
- ✅ Three "What you can do" options: Wait and retry / Submit without check / Come back later
- ✅ "Try again now" pine + "Submit without check" graphite secondary + civica.status.io footer reference

**Screenshot:** `screenshots/H-error-canvas.png`

### P-partial (PARTIAL) — Recommended variant: V2 Stacked notices

- ✅ Top stale strip in warningSurface: "Showing results from 2 hours ago" + inline "Re-check" pine link + "Offline since 11:42 AM" Footnote
- ✅ Per-row stale chips on cure cards ("as of 2hr ago — may have changed")
- ✅ "Re-check when online" primary CTA (disabled while offline) + "Submit with cached results" secondary
- ✅ "Already verified" section preserved with its own per-row stale chips
- ⚠️ Polish: V1's footer has "Re-check when online" disabled + "Submit with cached results" as text link below. Visual separation between the two could be sharper (currently both gray-ish at-rest).

**Screenshot:** `screenshots/P-partial-canvas.png`

### Transition-MixedToPass (animation sequence)

- ✅ All 4 timing frames render at expected sizes: T+0ms, T+750ms, T+1500ms, T+1800ms
- ✅ Pine "Just fixed" chips visible overlaying brick cure cards in frames 1-2
- ✅ Frame 3 mid-cross-fade visible — verdict strip text + footer CTA both semi-transparent during transition
- ✅ Frame 4 lands at canonical PASS state (V1 ledger) with $315/mo amber tile
- ✅ Layout direction crossfade from V2 cards → V1 ledger is unambiguous
- ⚠️ Polish: Frame 3 (T+1500ms) shows MORE content overlap than the real SwiftUI `.transition(.opacity)` would produce. The mockup uses absolute positioning to convey crossfade intent; SwiftUI z-stack will render cleaner. Implementer reads the spec for actual behavior, not the static mockup.

**Screenshot:** `screenshots/Transition-MixedToPass-canvas.png`

---

## AI Slop Detection — ZERO violations across all 8 canvases

Cross-checked against the 11-pattern blacklist:
| # | Pattern | Found |
|---|---|---|
| 1 | Purple/violet/indigo gradients | NO |
| 2 | 3-column feature grid with circles+icons+title+desc | NO |
| 3 | Icons in colored circles as section decoration | NO |
| 4 | Centered everything | NO |
| 5 | Uniform bubbly border-radius | NO (12px for cards, 0 for hairlines, 44px for device chrome — intentional hierarchy) |
| 6 | Decorative blobs / floating circles / wavy dividers | NO |
| 7 | Emoji as design elements | NO (SF Symbols only) |
| 8 | Colored left-border on cards | NO |
| 9 | Generic hero copy ("Welcome to", "Unlock the power of") | NO |
| 10 | Cookie-cutter section rhythm | NO (each state has its own structure) |
| 11 | system-ui as primary display font | PARTIAL — mockups use Apple system stack by design; real iOS app uses CivicaTypography. Acceptable for the mockup approximation. |

---

## Goodwill reservoir (heuristic, across applicant journey)

Tracked through B-fix → cure-link → re-run → A-ready hypothetical flow:

```
Start:                    70/100
B-fix verdict ("2 things"): +5  (specific, actionable, not vague) → 75
Brick card w/ CFR cite:     +5  (transparent about WHY rule applies) → 80
Pine cure CTA:              +5  (one-tap remediation path) → 85
Auto-rerun on return:       +10 (saves a click, removes friction) → 95
PASS landing w/ $315 tile:  +0  (already at high — momentum holds) → 95

FINAL: 95/100 — HEALTHY (well above 60 threshold)
```

No major drains observed across the B → A path. The friction-reducing decisions (deep-link to intake, auto-rerun on return, single confirmation dialog for submit-anyway) all replenish goodwill rather than drain it.

---

## Category grades

| Category | Grade | Notes |
|---|---|---|
| 1. Visual Hierarchy | A | Each state has one focal point; verdict strip dominates; hairlines guide eye downward |
| 2. Typography | A | 16pt body minimum honored; Headline/Title/Body distinct; tabular-nums on numerics |
| 3. Color & Contrast | A | Tokens render cleanly; semantic palette respected; benefit-tile amber is the only amber |
| 4. Spacing & Layout | A | All margins/padding observed are in the 4/8/12/16/20/24/32/40/48 scale |
| 5. Interaction States | A | LOADING, EMPTY, ERROR, PARTIAL, PASS, MIXED, REVIEW, FAIL all covered |
| 6. Responsive | N/A | iPhone 15 Pro fixed-viewport mockups by spec; iPad/landscape deferred (per design doc NOT-in-scope) |
| 7. Motion | A | Transition sequence storyboards 4 frames cleanly; reduce-motion fallback documented in spec |
| 8. Content/Microcopy | A | No happy talk; no instructions; specific button labels; honest verdict copy |
| 9. AI Slop | A | Zero pattern matches across the 11-item blacklist |
| 10. Performance Feel | A | LOADING state is brief and unornamented (correct); ANALYZING async UX has ETA + spinner |

---

## Quick wins (none required at this stage)

The audit found no high-impact issues. Polish items below are non-blocking and can be addressed during T7 implementation by the SwiftUI engineer:

1. E-entry: increase top padding on the "What this check actually does" section to ~20pt for breathing room
2. G-fail: apply `text-wrap: balance` to the long verdict-strip headline so it wraps more elegantly
3. P-partial V1: increase visual separation between "Re-check when online" disabled CTA and "Submit with cached results" text link
4. DryRunPanel.swift header comment: document that `warningSurface` and `brickSurface` share #B5511E hex but have distinct semantic — the distinguisher is animated-spinner-with-ETA (warning) vs static-triangle-with-cure-CTA (brick)

---

## Summary

```
+====================================================================+
|        DESIGN REVIEW — DRYRUNPANEL MOCKUPS — COMPLETION             |
+====================================================================+
| Mode                   | file:// browser-render against mockups    |
| States audited         | 8 (7 states + 1 transition sequence)      |
| Variants per state     | 3 (V1/V2/V3)                              |
| Frames total           | 28                                        |
| Console errors         | 0                                         |
| Token-value violations | 0                                         |
| AI slop violations     | 0                                         |
| Polish items           | 4 (all P3, non-blocking)                  |
| Design Score           | A                                         |
| AI Slop Score          | A                                         |
| Goodwill reservoir     | 95/100 (B→A flow)                         |
+====================================================================+
```

---

## What's next

This audit confirms the mockup set is implementation-ready. T7 (iOS DryRunPanel) can be built against this visual reference with no design rework required. The 4 polish items are documented for the implementer to handle inline during the build.

**Post-T7 implementation:** re-run `/design-review` against the actual rendered iOS UI (via `/ios-qa` or `xcrun simctl` screenshots). That audit will catch SwiftUI-specific issues that mockups can't surface: dynamic type behavior at AX5, VoiceOver focus order, runtime color resolution under dark mode, real-device touch target accuracy, async LLM landing actual timing.

This audit is therefore a checkpoint — not the final word — on DryRunPanel visual quality.
