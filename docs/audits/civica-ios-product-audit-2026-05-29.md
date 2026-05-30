# Civica iOS Product Audit — 2026-05-29

**Branch:** `claude/benefitscal-bridge-v1`
**Base:** `codex/rebuild-feb18`
**Auditor:** Plan-design-review (Claude)
**Scope:** Full 7-pass product audit of the Civica iOS target (SNAP enrollment).
**Inputs read:** DESIGN.md, CivicaRootView, CivicaEntryView (Phase 1), CivicaHomePhase2View, CivicaHomePhase3View, OnboardingFlowView + 5 screens, SNAPBenefitEstimatorView, SNAPConversationView, EBTBalanceDashboardView, SNAPDecisionDeniedView, SNAPReturningUserHomeView.

---

## Audit posture

The Civica iOS app is **already a 7.5/10 on design completeness** going into this audit. The May 2026 design review killed the AI-slop tile grid and replaced the cold-start home with a status-adaptive 3-phase shell. The DESIGN.md is real (11 sections, semantic palette, contracts, known-issue registry). The bilingual layer is genuine — every user-visible string is a `CivicaText`. Onboarding is transparent and respects autonomy.

So this audit is **not** "what's broken." It is "what would move 7.5 → 9.5 without losing the trust posture you've already earned."

What pulls the app down today, in priority order before the passes start:

1. **Silent failures.** EBT dashboard refresh, eligibility verdict persistence, the `// TODO wiring` rows on Phase 2/3 that quietly default to hidden — these are correctness gaps that show up as cold UX.
2. **Ineligibility / denial = door slams.** Both the estimator and the conversation screener treat "doesn't appear to qualify" as a terminal state with red copy and no warm next step. For a user in crisis this is the highest-stakes UX moment in the app.
3. **Documented gaps that have aged.** DESIGN.md §9.2 (Dynamic Type) and §11 L6 (dark mode forced off) have been known for 9 days. They are not high-effort but high-impact for the trust posture.
4. **Discoverability holes.** Settings is reachable only via the EBT dashboard context menu — invisible to anyone who hasn't linked a card. The phantom-recert flow is gated behind `RecertCompanionFeatureFlag` — pilot state, unclear rollout posture.
5. **Semantic-token drift.** The Phase 3 recert banner uses `amberPrimary` (positive-outcome token) for a process reminder; per DESIGN.md §2.2, recert reminders should arguably be `warningAmber` (process-attention) — small but corrosive over time if not policed.

This document records findings from all 7 passes plus a prioritized Implementation Tasks list at the end.

---

## Pass 1 — Information Architecture

**Initial: 7/10 → After fixes: 9/10**

The 3-phase status-adaptive home is structurally sound. Hierarchy reads correctly under the 3-second scan test. Gaps are concrete and bounded.

### IA-1 — Phase 2 missing interview date/time **[approved: Inline appointment block + plumb data]**

When `status == .interviewScheduled`, the "What county is doing" body says "A caseworker will call at the scheduled time" but the time itself is nowhere on screen. The #1 question a user has at this moment is unanswered.

**Decision:** Add an inline appointment card above the timeline when status = .interviewScheduled. Plumb a `nextAppointment: Date?` (and optional channel hint: phone, in-person, video) into `SNAPApplicationStatusStore`. The slot renders something like:

```
Interview · Wed Jun 12 · 2:30 PM
3 days away  ·  By phone  ·  Add to Calendar →
```

Render under amber-surface (process-attention) when within 48h, neutral surface otherwise. Stake: a missed interview is a denied case. ([Civica/App/CivicaHomePhase2View.swift:281-293](Civica/App/CivicaHomePhase2View.swift:281))

### IA-2 — Error-risk row priority inversion

Today Phase 2 renders: primary CTA → error-risk row (warning-amber surface) → documents-requested row → messages row. Documents-requested is concretely actionable; error-risk is a probabilistic prediction.

**Recommendation:** Swap to: primary CTA → documents-requested (if `> 0`) → error-risk (if `shouldSurface`) → messages. Documents-requested earns the higher visual position because it's actionable and finite ("upload 2 documents"); error-risk earns the warning surface but should not outrank concrete pending work. ([Civica/App/CivicaHomePhase2View.swift:137-149](Civica/App/CivicaHomePhase2View.swift:137))

### IA-3 — Phase 3 duplicate EBT entry

Hero balance card taps into `EBTBalanceRootView`. Secondary row "EBT activity → Recent transactions" taps into the same view. Two entry points, one destination.

**Recommendation:** Remove the EBT-activity secondary row from Phase 3. Replace with a "EBT card services" row that routes to `EBTCardLockView` (lock/freeze, report lost, change PIN) — a real distinct destination that isn't reachable from the hero card today. ([Civica/App/CivicaHomePhase3View.swift:239-271](Civica/App/CivicaHomePhase3View.swift:239))

### IA-4 — Settings discoverability **[approved: Gear icon in nav bar]**

Settings is reachable only via the EBT dashboard context menu. Users without a linked card cannot reach language, notification prefs, or AI transparency — including anyone whose first language isn't English and didn't catch the picker in onboarding.

**Decision:** Add a settings gear to the top-right of `CivicaRootView`'s `NavigationStack` toolbar, present in all 3 phases. Opens a sheet (`SNAPSettingsSheet`) with:

- Language (calls back to `LanguagePickerScreen` UI)
- Notifications (push, SMS opt-in/out)
- AI transparency (CivicaPrivacy fold + "What Civica uses AI for")
- Sign out (if authenticated)
- About + version + open-source notices

Standard iOS pattern; discoverable on every screen. Removes EBT-gating entirely.

### IA-5 — Denial view: 1 of 4 next-step cards is tappable **[approved: Make all 4 tappable + gate Appeal on appealability]**

Appeal, Review, Food Help, Reapply share visual rhythm; only Food Help is a `NavigationLink`. Static cards look tappable but aren't. Breaks Krug's "obviously clickable" rule at the highest-stakes emotional moment in the app.

**Decision:**
1. Wire all 4 cards to real destinations: Appeal → `SNAPAppealLetterView`, Review → new `SNAPApplicationPacketReviewView` (read-only view of the submitted packet), Food Help → `FindHelpRootView` (already wired), Reapply → reset draft + back to `CivicaEntryView` with confirm dialog.
2. **Correctness companion:** Gate the Appeal primary-button assignment on actual appealability. Not all denials are appealable (time window closed, certain category denials). Add a `denialReason → isAppealable` mapping; if false, demote Appeal to a static card and promote "Speak with a navigator" (already wired via `onOpenExternalPortal`) to primary.

### IA-6 — Returning user verdict card silently omitted (cont.)

