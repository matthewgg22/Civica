# CivicaDesignSystem evolution — 2026 Q3

## Owners

- **Civica target:** SNAP product owner (Matthew, currently)
- **WeVote target:** voting product owner (TBD — assign before any RA-* lands)
- **Shared (SPM package):** the design system maintainer (currently the Civica side)

The SPM package at `CivicaDesignSystem/` is imported by both Xcode targets in this repo (Civica + VoteNow/WeVote). Any change to the package ships to both targets simultaneously — there is no per-target fork.

## Why this doc

Multiple iOS audit findings (see `docs/audits/civica-ios-product-audit-2026-05-29.md`, Pass 6 + Pass 7) touch CivicaDesignSystem:

- **RA-1** — Dynamic Type: `CivicaTypography` migrates to `UIFontMetrics`-scaled fonts so type ramps with the user's text-size setting (including AX sizes).
- **RA-2** — Dark mode: token contrast audit + appearance binding so both targets can opt in or out at the app level.
- **RA-3** — iPad: `NavigationSplitView` sidebar shell extracted as a shared component each target configures.
- **RA-4** — Reduce Motion: `civicaAnimation` modifier in CivicaDesignSystem that respects `accessibilityReduceMotion` automatically.

Each is staged for Civica but lands in code WeVote also imports. We need to coordinate before any of them merge — UD-8 (Pass 7 of the audit) flagged this explicitly.

## Per-finding cross-target impact

### RA-1 — Dynamic Type (CivicaTypography migration)

- **Civica benefit:** high. SNAP applicants skew elderly + vision-impaired; many use xLarge or AX sizes daily.
- **WeVote benefit:** identical. Voting-app users span similar demographics; xLarge / AX support is table stakes.
- **Coordination:** run as a single SPM-level PR. Both targets test the same package release.
- **Risk:** layout breakage on WeVote screens at xxxLarge / AX5. Both teams smoke-test the largest content size before merge.
- **Action:** before merge, screenshot the largest WeVote screens at AX3 and AX5; file follow-ups on any clipped or truncated UI.

### RA-2 — Dark mode

- **Civica:** opt-in toggle in Settings; default is `.light`. Rationale: benefits flows benefit from the trust/consistency signal of a single appearance during the application; users in distress shouldn't be surprised by a theme change.
- **WeVote:** may want system-follow default (`.unspecified`). Consumer voting tools typically follow the OS, and the trust-signal argument doesn't apply equally.
- **Resolution:** the SPM package exposes an appearance binding + a token set that passes contrast in both modes. Each target sets its own default at the `CivicaApp` / `WeVoteApp` level — the package does **not** lock either default.
- **Action:** `CivicaApp.swift` sets `.preferredColorScheme(.light)`; WeVote's app entry sets `nil` (system) or whatever WeVote's owner chooses. Document the choice in each target's app file with a one-line `// dark mode default — see docs/plans/civicadesignsystem-evolution-2026-Q3.md` pointer.

### RA-3 — iPad NavigationSplitView

- **Civica:** full SplitView with always-visible sidebar on iPad regular width — Home / Apply / EBT / Find Help / Recert / Settings.
- **WeVote:** likely needs different sidebar items (Plan / Reps / Election / Settings — TBD with WeVote owner). Sidebar IA is a target concern, not a package concern.
- **Resolution:** the SplitView shell (column layout, sidebar visibility behavior, detail-view binding, iPhone fallback) goes into CivicaDesignSystem. Each target supplies its own item config.
- **Action:** define a `CivicaSplitViewConfig` protocol in the package — `sidebarItems: [CivicaSidebarItem]`, `defaultSelection`, `iPadOnly: Bool`. Civica and WeVote each provide a conformance. Audit T7 (separate scope doc) owns the Civica conformance.

### RA-4 — Reduce Motion modifier

- **Civica + WeVote:** identical benefit. Any user with `accessibilityReduceMotion` on gets non-springy transitions everywhere.
- **Coordination:** single SPM PR. Low risk; the modifier no-ops the spring when the env var is on.
- **Action:** introduce `View.civicaAnimation(_:value:)` in the package; replace direct `.animation(.spring())` calls in both targets in follow-up PRs (out of scope for the modifier-infra PR itself).

## Sequencing

1. **RA-1 step 1 — token migration** lands first. Lowest behavioral risk; touches typography but not color or layout.
2. **RA-4 — modifier infra** runs concurrent with RA-1. Independent surface.
3. **RA-2 — dark mode** lands after RA-1. Rationale: typography needs to scale before dark contrast can be honestly tested at xxxLarge — color contrast at small sizes is not the same problem as at AX sizes.
4. **RA-3 — iPad SplitView** is multi-week, owns its own scope doc per audit T7. Sequenced last because it depends on RA-1 (typography scaling on iPad regular width).

Each step is a separate PR. Do not bundle.

## QA contract

Before any CivicaDesignSystem PR merges to `codex/rebuild-feb18`:

- **Civica scheme** builds + tests pass (CI).
- **WeVote / VoteNow scheme** builds + tests pass (CI). If WeVote CI is not yet wired, the Civica owner runs `xcodebuild` for the WeVote scheme locally and posts the result on the PR.
- Both targets manually smoke-tested on **iPhone** at default + xxxLarge.
- Once an iPad target ships, add **iPad** at default + xxxLarge to the same smoke list.

PRs that skip the WeVote build are blocked at review.

## Open questions

- Does WeVote want dark mode default-on, system-follow, or default-off? (Drives RA-2 sequencing decisions for WeVote.)
- Does WeVote ship to iPad today? Check `TARGETED_DEVICE_FAMILY` in the VoteNow target's build settings before RA-3 starts.
- Who owns the SPM package version bump policy? Today the package is path-referenced (not versioned). If we keep path refs, "version bump" is just a commit on `codex/rebuild-feb18`. If WeVote ever ships from a different branch, we need a versioning policy.
- Token semantics: are `--color-amber` / `--color-warning` (see auto-memory: amber-vs-warning-tokens) WeVote-relevant, or Civica-only? If WeVote-only adopts a subset, document the split in the package README.

## References

- Audit: `docs/audits/civica-ios-product-audit-2026-05-29.md` — Pass 6 (RA-1..RA-4) and Pass 7 (UD-8)
- Package: `CivicaDesignSystem/`
- iOS DESIGN: `Civica/DESIGN.md`
- Dashboard DESIGN (for cross-platform token comparison): `apps/dashboard/DESIGN.md`
