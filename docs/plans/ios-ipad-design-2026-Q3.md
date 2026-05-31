# Civica iPad — 2026 Q3 plan

## Goal
Ship Civica for iPad with a NavigationSplitView shell that respects Apple's iPad design language while preserving the status-adaptive home behavior that's the core of the iPhone experience.

## Why scoped, not built today
iPad is ~3-4 weeks of focused architecture + design + QA work. Per the audit doc + ARCH-2 sidebar-vs-status routing decision: the iPad shell isn't a "wrap the iPhone view in a SplitView" job; it's a full IA shift (status routing moves DOWN into the Home detail pane, sidebar items become always-visible peer destinations).

## Current state
`TARGETED_DEVICE_FAMILY = "1,2"` — app ships to iPad but layout is iPhone-stretched. Hero card stretches to ~1024pt. No sizeclass adaptation. Worst-case visual surface area in the audit.

## Target architecture

### Sizeclass-adaptive shell
- `CivicaRootView` swaps `NavigationStack` for a sizeclass-aware shell:
  - `.regular` (iPad portrait, iPad landscape, iPhone 17 Pro Max landscape) → `NavigationSplitView`
  - `.compact` (iPhone portrait, smaller landscapes) → `NavigationStack` (today's behavior)
- Implementation: `@Environment(\.horizontalSizeClass)` branches at the root.

### Sidebar (always-visible) — per ARCH-2 decision
- Home — status-adaptive destination (today's `rootSurface` logic moves INTO this destination)
- Apply — `CivicaSNAPFlowView` (with status-aware fallback for already-enrolled users — see below)
- EBT balance — `EBTBalanceRootView`
- Find help — `FindHelpRootView`
- Recert — `RecertCompanionRoot` (gated by flag, see PR #382 runbook)
- Settings — `SNAPSettingsSheet` (shipped PR #369, hosted as a detail destination on iPad instead of a sheet)

### Status-aware destination behavior
Sidebar items are always TAPPABLE, but each destination shows status-appropriate content:
- `Apply` while enrolled → "You're enrolled — add a household member?" (route to add-member flow if it exists; placeholder otherwise)
- `Recert` pre-enrollment → "Available after you're approved"
- `EBT balance` pre-card-linked → unlinked-card placeholder (same as today's Phase 3 fallback)

The audit's decision was specifically NOT to gate sidebar items on status — that would defeat the point of the SplitView.

## Build sequence (5 phases, 3-4 weeks)

### Phase 1: NavigationSplitView shell + sidebar (~1 week)
- `CivicaRootView` sizeclass branch
- Sidebar with the 6 items above
- Selection state persisted in `@AppStorage(CivicaAppStorageKeys.iPadSidebarSelection)` (added by this PR)
- Each detail destination is a placeholder pointing to existing iPhone views (stretched, untouched)
- Test: iPad portrait + landscape + iPhone Pro Max landscape all show sidebar; iPhone portrait shows NavigationStack

### Phase 2: SNAPHomeDestination extraction (~1 week)
- Today's `rootSurface` status-routing logic moves into a new view `SNAPHomeDestination`
- Sidebar's "Home" item routes to it
- On iPhone: NavigationStack renders SNAPHomeDestination directly (zero behavior change)
- On iPad: SplitView's detail pane renders it
- Test: status changes update the Home detail pane on both layouts

### Phase 3: Detail-pane reading width (~3 days)
- Wrap each detail destination in `.frame(maxWidth: 720)` centered horizontally — Apple's recommended reading column max
- The Phase 1/2/3 home content shouldn't stretch full-iPad-width
- Test: snapshot the home detail pane at iPad portrait + landscape; verify the content is centered within a max 720pt column

### Phase 4: Adaptive sheet patterns (~3 days)
- EBT link card, denial appeal, recert companion — today full-screen — adopt `.sheet(presentation: .formSheet)` on iPad
- Onboarding 5-screen wizard stays single-pane on both layouts but center-caps at 600pt on iPad
- Test: each sheet adopts the form-sheet style on iPad; full-screen on iPhone

### Phase 5: iPad-specific QA (~1 week)
- Touch target re-verify on iPad (slightly larger expected hits ~50pt)
- Keyboard shortcuts: ⌘N for new application, ⌘F for find help, ⌘, for settings
- Pencil / Trackpad compatibility
- Dynamic Type at xxxLarge × iPad landscape (the worst-case layout stress test)
- Snapshot baselines for 5 representative screens on iPad portrait + landscape
- Accessibility audit on iPad (VoiceOver routing, focus order with sidebar)

## Open architectural decisions before Phase 1 starts
1. **Status-detail pane**: when user taps `Apply` while `.decisionApproved`, does the detail pane show (a) "you're enrolled" + add-member CTA, (b) silently bail back to Home, or (c) gray the sidebar item out? The audit's IA decision was (a); confirm before building.
2. **Sidebar persistence**: should sidebar selection persist across launches? Probably yes (it's a navigation state, not a transient choice).
3. **`Recert` sidebar item visibility**: pre-enrollment users see a stub "Available after you're approved"; should the item disappear entirely instead? Audit decision was "always visible" — confirm.

## Risk register
- **Risk: status routing complexity doubles.** SNAPHomeDestination has to handle 6+ status paths in one view; on iPad those paths render inside SplitView. Mitigation: keep the routing logic identical to today's `rootSurface` and just move it down a level.
- **Risk: SplitView state restoration across rotate / Stage Manager / split-screen.** Apple's adaptive layout shifts sizeclass mid-session. Mitigation: `@AppStorage` for sidebar selection + `onChange(of: horizontalSizeClass)` re-validation.
- **Risk: WeVote target shares the SPM package.** Per UD-8 plan (PR #389), the SplitView shell should be a CivicaDesignSystem-level component with per-target `CivicaSplitViewConfig`. WeVote may want different sidebar items.
- **Risk: 3-4 weeks elapsed time = competing for the same engineer-week budget as RA-2 dark mode.** Schedule both with explicit dependency ordering: dark mode first (RA-2 needs ~1 week), THEN iPad. Phase 1 of iPad can start while dark mode is in beta.

## Definition of done
- iPad cold install → onboarding centered → home shows SplitView sidebar → tap any sidebar item routes to detail pane
- All 6 sidebar destinations work on iPad portrait + landscape
- Snapshot baselines committed for 5 representative iPad screens
- Settings appearance toggle (if dark mode landed) works on iPad
- VoiceOver + iPad keyboard shortcuts both pass a11y audit
- iPhone behavior is byte-identical to pre-iPad code (regression-tested via existing baselines)

## Rollback plan
Each phase is a separate PR. Each PR's regression test ensures iPhone behavior is unchanged. If any phase blocks: revert that PR, iPad reverts to "stretched iPhone" until next attempt. The shipped state stays usable on iPad throughout (just not pretty).

## References
- Audit: `docs/audits/civica-ios-product-audit-2026-05-29.md` (Pass 6 RA-3 + ARCH-2)
- Sidebar IA decision: ARCH-2 (always-visible items, status-adaptive Home)
- Cross-target plan: `docs/plans/civicadesignsystem-evolution-2026-Q3.md` (PR #389)
- AppStorage keys: PR #383 (will need to add `iPadSidebarSelection`)
- Settings sheet: PR #369
- Snapshot infra: PR #325