`SNAPReturningUserHomeView` line 27 gates the verdict card on `statusStore.eligibilityResult` being non-nil. If nil (e.g., the user finished the screener but the result wasn't persisted across a crash or version upgrade), the card renders nothing — no fallback, no "couldn't load," no recovery action.

**Recommendation:** When `eligibilityResult` is nil, render a quiet fallback card:

```
We couldn't pull up your screener result.
→ Re-run the screener  (2 min)   ·   → Skip and continue applying
```

Logs the gap so we know how often it fires. ([Civica/Features/SNAP/Application/SNAPReturningUserHomeView.swift:27](Civica/Features/SNAP/Application/SNAPReturningUserHomeView.swift:27))

---

## Pass 2 — Interaction State Coverage

**Initial: 6/10 → After fixes: 8/10**

The skeleton-loaders + redaction effects in the EBT dashboard are best-in-class for this app. But three silent-failure surfaces (EBT refresh, Phase 2/3 stores, draft load) and one cold-tone moment (ineligibility verdict) are pulling the rating down.

### IS-1 — EBT refresh silent failure **[approved: Inline error banner + stale timestamp]**

`refreshable { await store.refresh() }` swallows errors. No spinner timeout, no banner, no update — user can't distinguish success from failure.

**Decision:** On refresh failure, show a dismissible amber-warning banner at the top of the dashboard ("Couldn't update. Showing balance as of 2:30 PM."). Bold the "Updated" timestamp on the hero card to draw the eye to its actual age. Refresh tap remains available. Aligns with Principle 1.3 (honesty about uncertainty); doesn't block in-checkout use of a stale-but-recent balance. ([EBTBalanceDashboardView.swift:100-108](Civica/Features/SNAP/EBTBalance/EBTBalanceDashboardView.swift:100))

### IS-2 — Phase 2/3 silent-fail-per-store **[approved: Quiet sync banner on connectivity errors]**

Today: if a store errors, its row hides. User can't tell "no docs requested" from "we couldn't reach the gateway."

**Decision:** Add a single dismissible "We're having trouble syncing right now" banner at the top of Phase 2/3 when 2+ stores fail in a row OR `NWPathMonitor` reports no path. Per-row hiding stays — only the coordinated/network case surfaces. Banner copy says nothing about *which* data is stale, just that sync is currently degraded. ([CivicaHomePhase2View.swift:184-195](Civica/App/CivicaHomePhase2View.swift:184))

### IS-3 — Conversation error banner is non-dismissible

Red banner stays on screen until user taps Retry. No "continue another way" affordance.

**Recommendation:** Make the banner dismissible (swipe-to-dismiss or X), add a secondary text-link "Get help by phone" → `tel://` deeplink to the Civica navigator line, persist the dismissal for the rest of the session. ([SNAPConversationView.swift:200-227](Civica/Features/SNAP/Conversation/SNAPConversationView.swift:200))

### IS-4 / IS-5 — Ineligibility door slam **[approved: Warm-but-honest verdict + 3 next-step rows]**

Estimator and Conversation both render ineligibility as red destructive card with no warm next-step.

**Decision:** Replace the red verdict card with an amber-warning surface:

```
─────────────────────────────────────────
You may not qualify today — but
situations change, and there are a
few things worth trying.

Based on what you told us. The county
makes the final decision.
─────────────────────────────────────────
→ Apply anyway — the county may approve
→ Find food while you sort this out
→ Talk to a navigator about your situation
```

The verdict text is honest ("may not qualify today") not absolute ("doesn't qualify"). Three next-step rows give the user explicit forward motion. Wired to: (1) `CivicaSNAPFlowView`, (2) `FindHelpRootView`, (3) `onOpenExternalPortal`.

Reuse the same component on `SNAPBenefitEstimatorView` and `SNAPConversationView` (extract `SNAPSoftIneligibilityCard`). Aligns with Principles 1.3 (honesty about uncertainty) and 1.4 (progressive disclosure — "see the math" stays available).

### IS-6 — EBT next-deposit formatted with no cents

`String(format: "$%.0f", amount)` strips cents. Hero balance shows dollars+cents.

**Recommendation:** Change next-deposit format to `String(format: "$%.2f", amount)` to match. ([CivicaHomePhase3View.swift:169](Civica/App/CivicaHomePhase3View.swift:169))

### IS-7 — TODO-wiring rows defaulting to hidden **[approved: Hide entirely until backend ships]**

Phase 2/3 messages-inbox row code exists but defaults to `unreadMessageCount = 0` → never renders.

**Decision:** Keep the current behavior. The design exists in the code for when the backend ships; the user never sees a fake row. Add a code-level marker (`// MARK: - HIDDEN UNTIL BACKEND`) on each such block and a `docs/runbooks/wiring-todo.md` ledger so we don't forget. ([CivicaHomePhase2View.swift:82-88](Civica/App/CivicaHomePhase2View.swift:82))

### IS-8 — First-paint flicker on Phase 2/3

`.task` fetches after first render; conditional-row band is blank for 200-800ms.

**Recommendation:** Add a subtle skeleton placeholder for the conditional-row band (3 shimmered hairline rows, 56pt height each, animated like the EBT dashboard's existing skeleton pattern). Only render while the parallel `.task` is in flight. Reuses an existing pattern in the codebase. Cost: ~2h human.

### IS-9 — Draft load silently returns nil on schema mismatch (cont.)

`SNAPApplicationDraftStore().load()` is called from multiple views. If schema changed (e.g., post-upgrade), `load()` may fail and return nil. Views read this as "no draft" — so the Resume CTA flips to "Start," user thinks they lost their progress.

**Recommendation:** Wrap `load()` in a `Result<Draft, DraftLoadError>` and surface an explicit banner on `CivicaEntryView` when load failed: "Couldn't read your saved progress. Resume anyway, or start fresh." Two CTAs. Log the failure version so eng can diagnose. ([Civica/Features/SNAP/Application/SNAPApplicationDraftStore.swift](Civica/Features/SNAP/Application/SNAPApplicationDraftStore.swift) — verify path)

---

## Pass 3 — User Journey + Emotional Arc

**Initial: 7/10 → After fixes: 9/10**

Onboarding's emotional arc is excellent (warm/transparent/non-coercive). Denial is honest. EBT's "Will it last?" projection is humane. The wins are real. The losses cluster around two long stretches with no design attention: the pending wait (days 5-30) and the recert window. Plus a missing dignity moment at approval.

### JR-1 — Pending wait opacity **[approved: "What I can do today" interactive checklist]**

**Decision:** Add a dismissible checklist card to Phase 2 below the timeline. 3-5 items the user can do *while they wait* to improve their odds:

```
While the county reviews — things you can do today
☐ Gather a backup pay stub (PDF or photo)
☐ Save your county number to your phone
☐ Look up your case's expected timeline
☐ Set a reminder for day 30 to follow up
☐ Save the BenefitsCal login on your phone
```

Items are status-aware (some items don't appear after `.documentsRequested`; new ones appear after `.interviewScheduled` like "Test your phone audio"). Persisted per status — once checked, stays checked across foreground/background. Gives users agency during a stretch where they have none today. Matches Principle 1.4 (progressive disclosure) and Krug's "muddle through" insight (give users something concrete to do).

**Caution:** keep the checklist UNDER 5 items and never use urgency framing. Title is "things you can do today," not "things you must do."

### JR-2 — Document request feels punitive

**Recommendation:** Reframe the document-request row copy to normalize the request:

```
[icon] 2 documents requested
       Most cases get at least one. Upload to keep moving →
```

Subtle but reduces the "my application is failing" anxiety spike. ([CivicaHomePhase2View.swift:141-149](Civica/App/CivicaHomePhase2View.swift:141))

### JR-3 — Interview moment underweights confidence (verify Interview Coach surfacing)

The primary CTA "Prepare for your interview" should route to a confidence-building screen, not just the external portal. Per the Explore agent, Interview Coach exists at `Civica/Features/SNAP/InterviewCoach/`.

**Recommendation:**
1. Verify that the `.interviewScheduled` primary CTA on Phase 2 actually navigates to `SNAPInterviewCoachView` (not just to the external portal). Engineering check — fix routing if it doesn't.
2. On the InterviewCoach screen, lead with reassurance: "Interviews usually take 15-20 minutes. You're allowed to have notes. Here's exactly what they'll ask."
3. Surface the most common rejections (e.g., "Don't worry if you don't have every doc — caseworkers can ask follow-ups.") in plain-text.

### JR-4 — Approval = no celebration **[approved: Persistent approval banner until card linked]**

**Decision:** Add an approval banner that appears the moment `status == .decisionApproved && account == nil` and persists until the EBT card is linked (then auto-dismisses, never returns). Banner copy:

```
─────────────────────────────────────────
✓  You're approved for CalFresh
   Your EBT card will arrive in 3-7 days
   When it does, link it here to see your balance.
─────────────────────────────────────────
       What this means for you →
       Find help while you wait →
```

Render above the existing "Your card is on the way" card (don't replace it — it has different role). Use pine-surface (not amber-surface, which is reserved for warnings). Dignified, not celebratory. Reinforces the win during the unlinked-card window. Matches Principle 1.1 (government-grade trust first — quiet confidence, not consumer-app fireworks). ([CivicaHomePhase3View.swift:128-157](Civica/App/CivicaHomePhase3View.swift:128))

### JR-5 — Recert reminder underweights reassurance **[approved: Lead with continuity, not deadline]**

**Decision:** Flip the banner copy hierarchy:

```
RECERTIFICATION
Renew your CalFresh — we'll pre-fill what we have
Due Jun 18 · 12 days                    Start →
```

The deadline drops to the metadata line. The headline reassures and previews the lighter lift. Amber-surface stays. Independent of `RecertCompanionFeatureFlag`. ([CivicaHomePhase3View.swift:200-219](Civica/App/CivicaHomePhase3View.swift:200))

### JR-6 — Returning user primary CTA not anchored

**Recommendation:** When `SNAPReturningUserHomeView` renders, add a small secondary line under the primary button that previews the destination:

```
Continue your application →
Step 5 of 9 · Income & expenses
```

Removes the "where will this take me" cognitive cost. Mirrors the eyebrow-pattern already used in secondary rows.

### JR-7 — Mid-journey language switch

**Recommendation:** One line in the language picker (and in any in-app settings sheet): "You can switch anytime. We won't translate answers you've already typed." Sets expectation without breaking flow.

### JR-8 — RecertCompanion flag rollout posture (cont.)

**Recommendation (process, not UX):** Document the pilot rollout cadence in `docs/runbooks/recert-companion-rollout.md`. Two users having materially different denial + recert journeys is fine for a pilot but the rollout sequence needs to be intentional and reversible. Specifically: cohort definition (state? case age?), success metric (recert completion rate? appeal initiation rate?), abort criteria (what flips the flag back off).

---

## Pass 4 — AI Slop Risk

**Initial: 9/10 → After fixes: 9.5/10**

Classification: APP UI. The May 2026 design review explicitly killed the textbook AI-slop patterns — the cold-start home is no longer a 3-column tile grid, copy is utility-language, type stack is Hanken Grotesk (not system-ui), and the semantic color palette has real CSS-variable equivalent. The remaining risk isn't current — it's preventing regression as new features ship.

### AS-1 — Icon-in-tinted-circle creep risk

Phase 3 recert banner uses `Image("clock.arrow.circlepath")` over `Circle.fill(amberPrimary.opacity(0.16))`. One-off, defensible. But four of these on one screen would be textbook AI-slop blacklist #3.

**Recommendation:** Add to DESIGN.md (new §12 or extend §5) — *"Icon-in-tinted-circle pattern is allowed at most once per screen, and only as a banner/state eyebrow — never as section decoration or repeating tile-row affordance."* Same posture as the May 2026 tile-grid rule. ([CivicaHomePhase3View.swift:191-199](Civica/App/CivicaHomePhase3View.swift:191))

### AS-2 — Triple-tap warning signal on Phase 2 error-risk row

Today the error-risk row layers FIVE concurrent warning signals: warning-amber background, 3pt warning-amber left-border, amber stroke outline, warning-amber icon, and amber chevron. ([CivicaHomePhase2View.swift:332-370](Civica/App/CivicaHomePhase2View.swift:332))

**Recommendation:** Simplify to two signals — `statusWarningSurface` background + `warningAmber` icon. Drop:
- the `Rectangle.fill(warningAmber).frame(width: 3)` left-border overlay,
- the `Rectangle.stroke(warningAmber.opacity(0.22))` outline,
- and reduce the chevron color to neutral `graphite`.

The surface + icon already communicate "this is a warning." Removes the colored-left-border pattern (AI-slop blacklist #8) and reduces visual noise.

### AS-3 — Hero copy + trust posture (no action) (cont.)

"Apply for SNAP / Save anytime, no commitment to submit" — concrete, brand-aware, no generic AI phrasing. ✓ Strong. Preserve as the bar for any new entry-point copy.

---

## Pass 5 — Design System Alignment

**Initial: 8/10 → After fixes: 9/10**

DESIGN.md is mature and largely respected by the code. Drift is contained to a few documented edges + one bypass.

### DS-1 — `amberPrimary` on Phase 3 recert banner **[approved: Switch to warningAmber + statusWarningSurface]**

**Decision:** Replace the 6 amberPrimary uses on the recert banner with `warningAmber`, and amberSurface with `statusWarningSurface`. Recert is a "pay attention / will expire" moment per DESIGN.md §2.2 — the warning semantic fits cleanly and reserves amberPrimary for actual positive outcomes (eligible verdicts, deposits). Reusable: other process-expiry surfaces (cert period ending, doc deadlines) inherit the same color story.

### DS-2 — Duplicate typography tokens still active

Grep shows 9 active references to `cardSubtitle`, `subheadBold`. DESIGN.md §3.3 marked them as aliases to be deprecated.

**Recommendation:** One-PR codemod. Replace `cardSubtitle` → `cardTitle`, `subheadBold` → `subheadStrong`, `sectionHeaderBold` → `sectionHeader`. Then in `CivicaDesignSystem/Sources/CivicaTypography.swift`, attribute the deprecated names with `@available(*, deprecated, renamed: "cardTitle")` so the next person who reaches for them gets compiler nudged.

### DS-3 — Missing 24pt display token

DESIGN.md §3.2 acknowledges this gap. EBT balance hero (line 223 of `EBTBalanceDashboardView`) uses `pageTitle` (28pt) for the balance amount; estimator result also uses pageTitle.

**Recommendation:** Add `display` token to CivicaTypography (24pt SemiBold). Migrate EBT balance hero + estimator result + benefit-amount displays to it. Reserves `pageTitle` for screen titles only. ~2h human, ~30 min CC.

### DS-4 — `pineSurface` on unlinked-card placeholder

DESIGN.md §2.1: pineSurface = "Success-adjacent fill (enrolled, submitted)." Approved user with no card linked yet IS approved. Acceptable.

**Recommendation:** No change. Document as a sanctioned use in the §8 surface system.

### DS-5 — `pinePrimary` on Phase 1 hero card

DESIGN.md §2.2: "Pine = CTAs only. Must not appear on icons, decorative elements, or status indicators." The Phase 1 hero is a NavigationLink — semantically a CTA — but visually it's a hero surface, not a button.

**Recommendation:** Defensible — the entire hero card IS the CTA tap target (44pt+ × full-width). Document in DESIGN.md §2.2 as an explicit sanctioned use: *"`pinePrimary` may be used as a card background ONLY when the card is itself the primary tap target (a NavigationLink-wrapped hero)."* This codifies the current intent and prevents the pattern from being copied to non-CTA hero cards. ([CivicaEntryView.swift:148-150](Civica/App/CivicaEntryView.swift:148))

### DS-6 — `wheatPrimary` contrast foot-gun unresolved

DESIGN.md C1 (Critical) recommended `@available(*, unavailable, message: "Never use as text foreground — contrast 2.1:1")` shim. Not shipped.

**Recommendation:** Ship the shim. ~30 min. Add a SwiftLint rule (`disallowed_call: CivicaColors.wheatPrimary` with allow-list for the 4 known-safe call sites) as a defense-in-depth backup.

### DS-7 — `FindHelpPinPalette` hex-literal bypass **[approved: Promote to CivicaColors as semantic map tokens]** (cont.)

**Decision:** Move all 8 pin colors into CivicaColors as a new `Map Pin` token section:

```
pinFood, pinHelp, pinHelpFood (already mapped to brick),
pinSupermarket, pinSmallGrocer, pinFarmersMarket, pinCoop, pinRestaurant
```

Each token gets light + dark variants and a contrast check against the chosen mapbox basemap tile. Delete `FindHelpPinPalette` struct; pin views reference `CivicaColors.pinX` directly. Add a §13 to DESIGN.md (Map Pin tokens) documenting the cartography rationale (category-specific palettes are intentional, not slop).

---

## Pass 6 — Responsive + Accessibility

**Initial: 6/10 → After fixes: 8/10** (with the three approved workstreams landing)

The DESIGN.md acknowledges most gaps (§9, §11). The audit confirms severity:
- Dynamic Type effectively unsupported (54 of 310 files use `.font(.system(size:N))` fixed-size bypass; 4 files reference any Dynamic Type API).
- Dark mode forced off via `CivicaRootView:74`.
- Universal app shipping to iPad with no iPad-specific design.
- Reduce Motion respected in 8/310 files (2.6%).

### RA-1 — Dynamic Type **[approved: Phased migration]**

**Decision (3-step):**

1. **Step 1 (~2 days, this sprint):** Migrate `CivicaTypography` tokens to use SwiftUI scaling fonts. Switch from `.system(size: 17, weight: .regular)` → `.body` (or a custom `UIFont.preferredFont(forTextStyle: .body)` with Hanken Grotesk descriptor). Tokens scale automatically wherever they're used.
2. **Step 2 (~1 week, next sprint):** Audit the 54 `.font(.system(size:N))` callers. Replace fixed-size SF Symbol fonts with `.imageScale(.large)` + `.font(.body)` so symbols scale alongside text. Replace fixed-size system fonts with the closest CivicaTypography token.
3. **Step 3 (~3 days):** Layout pass at `xxxLarge`. Fix overflow with `.fixedSize(horizontal: false, vertical: true)`, `.minimumScaleFactor(0.9)` on hero numerals, and `.lineLimit(nil)` where needed. Test 10 representative screens: entry, Phase 2/3, estimator result, conversation, denial, EBT dashboard, EBT link card, onboarding.

Cap `.dynamicTypeSize(...DynamicTypeSize.accessibility3)` (one step below maximum) at the root to bound layout work without disenfranchising the users who most need scaling.

### RA-2 — Dark mode **[approved: Opt-in Settings toggle]**

**Decision:**
1. Add an "Appearance" row to the Settings sheet (the gear-icon sheet from IA-4). Options: System / Light / Dark. Default: Light (preserves current behavior for everyone who doesn't visit Settings).
2. Replace `CivicaRootView:74`'s hardcoded `.preferredColorScheme(.light)` with a binding to `@AppStorage("co.civica.appearance")`.
3. Dark-mode audit before exposing in Settings: walk EBT hero, recert banner, error-risk row, denial view, estimator result, onboarding, conversation in dark mode. Confirm:
   - `accentTeal` dark = 4.6:1 on `#1B1F24` (just AA — borderline, may need bump to `#6FB5A8`)
   - `wheatPrimary` never appears as text in dark
   - `warningAmber` dark variant passes AA at body size
   - Hairline tokens have enough opacity in dark to remain visible
4. Beta-test with a 2-week opt-in cohort before promoting Dark to default-eligible.

### RA-3 — iPad **[approved: Full iPad redesign with NavigationSplitView + sidebar]**

**Decision — multi-sprint workstream:**

This is the largest workstream in the audit. Scope:

1. **Architecture (~3 days):** Replace `CivicaRootView`'s `NavigationStack` with a sizeclass-adaptive shell: `NavigationSplitView` on `.regular` width (iPad portrait + landscape, iPhone 17 Pro Max landscape), `NavigationStack` on `.compact`.
2. **Sidebar design (~1 week):** Permanent sidebar with persistent entry points: Apply / Your status / EBT balance / Find help / Recert / Settings. Status-aware highlight (e.g., bold the row for the current Phase).
3. **Detail-pane phases (~1 week):** Each Phase view becomes a detail-pane component. Reading-column cap (`.frame(maxWidth: 720)`) inside the detail pane prevents over-stretch.
4. **Adaptive sheet patterns (~3 days):** EBT link card, denial appeal, recert companion — currently full-screen — adopt `.sheet(presentation: .formSheet)` on iPad.
5. **Onboarding (~2 days):** 5-screen flow stays single-pane on iPad (it's a wizard) but center-caps at 600pt with side margins.
6. **QA + a11y on iPad (~1 week):** Touch targets re-verify (iPad has slightly larger expected hits ~50pt), keyboard shortcuts (Apple recommends ⌘N for new, ⌘F for find help), Pencil/Trackpad compatibility.

Total: **~3-4 weeks human / ~10h CC** of pair work. Worth scoping as its own milestone (`docs/plans/ios-ipad-design-2026-Q3.md`) before committing.

### RA-4 — ReduceMotion respect

8 of 310 files reference `accessibilityReduceMotion`. DESIGN.md §7.3 documents the pattern but most animations don't apply it.

**Recommendation:** Add a `civicaAnimation(_:value:)` view modifier in `CivicaDesignSystem` that wraps `withAnimation(reduceMotion ? nil : animation, value:)`. Codemod all 60+ existing `.withAnimation(CivicaAnimation.foo) { … }` callsites to use the modifier. ReduceMotion becomes a one-line concern, not a per-callsite vigilance task. ~3 days human / ~1.5h CC.

### RA-5 — VoiceOver coverage at 77%

19 of 83 `*View.swift` files have zero `accessibilityLabel`. Some are pure container views (acceptable); others are real screens.

**Recommendation:** Run an audit pass on the 19 zero-coverage files. Where they're container-only (no user-facing affordances), document with a `// MARK: - AccessibilityElement = parent` comment. Where they have any tappable element, fail the audit and add labels. ~1 day human.

### RA-6 — `warningAmber` borderline at footnote

DESIGN.md H4: 4.6:1 at body, fails below 17pt.

**Recommendation:** Either (a) bump `warningAmber` to `#9E4218` for a wider margin (DESIGN.md H4 explicitly suggests this), or (b) add a `CivicaColors.warningAmberSmall = #9E4218` paired token and a SwiftLint rule that flags `warningAmber` at fonts below 17pt. (a) is cleaner. ~1h human.

### RA-7 — `wheatPrimary` foot-gun (cont.)

Cross-ref DS-6. Ship the `@available(*, unavailable)` shim + SwiftLint guard.

---

## Pass 7 — Unresolved Design Decisions

### UD-1 — Sequencing **[approved: One audit-implementation PR per pass]**

**Decision:** 7 PRs, one per audit pass, landing all findings from that pass together. Suggested order (cost-weighted):

1. **PR-1 (Pass 4, AI Slop):** AS-1 DESIGN.md guard + AS-2 warning-row cleanup. ~half day.
2. **PR-2 (Pass 5, Design System):** DS-1 amber→warning recert, DS-2 typography codemod, DS-3 add display token, DS-5 DESIGN.md sanction, DS-6 wheatPrimary shim, DS-7 promote map pin palette. ~2-3 days.
3. **PR-3 (Pass 1, IA):** IA-1 interview appointment block, IA-2 row reorder, IA-3 EBT row swap, IA-4 settings sheet, IA-5 denial card wiring + appealability gate, IA-6 returning-user fallback card. ~1 week.
4. **PR-4 (Pass 2, States):** IS-1 EBT error banner, IS-2 sync banner, IS-3 conversation retry dismissibility, IS-4/5 soft-ineligibility component, IS-6 cents fix, IS-8 first-paint skeleton, IS-9 draft load fallback. ~1 week.
5. **PR-5 (Pass 3, Journey):** JR-1 checklist (UD-2 must close first), JR-2 doc-request reframe, JR-3 interview coach verify, JR-4 approval banner, JR-5 recert continuity copy, JR-6 returning CTA preview, JR-7 language one-liner. ~1-2 weeks.
6. **PR-6 (Pass 6 part 1):** RA-1 Dynamic Type phase 1 (tokens scale), RA-4 ReduceMotion modifier codemod, RA-5 VoiceOver fill-in, RA-6 warningAmber bump, RA-7 wheatPrimary shim. ~1 week.
7. **PR-7 (Pass 6 part 2 — major):** RA-2 dark mode opt-in + audit, RA-3 iPad NavigationSplitView. ~3-4 weeks. Plan separately at `docs/plans/ios-ipad-design-2026-Q3.md`.

Total ~7-10 weeks of work. PR-1 and PR-2 should land in the next 1-2 weeks.

### UD-2 — "What I can do today" content authorship

**Recommendation:** SME-validated. Civica has a CBO partner orbit per memory (VoteNow CBO partnership, Dave Guarino reference, USDA advanced automation guidance). Draft 5 items per status — `.submittedToState` / `.documentsRequested` / `.interviewScheduled` / `.interviewCompleted` — then ship past a CBO advisor for review before merging. PR-5 blocks on this content. ~1 week elapsed time, ~3 hours engagement.

### UD-3 — Soft-ineligibility component **[approved: Single SNAPSoftIneligibilityCard component]**

**Decision:** Extract one SwiftUI view to `Civica/Features/SNAP/Components/SNAPSoftIneligibilityCard.swift`. API:

```swift
struct SNAPSoftIneligibilityCard: View {
  let verdictReason: CivicaText  // estimator: "Your income + household size…"
                                 // conversation: "Based on what you told us…"
  let language: CivicaLanguage
  let onApplyAnyway: () -> Void
  let onFindHelp: () -> Void
  let onOpenStatePortal: () -> Void  // renamed from onTalkNavigator per UD-6
}
```

Strings live in `SNAPSoftIneligibilityStrings`. Estimator and Conversation each instantiate with their reason text. Single source of truth for the highest-emotion moment.

### UD-4 — Settings sheet scope

**Recommendation:** First-PR scope = appearance toggle (RA-2) + language picker callout + notification prefs + AI transparency (existing view) + sign-out + version/about. Defer: privacy settings, data export, accessibility shortcuts. Document the scope cap in the PR description to prevent scope creep.

### UD-5 — RecertCompanion default-on?

**Recommendation:** Keep gated for the next 90 days. Define the pilot end criteria in `docs/runbooks/recert-companion-rollout.md`:
- Pilot cohort: California users only (Launch state = CA per memory).
- Success metric: recert completion rate ≥ 85% AND appeal initiation rate vs. control no worse than -10%.
- Decision date: 2026-08-29 (90 days from audit).
- Default-on rollout: phased 25% → 50% → 100% across 2 weeks if success metrics met.

The JR-5 recert continuity copy ships in both paths regardless.

### UD-6 — Navigator handoff **[approved: Rename to "Open the state portal" + plan real wire-up later]**

**Decision (short-term, this audit):** Re-copy the row + soft-ineligibility CTA:

```
Phase 2 row eyebrow: "Have a question?"
Phase 2 row link:    "Open the state portal"   (was "Message a navigator")

Soft-ineligibility option 3: "Open the state portal for help"   (was "Talk to a navigator about your situation")
```

Honest about the destination today (Principle 10.4). Track real-navigator wire-up via `enrollment-api/navigator` (memory indicates this exists) as a Q3 plan at `docs/plans/real-navigator-handoff-2026-Q3.md`.

### UD-7 — Approval banner persistence schema

**Recommendation:** Persist `co.civica.approvalAcknowledged.{caseId}` in `@AppStorage` (per-case, so a re-apply gets a fresh banner moment). The banner reads:
- Show IF `status == .decisionApproved AND ebtAccount == nil AND approvalAcknowledged == false`
- "Dismiss" tap (any of: tap outside, swipe, close button) → set `approvalAcknowledged = true`
- Linking the EBT card also sets `approvalAcknowledged = true`

Add a `CASE_SCOPED_FLAGS_RESET_ON_REAPPLY` constant + helper that wipes per-case flags when status returns to `.notStarted`. Prevents stale acknowledgments from leaking across re-applications.

### UD-8 — CivicaDesignSystem changes affect WeVote target

**Recommendation:** WeVote target is `voting`, not `benefits` — different content but same SPM package. Coordinate with the WeVote owner:
- Dynamic Type migration (RA-1): WeVote benefits identically. Run together.
- Dark mode (RA-2): WeVote may want dark-default (consumer voting tools usually do). Add `appearance` to a target-aware default, not a package-level lock.
- iPad (RA-3): VoteNow may have its own iPad layout needs; coordinate the NavigationSplitView shell as a shared component.

File `docs/plans/civicadesignsystem-evolution-2026-Q3.md` co-owned by both teams.

---

## What already exists (leverage, don't rebuild)

Strong foundations to reuse, not duplicate:

- **DESIGN.md** — semantic palette, 4pt grid, type scale, accessibility contracts, known-issue registry. Source of truth.
- **CivicaDesignSystem SPM package** — `CivicaColors`, `CivicaTypography`, `CivicaSpacing`, `CivicaRadius`, `CivicaAnimation`. All tokens. Don't reach for hex literals (see DS-7).
- **`CivicaText(en:, es:)`** + parity unit tests — bilingual layer. Every new string uses this.
- **`SNAPApplicationStatusStore`** — single source of status truth. Extend (add `nextAppointment`) rather than parallel-track.
- **`CivicaPhaseTab`** + locked / DEBUG variants — phase-journey indicator. Reuse across all home screens.
- **`CivicaActionRow`** — row pattern with eyebrow + link + chevron. Use for every secondary nav row.
- **`CivicaPhaseTimeline`** — already wired with milestones. Reuse for any future progress visualization.
- **`EBTBalanceStore` skeleton/redaction pattern** — best-in-class loading UX. Reuse for IS-8 first-paint skeleton.
- **`SNAPRecoveryView`** — already exists for distress moments. Reuse before building new "recovery"-class screens.
- **Onboarding 5-screen flow** — language → value-prop → how-it-works → consent → phone. Don't redesign; it's working.
- **`RecertCompanionRoot` + Phantom Recert + Expiration Calendar + Just-in-Time Reminders + Procedural Appeal** — already built behind `RecertCompanionFeatureFlag`. Roll out via UD-5 process, don't rebuild.
- **`SNAPInterviewCoachView`** (verify per JR-3) — interview prep surface exists. Verify wiring, don't rebuild.
- **`FindHelpRootView` + `EBTBalanceRootView` + `SNAPDataPrivacyView`** — already wired and shipped. Reuse from any new soft-ineligibility / approval-banner / settings surface.

## NOT in scope (deferred with rationale)

- **Voice mode UX.** Experimental, behind a flag. Audit it when it leaves experimental.
- **EBT card services deep flows** (lock/freeze, replace card). The IA-3 fix adds a row pointing to `EBTCardLockView`; audit the destination separately.
- **Marketplace / job-matching feature.** Memory notes a new `SNAPMarketplace*` family in development. Audit after that ships.
- **PhantomRecert detail screens.** Behind `RecertCompanionFeatureFlag`. Audit when default-on per UD-5.
- **`SNAPDecisionApprovedView`** legacy — preserved unreferenced for rollback. No fixes needed.
- **`SNAPWaitingRoomView`** legacy — preserved unreferenced for rollback.
- **InformalHousing screener.** Acceptable as-is for CA launch; audit on next state expansion.
- **VoteNow target.** Same SPM package; UD-8 calls out coordination. Voting flows themselves out of scope.
- **Native push notification copy.** Push category framework exists (memory: `docs/plans/ebt-tracker-propel-parity.md` §16.5); copy audit is a separate pass.
- **Web dashboard (`apps/dashboard/`).** Already had its own design review (memory: dashboard-design-review-may2026).
- **BenefitsCal bridge extension (current branch work).** The bridge fills a state portal, not a Civica surface. Different design system.

---

## Implementation Tasks

Synthesized from the audit's findings. Each task derives from a specific finding. Run with Claude Code or Codex; check off as you ship.

- [ ] **T1 (P1, human: ~half day / CC: ~1h)** — Pass 4 cleanup PR — AS-1 DESIGN.md icon-in-tinted-circle rule, AS-2 simplify error-risk row to 2 warning signals
  - Surfaced by: Pass 4 — AS-1, AS-2
  - Files: `DESIGN.md`, `Civica/App/CivicaHomePhase2View.swift:332-370`
  - Verify: visual regression on Phase 2 with error-risk override; lint passes
- [ ] **T2 (P1, human: ~3 days / CC: ~2h)** — Pass 5 design system PR — DS-1 amber→warning recert, DS-2 typography codemod, DS-3 add display token, DS-5 sanction in DESIGN.md, DS-6 wheatPrimary shim, DS-7 promote map pin palette
  - Surfaced by: Pass 5 (DS-1 through DS-7)
  - Files: `CivicaDesignSystem/Sources/CivicaColors.swift`, `CivicaTypography.swift`, `Civica/App/CivicaHomePhase3View.swift`, `Civica/Features/SNAP/FindHelp/FindHelpPinPalette.swift`, all `*View.swift` referencing deprecated typography aliases, `DESIGN.md`
  - Verify: lint passes; visual regression on EBT hero, recert banner, FindHelp map
- [ ] **T3 (P1, human: ~1 week / CC: ~4h)** — Pass 1 IA PR — IA-1 inline appointment block, IA-2 row reorder, IA-3 EBT row swap, IA-4 settings sheet + gear icon, IA-5 wire all 4 denial cards + appealability gate, IA-6 returning-user fallback card
  - Surfaced by: Pass 1 — IA-1 through IA-6
  - Files: `Civica/App/CivicaRootView.swift`, `CivicaHomePhase2View.swift`, `CivicaHomePhase3View.swift`, `Civica/Features/SNAP/Application/SNAPDecisionDeniedView.swift`, `SNAPReturningUserHomeView.swift`, new `Civica/Features/SNAP/Settings/SNAPSettingsSheet.swift`, `SNAPApplicationStatusStore.swift` (add `nextAppointment`)
  - Verify: UI tests on each route; new tests for nil-eligibilityResult fallback + appealability gate
- [ ] **T4 (P1, human: ~1 week / CC: ~4h)** — Pass 2 states PR — IS-1 EBT error banner, IS-2 sync banner Phase 2/3, IS-3 conversation retry dismissible + tel link, IS-4/5 extract SNAPSoftIneligibilityCard, IS-6 cents format fix, IS-8 first-paint skeleton on Phase 2/3, IS-9 draft load fallback banner
  - Surfaced by: Pass 2 — IS-1 through IS-9
  - Files: `EBTBalanceDashboardView.swift`, `CivicaHomePhase2View.swift`, `CivicaHomePhase3View.swift`, `SNAPConversationView.swift`, new `Civica/Features/SNAP/Components/SNAPSoftIneligibilityCard.swift`, `SNAPApplicationDraftStore.swift`, `CivicaEntryView.swift`
  - Verify: tests on each silent-fail path; visual regression on first-paint flicker
- [ ] **T5 (P2, human: ~1-2 weeks / CC: ~3h)** — Pass 3 journey PR — JR-1 "What I can do today" checklist (blocks on UD-2 content), JR-2 doc-request reframe, JR-3 verify Interview Coach routing, JR-4 approval banner + persistence schema, JR-5 recert continuity copy, JR-6 returning-user CTA preview, JR-7 language one-liner
  - Surfaced by: Pass 3 — JR-1 through JR-7
  - Files: `CivicaHomePhase2View.swift`, `CivicaHomePhase3View.swift`, `SNAPReturningUserHomeView.swift`, `Civica/Features/Onboarding/Screens/LanguagePickerScreen.swift`, new `Civica/Features/SNAP/Components/SNAPDailyChecklistCard.swift`, new `SNAPApprovalBannerCard.swift`
  - Verify: tests on banner persistence semantics, checklist persistence, status-aware checklist content
- [ ] **T6 (P1, human: ~1 week / CC: ~3h)** — Pass 6 part 1 a11y PR — RA-1 Dynamic Type tokens scale, RA-4 ReduceMotion `.civicaAnimation()` modifier + codemod, RA-5 VoiceOver fill-in, RA-6 warningAmber bump, RA-7 wheatPrimary shim
  - Surfaced by: Pass 6 — RA-1, RA-4, RA-5, RA-6, RA-7
  - Files: `CivicaDesignSystem/Sources/CivicaTypography.swift`, `CivicaAnimation.swift`, `CivicaColors.swift`, all 60+ `withAnimation` callsites, 19 zero-coverage `*View.swift` files
  - Verify: a11y inspector audit on 10 key screens at xxxLarge; ReduceMotion toggle test
- [ ] **T7 (P2, human: ~3-4 weeks / CC: ~10h)** — Pass 6 part 2 dark + iPad (BIGGEST WORKSTREAM, plan separately) — RA-2 dark mode opt-in + audit, RA-3 NavigationSplitView + sidebar
  - Surfaced by: Pass 6 — RA-2, RA-3
  - Files: `Civica/App/CivicaRootView.swift`, all home + detail views (sizeclass adaptation), all token files (dark contrast audit)
  - Verify: dark mode pass on every screen; iPad portrait + landscape pass; regression on iPhone SE through Pro Max
- [ ] **T8 (P3, human: ~1h / CC: ~15 min)** — Process: rename "Message a navigator" copy + soft-ineligibility option per UD-6
  - Surfaced by: Pass 7 — UD-6
  - Files: `CivicaPhase2Strings`, `SNAPSoftIneligibilityStrings`
  - Verify: bilingual parity tests
- [x] **T9 (P3, human: planning meeting / CC: 0)** — Process: write rollout runbook `docs/runbooks/recert-companion-rollout.md` per UD-5 — merged PR #382 2026-05-30
  - Surfaced by: Pass 7 — UD-5
- [ ] **T10 (P3, human: planning meeting / CC: 0)** — Process: scope plans for iPad + dark mode + real navigator handoff at `docs/plans/ios-ipad-design-2026-Q3.md`, `docs/plans/civicadesignsystem-evolution-2026-Q3.md`, `docs/plans/real-navigator-handoff-2026-Q3.md`
  - Surfaced by: Pass 7 — UD-1, UD-6, UD-8

P1 ships next sprint; P2 the sprint after; P3 are planning/process tasks.

---

## Completion Summary

```
  +====================================================================+
  |       CIVICA iOS PRODUCT AUDIT — COMPLETION SUMMARY                |
  +====================================================================+
  | System Audit         | DESIGN.md mature; 322 SwiftUI files; CA-only |
  | Step 0               | Initial 7.5/10; full 7-pass audit selected   |
  | Pass 1  (Info Arch)  | 7/10 → 9/10 — 6 findings, 3 approved forks   |
  | Pass 2  (States)     | 6/10 → 8/10 — 9 findings, 4 approved forks   |
  | Pass 3  (Journey)    | 7/10 → 9/10 — 8 findings, 3 approved forks   |
  | Pass 4  (AI Slop)    | 9/10 → 9.5/10 — 3 findings recorded          |
  | Pass 5  (Design Sys) | 8/10 → 9/10 — 7 findings, 2 approved forks   |
  | Pass 6  (Responsive) | 6/10 → 8/10 — 7 findings, 3 approved forks   |
  | Pass 7  (Decisions)  | 8 surfaced, 3 approved + 5 recommendations   |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (11 items)                           |
  | What already exists  | written (12 reusable surfaces)               |
  | TODOS.md updates     | proposed (T8-T10 process tasks)              |
  | Approved Mockups     | 0 generated (audit of existing code)         |
  | Decisions made       | 18 fork decisions written into audit doc     |
  | Decisions deferred   | 0                                            |
  | Overall design score | 7.5/10 → 8.7/10 (projected after PR-1..7)    |
  +====================================================================+
```

All passes ≥ 8/10 after fixes ship except Pass 6 (8/10) — the iPad workstream is large enough that landing it in one milestone vs. two has a 0.5-point swing. Run `/design-review` against the implementation after PR-3 and PR-4 land to verify the soft-ineligibility + approval-banner moments feel right in the live app.

### Unresolved decisions

None — all 18 forks have a written decision.

### Approved Mockups

None generated. This is an audit of existing code with a mature design system already documented in DESIGN.md; mockup generation was skipped in favor of code-grounded findings and DESIGN.md references. If a specific finding's intent is unclear when PR work starts, generate a targeted mockup at that point with `$D generate`.

---

---

# Engineering Review (2026-05-29)

The audit-doc plan above was reviewed by `/plan-eng-review` after the design review locked. Step 0 scope challenge surfaced one fork (iPad SplitView vs. readable-width cap) — the user reaffirmed full SplitView. The eng review then walked Architecture, Code Quality, Test review, and Performance. Total: **20 findings → 12 forks decided → 5 new tasks (T11-T15)**.

## Section 1 — Architecture (eng review)

### ARCH-1 — `SNAPApplicationStatusStore` decomposition **[approved]**

The audit-doc plan was loading status + timestamps + appointment + caseId + appealability all onto one store. Decision: split into 3 collaborators before any PR ships.

```
┌───────────────────────────────────┐
│ SNAPApplicationStatusStore        │   status enum + per-status timestamps
│  - status: SNAPApplicationStatus  │   approvalAcknowledged: Bool (per ARCH-3)
│  - timestamps: [Status: Date]     │
│  - approvalAcknowledged: Bool     │
└──────────────┬────────────────────┘
               │ @Published nextAppointment
               ▼
┌───────────────────────────────────┐
│ SNAPNextAppointment value         │   (refined per CQ-3: value not store)
│  struct SNAPAppointment {         │
│    date: Date                     │
│    channel: Channel               │
│    location: String?              │
│  }                                │
└──────────────┬────────────────────┘
               │ fetched by
               ▼
┌───────────────────────────────────┐
│ SNAPAppointmentRepository         │   network + caching + refresh
│  - bind(client:)                  │   silent-fail per IS-2 posture
│  - load() async                   │
└───────────────────────────────────┘

┌───────────────────────────────────┐
│ AppealabilityService              │   pure service, no state
│  - evaluate(reason,state,date)    │   data source: packages/snap-rules
│    → Bool                         │   (per CQ-4)
└───────────────────────────────────┘
```

Matches the EBT pattern documented in CLAUDE.md ("per-concern Store + Repository").

### ARCH-2 — Sidebar always-visible, Home detail pane status-adaptive **[approved]**

T7 NavigationSplitView IA resolution:

```
iPad layout (regular sizeclass):
┌──────────────┬──────────────────────────────────────────┐
│  SIDEBAR     │  DETAIL PANE                             │
│              │                                          │
│  ⌂ Home      │  ← status-adaptive (today's rootSurface  │
│  ✎ Apply     │    logic moves into a SNAPHomeDestination│
│  💳 EBT bal  │    view; sidebar Home routes to it)      │
│  🍴 Find help│                                          │
│  ⏲ Recert    │  Tapping "Apply" while enrolled lands    │
│  ⚙ Settings  │  on a status-aware "You're already       │
│              │  enrolled — add a household member?"     │
└──────────────┴──────────────────────────────────────────┘

iPhone layout (compact sizeclass):
NavigationStack { SNAPHomeDestination + toolbar gear } — unchanged behavior
```

Status routing logic moves DOWN into `SNAPHomeDestination`. Other sidebar destinations (Apply / EBT balance / Find help / Recert / Settings) are status-aware at their entry but always visible.

### ARCH-3 — Approval banner persistence simplified **[approved]**

```
@AppStorage("co.civica.approvalAcknowledged") Bool

Show WHEN:
  status == .decisionApproved
  AND ebtAccount == nil
  AND !approvalAcknowledged

Reset to false WHEN:
  status transitions to .notStarted (fresh case)
  OR status transitions .recertDue → .decisionApproved  (per CQ-5)

Set to true WHEN:
  banner dismissed (any tap-outside / close button)
  OR EBT card linked
```

No caseId dependency, no gateway round-trip, same UX outcome.

### ARCH-4 — Toolbar gear coverage (recorded)

The settings gear in `CivicaRootView`'s `NavigationStack` toolbar only renders when `rootSurface` IS the NavigationStack content. But `rootSurface` can be `SNAPDecisionDeniedView`, `RecertCompanionRoot`, or `SNAPRecertificationView` — full-screen children.

**Recommendation:** Place the toolbar at `CivicaRootView` level (wrapper around NavigationStack) so it propagates regardless of which child renders. Add a UI test asserting gear visibility on all 5 root surfaces (Phase 1/2/3 + Denied + RecertDue).

### ARCH-5 — `civicaAnimation` modifier doesn't fit imperative callsites (recorded)

Existing animation calls in the codebase use `withAnimation(.token) { state.change }` (imperative pattern). A `.civicaAnimation(_:value:)` view modifier only works for declarative `.animation(_:value:)`.

**Recommendation:** Ship BOTH:
1. `extension View { func civicaAnimation(_ token: CivicaAnimation, value: Equatable) -> some View }` — for declarative `.animation` callsites.
2. `func civicaWithAnimation<R>(_ token: CivicaAnimation, _ value: Equatable, body: () -> R) -> R` — free function wrapping `withAnimation` with ReduceMotion env check via `UIAccessibility.isReduceMotionEnabled` (no SwiftUI env in a free function context).

Codemod targets both patterns. The codemod is rougher than a simple `s/withAnimation/civicaWithAnimation/` find-replace because the imperative form needs to read ReduceMotion off `UIAccessibility` instead of the SwiftUI env (the View modifier approach uses the env).

### ARCH-6 — UIFontMetrics implementation (recorded)

The audit said "switch to `.font(.body, design: .default)` with Hanken Grotesk fontDescriptor." That's not a real API. The actual pattern is `UIFontMetrics(forTextStyle: .body).scaledFont(for: UIFont(descriptor: hankenDescriptor, size: 17))` wrapped as a SwiftUI `Font`.

**Recommendation:** New file `CivicaDesignSystem/Sources/CivicaTypographyResolver.swift`:

```swift
actor CivicaTypographyResolver {
  static let shared = CivicaTypographyResolver()
  private var cache: [CacheKey: Font] = [:]

  func font(for token: CivicaTypography.Token,
            at dynamicTypeSize: DynamicTypeSize) -> Font {
    // Resolve UIFontDescriptor (Hanken Grotesk + weight)
    // Wrap with UIFontMetrics scaling
    // Cache by (token, dynamicTypeSize)
    // Invalidate on UIContentSizeCategory.didChangeNotification
  }
}
```

Settles ARCH-6 + RA-1 + PF-2 in one component.

### ARCH-7 — Backend wiring: optional + hide-when-nil **[approved]**

```swift
// SNAPAppointmentRepository
@Published var appointment: SNAPAppointment? = nil

// Phase 2 view
if statusStore.status == .interviewScheduled, let appt = appointmentRepo.appointment {
    appointmentBlock(appt)
} else if statusStore.status == .interviewScheduled {
    // existing body copy fallback
    whatCountyIsDoing
}
```

iOS PR-3 ships immediately. Gateway endpoint (`/me/appointments` or `GET /me/case/{caseId}` extension) lands on backend's own cadence. Same posture as IS-7 (messages-inbox row hide-when-nil).

### ARCH-8 — SoftIneligibility callback wiring (recorded)

`SNAPBenefitEstimatorView` and `SNAPConversationView` need to inject 3 callbacks into the new `SNAPSoftIneligibilityCard`. The estimator's existing flow is `NavigationLink`-driven; injecting closures is a small structural change.

**Recommendation:** Pass closures from the parent flow view (`SNAPEstimatorFlowView`, `SNAPConversationFlowView`) down, not from the result view itself. The flow view owns navigation state and can hand back NavigationLinks or push state changes as needed.

---

## Section 2 — Code Quality (eng review)

### CQ-1 — DRY extract in PR-3 **[approved]**

New components in `CivicaDesignSystem/Sources/`:
- `CivicaSecondaryRow(icon: String, eyebrow: CivicaText, link: CivicaText, trailing: AnyView? = nil, language: CivicaLanguage)` — replaces `secondaryRowLabel` in 3 home views.
- `CivicaPrivacyFooterLink(language: CivicaLanguage, destination: () -> some View)` — replaces `privacyFooterLink`.
- `CivicaPhaseTab.locked(at:, debugChange:)` overload — handles the `#if DEBUG` toggle internally so call sites become one line.

Saves ~120 LOC across the 3 home views, all in PR-3 (which is already touching those files).

### CQ-2 — `CivicaMoney` everywhere (recorded)

5+ uses of `String(format: "$%.2f", amount)` or `$%.0f`. Use `CivicaMoney(amount: Decimal, font: Font)` consistently. Add a SwiftLint rule blocking `String(format:` with a `$%` pattern (codemod first, then lint).

### CQ-3 — `SNAPAppointment` struct, not store **[approved]**

(Refines ARCH-1.) `SNAPAppointment` is a `Codable` value type. Repository owns network. Store exposes `@Published var nextAppointment: SNAPAppointment?`.

### CQ-4 — `packages/snap-rules` appealability domain **[approved]**

```
packages/snap-rules/rules/appealability/
├── CA.json    {window_days: 90, non_appealable_categories: [...]}
└── MA.json    {window_days: 30, non_appealable_categories: [...]}

AppealabilityService.swift (iOS-side):
  evaluate(reason: DenialReason, state: StateCode, decisionDate: Date) -> Bool
  reads compiled rule bundle from existing snap-rules build phase
```

Reuses PR #94's infrastructure. State-author-friendly. Auditable.

### CQ-5 — Banner re-fires on recert renewal **[approved]**

Acknowledged flag resets on `.recertDue → .decisionApproved` transition AND on `.notStarted` transition. Banner copy adapts:

```
First-approval:  "You're approved for CalFresh"
                 "Your EBT card will arrive in 3-7 days"

Renewal-approval: "You're renewed for another year"
                  "Your benefits will continue without interruption"
```

`SNAPApprovalBannerCard` accepts a `flavor: .firstApproval | .renewal` parameter.

### CQ-6 — `verdictReason` truncation (recorded)

`.lineLimit(4)` with `.fixedSize(horizontal: false, vertical: true)`. Add a "See more" tap action that expands to full text. Long reasons (estimator's BBCE explanation) are real.

### CQ-7 — `DraftLoadError` typed enum (recorded)

```swift
enum DraftLoadError: Error {
    case schemaMismatch(version: String)
    case ioError(underlying: Error)
    case decodingError(underlying: Error)
    case empty
}
```

UI in `CivicaEntryView` fallback card branches: schemaMismatch → "Your data is from an older version, re-run screener?"; ioError → "Couldn't read saved progress, try restart?"; decodingError → "Data corrupted, start fresh?". Each variant logs to telemetry with version + reason.

### CQ-8 — String parity tests (recorded)

~80 new `CivicaText` entries across T3-T7. Extract `EBTStringParityTests` pattern into a reusable `CivicaTextParity.assertParity(for:)` helper. Run per-feature suite (`SettingsStringParityTests`, `SoftIneligibilityStringParityTests`, etc).

### CQ-9 — ASCII routing diagrams in DESIGN.md (recorded)

DESIGN.md §1 should grow a §1.5 with the routing diagram. Specifically:
- The cold-start `rootSurface` status routing (existing)
- The new SplitView sidebar IA (from ARCH-2)
- The phase-tab journey indicator behavior (.locked vs DEBUG)

### CQ-10 — `CivicaAppStorageKeys` enum (recorded)

```swift
enum CivicaAppStorageKeys {
    static let hasCompletedOnboarding = "co.civica.hasCompletedOnboarding"
    static let recertInProgress = "co.civica.recertInProgress"
    static let appearance = "co.civica.appearance"
    static let approvalAcknowledged = "co.civica.approvalAcknowledged"
    static let language = CivicaLanguage.defaultStorageKey
    static let dailyChecklistPrefix = "co.civica.dailyChecklist."
    // ...
}
```

Prevents typo/collision drift across 8+ AppStorage uses. Land in PR-3.

---

## Section 3 — Test Review (eng review)

Coverage diagram above shows ~120 new code paths across the 10 implementation tasks, 8 starred regressions, and 5 paths requiring snapshot test infrastructure.

### TR-1 — Snapshot tooling **[approved: pointfreeco/swift-snapshot-testing as PR-0]**

PR-0 (new, prereq) adds `pointfreeco/swift-snapshot-testing` to the `Civica Tests` target as a SwiftPM dependency. Establish snapshot baselines for 10 representative screens at default + xxxLarge + dark mode. All subsequent T6/T7 work registers against those baselines. Without this, dark mode + Dynamic Type + iPad verification is theater.

### TR-2 — Regression tests as `test(qa):` commits **[approved]**

Each of the 8 ★ regressions (status-store API surface preservation, EBT cents format, NWPathMonitor offline, banner reset on .notStarted, banner reset on recert renewal, CivicaTypography default-size rendering, EBT silent-fail surface, NWPathMonitor offline detection) gets a `test(qa): <regression>` commit BEFORE the `feat:` commit in its respective PR. Greppable for retros: `git log --since=... --grep '^test(qa):'`.

### Test plan artifact

Written to `~/.gstack/projects/matthewgg22-Civica/matthewgreer-gentis-claude-benefitscal-ext-ui-eng-review-test-plan-20260529-122450.md`. Consumed by `/qa` for QA test runs.

---

## Section 4 — Performance (eng review)

### PF-1 — EBT refresh debounce: coalesce + 3s cooldown **[approved]**

```
Store exposes @Published var isRefreshing: Bool
Banner retry button:
  - disabled WHEN isRefreshing
  - shows spinner in-place of the button label
  - after refresh completes, 3s cooldown before re-enable
```

Simple. Observable. Prevents tap-spam and request-spam.

### PF-2 — `CivicaTypographyResolver` actor cache **[approved]**

Resolves UIFont once per (token, DynamicTypeSize) tuple. Cache invalidates on `UIContentSizeCategory.didChangeNotification`. Bounded cache size (~168 entries max). Settled together with ARCH-6.

### PF-3 — SplitView Home destination rebuild cost (recorded)

Use SwiftUI's natural sub-view extraction. The `SNAPHomeDestination` view owns the status-routing branch. Sidebar stays stable. As long as `SNAPHomeDestination` body() is not recomputing on sidebar item taps (it shouldn't), we're fine.

**Verify:** Add a SwiftUI Instrument profile run on iPad after T7 lands. If body() recomputes excessively, factor `SNAPHomeDestination` into smaller `@ViewBuilder` sub-views.

### PF-4 — `@StateObject` vs `@ObservedObject` lifecycle (recorded)

New stores (SNAPAppointmentRepository, SNAPSyncBannerStore, SNAPDailyChecklistStore, SNAPRefreshErrorState) each have ONE owner.

**Recommendation:** Owner uses `@StateObject` at component-init level. Children consuming the store use `@ObservedObject`. Wrong usage causes recreated stores per render + lost `@Published` values. Add a Swift convention comment in each store file.

### PF-5 — Daily checklist @AppStorage (recorded)

5 items × @AppStorage reads on Phase 2 render = trivial. No concern.

---

## NOT in scope (eng-review additional deferrals)

- iPad-specific app icon (separate plan)
- Apple Watch extension
- iOS Widget extension
- Push notification copy audit (separate plan per memory)
- Voice mode performance audit (experimental, flagged in design review)
- Marketplace job-matching test coverage (out of scope per design review)
- The Civica WeVote target — UD-8 already routes coordination there

## What already exists (eng-review additions)

- **57 test files in `Civica Tests/`** — Swift Testing + XCTest split. Reuse patterns.
- **`packages/snap-rules` engine (PR #94)** — perfect home for `AppealabilityService` rules.
- **`EBTBalanceRepository` template documented in CLAUDE.md** — `SNAPAppointmentRepository` should mirror it line by line.
- **`CivicaMoney` view component** — used by `EBTBalanceDashboardView:223`. Reuse for all currency formatting (replaces 5+ `String(format:)` bypasses).
- **`CivicaFontRegistration` mechanism** — Hanken Grotesk already registered; `CivicaTypographyResolver` reads through it.
- **`CivicaText(en:, es:)` + parity unit-test pattern (`EBTStringParityTests.swift`)** — generalize for all new strings.
- **Existing `nonisolated(unsafe)` static-state pattern in concurrent stores (memory `feedback_swift_testing_concurrent`)** — apply `@Suite(.serialized)` to any new test suite touching shared state.

## Failure modes

| Code path | Failure | Test? | Handling? | User sees? |
|---|---|---|---|---|
| `SNAPAppointmentRepository.load()` | Timeout | T11/PR-3 gap | Yes (silent fail) | Falls back to "caseworker will call at scheduled time" body |
| `AppealabilityService.evaluate(...)` | Unknown denialReason | Gap | Default true (appealable) | Appeal as primary (today's behavior) — log telemetry |
| `@AppStorage("co.civica.appearance")` | Malformed string | Gap | SwiftUI fallback to system | Possible visual flash on launch |
| `NWPathMonitor` cancel-on-deinit | Leak | Gap (T4 needed) | Need to verify cancel pattern | Battery drain |
| `UIFontMetrics + Hanken Grotesk descriptor` | Font not registered at cold start | Gap (T6 needed) | Falls back to system font | Visual register breaks on first paint |
| `Result<Draft, DraftLoadError>` | Schema mismatch on app upgrade | T4 has it | Yes (typed fallback card) | "Re-run screener" CTA |
| `SNAPApprovalBannerCard` reset | Banner never re-fires on recert | T5/REGRESSION★ | Yes (per CQ-5) | "Renewed for another year" |
| `SNAPApplicationStatusStore` decomposition (ARCH-1) | API surface drift breaks callers | T3/REGRESSION★ | Yes (preserve existing API) | Crash or wrong status |

**Critical gaps after eng review: 0.** All flagged paths have either a test plan in the coverage diagram OR a handling recommendation. The 8 ★ regressions are mandatory `test(qa):` commits per PR.

## Worktree parallelization strategy

```
PR-0 (snapshot testing infrastructure)  ← prereq, blocks T6+T7
  │
  ▼
┌───────────────────┐       ┌──────────────────┐
│ PR-1 (Pass 4)     │       │ PR-2 (Pass 5)    │   PARALLEL
│ AS-1, AS-2        │       │ DS-1 through 7   │   (different files)
└────────┬──────────┘       └─────────┬────────┘
         │                            │
         └───────┬────────────────────┘
                 ▼
        ┌─────────────────────────────┐
        │ PR-3 (Pass 1 IA + DRY)      │   SEQUENTIAL
        │ IA-1..6, CQ-1, T15          │   (touches files PR-1+PR-2 touched)
        └────────────┬────────────────┘
                     │
         ┌───────────┴────────────────────┐
         ▼                                ▼
┌──────────────────┐               ┌─────────────────┐
│ PR-4 (Pass 2)    │               │ PR-5 (Pass 3)   │   PARALLEL
│ IS-1..9, T14     │               │ JR-1..7         │   (different files)
└────────┬─────────┘               └──────────┬──────┘
         │                                    │
         └────────────────┬───────────────────┘
                          ▼
                 ┌──────────────────────┐
                 │ PR-6 (Pass 6a)       │   SEQUENTIAL
                 │ RA-1, RA-4..7, T13   │   (a11y touches strings PR-5 added)
                 └──────────┬───────────┘
                            ▼
                 ┌──────────────────────┐
                 │ PR-7 (Pass 6b)       │   SEQUENTIAL
                 │ RA-2, RA-3 (BIGGEST) │   (depends on all prior structure)
                 └──────────────────────┘
```

**Conflict flag:** None at module level. PR-1 and PR-2 both touch DESIGN.md but in separate sections (AS-1 adds §12 anti-patterns; DS-1 modifies §2.2 color rules). Resolve via manual merge.

## Implementation Tasks (eng-review additions)

- [ ] **T11 (P0, human: ~1 day / CC: ~1.5h)** — **PR-0** — Add pointfreeco/swift-snapshot-testing as Civica Tests dependency
  - Surfaced by: TR-1
  - Files: `Civica.xcodeproj/project.pbxproj`, `Civica Tests/SnapshotConfig.swift` (new)
  - Verify: 3 representative-screen baseline snapshots committed (CivicaEntryView, Phase 2, Phase 3) at default + xxxLarge + dark
- [ ] **T12 (P0, human: ~3h × 8 regressions / CC: ~30min × 8)** — **Per PR** — Write `test(qa):` commit BEFORE `feat:` commit for each of 8 ★ regressions
  - Surfaced by: TR-2
  - Files: `Civica Tests/*RegressionTests.swift` (8 new files or extensions)
  - Verify: each `test(qa):` commit fails before the feat commit it sits before; `git log --grep '^test(qa):'` shows ≥8 new entries across PR-3..PR-7
- [ ] **T13 (P1, embedded in T6)** — `CivicaTypographyResolver` actor with UIFont cache
  - Surfaced by: ARCH-6 + PF-2
  - Files: `CivicaDesignSystem/Sources/CivicaTypographyResolver.swift` (new)
  - Verify: Instrument profile pre/post on EBT activity scroll shows no font-resolution cost in body()
- [ ] **T14 (P1, embedded in T4)** — EBT refresh banner coalesce + 3s cooldown
  - Surfaced by: PF-1
  - Files: `Civica/Features/SNAP/EBTBalance/EBTBalanceStore.swift`, `EBTBalanceDashboardView.swift`
  - Verify: rapid tap doesn't trigger >1 request per 3s; spinner shows while inflight
- [ ] **T15 (P1, embedded in T3)** — `CivicaAppStorageKeys` enum
  - Surfaced by: CQ-10
  - Files: `Civica/Helpers/CivicaAppStorageKeys.swift` (new); migrate 8+ AppStorage key uses
  - Verify: build succeeds; no string-literal AppStorage keys remain in Civica/

Total eng-review additions: 5 tasks. Two are P0 prerequisites (PR-0 snapshot infra + per-PR regression tests). Three are P1 embedded inside existing tasks T3/T4/T6.

## Completion summary

```
+====================================================================+
|         ENG REVIEW — COMPLETION SUMMARY                            |
+====================================================================+
| Step 0 Scope Challenge | scope accepted as-is (iPad SplitView)     |
| Architecture           | 8 findings, 4 forks decided, 4 recorded   |
| Code Quality           | 10 findings, 4 forks decided, 6 recorded  |
| Test Review            | coverage diagram, 2 forks decided         |
|                        | ~120 new paths, 8 ★ regressions, 5 infra  |
| Performance            | 5 findings, 2 forks decided, 3 recorded   |
+--------------------------------------------------------------------+
| NOT in scope           | written (7 items)                          |
| What already exists    | written (7 reusable surfaces)              |
| TODOS.md updates       | n/a (audit doc IS the planning artifact)   |
| Failure modes          | 0 critical gaps                            |
| Outside voice          | skipped (audit doc already has design       |
|                        | review consensus; codex re-run optional)   |
| Parallelization        | 3 lanes; PR-1 ∥ PR-2; PR-4 ∥ PR-5; rest    |
|                        | sequential                                 |
| Lake Score             | 12 of 12 forks chose complete option        |
+====================================================================+
```

### Unresolved decisions

None — all 12 eng-review forks have a written decision.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | not run |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 23 issues, 0 critical gaps, 12 forks decided, 5 new tasks |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL) | score: 7.5/10 → 8.7/10, 18 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not run |

- **CROSS-MODEL:** Design + Eng reviews ran on the same audit doc. No external model (codex) yet. Outside voice optional; recommend running codex on the SplitView IA architecture (ARCH-2) since that's the single biggest architectural commit and a second perspective would harden it.
- **UNRESOLVED:** 0 (across both reviews)
- **VERDICT:** DESIGN + ENG CLEARED — 30 decisions written across both reviews, 0 critical gaps, 0 unresolved. PR-0 snapshot infra is the gating prerequisite; after that, PR-1 and PR-2 can launch in parallel.









