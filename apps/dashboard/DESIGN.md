# Civica Dashboard — Design System (Web Translation Layer)

**Audit date:** 2026-05-23
**Target:** Web (`apps/dashboard/`, Next.js App Router)
**Source of truth:** [`/DESIGN.md`](../../DESIGN.md) at repo root — the iOS app's design system. This document translates those rules to web and documents web-only patterns.

When iOS DESIGN.md and this document conflict on a token or rule, **this document wins for web**. When this document is silent, fall back to iOS DESIGN.md.

---

## 1. Tokens — Tailwind v4 `@theme`

All tokens live in [`app/globals.css`](app/globals.css) inside the `@theme` block. Tailwind v4 auto-generates utility classes from `@theme` declarations: `--color-foo` becomes `text-foo` / `bg-foo` / `border-foo` / `ring-foo` etc.

### Color tokens (semantic)

| Token | Hex | Use | Maps to iOS |
|---|---|---|---|
| `--color-ink` | `#1A1714` | Body text, primary text on light surfaces | `ink` |
| `--color-graphite` | `#443F38` | Secondary text, metadata | `graphite` |
| `--color-muted` | `#57524A` | Tertiary text, captions ≥12px | `muted` |
| `--color-paper` | `#F7F5EF` | Screen background | `paper` |
| `--color-surface` | `#FFFFFF` | Card / row background | `surfacePrimary` |
| `--color-surface-secondary` | `#F0EEE6` | Nested card / aggregate stats | `surfaceSecondary` |
| `--color-hairline` | `rgba(0,0,0,0.12)` | Dividers, card borders | `hairline` |
| `--color-pine` | `#2D5A45` | **CTAs only** — primary buttons + text links | `pinePrimary` |
| `--color-pine-pressed` | `#224636` | Pine pressed state | `pinePrimaryPressed` |
| `--color-pine-surface` | `#D8E6DE` | Success-adjacent fill (enrolled, submitted) | `pineSurface` |
| `--color-amber` | `#C9922A` | **Positive outcome only** — eligibility, deposits | `amberPrimary` |
| `--color-amber-surface` | `#F5E2C0` | Positive-outcome fill | `amberSurface` |
| `--color-wheat` | `#E8C547` | Benefit fill on dark pine surfaces — **never text on paper** (fails AA) | `wheatPrimary` |
| `--color-brick` | `#9C3A24` | Human recovery moments — denial, distress, navigator outreach | `brickAccent` |
| `--color-warning` | `#B5511E` | **Process warnings** — expiry, missing doc, stale data, needs-attention | `warningAmber` |
| `--color-error` | `#C84637` | Form validation errors, data-loss confirmations | `destructive` |
| `--color-indigo` | `#4F46A5` | Info accent, secondary status | (no iOS equivalent — web-only) |
| `--color-teal` | `#C9922A` (alias for amber) | Legacy alias for positive-outcome — prefer `--color-amber` in new code | (deprecated) |

### Color use rules (web-specific reinforcements)

These are the violations most likely to show up in a code review. Reject the PR if any are broken.

1. **Pine is for CTAs only.** Primary buttons, links, focus rings. Do not use `bg-pine` / `text-pine` on icons, decorative elements, status pills, or backgrounds. The Funnel "Operations" badge and the FirstVisitCallout's `pine/8` tint are the only currently-sanctioned non-CTA pine usages — both are "navigator-action-adjacent" framing, not decoration.

