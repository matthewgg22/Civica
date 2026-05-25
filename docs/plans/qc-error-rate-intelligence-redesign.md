# /qc Error Rate Intelligence — IA redesign (v2)

**Branch:** `feat/dashboard-caseworker-readiness`
**Audit date:** 2026-05-25
**Reviewer:** /plan-design-review (sketch mode)
**Reader model:** semi-CEO / semi-caseworker — the person who wrote the thesis, wants to see if the formula is holding against live applicant data.
**Constraint:** [`apps/dashboard/DESIGN.md`](../../apps/dashboard/DESIGN.md) is calibration source.
**Companion thesis:** [`docs/plans/civica-error-reduction-thesis.md`](./civica-error-reduction-thesis.md) — the methodology.
**OBBBA context:** [`docs/plans/obbba-snap-compliance.md`](./obbba-snap-compliance.md) if it exists; otherwise reference the OBBBA audit branches/PRs (Track 1 shipped, Track 2/3 + Native American exemption 1.3 + Q5 distress gate pending).

> **v2 reframe (2026-05-25):** v1 framed this page as engine-explanation for an analyst. The actual reader is the thesis owner asking *"is the formula holding against the data?"* — so the page is now thesis-tracking, not engine-explanation. The hero metric is the gap between projected and current-data PER. OBBBA enters as a fourth pillar.

---

## 1. Problem

The current `/qc` page reads as four marketing-shaped slides — each panel has its own hero number, its own composition, its own pitch shape:

1. `ErrorReductionProjectionPanel` — hero "5.5% vs 10.98%"
2. `ApiCoveragePanel` — weighted coverage bar + API cards
3. `ScoringPanel` — defensibility per flow + maturity ladder
4. `BaselinePanel` — dumbbell (empty until QC outcomes exist)

The thesis is shipped as a CONCLUSION (5.5%, halves baseline) but the formula behind it is never visible, never operable, never tested against live data. A semi-CEO reading the page learns the claim, not whether the claim is holding. OBBBA — the regulatory overlay that creates new eligibility-error surface — is absent entirely.

The slideshow feel is the symptom; the cause is that the page is structured as 4 independent assertions rather than 1 argument with 4 supports.

## 2. Inversion — thesis-tracking, formula-first

Replace presentational slide-stack with one analytical document, top-down:

```
HEADER strip — page intent + period picker + FNS-380 export
└─ FORMULA HERO (the spine)
   the equation, both rows — projected and current-data
   single highlighted number: ENGAGEMENT REALIZATION GAP
└─ PILLAR TRACKING (4 strips, not cards)
   Income · Shelter · Calc · OBBBA — each strip shows required vs
   observed engagement, shortfall, bottleneck, lever
└─ INCOMING DATA FEED
   last N packets · engagement vector · this packet's realization gap
   filter chips for "missing income / shelter / OBBBA-track"
└─ CALIBRATION (the falsification surface)
   USDA observed mix vs Civica observed — gated on QC outcomes
└─ METHOD FOOTER
   one-line link to thesis + OBBBA audit doc
```

One argument: *here's the formula → here's the gap → here's why the gap is open (pillars) → here's the per-applicant signal feeding it → here's the future falsification test.*

## 3. Component specs

### 3.1 FormulaHero (new — `components/qc/FormulaHero.tsx`)

The page's central surface. A single table rendered as one operable equation, two halves.

**Top half — projected (4 pillars + residual, no OBBBA term):**

