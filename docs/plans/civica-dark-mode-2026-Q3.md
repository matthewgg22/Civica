# Civica dark mode — 2026 Q3 plan

## Goal
Opt-in dark mode for Civica via Settings (system / light / dark) without changing the default user experience. Defaults to light to preserve government-grade trust posture per DESIGN.md §1.1.

## Why scoped, not built today
Per the audit, dark mode requires a token-by-token contrast audit that needs ~1 week of dedicated time + native screenshot review. Shipping unscoped would risk landing tokens that fail WCAG AA in dark and that no test catches until users with sensory needs report them.

## Implementation plan (5 phases, ~1 week)

### Phase 0: replace forced-light lock with bound state
- `CivicaRootView` swaps `.preferredColorScheme(.light)` for a `@AppStorage(CivicaAppStorageKeys.appearance) String = "light"` binding (key added in PR #383). Three values: `"system"`, `"light"`, `"dark"`. Default `"light"`.
- A small `CivicaAppearance` enum decoder converts the AppStorage string to `ColorScheme?` (nil for system).
- No UI to change it yet — that lands in Phase 2.
- Estimated: ~3h

### Phase 1: per-token contrast audit (THE LOAD-BEARING PHASE)
- Build a `CivicaColorContrastReport` test that walks every token pair documented in DESIGN.md §2.3 and asserts WCAG AA contrast ratios in BOTH light and dark.
- Token pairs to audit (from DESIGN.md §2.3 + new audit):
  - ink on paper (both modes)
  - ink on surfacePrimary
  - graphite on paper
  - pinePrimary on surfacePrimary
  - amberPrimary on paper (sanctioned use only)
  - warningAmber on paper at body + footnote size
  - brickAccent on paper
  - destructive on paper
- For dark mode, the audit doc flagged these as borderline:
  - `accentTeal` dark variant (4.6:1 — barely AA; bump to `#6FB5A8`?)
  - `wheatPrimary` dark (still fails as text — verify danger-zone marker keeps it fill-only)
  - `warningAmber` dark variant (verify AA at body)
  - Hairline tokens have enough opacity in dark to remain visible
- Each failing pair: choose either (a) bump the dark variant value, (b) flag the pair as "never use" in DESIGN.md §9, or (c) document a sanctioned exception with rationale.
- Estimated: ~3 days (including SwiftUI snapshot review for ~12 screens × 2 modes)

### Phase 2: Settings UI
- Add "Appearance" row to `SNAPSettingsSheet` (added in PR #369) with 3-way picker: System / Light / Dark.
- Picker writes to `@AppStorage(CivicaAppStorageKeys.appearance)`.
- Use the snapshot-testing infra (PR #325) to record a dark baseline for `SNAPSettingsSheet` and one representative home view.
- Estimated: ~4h

### Phase 3: Beta-cohort opt-in
- Behind a feature flag `DarkModeRevealFeatureFlag.isEnabled` (off by default) the Appearance row is visible in Settings; off-flag users don't see it.
- Beta cohort criteria:
  - 2-week opt-in beta
  - Recruit ~50 users via Civica navigator network OR via TestFlight
  - Success criteria: zero AA contrast failures reported in dark via a feedback URL on the Settings sheet ("Report a contrast issue →")
  - Failure criteria: ≥3 reports of unreadable text in dark
- Estimated: 2 weeks elapsed (no engineering effort during beta — just collecting reports)

### Phase 4: General rollout
- Flip `DarkModeRevealFeatureFlag.isEnabled = true`. Appearance row visible to all users.
- Default stays `light`.
- Document the rollout in `docs/runbooks/dark-mode-rollout.md`.
- Estimated: ~1h

## Risk register
- **Risk: WeVote target inherits the SPM-package change.** Per `docs/plans/civicadesignsystem-evolution-2026-Q3.md` (PR #389), the SPM-level binding exposes appearance; each target sets its own default. Civica = light; WeVote = decide separately.
- **Risk: brand-trust regression in dark.** Government-grade trust historically reads as cream/paper. If users misread dark mode as "an unofficial / scammy version of the app," that's a brand hit. Mitigation: Settings copy ("Dark mode preserves all Civica's trust marks; tap to confirm we still look official to you") + screenshot in Settings showing the brand assets in dark before user confirms.
- **Risk: Snapshot tests become brittle in dark.** PR #325's snapshot infra records 3 traits per screen but `.dark` baselines drift if any token contrast changes. Mitigation: re-record baselines as part of Phase 1.

## Rollback plan
Flip `DarkModeRevealFeatureFlag.isEnabled = false`. Existing users on dark drop back to system; light-mode default returns. No data loss (only the AppStorage value persists; UI just stops surfacing the toggle).

## References
- Audit: `docs/audits/civica-ios-product-audit-2026-05-29.md` (Pass 6 RA-2)
- Per-target appearance plan: `docs/plans/civicadesignsystem-evolution-2026-Q3.md`
- Settings sheet host: PR #369
- AppStorage key: PR #383
- Snapshot infra: PR #325
