# Civica Design System

**Audit date:** 2026-05-20  
**Target:** iOS app (Civica target — SNAP benefits enrollment)  
**Brand goal:** *Safe, official, trustworthy* — a government-grade tool that residents trust on first impression and rely on under stress.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color](#2-color)
3. [Typography](#3-typography)
4. [Spacing & Layout Grid](#4-spacing--layout-grid)
5. [Shape & Radius](#5-shape--radius)
6. [Elevation & Shadow](#6-elevation--shadow)
7. [Animation & Motion](#7-animation--motion)
8. [Surfaces (Background Layer System)](#8-surfaces-background-layer-system)
9. [Accessibility Contracts](#9-accessibility-contracts)
10. [Brand Voice & Copy Rules](#10-brand-voice--copy-rules)
11. [Known Issues & Remediation Plan](#11-known-issues--remediation-plan)
12. [Component Anti-Patterns](#12-component-anti-patterns)
13. [Map Pin tokens](#13-map-pin-tokens)

---

## 1. Design Principles

These four principles resolve conflicts. When two choices feel equally valid, apply them in order.

### 1.1 Government-grade trust first

Every screen must read as *official and safe* before it reads as modern or friendly. This means:
- No marketing metaphors (rewards, streaks, confetti) in eligibility flows
- No patterns borrowed from consumer fintech (gradient cards, large illustrative icons, animated badges)
- Calm, neutral backgrounds before colorful ones
- Explicit "this does not submit your application" language persists through the entire flow

### 1.2 Legibility over aesthetics

Benefits applications are completed under stress, often by people in financial crisis, sometimes on small phones in poor lighting. Optimise for reading speed and error reduction:
- Body text at 17pt minimum (iOS default body, not smaller)
- No text on tinted or photographic backgrounds
- Hierarchy communicated by weight + size, not color alone

### 1.3 Honesty about uncertainty

The app produces *estimates*, not decisions. The design must never imply certainty the rules engine can't guarantee:
- Benefit amounts always labeled "estimate" or "likely"
- Disclaimers co-located with results, not tucked into footers
- State agency makes the final determination — say so, every time

### 1.4 Progressive disclosure

Residents arrive with different levels of SNAP knowledge. Never front-load complexity:
- "What is SNAP?" before the eligibility screener
- Math details behind a "See the math" reveal
- Deductions explained in-context, not in a help article

---

## 2. Color

### 2.1 Semantic palette

| Token | Light | Dark | Role |
|---|---|---|---|
| `ink` | `#1A1714` | `#F0EDE7` | All body and display text |
| `graphite` | `#5A544D` | `#9B9289` | Secondary / metadata text |
| `paper` | `#F7F5EF` | `#12100E` | Screen background (default) |
| `paperBright` | `#FCFAF6` | `#161A1F` | Hero surface inside cards |
| `surfacePrimary` | `#FFFFFF` | `#1B1F24` | Card / row background |
| `surfaceSecondary` | `#F0EEE6` | `#2A2620` | Nested card / grouped row |
| `hairline` | `rgba(0,0,0,0.13)` | `rgba(255,255,255,0.10)` | Dividers, card borders |
| `pinePrimary` | `#2D5A45` | `#6FA98F` | **CTAs only.** Primary buttons and links |
| `pinePrimaryPressed` | `#224636` | `#5A9279` | Pressed state of pine CTAs |
| `pinePrimaryDisabled` | `#7A998C` | `#4E7565` | Disabled state of pine CTAs |
| `pineSurface` | `#D8E6DE` | `#2C3F37` | Success-adjacent fill (enrolled, submitted) |
| `amberPrimary` | `#C9922A` | `#E8B84B` | Positive-outcome text/icons on **light** backgrounds (eligible status, deposit amounts) |
| `amberSurface` | `#F5E2C0` | `#3D2E12` | Positive-outcome fills on light backgrounds |
| `wheatPrimary` | `#E8C547` | `#F4D670` | Benefit-positive **fills only** — no text, ever |
| `wheatSurface` | `#F7E89C` | `#4A3D1F` | EBT balance, enrollment confirmation |
| `brickAccent` | `#9C3A24` | `#E8856E` | Recovery / human moments: navigator calls, denials, distress |
| `brickSurface` | `#F1D4C8` | `#3D2B24` | Recovery surfaces |
| `warningAmber` | `#9E4218` | `#9E4218` | Warnings (expiry, missing doc) — NOT errors |
| `destructive` | `#C84637` | `#E87060` | Error states, data-loss actions |

### 2.2 Color use rules

**Pine = CTAs only.**  
`pinePrimary` is reserved for primary action buttons and text links. It must not appear on icons, decorative elements, or status indicators. Using it outside CTAs dilutes the signal that something is tappable.

**Exception:** `pinePrimary` may be used as a card background ONLY when the card is itself the primary tap target (e.g., a `NavigationLink`-wrapped hero card occupying the full hero slot). The Phase 1 hero card ([Civica/App/CivicaEntryView.swift:148-150](Civica/App/CivicaEntryView.swift:148)) is the sanctioned use. Do NOT propagate this pattern to non-CTA hero cards or to any card where the tap target is smaller than the card surface.

**Wheat = benefit fills, never text.**  
`wheatPrimary` (#E8C547) achieves only 2.1:1 contrast on `paper` — it fails WCAG AA at every size. It may appear as a fill color for EBT balance or enrollment celebration; it must never be used as foreground text.

**AmberPrimary = positive outcomes on light surfaces (eligible, deposit amounts, confirmed).**  
`#C9922A` (amber gold) achieves 4.9:1 on paper — AA at all body sizes. Use for "Likely eligible" status text, deposit transaction amounts, and any foreground that communicates benefit value on a light background.

**WheatPrimary = positive outcomes on dark pine surfaces.**  
On the dark pine hero card (EBT balance, eligibility result box), use `wheatPrimary` (#E8C547) — it has higher luminance and reads clearly against the dark background. Never use wheatPrimary as foreground on light surfaces (2.1:1 — fails AA).

**Brick = human recovery, not warning.**  
`brickAccent` and `brickSurface` are for screens where a person needs help from a navigator, has been denied, or is in distress. They are not generic warning colors. The warm tone signals "human support is here." Do not use brick for form validation errors (use `destructive`) or process warnings (use `warningAmber`).

**warningAmber ≠ destructive.**  
Amber (#9E4218) means "pay attention / something will expire." Red (#C84637) means "data loss / error." Never use them interchangeably. Both appear brownish-orange at low saturation — in code, never assign by visual approximation; always use the named semantic token.

**Teal surfaces = benefit context only.**  
`tealSurface` and `tealSurface` are result-positive surfaces. Using them on the SNAP intro screen (before any eligibility is known) would imply a positive outcome before the user has earned one. Intro/onboarding screens use `paper`. Confirmed-eligible screens use `tealSurface`.

### 2.3 Contrast quick-reference

| Foreground | Background | Ratio | WCAG |
|---|---|---|---|
| `ink` | `paper` | 12.9:1 | AAA ✅ |
| `ink` | `surfacePrimary` | 14.7:1 | AAA ✅ |
| `graphite` | `paper` | 5.4:1 | AA ✅ |
| `pinePrimary` | `white` | 9.01:1 | AAA ✅ |
| `accentTeal` | `paper` | 4.7:1 | AA ✅ |
| `wheatPrimary` | `paper` | 2.1:1 | **FAIL** ❌ |
| `warningAmber` | `paper` | 5.9:1 | AA ✅ |
| `brickAccent` | `paper` | 5.2:1 | AA ✅ |

---

## 3. Typography

### 3.1 Typeface

**Hanken Grotesk** — geometric sans-serif, registered via `CivicaFontRegistration`.  
Three weights in use: Regular (400), Medium (500), SemiBold (600).  
Do not introduce Bold (700) or Thin (100) without design review — they break the weight rhythm.

### 3.2 Type scale

| Token | Size | Weight | Use |
|---|---|---|---|
| `pageTitle` | 28pt | SemiBold | Screen titles (nav bar or hero) |
| `cardTitle` | 20pt | SemiBold | Card and section primary headings |
| `sectionHeader` | 17pt | SemiBold | Inline section headings within scrollable content |
| `body` | 17pt | Regular | All body copy, form labels, row titles |
| `bodyStrong` | 17pt | SemiBold | Emphasized body — correct answers, confirmed values |
| `subhead` | 15pt | Medium | Supporting metadata, secondary labels |
| `subheadStrong` | 15pt | SemiBold | Secondary labels that need emphasis |
| `footnote` | 13pt | Regular | Disclaimers, source citations, compliance copy |
| `footnoteStrong` | 13pt | SemiBold | Footnote data (amounts in deduction rows) |
| `caption` | 12pt | Regular | Eyebrow labels, overlines |
| `captionStrong` | 12pt | SemiBold | Uppercase overlines with letter-spacing |

**Missing size:** There is no 24pt token. Benefit amount displays (e.g., the estimator's monthly benefit) currently use `pageTitle` (28pt) or `cardTitle` (20pt). A `display` token at 24pt/SemiBold would serve large numerics without the full weight of a page title. Add when the estimator or EBT balance hero gets a visual update.

### 3.3 Duplicate tokens (known debt)

These pairs are currently identical — they exist because of naming evolution, not distinct design intent. The aliases can be used interchangeably for now, but should be resolved to one canonical name in a future design-system refactor:

- `sectionHeader` == `sectionHeaderBold` — keep `sectionHeader`, deprecate `sectionHeaderBold`
- `cardTitle` == `cardSubtitle` — keep `cardTitle`, deprecate `cardSubtitle`
- `subheadStrong` == `subheadBold` — keep `subheadStrong`, deprecate `subheadBold`

### 3.4 Line height and spacing

SwiftUI's default line height for Hanken Grotesk reads comfortably at 17pt body. Do not set explicit `lineSpacing` on body copy unless a specific layout requires it. For compliance copy (privacy notice, eligibility disclaimers), add `lineSpacing(2)` — dense legal text benefits from the extra breathing room.

### 3.5 Letter spacing

Reserve explicit `kerning` for uppercase caption overlines only: `captionStrong + .kerning(1.2)` is the established pattern. Do not kern mixed-case or body text — it hurts legibility.

---

## 4. Spacing & Layout Grid

### 4.1 Grid

Civica uses a **4pt base grid**. Every spacing value is a multiple of 4:

| Token | Value | Use |
|---|---|---|
| `xxs` | 2pt | Tight internal separators (icon-to-label gap) |
| `xs` | 4pt | Icon padding, very tight pairs |
| `sm` | 8pt | Default element gap within a card |
| `md` | 12pt | Card internal padding top/bottom, list row vertical padding |
| `lg` | 16pt | Card internal padding left/right, section gaps |
| `xl` | 24pt | Screen edge padding, between-section gaps |
| `xxl` | 32pt | Hero padding, bottom-safe-area clearance |

Note: `md=12` is on the 4pt grid (not the 8pt grid). It is intentionally between `sm` and `lg` to tighten card interiors without affecting screen-level padding.

### 4.2 Edge-to-edge padding

Screen content pads at `xl` (24pt) horizontally. This matches Apple's recommended minimum tap-target margin and gives paper space to breathe around cards.

### 4.3 Touch targets

Minimum touch target: 44×44pt. For destructive actions, prefer 48pt tall to reduce accidental activation.

---

## 5. Shape & Radius

| Token | Value | Use |
|---|---|---|
| `control` | 3pt | Text fields, segmented controls, toggles |
| `card` | 4pt | All cards and row containers |
| `pill` | 999pt | Tags, status chips, CTA buttons |

**Government-appropriate sharpness.** The very tight radii (3–4pt) are intentional: they signal precision and formality rather than consumer-app friendliness. These corners read as a document, not an app. This directly supports the "safe, official, trustworthy" goal.

**Buttons** use `pill` (999pt) to distinguish them as interactive from the sharp-cornered document-style cards. The contrast between pill buttons and sharp cards creates a clear hierarchy: cards hold information, pills are actions.

**Never use radius > 12pt on content cards.** Highly rounded cards push toward consumer/fintech aesthetics and undermine the government-grade visual register.

---

## 6. Elevation & Shadow

| Token | Radius | Y | Opacity | Use |
|---|---|---|---|---|
| `.hairline` | 3pt | 1pt | 8% | Focused inputs, subtle card lifts |
| `.card` | 6pt | 2pt | 6% | Default card elevation |
| `.floating` | 14pt | 4pt | 20% | Sheets, drawers, modal surfaces |

Shadows are warm-tinted (`CivicaColors.ink` base color, not black). This keeps shadows inside the warm neutral palette.

**Prefer border over shadow for cards.** Most cards in the app use `hairline` strokeBorder rather than `.civicaShadow(.card)`. Borders are crisper, more "official," and cleaner on the `paper` background. Shadows imply physical depth/materiality — use them for surfaces that truly float (bottom sheets, drawers, the floating CTA button).

---

## 7. Animation & Motion

### 7.1 Token catalog

| Token | Curve | Duration | Use |
|---|---|---|---|
| `fast` | easeInOut | 0.12s | Micro-interactions: toggle ticks, icon state changes |
| `standard` | easeInOut | 0.20s | Default: card expand, panel reveal, most state changes |
| `snap` | easeOut | 0.18s | Dismiss / return-to-rest: closing menus, deselecting |
| `slow` | easeInOut | 0.30s | Considered transitions: section reveals, important state |
| `stepTransition` | easeOut | 0.24s | Form step cross-fades (one-question-per-screen) |

### 7.2 Numeric animation

Benefit amounts and money values should use `.contentTransition(.numericText())` combined with a spring to make re-calculations feel real-time and responsive:

```swift
Text(formattedAmount)
    .contentTransition(.numericText())
    .animation(.spring(response: 0.25, dampingFraction: 0.8), value: amount)
```

This is intentionally a spring (not a `CivicaAnimation` easeInOut token) because the spring physics feel more organic for a counter rolling up. The `response: 0.25` value maps roughly to `standard` duration.

### 7.3 Reduce-motion

Every animated transition must respect `@Environment(\.accessibilityReduceMotion)`. The pattern:

```swift
@Environment(\.accessibilityReduceMotion) private var reduceMotion

withAnimation(reduceMotion ? nil : CivicaAnimation.stepTransition) { ... }
```

For `.contentTransition(.numericText())` + spring: wrap the animation modifier conditionally:

```swift
.animation(reduceMotion ? .none : .spring(response: 0.25, dampingFraction: 0.8), value: amount)
```

### 7.4 Stagger

OCR field reveals use `staggerInterval` (0.08s) keyed off row index. Do not stagger more than 5 rows — the delay on the last item becomes noticeable (0.4s+ total) and feels sluggish.

---

## 8. Surfaces (Background Layer System)

The app has three distinct layers. Each layer has exactly one correct background token:

| Layer | Token | Typical use |
|---|---|---|
| Screen | `paper` | ScrollView / ZStack ignoresSafeArea background |
| Card / row | `surfacePrimary` | Any card or list row sitting on paper |
| Nested content | `surfaceSecondary` | A card inside a card; grouped sub-rows |

**Accent surfaces** communicate state, not depth:

| Token | Trigger | Example |
|---|---|---|
| `tealSurface` | Positive outcome confirmed | Benefit amount box, "Likely eligible" result card |
| `pineSurface` | Enrolled / submitted | "Application sent" confirmation |
| `brickSurface` | Recovery / human support | Denial screen, navigator outreach panel |
| `wheatSurface` | EBT balance / deposit | EBT card balance display, enrollment celebration |

**Rule:** Accent surfaces do not substitute for the base three layers. A screen with a tealSurface card still uses `paper` as its background. Accent surfaces appear *within* the layer system, not instead of it.

**`paperBright`** is a card-interior highlight for hero moments within a card (e.g., the benefit amount inside a result card that already uses `surfacePrimary`). Use sparingly — one per card maximum.

---

## 9. Accessibility Contracts

### 9.1 Color contracts (never break these)

1. **Never render text in `wheatPrimary`.** It fails AA on all Civica surfaces. Use `accentTeal` or `ink` for any text that communicates benefit value.

2. **Error states require color + sigil + label.** Color alone is never sufficient. `destructive` on a field border must be paired with an icon (e.g., `exclamationmark.circle.fill`) and an explicit error message string.

3. **All interactive elements ≥ 3:1 on their background** (WCAG 1.4.11 non-text contrast). All CTAs, all toggles, all segmented controls.

4. **`graphite` on `paper` = 5.4:1.** Safe for secondary text at 17pt+. Too low for 12pt caption text — use `ink` for captions that carry meaning. `graphite` on `tealSurface` drops to ~3.1:1 — only use ink on teal surfaces.

### 9.2 Dynamic Type

The app does not currently resize for Dynamic Type. This is a known gap. At minimum, text must not be truncated with ellipsis in standard WCAG body sizes (up to xxxLarge). Fixed-height rows that clip text should be changed to `.fixedSize(horizontal: false, vertical: true)` to grow vertically.

### 9.3 VoiceOver

Every interactive element must have an `accessibilityLabel` that makes sense standalone, without visual context. Decorative images: `.accessibilityHidden(true)`. Chevrons and affordance icons: `.accessibilityHidden(true)`. Combined cards with NavigationLink: `.accessibilityElement(children: .combine)` + explicit `.accessibilityLabel`.

### 9.4 Minimum touch targets

44×44pt minimum. For "destructive" or "start over" actions, prefer a 48pt height. Inline text links (like "Learn more") must have adequate padding — do not rely on the text's natural bounds as the tap area.

---

## 10. Brand Voice & Copy Rules

### 10.1 First person ("you"), not bureaucratic third person

✅ "You may qualify for up to $X/month."  
❌ "Applicant may be eligible for benefits."

### 10.2 Estimates are estimates

Every benefit figure must be labeled as an estimate. "Your monthly benefit" in the math view is the one exception — it displays the result of the calculation, but the "Civica's estimate" disclaimer must be co-present.

### 10.3 No urgency patterns

Government services don't expire in a countdown timer. Never use urgency language ("Only 3 days left!") or scarcity patterns. Use only factual deadlines ("Your certification period ends [date]").

### 10.4 Action labels describe outcomes, not mechanics

✅ "See if I qualify"  
✅ "Get my application packet"  
✅ "Open official state SNAP website"  
❌ "Submit" (for what is actually "generate PDF")  
❌ "Continue" (for what is actually "start eligibility screener")  
❌ "Apply on BenefitsCal" on a button that routes inside the app (must route externally if labeled as external portal)

### 10.5 Bilingual parity

Every user-visible string is a `CivicaText(en:, es:)`. Raw `Text("string")` literals are forbidden in SNAP flows. Spanish strings are translation-equivalent, not shorthand. Confirm all new strings with a native speaker before shipping.

### 10.6 "This does not submit your application"

This disclaimer must appear:
- On the confirmation screen before reviewing a draft
- In the application packet view before generating the PDF
- Anywhere a user might believe Civica is submitting on their behalf

---

## 11. Known Issues & Remediation Plan

Listed by severity.

### 🔴 Critical

| # | Issue | File | Fix |
|---|---|---|---|
| C1 | `wheatPrimary` is defined but only 2.1:1 contrast — easy to misuse as text | `Colors+v2.swift` | Add `@available(*, unavailable, message: "Never use as text foreground — contrast 2.1:1")` shim, or add a lint rule |
| C2 | `isExternalLink` logic on estimator CTA was creating browser-open affordance for internal navigation | `SNAPBenefitEstimatorView.swift` | Fixed 2026-05-20 — flag removed |
| C3 | SUA calculation silently returned nil for CA users (FederalDefaultRules has no SUA) | `SNAPBenefitEstimatorCalculator.swift` | Fixed 2026-05-20 — switched to CAStateRules |

### 🟡 High

| # | Issue | File | Fix |
|---|---|---|---|
| H1 | tealSurface on the SNAP intro screen implied positive outcome before eligibility check | `SNAPEligibilityIntroView.swift` | Fixed 2026-05-20 — changed to paper |
| H2 | Duplicate typography tokens (`sectionHeaderBold`, `cardSubtitle`, `subheadBold`) create inconsistent usage across the codebase | `CivicaTypography.swift` | Deprecate the `*Bold` aliases; point to canonical names. Schedule for design-system refactor sprint. |
| H3 | Lever cards (childcare, medical, rent) are dead ends — tapping them does nothing | `SNAPDecisionLeversView.swift` | Add NavigationLink or `.sheet` to the relevant questionnaire question. Requires UX design for edit-path deeplink. |
| H4 | **RESOLVED (RA-6, 2026-05-29):** `warningAmber` was #B5511E (4.6:1 on paper — barely AA, failed at footnote sizes). Bumped to **#9E4218 (5.9:1 on paper)** — AA with margin at small sizes. | `CivicaColors.swift` | Done — token darkened. |

### 🟢 Low / Quality of Life

| # | Issue | File | Fix |
|---|---|---|---|
| L1 | Spring animation on estimator numeric display uses inline values rather than `CivicaAnimation` token | `SNAPBenefitEstimatorView.swift` | Add `CivicaAnimation.numericSpring` token once the design system gets a numeric-display token |
| L2 | md=12 spacing is not on the 8pt grid — this is fine on a 4pt grid but the README implies 8pt | `CivicaTokens.swift` | Update docs to explicitly call it a 4pt grid |
| L3 | 6 named background surface tokens — risk of proliferation | `CivicaColors.swift`, `Colors+v2.swift` | Document the three-layer rule (§8) in code comments next to each token |
| L4 | Returning user "Waiting…" primary CTA has no affordance when status = interviewScheduled | `SNAPReturningUserHomeView.swift` | Show status-specific text and a "What to expect" link per interview stage |
| L5 | captionStrong with `.kerning(1.2)` + `.textCase(.uppercase)` is repeated in 5+ views with no view modifier helper | Multiple SNAP views | Extract `func civicaOverline() -> some View` modifier into design system |
| L6 | Dark mode values exist in all tokens but app forces light mode (`UIUserInterfaceStyle = Light`) | `CivicaColors.swift`, `Colors+v2.swift`, Info.plist | When dark mode ships, audit accentTeal dark (5FA89E on 1B1F24 = 4.6:1 — just passes AA) and wheat dark (F4D670 — still fails as text) |

---

## 12. Component Anti-Patterns

Patterns the design review has explicitly killed or capped. New code should not reach for these without referencing the sanctioned-use carve-out below.

### 12.1 Icon-in-tinted-circle

The pattern `Image(systemName:).foregroundStyle(token).background(Circle().fill(token.opacity(N)))` is allowed at most **once per screen**, and only as a **banner/state eyebrow** — never as section decoration or repeating tile-row affordance. Repeating this pattern across multiple cards or sections produces the textbook AI-slop look the May 2026 design review explicitly killed (blacklist pattern #3).

Sanctioned use: the Phase 3 recert banner clock-arrow icon ([CivicaHomePhase3View.swift:191-199](Civica/App/CivicaHomePhase3View.swift:191)).
Unsanctioned use: any tile-grid or 3-column "feature highlights" pattern.

Cross-ref: same posture as the cold-start tile-grid rule from the May 2026 review (CivicaEntryView.swift design comment).

---

## 13. Map Pin tokens

Map cartography needs a category-distinguishable palette that the main brand semantic vocabulary cannot supply on its own. The FindHelp map pins five EBT-retailer categories and three help-directory categories — eight unique pins. The brand palette ships ~six semantic foreground hues, none of which are reserved for cartography. So `CivicaColors.pinX` exists as a separate axis.

**Rationale.** Category-specific palettes on a map are intentional. A map pin's color is not communicating brand semantics ("approved," "warning," "recovery"); it is communicating *which kind of place this is* against varied basemap tiles. Reusing brand semantics here would dilute both vocabularies — a brick-red `pinFood` would read as a denial signal everywhere else in the app.

**Token list.** Defined in `CivicaColors.swift` under `MARK: - Map Pin tokens`:

| Token              | Light hex  | Maps to                                              |
|--------------------|------------|------------------------------------------------------|
| `pinFood`          | `#9C3A24`  | Help directory + SNAP application help (brick)       |
| `pinHelp`          | `#2A6F66`  | Help directory + Food assistance (teal)              |
| `pinHelpBoth`      | `#3A342E`  | Help directory + Both services (graphite)            |
| `pinSupermarket`   | `#1F4F4A`  | EBT retailer + Supermarket (teal-deep)               |
| `pinSmallGrocer`   | `#B5762A`  | EBT retailer + Small grocer (amber)                  |
| `pinFarmersMarket` | `#3B6B33`  | EBT retailer + Farmers market (green)                |
| `pinCoop`          | `#3D4E6E`  | EBT retailer + Co-op (indigo)                        |
| `pinRestaurant`    | `#9C3A24`  | EBT retailer + Restaurant Meals Program (brick)      |

Dispatch from `FindHelpLocation` to token lives in `FindHelpPinPalette.color(for:)` — kept in the FindHelp domain because the dispatch depends on the location model.

**Dark-mode contract — LIGHT ONLY as of 2026-05-29.** Dark variants are deferred to audit task T7 (the Pass 6 dark-mode rollout, which already owns the design-system contrast story). The pin tokens currently render with their light hex in both light + dark interface styles. Single-pin readability against dark-mode MapKit tiles has not been verified — the existing `FindHelpPinPalette.mixedClusterColor` lift is the only dark-tile adaptation today, and it applies only to mixed-category clusters. When T7 lands, each pin needs a +20 luminance variant verified against the chosen basemap tile at three zoom levels.

Do not propagate `pinX` tokens outside map / cartography contexts. They are not a general accent palette — they are the FindHelp pin axis. The brand semantic palette covers all non-cartography needs.

---

## Appendix: Token Quick-Reference Card

```
BACKGROUNDS    paper (#F7F5EF) → surfacePrimary (#FFF) → surfaceSecondary (#F0EEE6)
HERO SURFACES  pinePrimary (#2D5A45) — dark hero card (EBT balance, result box)
ACCENT FILLS   amberSurface · pineSurface · brickSurface · wheatSurface  (state, not depth)
TEXT           ink (#1A1714) / graphite (#5A544D)
CTAs           pinePrimary (#2D5A45) — ONLY for primary actions
POSITIVE LIGHT amberPrimary (#C9922A) — eligible results, deposit amounts on light bg
POSITIVE DARK  wheatPrimary (#E8C547) — benefit amounts on dark pine hero cards
RECOVERY       brickAccent (#9C3A24) — denial, navigator, distress
WARNING        warningAmber (#9E4218) — expiry, missing doc
ERROR          destructive (#C84637) — data errors, form validation

DARK HERO RULE  One dark (pinePrimary) hero card per screen.
                Wheat-gold text on pine = "this is your benefit / your money."
                Everything else is neutral white/paper cards.

RADIUS         control=3pt · card=4pt · pill=999pt
SPACING        xxs=2 · xs=4 · sm=8 · md=12 · lg=16 · xl=24 · xxl=32  (4pt grid)
TYPE           12/13/15/17/20/28pt · Hanken Grotesk 400/500/600
ANIMATION      fast=0.12 · standard=0.20 · snap=0.18 · slow=0.30 · step=0.24
```
