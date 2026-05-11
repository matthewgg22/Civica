# CivicaDesignSystem

Local Swift package holding the Civica v1 design tokens. The main app target
(`VoteNow`) depends on this package; the widget extension
(`Voting UI Island CardExtension`) keeps its own duplicated copies of
`CivicaColors`, `CivicaTokens`, and `CivicaTypography` because Live Activity /
WidgetKit extensions cannot import SPM packages directly.

The brand was rewritten to the values locked in `HANDOFF.md` (May 10, 2026):
brick primary, teal accent, ink/paper neutrals, Hanken Grotesk type, sharp
3/4pt radii, 56/48/44pt hit targets, tabular-nums money. Legacy
`ctaBlue`/`ctaRed`/`canvasBackground`/`textPrimary`/etc. are removed; consumers
have been swept onto the new names.

## What's in here

| File | What it exposes |
|---|---|
| `CivicaColors.swift` | Color palette, `Color.dynamic(light:dark:)`, `Color.init(hex:)`, `UIColor.init(hex:)`, `CivicaPrimaryCTAButtonStyle` (56pt min hit), `CivicaSecondaryCTAButtonStyle` (48pt min hit) |
| `CivicaTokens.swift` | `CivicaSpacing` (xs/sm/md/lg/xl/xxl = 4/8/12/16/24/32), `CivicaRadius` (control/card/pill = 3/4/999) |
| `CivicaBorder.swift` | `fieldDefault` (1pt), `fieldActive` (1.5pt) — form input strokes |
| `CivicaTypography.swift` | Semantic font ladder, all rendered in Hanken Grotesk |
| `CivicaShadow.swift` | 3 elevation tiers + `View.civicaShadow(_:color:opacity:)` |
| `CivicaAnimation.swift` | `fast` / `standard` / `snap` / `slow` / `stepTransition` (240ms form crossfade) / `staggerInterval` (80ms) |
| `CivicaMoney.swift` | View enforcing the handoff money rule (tabular-nums, denominator, VoiceOver-correct) |
| `CivicaFontRegistration.swift` | `CivicaFonts.register()` — call once on app launch |
| `Resources/Fonts/` | `HankenGrotesk-{Regular,Medium,SemiBold}.ttf`, `AtkinsonHyperlegible-Regular.ttf` |

## Color tokens

### Brand
| Token | Light | Dark | Use |
|---|---|---|---|
| `brickPrimary` | `#9C3A24` | `#E8856E` | Primary CTAs, urgent. AAA on `paper` (6.42:1). |
| `brickPrimaryPressed` | `#84311E` | `#D26A52` | Pressed state for primary CTA. |
| `brickPrimaryDisabled` | `#B07A6E` | `#9D5C4D` | Disabled state for primary CTA. |
| `accentTeal` | `#2A6F66` | `#5FA89E` | **Deltas, success, on-target SLA only. Never body. Never paragraphs.** |
| `paper` | `#F5F2EC` | `#111418` | Warm white app background. Pure white reserved for printed output. |
| `ink` | `#1A1714` | `#F2F5F8` | Primary text. |
| `graphite` | `#5A544D` | `#BCC6D0` | Secondary text. |
| `muted` | `#8A8278` | `#9AA0A6` | Tertiary text / placeholder. |
| `hairline` | `#00000012` | `#FFFFFF12` | The only divider color. No new grays. |

### Political
Mode-invariant — political colors don't shift with light/dark.
| Token | Value | Use |
|---|---|---|
| `partyDemocrat` | `#246AA8` | Democrat-blue rendering, patriotic logo orbit. |
| `partyRepublican` | `#C84637` | Republican-red rendering, patriotic logo orbit. |

### State
| Token | Light | Dark | Use |
|---|---|---|---|
| `destructive` | `#C84637` | `#E07060` | Form validation, network errors, irreversible actions. |
| `destructivePressed` | `#A1372B` | `#C45848` | Pressed state. |
| `destructiveDisabled` | `#A35B53` | `#9D5952` | Disabled state. |
| `warningAmber` | `#9A5A14` | same | Caution / deadline. |
| `neutralStatus` | `#5A5F66` | same | Inactive / neutral. |
| `indigoStatus` | `#4F46A5` | same | Carried-forward indigo cue. |

### Surfaces
Solid pastels so consumer `.opacity(...)` chains compose predictably.
| Token | Light | Dark |
|---|---|---|
| `brickSurface` | `#F1D4C8` | `#4A2A22` |
| `tealSurface` | `#BCE0DA` | `#2C4D49` |