| | Component | USDA weight | Contribution |
|---|---|---|---|
| | Baseline PER · CA FY24 (USDA FNS-380) | — | `10.98%` |
| − | Income axis @ 75% required engagement (Argyle) | `~28.5%` | `−X.X pts` |
| − | Shelter axis @ 75% required engagement (SUA + lease OCR) | `~39.9%` | `−X.X pts` |
| − | Shared-lease axis @ classifier-engaged rate | `~7.9%` | `−X.X pts` |
| − | Calc engine @ 100% (deterministic) | `~4.1%` | `−X.X pts` |
| | Residual · RSDI / SSI / medical / child support (outside Civica's stack) | `~19.6%` | `irreducible floor` |
| **=** | **PROJECTED PER · at full stack engagement** | sums to 100% | **`~5.5%`** |

OBBBA does NOT appear as a term in this formula. CA FY24 baseline predates OBBBA enforcement; OBBBA-correctness prevents a new kind of error rather than reducing the FY24 baseline. OBBBA gets its own section (§3.6) as a regulatory-readiness surface, not a pillar.

The weights shown above are `ERROR_WEIGHT_UNNORMALIZED` (un-renormalized USDA CA FY2023 shares, summing to ~81%, residual = ~19%). T0 adds these to the engine. Renormalized `ERROR_WEIGHT` (existing, sums to 1.0 across 5 flows) stays the source of truth for per-packet `scoreErrorRisk`.

> **USDA weights authoritative source (eng review 2026-05-25):** [`packages/snap-qc-engine/src/scoring/error-risk.ts`](../../packages/snap-qc-engine/src/scoring/error-risk.ts) — T0 adds `ERROR_WEIGHT_UNNORMALIZED` alongside the existing `ERROR_WEIGHT`. Renormalized weights (`ERROR_WEIGHT`, sums to 1.0 across 5 flows) stay the source of truth for per-packet `scoreErrorRisk`. Un-renormalized weights (`ERROR_WEIGHT_UNNORMALIZED`, sums to ~81%, residual = ~19%) become the source of truth for population `computeEngagementImpliedPER` so the irreducible floor is an explicit formula term, not absorbed by renormalization. Engine exports both; dashboard imports both. The page's prior hardcoded labels (50.5 / 26.8 / 11.4 / 8.2 / 3.1) are retired — they trace to no documented USDA source in the codebase. Stakeholder-visible change: gig income label 26.8 → 35.4, assets 8.2 → 0.2 (visually de-emphasize the assets row), residual 19% appears as a real formula row. Update any YC / CEO doc that quoted the prior values.

**Bottom half — engagement-implied (same formula, observed coverage substituted, OBBBA omitted):**

| | Component | Contribution |
|---|---|---|
| − | Income axis @ `<observed>%` engagement | `−X.X pts` |
| − | Shelter axis @ `<observed>%` engagement | `−X.X pts` |
| − | Shared-lease axis @ `<observed>%` engagement | `−X.X pts` |
| − | Calc engine @ 100% | `−X.X pts` |
| | Residual · 19.6% irreducible floor | (constant) |
| **=** | **ENGAGEMENT-IMPLIED PER · what the formula projects at observed coverage** | **`~X.X%`** |

> **Honest framing (cross-model tension #2, decided 2026-05-25):** "engagement-implied PER" is the projected PER recomputed with observed engagement rates substituted for the 75% required rate — it is NOT a Civica-measured error rate. The page does not yet have measured PER (that's CalibrationPanel §3.4, gated on n≥30 QC outcomes). The hero metric below is the engagement realization gap — the gap between full-stack-engagement projection and current-engagement projection. It tracks coverage adoption, not thesis falsification. The thesis is falsified only when QC outcomes exist and disagree with the formula's pillar weights — that's §3.4's job.

**Highlighted footer row — the page's reason for existing:**

```
ENGAGEMENT REALIZATION GAP                              X.X pts
```

**Numerics:**

- Each `<observed>%` is computed live from `packetsRes`, `argyleRes`, `shelterDocsRes`, OBBBA-impact join, etc.
- Each `−X.X pts` is the formula's contribution given that engagement rate. Server-side derivation in v1; promote to `v_thesis_realization` view in v2 (see §4).
- `ENGAGEMENT REALIZATION GAP` = `engagementImpliedPER − projectedPER`. Color-coded: brick if widening, teal if narrowing over the period, graphite if flat. Read this as "how much of the projected PER reduction is currently unrealized due to engagement shortfalls in the pillars." Not a measurement gap; a coverage-adoption gap.

**Visual register:**

- Two rows of the table use a tinted background to separate projected from current-data.
- Component rows are 36px tall, label-left / number-right, `tabular-nums`.
- `PROJECTED PER` and `ENGAGEMENT-IMPLIED PER` rows use `font-semibold text-[18px]` — visible but not 44px-hero.
- `ENGAGEMENT REALIZATION GAP` is the only large number on the page (`text-[32px] font-bold`). Single hero metric. No PillarCard competing.
- No card chrome around the table — `border-t-2 border-t-pine-surface` for the section, hairline rows.

### 3.2 PillarTracking (new — `components/qc/PillarTracking.tsx`)

Replaces the engine-ledger framing from v1 + the per-pillar cards from the current page. Each pillar is a horizontal strip (~80-100px), NOT a 320px card. Top-down reading reveals which pillars are tracking and which are lagging.

**Strip shape (one per pillar):**

```
┌─ INCOME AXIS ─────────────────────────────────── PER contribution: 2.65 pts ─┐
│  Tools: Argyle payroll wire                                                   │
│  Required engagement: 75% packets connected ··········· ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░ 75%  │
│  Observed today:      42% packets connected ··········· ▓▓▓▓▓▓▓▓░░░░░░░░ 42%  │
│  Shortfall: 33 pts off thesis · realization 56%                              │
│  Bottleneck: Argyle prompt placement; adoption during gig-applicant intake   │
│  Lever:     elevate Argyle CTA above income self-report in intake step 3     │
└──────────────────────────────────────────────────────────────────────────────┘
```

Each strip is 4 visual rows: header (tool + PER contribution badge), required-vs-observed bar pair, shortfall + realization %, bottleneck + lever (one line each).

**Four pillars in v1 (matching formula §3.1 in PER-contribution descending order, weights from `ERROR_WEIGHT_UNNORMALIZED`):**

1. **Shelter axis** — SUA engine + lease OCR · weight ~39.9% (utility-sua share)
2. **Income axis** — Argyle payroll wire · weight ~28.5% (gig-income share)
3. **Shared-lease axis** — sublease classifier · weight ~7.9%
4. **Calc engine** — CDSS deterministic rules · weight ~4.1% · always at 100% engagement (listed for completeness, demoted to 40px strip)

**Residual** (RSDI / SSI / medical / child support / unemployment, ~19% uncovered): single 32px footer strip below the four pillars — *"Outside Civica's verification stack — irreducible floor for PER on Civica-served households."* Listed for honesty; no engagement metric.

**OBBBA does NOT live in PillarTracking.** It gets its own section (`OBBBAReadinessStrip`, see §3.6) between PillarTracking and IncomingDataFeed. Per arch-finding A3, OBBBA is regulatory readiness, not a PER-formula contributor.

**Reused tokens:** `border-hairline` row dividers, `eyebrow` for pillar label, semantic colors per pillar (teal income, warning shelter heuristic until classifier ships, indigo OBBBA, graphite residual), bar pattern from existing `Funnel` proportional-bar primitive.

**Why this works:** the v1 "engine ledger" rule-by-rule table was the right inversion for an analyst reader. For thesis-tracking, the unit is the pillar, not the rule — because the formula contributes pillar-by-pillar, not rule-by-rule. Rules collapse into the "Tools" line of each strip.

### 3.3 IncomingDataFeed (new — `components/qc/IncomingDataFeed.tsx`)

Verbatim the user's ask: *"pulling data from applicants to see how it is tracking."*

Vertical list, last 20 packets, one row each.

| Column | Width | Content |
|---|---|---|
| Packet | 120px | short ID + applicant initials |
| Days pending | 60px | tabular num |
| Engagement vector | 220px | icon strip — 4 dots per pillar showing whether each pillar is engaged for this packet (Argyle ✓, lease ✓, SUA flags ✓, OBBBA chain ✓). Greyed = no signal, colored = signal present. |
| Per-packet PER | 100px | this packet's contribution to current-data PER if the formula were computed on a population of one. Tabular-nums. |
| Gap to thesis | 80px | delta vs the 5.5% projected — colored brick if wider than 1pt, teal if at/below thesis, graphite within ±1pt |
| What would close it | flex | one short auto-generated string — *"Connect Argyle (closes 1.2 pts)"*, *"Upload lease (closes 0.8 pts)"*, *"OBBBA work-req docs missing"* |
| → | 24px | link icon → `/packets/[packetId]` |

**Filter chip row above the list:**

```
[All] · [Missing income] · [Missing shelter] · [Missing OBBBA chain] · [Stack engaged — verify projection]
```

The last chip is the validation lens: filter to packets where the full stack DID engage, then read their average per-packet PER — if it's at or below 5.5%, the thesis holds for that cohort.

**Empty state:** if `totalPackets === 0`, show one explainer card: *"No packets in this period. The formula above projects from coverage at full stack engagement; observed-engagement contributions will populate as applicants flow in."*

**Sparse state (n < 20):** render the rows that exist; no padding-to-20.

### 3.4 CalibrationPanel (kept from current `BaselinePanel`, reframed)

Keep the dumbbell — it's honest and the right surface for what it shows. Strip the heavy framing.

**Before:** "Are our errors in the same places as the statewide baseline?" + 8-line description.

**After:** small section under IncomingDataFeed.

- Title: `Calibration · USDA observed vs Civica observed`
- One-paragraph subtitle: *"Once navigators sample ≥30 cases via QC outcomes, this chart compares Civica's error-type distribution against USDA FY24 CA. Disagreement signals miscalibrated pillar weights in the formula above."*
- Dumbbell when `sampleN ≥ 30`; explanatory placeholder when not.
- Total card height ≤ 40% of pre-redesign.

**Reframed purpose:** this is the formula's falsification surface. When QC samples exist, you read down each pillar and check whether observed error-mix matches the weights in §3.1's formula. Material disagreement = the formula's pillar weights need recalibration.

### 3.5 MethodFooter (slim strip — replaces `ErrorReductionProjectionPanel`'s caveat block)

One 40px strip at the very bottom of the page:

```
[info icon] Projection at full stack engagement (~5.5%) is computed from per-pillar
defensibility error probabilities applied to CA FY23 element-attribution shares.
Method: docs/plans/civica-error-reduction-thesis.md §4 → · OBBBA audit: → · Baseline: USDA FNS-380 FY24
```

One line, three links, no 44px display number. The five-paragraph caveat from the current page is gone — the formula's two-halves rendering already does the "projection vs measurement" work visually.

### 3.6 OBBBAReadinessStrip — regulatory readiness beside the formula

Per arch-finding A3 (eng review 2026-05-25), OBBBA is NOT a pillar in the formula. CA FY24 baseline predates OBBBA enforcement; OBBBA-correctness prevents a new kind of error in the post-OBBBA world. OBBBA gets its own section, sitting between PillarTracking and IncomingDataFeed, framed as "regulatory readiness" not "PER contributor."

Two characteristics distinguish OBBBA from the formula pillars:

- **Categorical, not continuous:** Income / Shelter / Lease / Calc apply to all packets at a coverage rate. OBBBA applies *only to OBBBA-impacted packets* (work-required age band, claimed exemption, distress-flag respondent). The strip metric is *"X% of OBBBA-impacted packets ran the rule chain to completion."*
- **Multi-track shipping status:** unlike Income (Argyle, single integration), OBBBA has several rule tracks at different shipping stages. Strip needs to surface this.

**OBBBAReadinessStrip — section shape:**

```
┌─ OBBBA REGULATORY READINESS ──── prevents a new error surface, not in formula ─┐
│  Tools: work-requirement age bands · exemption rules · distress gate           │
│  OBBBA-impacted subset: X% of CA SNAP applicants (work-required + exempt)      │
│  Required engagement: 100% of impacted packets must run the chain              │
│  Observed today:      X% of impacted packets evaluated                         │
│                                                                              │
│  Track readiness:                                                            │
│    ✓ Track 1     · shipped (PR #62, 2026-05-17) — core OBBBA SNAP rules     │
│    ✓ 1.1 / 1.2   · shipped — work-req age bands                              │
│    ⏳ 1.3         · counsel pending — Native American exemption logic        │
│    ⏳ Track 2     · counsel pending — ABAWD reauth                           │
│    ⏳ Track 3     · external pending                                         │
│    ⏳ Q5         · pending — distress-prompt confirmation gate               │
│                                                                              │
│  Bottleneck: counsel on Track 2/3 + Native American exemption                │
│  Lever:     unblock 1.3 to unlock ~X% of impacted packets                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Engine wiring needed:**

- Per-packet OBBBA-impact tag (work-required age, claimed exemption, etc.) — derive from `packet_answers` + applicant DOB; helper added to `apps/dashboard/lib/analytics/obbba.ts` (the existing OBBBA module).
- Per-packet OBBBA rule-chain output (pass / fail / pending-counsel per track) — likely lives in a sibling of `packet_error_risk` or as `factors` entries within it.
- Per-track shipping-status registry — **reuse `obbbaProvisions()` from [`apps/dashboard/lib/analytics/obbba.ts`](../../apps/dashboard/lib/analytics/obbba.ts)** (already powers `/compliance` via `ObbbaReadinessPanel`). Each provision already carries `status` (`Ready`/`Partial`), `posture`, `deadlineIso`, `source`, `authorities`, `stakeholders`. If the /qc pillar needs additional fields (e.g. `engineReadiness: boolean`, `observedEngagementPct: number`), extend the existing `ObbbaProvision` interface — do NOT fork a parallel `lib/obbba-tracks.ts`.

**Scope reduction (eng review 2026-05-25):** v2 originally proposed `lib/obbba-tracks.ts` as a new static config. Step 0 found `obbbaProvisions()` already exists with richer fields and is the registry of record. Reusing it keeps `/qc` and `/compliance` in sync about OBBBA shipping status — when counsel/external answers land on Track 2/3 or 1.3, both pages update from one source. Also consider compactly embedding `ObbbaReadinessPanel` or extracting its track-row primitive into a shared component if visual alignment between the two pages is desired.

**Why OBBBA-as-separate-section (not in formula):** decided 2026-05-25 per arch-finding A3. CA FY24 baseline (10.98%) was measured pre-OBBBA enforcement; OBBBA-correctness doesn't reduce the FY24 baseline. OBBBA prevents a new kind of error in the post-OBBBA world — that's a different formula. Putting OBBBA in the same equation as Income/Shelter/Lease/Calc would conflate two different surfaces. As its own section, OBBBA can show track-readiness honesty (counsel/external blockers) without distorting the per-pillar contributions to the FY24-anchored projected PER.

**Visual placement:** OBBBAReadinessStrip sits between PillarTracking and IncomingDataFeed. Visually styled as a peer to PillarTracking but with an `indigo` accent token (vs. semantic pillar colors) and a header eyebrow reading "Regulatory readiness · OBBBA" to make the separation unmistakable.

## 4. Data needs

Most data is already fetched in `app/qc/page.tsx` (lines 25-60). What's new:

**Existing (kept):**

- `snap_packets` — total packets
- `argyle_connections` — earned-income coverage
- `packet_error_risk` — score + tier + factors per packet
- `qc_outcomes` — calibration sample
- `packet_answers` — SUA / housing / employment intake signals
- `uploaded_documents` (lease, confirmed) — shelter doc coverage

**New for v2 (FormulaHero + OBBBA pillar + IncomingDataFeed):**

- `engagementImpliedPER` derived value + per-pillar contribution math — see formula in §3.1. **Lives in `packages/snap-qc-engine/src/scoring/error-risk.ts`** alongside existing `ERROR_WEIGHT`, `INCOME_GROUP_PER_FY23`, `CA_INCOME_GROUP_PER_FY23`, `CA_ELEMENT_ATTRIBUTION_FY23` constants. New exports: `computeProjectedPER(pillarEngagement)`, `computeEngagementImpliedPER(observedEngagement)`, `pillarContribution(pillar, engagement)`. The dashboard imports them; no duplication of constants page-side. (Scope-reduction decision, eng review 2026-05-25.)
- OBBBA-impact join — for each packet, a flag indicating OBBBA impact (work-required age, exemption claim, distress flag). Logic lives as a helper in **existing** `apps/dashboard/lib/analytics/obbba.ts`. Reads against `packet_answers` (DOB-derived age band, exemption questions).
- OBBBA rule-chain output per packet — pass / fail / pending-counsel per track. Verify whether `packet_error_risk.factors` already encodes this before adding any new table.
- OBBBA track-readiness registry — **reuse `obbbaProvisions()`** from `apps/dashboard/lib/analytics/obbba.ts`. Extend the existing `ObbbaProvision` interface only if /qc-specific fields (e.g. `engineReadiness: boolean`) are needed.

**Add later (v3):**

- `v_thesis_realization` view that calls the engine's `computeEngagementImpliedPER` derivation against current packet rows server-side, refreshed on packet insert/update. (Engine is the source of truth; the view is a caching surface.)
- `v_obbba_engagement` view giving per-pillar OBBBA observed-engagement % refreshed similarly.

## 5. Design-system constraints (from DESIGN.md — survives v1)

- Pine reserved for CTAs — no pillar bar uses pine; pillar bars use category-semantic colors (teal income, indigo OBBBA, warning shelter-heuristic, graphite calc/residual).
- `text-amber` for positive outcomes only — pillar status pills use `text-warning` (heuristic) or category-semantic color (Strong tier).
- `text-brick` only for: realization-gap-widening trend indicator, residual-pillar header.
- Hairline borders, no shadows on rows. Pillar strips separated by `border-t border-hairline`.
- `tabular-nums` on every percent / count / weight / pts. `font-mono` for packet IDs and provenance footer.
- Radius ≤ 4px on sections; 0px on strip rows.
- Hanken Grotesk; no system-ui fallbacks.
- Eyebrow class for section labels. Section titles use `text-[20px] font-semibold`.
- Single 32px display number on page: `ENGAGEMENT REALIZATION GAP`. Every other numeric is ≤ 18px.

## 6. Interaction states

| Surface | Loading | Empty | Error | Sparse |
|---|---|---|---|---|
| FormulaHero | skeleton 8 rows | n=0: shows projected half only, current-data half with `—` per row | per-cell `—` if pillar engagement undefined | grey out current-data half until n ≥ 5 packets |
| PillarTracking | skeleton 4 strips | n=0: required-vs-observed bars at required only, observed bar empty with "n=0" note | strip-level error chip if pillar data fetch failed | "n < 5 — provisional" footnote on observed bar |
| OBBBA pillar (extension) | track-readiness section has loading skeleton | n=0 impacted packets: strip shows "no OBBBA-impacted packets in period · 100% of 0 = N/A" | track-readiness fetched separately; if registry fails, fall back to "track status unavailable" | per-track ⏳ if shipped_at is null in registry |
| IncomingDataFeed | 5 skeleton rows | "No packets in period · formula above projects what would happen as applicants flow in" | row-level error chip if `packet_error_risk` failed for that packet | filter chips count `(0)` when slice yields nothing |
| CalibrationPanel | n/a | "Awaiting ≥30 QC samples · n = N today" | n/a | dumbbell renders with reduced opacity until n ≥ 30 |
| MethodFooter | static | static | static | n/a |

## 7. Responsive

- ≥1024px: full layout — FormulaHero table 3-column, PillarTracking strips full-width, IncomingDataFeed table 7-column.
- 768–1023px: FormulaHero stays 3-column; PillarTracking strips fold "Bottleneck" + "Lever" into a single line; IncomingDataFeed drops "Days pending" and "Gap to thesis" columns (move to tooltip on Per-packet PER cell).
- <768px: FormulaHero becomes stacked rows (label above value); PillarTracking becomes stacked cards (one card per pillar, sub-rows stacked); IncomingDataFeed becomes scrollable horizontal table with sticky packet-ID column.

## 8. Accessibility

- FormulaHero is a real `<table>` with `<caption>` (visually hidden): "Civica error-rate thesis · projected vs current-data." Result rows marked `<tr role="presentation">` is the wrong call — use `<th scope="row">` for `PROJECTED PER` and `ENGAGEMENT-IMPLIED PER` labels so screen readers announce the relationship.
- `ENGAGEMENT REALIZATION GAP` row has `aria-live="polite"` so screen readers re-announce when the gap value changes (e.g. period switch).
- PillarTracking strip required-vs-observed bars: `role="img"` + `aria-label="Required 75 percent, observed 42 percent, shortfall 33 points."`
- OBBBA track-readiness sub-row: each track is `<li>` inside `<ul role="list">` with status announced as text ("Track 1, shipped May 17 2026 · 1.3 Native American exemption, counsel pending").
- IncomingDataFeed engagement-vector icons: each dot has `aria-label="Argyle income, signal present"` etc. Row has hidden summary cell: "Packet ABC, 3 of 4 pillars engaged, missing OBBBA chain, current realization gap 1.2 points."
- Filter chips: `<button role="radio">` inside `<div role="radiogroup" aria-label="Filter packets by engagement">`.
- Color-coded gap trends: paired with arrow glyph (▲ widening / ▼ narrowing / ≈ flat) so the trend is not color-only.

## 9. What gets deleted / repurposed

| Existing file | Fate |
|---|---|
| `components/qc/ErrorReductionProjectionPanel.tsx` | **Delete.** PillarCard logic survives as inspiration for PillarTracking strips; the hero card + caveat block are gone. 5.5% claim moves to `MethodFooter` (one line) + `FormulaHero` (one cell, not a 44px hero). |
| `components/qc/ApiCoveragePanel.tsx` | **Delete.** Coverage bar logic merges into PillarTracking strip's required-vs-observed bar pair. API cards retire — that data lives in pillar strip "Tools" line + Track readiness sub-row (OBBBA). |
| `components/qc/ScoringPanel.tsx` | **Delete.** Donut completeness + maturity ladder + per-flow defensibility bars all collapse into PillarTracking strips. Scoring maturity becomes one cell in page header: `Scoring maturity · Phase 1 of 3`. |
| `components/qc/BaselinePanel.tsx` | **Keep, shrink, reframe.** Dumbbell stays. Header copy rewritten per §3.4. Becomes "calibration / falsification" not "baseline comparison." |
| `app/qc/page.tsx` data fetches | **Keep, extend.** All current queries still needed. Add OBBBA-impact derivation + engagementImpliedPER computation. |

New components:

- `apps/dashboard/components/qc/FormulaHero.tsx`
- `apps/dashboard/components/qc/PillarTracking.tsx` (single component, four strips + OBBBA-extended strip + residual footer)
- `apps/dashboard/components/qc/IncomingDataFeed.tsx`
- `apps/dashboard/components/qc/MethodFooter.tsx` (one-strip)

Engine package extensions (cross-workspace):

- `packages/snap-qc-engine/src/scoring/error-risk.ts` — add `computeProjectedPER`, `computeEngagementImpliedPER`, `pillarContribution` alongside existing `scoreErrorRisk` / `ERROR_WEIGHT` / `CA_ELEMENT_ATTRIBUTION_FY23`. Bump engine version (semver minor — new exports only, no breaking changes).
- `packages/snap-qc-engine/src/index.ts` — re-export the new functions.

Existing modules touched (dashboard):

- `apps/dashboard/lib/analytics/obbba.ts` — add OBBBA-impact helper (DOB-derived work-required age band, exemption flag). Possibly extend `ObbbaProvision` interface with `engineReadiness: boolean` if /qc needs it.
- `apps/dashboard/app/qc/page.tsx` — composition rewrite, imports engine functions, calls obbbaProvisions().

**No new `lib/obbba-tracks.ts`. No new `obbba_classifications` / `obbba_tracks` Supabase tables.** (Scope-reduction decisions, eng review 2026-05-25.)

## 10. Unresolved decisions (for eng review)

1. **Does OBBBA enter the formula as a fourth pillar, or as a separate companion panel?** Recommend fourth pillar — formula stays one readable equation. But OBBBA's PER contribution is small (capped by underpayment share); eng review should verify whether it muddies the formula's signal-to-noise. If yes, move OBBBA to a parallel "Regulatory readiness" panel directly under PillarTracking.
2. **`engagementImpliedPER` derivation: engine-package function (v1) vs. SQL view (v2)?** Decided 2026-05-25: derivation lives in `packages/snap-qc-engine` v1; SQL view (`v_thesis_realization`) is v2 caching surface that calls the engine function. Dashboard imports from engine package; never duplicates constants. Open sub-question: dashboard server-side call directly from `app/qc/page.tsx`, or via an internal API route for cleaner cache boundaries? Recommend direct call in v1.
3. **OBBBA-impact tagging: derive client-side from `packet_answers` + DOB, or add `obbba_classifications` table?** Decided 2026-05-25: derive in v1, helper added to existing `lib/analytics/obbba.ts`. Promote to table in v2 only if eligibility logic grows past one helper file.
4. **OBBBA tracks registry shape.** Decided 2026-05-25: reuse `obbbaProvisions()` from `lib/analytics/obbba.ts`. Open sub-question: extend `ObbbaProvision` interface in place (adds /qc-specific fields like `engineReadiness`, `observedEngagementPct` to all provisions) vs. compute /qc-specific fields page-side from existing fields (interface stays narrow). Recommend page-side computation — keeps the shared registry clean.
5. **`ENGAGEMENT REALIZATION GAP` trend direction: 30d / 90d / FY24 — how is "widening/narrowing" computed when period switches?** Recommend: compare current-data PER at end of period vs midpoint of period. Eng review to confirm.
6. **IncomingDataFeed length: 20, 50, or paginated?** Recommend 20 with "view all" → future `/qc/feed`. Suspense per row if >50.
7. **Engagement-vector visualization: dot icons (denser) vs. named-pillar pills (more accessible)?** Recommend pills v1; revisit icons if row gets cramped.
8. **`scoreErrorRisk()` output placement:** absorbed into IncomingDataFeed's "Per-packet PER" column? Or surfaced separately? Recommend: per-packet PER IS the rendered form of `scoreErrorRisk()` for this page; no separate surface.
9. **Residual pillar (RSDI / SSI / etc.): show in formula as a constant `−Xpts` line, or omit?** Recommend show — completeness keeps the formula honest. It's the irreducible floor.

## 11. Implementation tasks

- [ ] **T0 (P1, human: ~3h / CC: ~25min)** — Extend `packages/snap-qc-engine` with `ERROR_WEIGHT_UNNORMALIZED`, `RESIDUAL_FLOOR_SHARE`, `computeProjectedPER`, `computeEngagementImpliedPER`, `pillarContribution`
  - Surfaced by: §3.1 + §4 + scope-reduction decision 2026-05-25 (formula constants already live in engine) + arch-finding A1 (engine ERROR_WEIGHT is authoritative source) + arch-finding A2 (population PER needs un-renormalized weights to keep residual explicit)
  - Files: `packages/snap-qc-engine/src/scoring/error-risk.ts`, `packages/snap-qc-engine/src/index.ts`, `packages/snap-qc-engine/CHANGELOG.md`, `packages/snap-qc-engine/package.json` (semver minor bump), `packages/snap-qc-engine/__tests__/error-risk.test.ts`
  - API shape (arch-finding A4): `computeProjectedPER({income, shelter, lease, calc}: PillarCoverage): number` and `computeEngagementImpliedPER({income, shelter, lease, calc}: PillarCoverage): number` take a struct (not array). `PillarCoverage` is its own type, distinct from `ScoringInput[]` so TypeScript catches mis-shaping. `pillarContribution(pillar: keyof PillarCoverage, engagement: number): number`. Weights stay module-private.
  - Defensive boundaries (code-quality finding CQ2): both `computeProjectedPER` and `computeEngagementImpliedPER` clamp engagement inputs to `[0, 1]`; NaN inputs (from `0/0` total-packets division) coerce to `0`. Functions never throw, never return NaN. Match `scoreErrorRisk`'s forgiving-default posture.
  - Citation depth (cross-model tension #3, decided 2026-05-25): annotate each `ERROR_WEIGHT_UNNORMALIZED` entry with row-by-row USDA citation. Format: `// utility-sua: 0.399 — FNS-380 element 363 (Shelter deduction, sua-portion 81.6%) + 364 (SUA) = 39.94×0.816 + 4.49. Source: ca_fy2023_element_attribution.csv. Measurement window: CA FY23.` Same treatment for gig-income, shared-lease, benefit-impact-projection. `RESIDUAL_FLOOR_SHARE` annotates which elements compose the residual (331 RSDI, 333 SSI, 346 other unearned, 365 medical, 350 child-support, 334 unemployment) with their share_pct from CA_ELEMENT_ATTRIBUTION_FY23. External reviewers can now verify the formula without trusting opaque constants.
  - Verify: (a) new constants `ERROR_WEIGHT_UNNORMALIZED` sums to ~0.81 across 4 in-formula flows (utility-sua, gig-income, shared-lease, benefit-impact-projection — assets near-zero is folded into residual), `RESIDUAL_FLOOR_SHARE ≈ 0.19`; (b) `computeProjectedPER({income: 0.75, shelter: 0.75, lease: 0.75, calc: 1.0}) ≈ 5.5%` with residual term included; (c) `computeEngagementImpliedPER` against fixture coverage rates returns value between projected and baseline; (d) existing `scoreErrorRisk` callers + golden fixtures unchanged (no renormalized-weights breaking change); (e) parity test: weighted contributions + residual sum to baseline-PER reduction; (f) TypeScript test: passing `ScoringInput[]` to `computeEngagementImpliedPER` fails to compile; (g) boundary tests: `computeEngagementImpliedPER({income: NaN, shelter: 1.5, lease: -0.3, calc: 1.0})` returns finite number matching `computeEngagementImpliedPER({income: 0, shelter: 1, lease: 0, calc: 1.0})`
- [ ] **T1 (P1, human: ~4h / CC: ~30min)** — Build `FormulaHero` component with both-halves table + realization gap row
  - Surfaced by: §3.1 — the page's central operable equation
  - Files: `apps/dashboard/components/qc/FormulaHero.tsx` (new), `apps/dashboard/app/qc/page.tsx`
  - Depends on: T0
  - Verify: projected half matches existing 5.5% thesis; current-data half computes from live `argyle_connections` / `uploaded_documents` / `packet_answers` engagement rates via engine import; realization gap is the only 32px number on the page
- [ ] **T2 (P1, human: ~4h / CC: ~30min)** — Build `PillarTracking` component with 4 pillar strips (Shelter, Income, Lease, Calc) + residual footer (no OBBBA strip — see T4)
  - Surfaced by: §3.2 — pillar-by-pillar thesis-tracking matching formula §3.1
  - Files: `apps/dashboard/components/qc/PillarTracking.tsx` (new), `apps/dashboard/app/qc/page.tsx`
  - Depends on: T0
  - Verify: 4 strips match the 4 formula pillars (Shelter ~39.9%, Income ~28.5%, Lease ~7.9%, Calc ~4.1%) with required vs observed bar pair + bottleneck + lever; residual footer shows ~19.6% as a 32px strip; OBBBA is NOT in this component
- [ ] **T3 (P1, human: ~3h / CC: ~25min)** — Build `IncomingDataFeed` with filter chips + per-packet realization columns
  - Surfaced by: §3.3 — "pulling data from applicants to see how it is tracking" verbatim
  - Files: `apps/dashboard/components/qc/IncomingDataFeed.tsx` (new), `apps/dashboard/app/qc/page.tsx`
  - Depends on: T0
  - Verify: last 20 packets, engagement vector per packet, filter chips re-slice the list, "stack-engaged" chip exposes the cohort PER for thesis validation
- [ ] **T4a (P1, human: ~30min / CC: ~10min)** — Extract `OBBBATrackRow` primitive from `ObbbaReadinessPanel.tsx`
  - Surfaced by: code-quality finding CQ1 (2026-05-25) — both /compliance and /qc render `obbbaProvisions()`; sharing the row primitive prevents drift
  - Files: `apps/dashboard/components/compliance/OBBBATrackRow.tsx` (new — extracted from existing panel), `apps/dashboard/components/compliance/ObbbaReadinessPanel.tsx` (compose the extracted row)
  - Depends on: nothing (can land before T0)
  - Verify: `/compliance` page renders byte-identical (visual snapshot test if available); extracted primitive accepts an `ObbbaProvision` + display-mode prop and is reusable; existing /compliance test in `apps/dashboard/lib/analytics/__tests__/obbba.test.ts` still passes
- [ ] **T4b (P1, human: ~1.5h / CC: ~12min)** — Build `OBBBAReadinessStrip` (regulatory readiness, NOT formula pillar) using the shared `OBBBATrackRow` primitive
  - Surfaced by: §3.6 + arch-finding A3 (2026-05-25 — OBBBA prevents new error surface, doesn't reduce FY24 baseline; lives beside formula not in it)
  - Files: `apps/dashboard/components/qc/OBBBAReadinessStrip.tsx` (new — composes OBBBATrackRow), `apps/dashboard/lib/analytics/obbba.ts` (extend with per-packet OBBBA-impact helper from `packet_answers` + DOB), `apps/dashboard/app/qc/page.tsx`
  - Depends on: T4a
  - Verify: strip is visually distinct from PillarTracking (indigo accent, "Regulatory readiness · OBBBA" eyebrow); track-readiness sub-row pulls from `obbbaProvisions()` via shared `OBBBATrackRow`; OBBBA-impacted subset % matches counsel-confirmed eligibility logic; strip does NOT add or subtract from the PER number in FormulaHero
  - Note (cross-model tension #4 deferred 2026-05-25): full OBBBA-impact contract (TypeScript type of packet_answers keys consumed, exemption mapping rules, PENDING_COUNSEL semantics for 1.3 Native American exemption) deferred to TODO — see §11 follow-up TODOs. T-test-6 ships with author-intent coverage; contract-driven tests follow when counsel answers land.
- [ ] **T5 (P1, human: ~1h / CC: ~10min)** — Retire `ErrorReductionProjectionPanel`; introduce `MethodFooter` single-line strip
  - Surfaced by: §3.5 + §9 — caveat block compresses to one line, 5.5% claim demoted to formula cell
  - Files: `apps/dashboard/components/qc/MethodFooter.tsx` (new), `apps/dashboard/components/qc/ErrorReductionProjectionPanel.tsx` (delete), `apps/dashboard/app/qc/page.tsx`
  - Verify: page bottom shows one 40px strip with three links; no hero panel
- [ ] **T6 (P1, human: ~1h / CC: ~10min)** — Retire `ScoringPanel`; surface "Scoring maturity · Phase 1 of 3" inline in page header
  - Surfaced by: §9 — donut + ladder + def-bars absorbed into PillarTracking
  - Files: `apps/dashboard/components/qc/ScoringPanel.tsx` (delete), `apps/dashboard/app/qc/page.tsx`
  - Verify: no separate scoring section; maturity is one cell beside page title
- [ ] **T7 (P1, human: ~1h / CC: ~10min)** — Retire `ApiCoveragePanel`; coverage data absorbed into PillarTracking
  - Surfaced by: §9 — API cards + headline numbers retire, bar logic survives inside pillar strips
  - Files: `apps/dashboard/components/qc/ApiCoveragePanel.tsx` (delete), `apps/dashboard/app/qc/page.tsx`
  - Verify: no separate API panel; "Tools" line in each pillar names the API/engine
- [ ] **T8 (P2, human: ~1h / CC: ~10min)** — Shrink `BaselinePanel` to compact calibration card + reframe header copy
  - Surfaced by: §3.4 — dumbbell stays, narrative compresses, becomes "falsification surface"
  - Files: `apps/dashboard/components/qc/BaselinePanel.tsx`
  - Verify: card height ≤ 40% of pre-change; dumbbell still renders when sampleN > 0
- [ ] **T9 (P2, human: ~3h / CC: ~20min)** — Server-side `v_thesis_realization` SQL view that calls engine `computeEngagementImpliedPER` (or replicates its math from engine-exported constants)
  - Surfaced by: §4 + §10 #2 — caching surface, not a fork of the formula
  - Files: `supabase/migrations/` (new view), `apps/dashboard/app/qc/page.tsx`
  - Depends on: T0
  - Verify: FormulaHero reads from view; numbers match engine direct-call output (parity test); recompute time < 100ms
- [ ] **T10 (P2, human: ~2h / CC: ~15min)** — Accessibility pass per §8 — table semantics, `aria-live` on gap, engagement-vector summaries, filter `radiogroup`
  - Surfaced by: §8
  - Files: `apps/dashboard/components/qc/FormulaHero.tsx`, `apps/dashboard/components/qc/PillarTracking.tsx`, `apps/dashboard/components/qc/IncomingDataFeed.tsx`
  - Verify: VoiceOver reads FormulaHero top-to-bottom as one equation; gap value re-announces on period switch
- [ ] **T11 (P3, human: ~2h / CC: ~15min)** — Drill-in: clicking an IncomingDataFeed row navigates to `/packets/[packetId]` with QC context preserved
  - Surfaced by: §3.3 — per-packet detail handoff
  - Files: `apps/dashboard/components/qc/IncomingDataFeed.tsx`, `apps/dashboard/app/packets/[packetId]/page.tsx`
  - Verify: clicking a row deep-links to packet detail; back navigation preserves filter state

### Test tasks (per test-review 2026-05-25, full component coverage chosen)

- [ ] **T-test-1 (P1, human: ~1h / CC: ~10min)** — CRITICAL regression test for `/compliance` (extract pre-requisite)
  - Surfaced by: test review REGRESSION RULE (2026-05-25) — T4a extracts OBBBATrackRow from ObbbaReadinessPanel; existing /compliance has ZERO tests; extraction without snapshot is silent visual regression risk
  - Files: `apps/dashboard/components/compliance/__tests__/ObbbaReadinessPanel.test.tsx` (new), `apps/dashboard/app/compliance/__tests__/page.test.tsx` (new if absent)
  - Depends on: nothing (must land BEFORE T4a)
  - Verify: snapshot test of ObbbaReadinessPanel with fixture provisions + behavioral assertions (NOT just snapshot): each obbba_provision tier (hero/standard/posture) renders its expected fields; status pill, posture text, deadline ISO, source path link all appear with correct contents per provision; after T4a extraction, all assertions pass — the snapshot ensures byte-identity, the behavioral assertions ensure the snapshot wasn't capturing a pre-existing bug. (Outside voice point #3 partial response: snapshot alone is checkbox safety; pair with behavioral assertions to make extraction safety real.)
- [ ] **T-test-2 (P1, human: ~30min / CC: ~10min)** — FormulaHero render + interactions
  - Surfaced by: test review §3 — happy-path + empty + sparse + a11y
  - Files: `apps/dashboard/components/qc/__tests__/FormulaHero.test.tsx` (new)
  - Depends on: T1
  - Verify: renders both halves with fixture, gap row computes delta correctly, aria-live attribute present on gap row, empty state (n=0) renders projected-only half, sparse state (n<5) shows grey current-data half
- [ ] **T-test-3 (P1, human: ~30min / CC: ~10min)** — PillarTracking render + bar-pair rendering
  - Surfaced by: test review §3
  - Files: `apps/dashboard/components/qc/__tests__/PillarTracking.test.tsx` (new)
  - Depends on: T2
  - Verify: 4 strips render with correct USDA weight labels matching `ERROR_WEIGHT_UNNORMALIZED`, residual footer renders at ~19.6%, OBBBA strip is NOT present, required-vs-observed bars render in proportional widths
- [ ] **T-test-4 (P1, human: ~45min / CC: ~12min)** — IncomingDataFeed render + filter chips + row click
  - Surfaced by: test review §3 — filter chip behavior is the user-facing interaction most likely to drift
  - Files: `apps/dashboard/components/qc/__tests__/IncomingDataFeed.test.tsx` (new)
  - Depends on: T3
  - Verify: renders last 20 packets from fixture, each filter chip (`all` / `missing-income` / `missing-shelter` / `missing-obbba-chain` / `stack-engaged`) re-slices correctly, filter chips use `role="radio"` inside `role="radiogroup"`, row click fires expected navigation handler with packet ID, empty state explainer renders when no packets
- [ ] **T-test-5 (P1, human: ~30min / CC: ~10min)** — OBBBATrackRow + OBBBAReadinessStrip render
  - Surfaced by: test review §3 + CQ1 — shared primitive needs its own tests so both consumers stay safe
  - Files: `apps/dashboard/components/compliance/__tests__/OBBBATrackRow.test.tsx` (new), `apps/dashboard/components/qc/__tests__/OBBBAReadinessStrip.test.tsx` (new)
  - Depends on: T4a, T4b
  - Verify: OBBBATrackRow renders an ObbbaProvision with correct status pill + posture + deadline; OBBBAReadinessStrip composes the row primitive, shows OBBBA-impacted subset %, renders "Regulatory readiness · OBBBA" eyebrow, fingerprints a `data-testid="obbba-strip"` that's distinct from PillarTracking
- [ ] **T-test-6 (P1, human: ~30min / CC: ~10min)** — OBBBA-impact helper unit tests
  - Surfaced by: test review §3 — new derivation logic in lib/analytics/obbba.ts (DOB → work-required age band, exemption flag detection)
  - Files: `apps/dashboard/lib/analytics/__tests__/obbba.test.ts` (extend existing)
  - Depends on: T4b
  - Verify: 18-59 year olds without exemption are flagged work-required; 60+ exempt; ANCSA-region applicants flagged for 1.3 exemption (pending counsel); existing obbbaProvisions() output unchanged (no drift)
- [ ] **T-test-7 (P1, human: ~15min / CC: ~5min)** — Engine package unit tests for T0 (separate task so review can verify)
  - Surfaced by: test review §3 — T0 verify line names the test cases but the task list should call them out explicitly
  - Files: `packages/snap-qc-engine/test/error-risk.test.ts` (extend existing)
  - Depends on: T0
  - Verify: cases (a)-(g) from T0 verify line all pass; tests cover clamp boundaries, NaN coercion, projected ≈ 5.5%, residual term is additive, TypeScript-level shape distinction

## 11.5 NOT in scope

Work considered during eng review and explicitly deferred. Each has a one-line rationale.

- **`v_thesis_realization` SQL view.** Engine direct-call from `app/qc/page.tsx` is sufficient at UAT scale (<500 packets). Promote when packet volume forces SSR latency above the page's perf budget. Tracked as T9 P2.
- **Per-section Suspense boundaries on /qc.** Existing 6-query SSR latency is a project-wide concern already tracked in `apps/dashboard/DESIGN.md` §8. This redesign neither helps nor harms; will land alongside the broader Suspense effort.
- **Full OBBBA-impact contract documentation.** TypeScript type listing every `packet_answers` key consumed, exemption mapping rules, PENDING_COUNSEL semantics for 1.3 Native American exemption. Deferred to TODO; T-test-6 ships with author-intent coverage. Land when counsel/external answers on Track 2/3 + 1.3 land.
- **ObbbaProvision interface extension (`engineReadiness`, `observedEngagementPct`).** §10 #4 chose to compute /qc-specific fields page-side rather than extending the shared registry interface. Revisit if 3+ pages need the same /qc-specific computation.
- **Performance budget + measurement plan.** Outside voice flagged absence (#5). Real concern but a project-level v2 — not /qc-specific.
- **`/qc/feed` sub-page.** Future home of paginated IncomingDataFeed when n > 50 packets per period. T11 leaves the drill-in hook; the destination page is not in this scope.
- **OBBBA-as-formula-pillar.** Considered (arch-finding A3). Rejected because CA FY24 baseline predates OBBBA enforcement. Revisit if a post-OBBBA baseline (e.g., FY27) becomes the anchor.

## 11.6 What already exists (and is being reused, not rebuilt)

- [`packages/snap-qc-engine/src/scoring/error-risk.ts`](../../packages/snap-qc-engine/src/scoring/error-risk.ts) — `scoreErrorRisk`, `ERROR_WEIGHT`, `INCOME_GROUP_PER_FY23`, `CA_INCOME_GROUP_PER_FY23`, `CA_ELEMENT_ATTRIBUTION_FY23`. T0 extends; does not duplicate.
- [`apps/dashboard/lib/analytics/obbba.ts`](../../apps/dashboard/lib/analytics/obbba.ts) — `obbbaProvisions()` with 7 SNAP provisions, full status/posture/deadline/source/stakeholders/market-opportunity fields. T4 extends with the OBBBA-impact helper; does not fork a new registry.
- [`apps/dashboard/components/compliance/ObbbaReadinessPanel.tsx`](../../apps/dashboard/components/compliance/ObbbaReadinessPanel.tsx) — visual rendering of obbbaProvisions(). T4a extracts the row primitive; the panel keeps composing it. /compliance renders byte-identical post-extraction.
- [`apps/dashboard/components/Funnel.tsx`](../../apps/dashboard/components/Funnel.tsx) — proportional-bar primitive. PillarTracking's required-vs-observed bars reuse the same visual pattern, not a new bar component.
- `snap_packets`, `argyle_connections`, `packet_error_risk`, `qc_outcomes`, `packet_answers`, `uploaded_documents` Supabase fetches — already in `app/qc/page.tsx:25-60`. The redesign reuses the same query block; no new Supabase round-trips.
- [`apps/dashboard/DESIGN.md`](../../apps/dashboard/DESIGN.md) — semantic tokens (pine = CTA only, brick = recovery, warning ≠ amber, hairline borders, Hanken Grotesk, tabular-nums). All new components consume tokens; no new color or type tokens introduced.

## 11.7 Failure modes

Realistic production failure scenarios for each new codepath + whether the plan covers them.

| Failure | Likelihood | Detection | Plan coverage |
|---|---|---|---|
| `computeEngagementImpliedPER` returns NaN (0/0 packet-total) | Medium (demo / first-deploy with empty DB) | Page renders `NaN%` in hero | ✓ CQ2 — engine clamps inputs, returns finite always |
| `packet_error_risk` query partial failure mid-render | Low (Supabase outage) | Per-row error chip in IncomingDataFeed | ✓ §6 interaction-state table — row-level error chip specified |
| OBBBA registry import fails | Very low (static import) | OBBBA strip blank | ✓ §6 — fallback "Track status unavailable" |
| `/compliance` visual regression after T4a | Medium (if extraction is rougher than expected) | Visual diff or human catch in QA | ✓ T-test-1 — snapshot + behavioral assertions, CRITICAL P1 |
| Engine version bump breaks existing `scoreErrorRisk` callers | Low (additive change only) | golden-fixture tests | ✓ T0 verify (d) — existing scoreErrorRisk callers + golden fixtures unchanged |
| `engagementImpliedPER` vs measured PER divergence misread as falsification | Medium (this was outside voice CMT2) | User confusion | ✓ §3.1 framing — explicit "engagement-implied" label, MethodFooter explains |
| OBBBA-impact helper miscategorizes 1.3 Native American applicant | Unknown (counsel-pending) | counsel review | ⚠ Partial — T-test-6 verifies author-intent; full contract deferred per CMT4 → TODO |

One **partial gap**: OBBBA-impact 1.3 misclassification is the failure mode the deferred contract (TODO-OBBBA-CONTRACT) is meant to lock down. Acceptable for v1 (counsel answers themselves are pending); ship test coverage of the contract when those answers land.

## 11.8 Worktree parallelization

Three independent lanes; T-test-1 is the rate-limiting pre-requisite for the /compliance extraction lane.

| Lane | Steps | Modules | Depends on |
|---|---|---|---|
| **A — Engine** | T0 → T-test-7 → (T1, T3, T9) | `packages/snap-qc-engine/`, `apps/dashboard/components/qc/FormulaHero.tsx`, `apps/dashboard/components/qc/IncomingDataFeed.tsx` | — |
| **B — Compliance extraction** | T-test-1 → T4a → T4b → T-test-5 → T-test-6 | `apps/dashboard/components/compliance/`, `apps/dashboard/components/qc/OBBBAReadinessStrip.tsx`, `apps/dashboard/lib/analytics/obbba.ts` | T-test-1 first (regression safety net) |
| **C — Page composition + retirements** | T2, T5, T6, T7, T8 → T-test-2, T-test-3, T-test-4 → T10, T11 | `apps/dashboard/app/qc/page.tsx`, `apps/dashboard/components/qc/PillarTracking.tsx`, retirement deletes | Lanes A + B complete |

**Execution order:** launch A and B in parallel worktrees. When both green, C composes them in `app/qc/page.tsx`.

**Conflict flag:** lanes A and C both touch `app/qc/page.tsx` (imports). C runs after A; merge-time conflict resolution is rebase-friendly because A's change is import additions, C's is full composition rewrite.

## 11.9 Follow-up TODOs (proposed — user can object)

Three TODOs surface from this review. Each has a what/why/effort. User can strike any here.

**TODO-OBBBA-CONTRACT** — document the OBBBA-impact helper's full contract
- **What:** TypeScript type listing every `packet_answers` key consumed by the OBBBA-impact helper, full table of exemption mapping rules, PENDING_COUNSEL semantics for 1.3 Native American exemption.
- **Why:** CMT4 (outside voice #6) — T-test-6 ships verifying author intent without a contract to fail against. When counsel answers Track 2/3 + 1.3 land, contract-driven tests can finalize OBBBA correctness.
- **Effort:** S (human ~1h / CC ~15min)
- **Depends on:** counsel-pending OBBBA Track 2/3 + 1.3 answers (external)
- **Priority:** P2 — implementation ships in v1, contract follows when blockers clear.

**TODO-ENGINE-FNS-CITATIONS** — back-annotate ERROR_WEIGHT_UNNORMALIZED with FNS-380 row IDs
- **What:** Beyond CMT3's per-entry comments (which T0 ships), add a fixture CSV pointer + measurement-window metadata so the engine's USDA citations can be checked against authoritative federal sources without trusting code comments.
- **Why:** Cross-model tension #3 — full closure of the magic-numbers critique. T0 ships partial; full closure pairs comments with verifiable fixtures.
- **Effort:** S (human ~30min / CC ~10min)
- **Priority:** P3 — nice-to-have for external reviewers; not a v1 blocker.

**TODO-QC-SUSPENSE** — per-section Suspense boundaries on /qc page (project-wide pattern)
- **What:** Wrap FormulaHero, PillarTracking, IncomingDataFeed, CalibrationPanel in per-section `<Suspense>` so already-loaded sections render while slower ones spin.
- **Why:** /qc inherits the existing 6-query SSR latency. At UAT scale (n<500) trivial; at prod scale (10K+) Suspense is value. Already tracked in `apps/dashboard/DESIGN.md` §8 as a project-wide concern.
- **Effort:** M (human ~3h / CC ~25min)
- **Depends on:** Next.js Suspense pattern decisions for the broader dashboard.
- **Priority:** P2 — defer until packet volume forces it.

## 12. Verdict on the user's framing

The user reframed in two passes:

- **Pass 1:** "slideshow not engine-explanation" → v1 IA (engine ledger + USDA framework + packet stream)
- **Pass 2:** "I'm a semi-CEO/semi-caseworker tracking the thesis against live data, and the engine needs OBBBA integration" → v2 (this doc)

v2 redesign:

- **Thesis is visible and operable** — the formula renders as a two-halves table, every line item is named, every contribution is computable from live data
- **Hero metric is the realization gap** — one 32px number on the page, the answer to "is the formula holding"
- **Pillars track required vs observed** — Income, Shelter, Calc, **OBBBA**, residual — pillar-by-pillar diagnosis of where the gap is open
- **OBBBA is first-class** — fourth pillar in the formula, track-readiness sub-row surfacing counsel/external blockers, regulatory-readiness story visible alongside API coverage
- **Applicant data feeds the formula** — IncomingDataFeed shows per-packet realization, filter chips expose the stack-engaged cohort for direct thesis validation
- **Calibration is the falsification surface** — kept dumbbell, reframed as "are observed errors distributing as the formula predicts?"

Score on the user's frame after this redesign, projected: **9/10.** The 1 point off is OBBBA Track 2/3 + 1.3 + Q5 not shipped — until counsel/external answers land, the OBBBA pillar's observed-engagement is capped at the shipped-track subset. That's a project-state gap, not a design gap.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 8 in-review issues + 4 cross-model tensions, all resolved. 1 critical regression flagged (T-test-1 covers it). Scope reduced from ~11 files → ~8 by reusing existing primitives. |
| Design Review | `/plan-design-review` | UI/UX gaps | 2 (v1 + v2) | issues_open | v1 4/10 → v1 9/10 (engine-explanation framing); v2 reframed for thesis-tracking reader + OBBBA pillar, projected 9/10 |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CROSS-MODEL:** Outside voice (Claude subagent, codex unavailable) raised 9 findings. 4 substantive cross-model tensions surfaced; user resolved each:
- CMT1 (vanity dashboard): user confirmed real audience (semi-CEO/semi-caseworker thesis owner). Proceed.
- CMT2 (engagementImpliedPER as theater): adopted. Page renamed "current-data PER" → "engagement-implied PER" and "thesis realization gap" → "engagement realization gap" — page no longer claims measurement it can't deliver until QC outcomes ≥ 30.
- CMT3 (magic numbers persisted): adopted. T0 adds row-by-row USDA FNS-380 citations to ERROR_WEIGHT_UNNORMALIZED comments.
- CMT4 (OBBBA contract hand-waved): deferred to TODO-OBBBA-CONTRACT (counsel-pending on Track 2/3 + 1.3 blocks finalization regardless).
- Import audit (outside voice #7): resolved here — ApiCoveragePanel, ScoringPanel, ErrorReductionProjectionPanel, BaselinePanel are imported only by `app/qc/page.tsx`, have zero existing tests. Deletes safe.

**UNRESOLVED:** 0 decisions left open. All 4 architecture findings (A1-A4), 2 code-quality findings (CQ1-CQ2), 4 cross-model tensions (CMT1-CMT4), and test coverage scope decided. The 9 §10 items from design review were all decided during this eng review.

**CRITICAL GAPS:** 1 (`/compliance` ObbbaReadinessPanel currently has zero tests — T-test-1 P1 task adds snapshot + behavioral assertions before T4a extraction, closing the regression risk).

**VERDICT:** ENG REVIEW CLEARED (PLAN). Plan locked at architecture fidelity with full test coverage in spec. Ready to implement. 16 tasks total: T0 (engine extension), T1-T11 (components + retirements + drill-in), T-test-1 through T-test-7 (full component + regression coverage). Worktree plan: Lane A (engine → FormulaHero, IncomingDataFeed) and Lane B (T-test-1 → T4a → T4b → OBBBA testing) parallel; Lane C (PillarTracking + retirements + page composition) sequential after A+B land. Recommend proceeding to implementation; no further reviews required (CEO and Design already considered + adopted via in-review pivots).