2. **`--color-amber` is positive-outcome; `--color-warning` is warning.** Same family, different jobs. On web, `--color-warning` (#B5511E, burnt-orange) is the dedicated warning token. Use it for: Needs Attention, stale flags, expiring recerts, expedited review, due-soon outreach, Medium-risk dots, Needs Documents / Needs Clarification status badges. Use `--color-amber` (#C9922A, gold) only when you're communicating "positive thing happened" (currently rare on staff dashboard; common on iOS applicant app).

3. **`--color-brick` is recovery, not generic CTA, not generic warning.** Brick is reserved for moments where a person needs human help, has been denied, or is in distress. Using brick as a CTA color or for neutral counts is semantic theft.

4. **Wheat never as text on paper.** `--color-wheat` (#E8C547) is 2.1:1 on `--color-paper` — fails WCAG AA. Wheat may appear as a fill color for EBT-balance hero cards on dark pine. It must never be foreground text on light surfaces.

### Motion tokens

| Token | Value | Use | Maps to iOS |
|---|---|---|---|
| `--duration-fast` | `120ms` | Micro: toggle ticks, icon state changes | `fast` |
| `--duration-snap` | `180ms` | Dismiss / return-to-rest | `snap` |
| `--duration-standard` | `200ms` | Default: card expand, panel reveal | `standard` |
| `--duration-step` | `240ms` | Form step cross-fades | `stepTransition` |
| `--duration-slow` | `300ms` | Considered transitions, section reveals | `slow` |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default easing | `easeInOut` |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Dismiss / decelerate | `easeOut` |

`globals.css` has a global `prefers-reduced-motion: reduce` override that collapses all animation and transition durations to `~0ms`. Custom JS-driven motion (spring physics, RAF loops) must also check `matchMedia('(prefers-reduced-motion: reduce)')` — CSS enforcement is necessary but not sufficient.

### Spacing & radius

- Spacing follows Tailwind's default scale (4px base). DESIGN.md's iOS token names (`xxs`/`xs`/`sm`/`md`/`lg`/`xl`/`xxl`) translate roughly to Tailwind `0.5`/`1`/`2`/`3`/`4`/`6`/`8`.
- Radius tokens are `--radius-control` (3px) and `--radius-card` (4px). The dashboard uses `rounded-[3px]` and `rounded-[4px]` arbitrary values rather than Tailwind's `rounded-sm` (since defaults are larger than Civica intends). Pill shapes use `rounded-full`.
- **Never use radius > 12px on content cards** — pushes toward consumer-app aesthetic and undermines the gov-grade visual register.

---

## 2. Typography

- **Font:** Hanken Grotesk, loaded from Google Fonts in `globals.css` (weights 400 / 500 / 600). Same typeface as iOS, different delivery path (web pulls from Google CDN, iOS bundles the font file).
- **Tailwind utility:** the `@theme` block sets `--font-sans` so `font-sans` resolves to Hanken Grotesk. `html` and `body` declare it explicitly as a fallback.
- **Web size scale** (differs from iOS — web density is higher and the medium is smaller):

| Size | px | Use |
|---|---|---|
| 11px | `text-[11px]` | Eyebrow text (combined with `.eyebrow` class for uppercase + tracking) |
| 12px | `text-[12px]` | Captions, footnotes, table cell metadata |
| 13px | `text-[13px]` | Compact body, secondary labels, sub-headings |
| 14px | `text-sm` | Default body in dense UI, button labels |
| 15px | `text-[15px]` | Default body in less-dense UI |
| 17px | `text-[17px]` | Emphasized body (matches iOS body min) |
| 20px | `text-xl` | Card titles |
| 26px | `text-[26px]` | Page-level H2 |
| 32px | `text-[32px]` | StatCard values, hero numerics |

iOS DESIGN.md sets a 17pt body minimum because applicants read it on phones under stress. Web staff users are at desk-resolution, often dual-screen, so 13-14px body is acceptable for table-density UI. **Body text under 12px is forbidden** — those need to either grow or move to a tooltip.

### Utility classes

- `.eyebrow` — 12px / 600 / uppercase / 0.12em tracking / `#5A544D`. Use for category labels above primary content (`<p className="eyebrow">CIVICA · CBO PREVIEW</p>`).
- `.section-title` — 14px / 700 / uppercase / 0.08em tracking / `#1A1714`. Use for major section headings inside dashboard `Card` components.
- `.section-sub` — 12px / italic / `#6B655C`. Subtitle pattern under `.section-title`.
- `.tabular-nums` — `font-variant-numeric: tabular-nums`. Apply to all numeric displays (counts, percentages, dates) so digits don't shift width when values change.

---

## 3. Surface hierarchy

Three layers, mirrors iOS DESIGN.md §8 exactly:

```
Screen   →   bg-paper             (#F7F5EF)
Card     →   bg-surface           (#FFFFFF) with border-hairline
Nested   →   bg-surface-secondary (#F0EEE6)
```

Accent surfaces (pine, brick, warning, wheat) communicate state — they don't substitute for the base three layers. A screen with a warning card still uses `bg-paper` as its background.

**Border over shadow** for cards. The dashboard uses `border border-hairline` consistently. Shadows are reserved for surfaces that truly float (modals, dropdowns). The MobileNavMenu dropdown is the one current shadow user.

---

## 4. Component patterns

These are the established dashboard primitives. Reuse them; do not reinvent.

### Card (inline in dashboard/page.tsx:559)
- `bg-surface border border-hairline rounded-[4px] p-6`
- Optional `mb-4` heading area with `<h3 className="section-title">` + `<p className="section-sub">`
- `weight="secondary"` variant uses `p-5` for lower visual weight

### StatCard (inline in packets/page.tsx:196)
- 4-column grid for status overviews
- `<div className={bg + " border border-hairline rounded-[4px] px-5 py-4"}>`
- Value: `text-[32px] font-semibold tabular-nums leading-none`
- Label: `text-[14px] text-ink mt-2 font-semibold`
- Accent + bg should follow semantic tokens (warning for warnings, teal for positive, ink for neutral counts, brick for recovery — never for neutral counts)

### Funnel (`components/Funnel.tsx`)
- Horizontal bars, width proportional to count vs max
- Stage-to-stage conversion % with semantic color thresholds: teal ≥80% / warning ≥50% / brick <50%
- Each row optionally a `<Link>` to filtered packet list
- Use this on any "X → Y → Z" flow visualization. Do not inline an alternative funnel implementation.

### StatusBadge (inline in packets/page.tsx)
- 36px circle with status icon glyph
- **Accessibility:** always wraps with `role="img"` + `aria-label="Status: {status}"`; glyph itself is `aria-hidden="true"`

### AppHeader (`components/AppHeader.tsx`)
- Pine background, white text + nav tabs
- Below `md` (768px): tabs hidden, hamburger via `MobileNavMenu`

### FirstVisitCallout (`components/FirstVisitCallout.tsx`)
- Pattern for first-visit explanatory banners; persists dismissal in localStorage
- SSR-safe: renders null pre-hydration so server/client HTML match

### CountyOutcomeRoadmapCard (`components/CountyOutcomeRoadmapCard.tsx`)
- Dismissible banner that surfaces the Payment Integrity Engine's "built but dormant, awaiting county handshake" state.
- **Placement:** TOP of `apps/dashboard/app/packets/[packetId]/page.tsx`, above all `<Section>` and `<EvidenceSection>` blocks (immediately inside `<main>`).
- **Dismiss key:** `civica.county-outcome-roadmap-acknowledged` in localStorage. Set to `"1"` on dismiss; card renders null once set.
- **a11y contract:** `<aside role="region" aria-label="County outcomes will land here">`. Dismiss button has `aria-label="Dismiss county outcome roadmap"`.
- **SSR-safe:** `useState<boolean | null>(null)` + `useEffect` reads localStorage post-hydration; renders null when `dismissed !== false` — identical to FirstVisitCallout pattern. No hydration mismatch.
- **Shell tokens:** `bg-surface border border-hairline rounded-[4px] p-6` (standard Card shell per §4).
- **Typography:** heading uses `.section-title`; body uses `.section-sub`.
- **Copy status: LOCKED** — set in CEO review addendum 2026-06-04. Headline: "County outcomes will land here". Do not modify copy without a new CEO/design sign-off.
- No icons, no emoji decoration (§7), no data fetching (purely presentational).

### EvidenceSection (`components/packet-detail/EvidenceSection.tsx`)
- Collapsible card for reference + computed-advisory content on packet detail. Decide-zone sign-off gates stay as `<Section>`; evidence rows wrap in `<EvidenceSection>`.
- Built on native `<details>` / `<summary>` for free keyboard a11y (Enter/Space toggle), screen-reader semantics, and `prefers-reduced-motion` compliance.
- Outer shell uses `bg-surface border-hairline rounded-[4px]`; body uses `bg-paper` with `space-y-5` so nested sub-cards (Documents has three) sit as white surfaces on the paper trough — matches §3 surface hierarchy.
- Summary row shows title + optional count + status chip (`{summary}` text) + `⚠` flagged glyph with `role="img"` per §6.1.
- Auto-open rule: `defaultOpen` wins; otherwise opens when `flagged`. Closed sections still announce state via the summary text — color is never the only signal (§6.4).
- State is derived from data, not persisted client-side. Reviewers don't manually arrange UI between visits.

---

## 5. Breakpoints

Use Tailwind defaults (no custom screens):

| Prefix | Min-width | Typical use |
|---|---|---|
| `sm:` | 640px | Tablet-portrait |
| `md:` | 768px | Tablet-landscape — **mobile-nav cutoff** |
| `lg:` | 1024px | Desktop |
| `xl:` | 1280px | Large desktop |

The desktop nav tabs are hidden below `md`; the MobileNavMenu hamburger takes over.

---

## 6. Accessibility contracts

Mirrors iOS DESIGN.md §9; web specifics below.

1. **Decorative glyphs need text alternatives.** Unicode icons (✎ ↑ ! ? ◉ ✓ → •) used alone as status indicators must be wrapped with `role="img"` + `aria-label`; the glyph itself is `aria-hidden="true"`. Pattern: see StatusBadge.

2. **All interactive elements ≥ 3:1 on background.** Focus rings, nav tabs, icon buttons. Use `focus:ring-2 focus:ring-pine/30` as the default.

3. **Touch targets ≥ 44×44 px for primary actions.** Inline text links may be smaller but must have hover/focus affordance.

4. **Color is never the only signal.** Status pills include text label + color. Errors require icon + message. Risk dots are paired with a text label.

5. **Honor `prefers-reduced-motion`.** Already enforced globally via CSS media query in `globals.css`. JS-driven motion must also check `matchMedia('(prefers-reduced-motion: reduce)')`.

6. **`text-muted` (`#57524A`) on `paper` is 4.5:1.** At AA threshold for body, fails for footnote sizes (<12px). Avoid `text-muted` on captions; use `text-graphite` (5.4:1) instead.

---

## 7. Forbidden patterns (will be rejected in review)

1. Emoji as design elements (3-column emoji grid is the textbook AI-template look)
2. `style={{ backgroundColor: 'var(--color-brick)' }}` on a primary CTA (Pine is for CTAs)
3. `text-amber` on a warning context (use `text-warning`)
4. Default font stack (Inter, Roboto, system-ui as primary) — Hanken Grotesk is the choice
5. Rounded radius > 12px on content cards (gov-grade aesthetic)
6. Headings floating between paragraphs (must be visually closer to the section they introduce)
7. Placeholder-as-only-label on form inputs

---

## 8. Open questions / future work

- Dark mode is not implemented on web. iOS forces light mode currently. When dark mode ships, audit `--color-graphite` on dark and `--color-wheat` foreground contrast (still fails as text per iOS).
- Per-section Suspense boundaries in `/packets/[id]/page.tsx` (12+ parallel queries) would let already-loaded sections render while slow ones spin. Tracked separately.
- Public `/cbo-preview` (drop role gate, interactive sample-packet flow) tracked separately.
- Audit remaining `var(--color-amber)` inline-style usages in KpiCard `warning` variants (cbo-preview, county, compliance/county, cdss) and migrate to `var(--color-warning)`.

---

## 9. Decisions log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-25 | `/enrollments` lifecycle audit — 10 token-rule violations fixed | Page introduced post-handoff lifecycle buckets + Stage 3 monetization band; new code did not honor DESIGN.md §1 (pine for CTAs only) and §2 (teal deprecated). Specifics: (a) bucket meta — `interview_pending` migrated teal → indigo (info, scheduled-but-unconfirmed); `active` migrated teal → pine-surface/60 + text-ink (the canonical "enrolled, submitted" success-adjacent fill, FG neutral); `recertified` migrated indigo → amber (positive lifecycle outcome). (b) Stage3Chips — `text-pine` on hours-compliant + workforce-placement chips violated §1; FG changed to `text-ink` while keeping `bg-pine-surface` (fill is allowed). (c) PilotCohort + NavigatorThroughput — goal-reached/target-met used `bg-pine` + `text-pine` (CTA color on a status indicator); migrated to amber. (d) Stage3YieldBand — `text-pine` on WOTC "$200-500/hire" projection migrated to amber (positive projected outcome). (e) LifecycleStage — `text-teal`/`bg-teal` on interview countdown migrated to indigo; default countdown bar migrated to amber. (f) RECERT_STAGE_META — `stage_60` cadence chip migrated teal → amber (gradient amber → warning → warning-deep → brick now uses canonical tokens). |
| 2026-05-25 | Lifecycle bucket semantics codified | The 7 post-handoff buckets each map to a canonical DESIGN.md token: urgent group → brick (expired, interview_at_risk) + warning (expiring, verification_outstanding); progress group → indigo (interview_pending, info), pine-surface (active, success-adjacent fill), amber (recertified, positive outcome). Each token is semantically motivated, not chosen for visual variety. |
| 2026-05-28 | Packet detail overview tab split into Decide + Evidence zones | The overview tab stacked 14–18 same-weight `<Section>` cards; `ReviewStatusCard` was meant to be the at-a-glance answer but was undermined by 13+ equally-shouting cards below it. Decide zone (ReviewStatus, Work-Hours, Consent, Shared Lease, Expedited Gate, Advance Status, BenefitsCal, Handoff) keeps `<Section>` chrome and stays open. Evidence zone (Documents, Application Answers, Extracted Fields, API Cross-Verification, Missed Elections, Notes, Activity Timeline, Packet metadata) collapses into `<EvidenceSection>` rows with auto-open-when-flagged behavior. Missed Elections moved from Decide → Evidence (advisory output, not a sign-off gate). NotesSection/VerificationSection/DocumentsSection/TimelineSection refactored to chromeless bodies so EvidenceSection owns the outer card. See [docs/plans/packet-detail-decide-evidence-layout.md](../../docs/plans/packet-detail-decide-evidence-layout.md). |