Plus the carried-forward `surfacePrimary`, `surfaceSecondary`, `onPrimaryText`,
`iconOnPrimarySurface`, `iconOnPrimaryBorder`, `shadowSoft`, status surface
tints, secondary-button fills, and a few specialty surfaces
(`mapvCardBackground`, `supportPageBackground`, `supportWarmSurface`,
`timelineFocusGold`).

## Typography

All semantic tokens render in Hanken Grotesk. Weights map to the handoff cap:

| SwiftUI weight | Hanken weight |
|---|---|
| `.regular` (400) | Hanken Regular |
| `.medium` (500) | Hanken Medium |
| `.semibold` (600) | Hanken SemiBold |
| `.bold` | Hanken SemiBold (handoff caps UI weight at 600 — hierarchy comes from size/color, not extra weight) |

Body / footnote / caption / support tier tokens carry `.monospacedDigit()`
automatically so any number rendered in them satisfies the tabular-nums rule.

`codeChip` stays on system monospaced (`ui-monospace` / SF Mono) per the
handoff's "monospace for metadata only" rule.

Atkinson Hyperlegible is bundled as a documented fallback. It is registered
but not yet wired into the typography ladder — invoke explicitly with
`Font.custom("AtkinsonHyperlegible-Regular", size:)` when needed.

## Radii

Three semantic values per HANDOFF.md §1: *"3px controls/chips · 4px cards · 99px status pills. No 8/12/16. Sharp on purpose."*

| Token | Value | Use |
|---|---|---|
| `CivicaRadius.control` | 3 | Controls, chips, inline buttons. |
| `CivicaRadius.card` | 4 | Cards, containers, sheets. |
| `CivicaRadius.pill` | 999 | Status pills. |

## Hit targets

Per HANDOFF.md §1: 56 / 48 / 44pt. The package's two button styles enforce the
two upper tiers:

- `CivicaPrimaryCTAButtonStyle` → `.frame(minHeight: 56)`
- `CivicaSecondaryCTAButtonStyle` → `.frame(minHeight: 48)`

44pt is the floor for any compact / dense touch target — enforce per call site.

## Money rule

Always render currency with `CivicaMoney`:

```swift
CivicaMoney(amount: 291, denominator: "mo")     // "$291/mo"
CivicaMoney(amount: 1.99, denominator: "meal")  // "$1.99/meal"
CivicaMoney(amount: 24000, denominator: "yr",
            font: CivicaTypography.cardHero)
```

- Tabular-nums always (forced even if the caller's font isn't already mono-digit).
- Denominator after a slash. Whole-dollar amounts hide trailing zeros.
- VoiceOver reads "two hundred ninety-one dollars per month".
- Never as a teaser before submission (handoff §1 rule).

## Font registration

Hanken Grotesk + Atkinson Hyperlegible are bundled via SPM resources but Core
Text won't pick them up automatically. Call `CivicaFonts.register()` once on
app launch — `CivicaApp.init()` already does this:

```swift
@main
struct CivicaApp: App {
    init() {
        CivicaFonts.register()
        // …
    }
}
```

## Adding the package to Xcode (one-time setup)

This package isn't yet wired into `Civica.xcodeproj`. The first time you check
out this branch, do the following in Xcode (takes ~1 minute):

1. Open `Civica.xcodeproj`.
2. **File** → **Add Package Dependencies...**
3. Click **Add Local...** (button at the bottom-left of the dialog).
4. Navigate to and select the `CivicaDesignSystem` folder (the one containing
   `Package.swift`). Click **Add Package**.
5. When Xcode prompts to choose a target, check **`VoteNow`**. Click **Add Package**.
6. Build (Cmd+B). Should succeed.
7. Commit the `Civica.xcodeproj/project.pbxproj` changes and push.

## Known gaps / follow-up

- The widget extension (`Voting UI Island CardExtension`) duplicates the
  package's tokens manually and still uses **system fonts**, not Hanken — Live
  Activity bundles need their own font registration plus the `.ttf` files added
  to the widget target. Tracked as a future cleanup.
- Some `ctaRed` consumers were collapsed to `destructive` in commit 0c339c40
  even though their semantic was urgency rather than error (notably some
  election-timeline call sites). A follow-up pass should reclassify those to
  `brickPrimary` where appropriate.
- Existing money-display sites in the app should be migrated to `CivicaMoney`.
  This is a separate cleanup pass; the primitive is in place.
- The handoff's screen rebuilds (HANDOFF.md §4) and form-scaffolding /
  status-timeline / i18n / SMS / caseworker-queue work (HANDOFF.md §3 items
  4–9) are out of scope for this token rewrite and remain to be planned
  separately.
