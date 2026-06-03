# Engine + audit signal in the CBO dashboard

Plan source: `/plan-eng-review` 2026-06-03.
Audit context: PR #450 (engine + 9 fixture defects fixed) and PR #456 (PolicyEngine full-92 triangulation).
Branch: `claude/ios-civica-wheat-logo` at review time; implementation branch is up to the user.

## Problem

The SNAP engine we audited (`@civica/snap-rules`, FY26) carries world-class regulatory rigor — 129/0 profile-harness pass rate, GPO-sourced 7 CFR citations attached to each gate, PolicyEngine US triangulation at ~73% within ±$10/mo. None of that signal reaches the caseworker viewing a packet today.

Specifically:
- The user-facing `/tools/deductions` calculator imports a parallel `@civica/snap-calculator` package (FY25 hardcoded values, never audited).
- `@civica/snap-qc-engine` (which powers the dashboard QC + error-rate surfaces) builds on `snap-calculator`, so QC analysis is downstream of the un-audited engine.
- `apps/dashboard/app/packets/[packetId]/page.tsx` uses `snap-rules` for two helper calls only; the engine's verdict, benefit breakdown, gate trace, and citations are not rendered anywhere on the packet view.
- No caseworker workflow exists for "show me the engine's reasoning for this specific case."

## Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Scope | All three workstreams (W1 + W2 + W3) | User opted in to deep integration; consolidation + panel + per-case binding all land in one plan. |
| D2 | Calculator survivor | Facade — `snap-calculator` re-exports `snap-rules` math | Smaller diff, no parallel-API risk while imports remain stable. |
| D3 | QC engine depth | Deep — surface gate trace + citations | QC scoring is exactly where audit signal should land first. |
| D4 | Packet panel content | Gate trace + citations | Unique value of the audit work, no Python dependency on dashboard. |
| D5 | Audit-signal binding | Structural — citations attached to gates | Leverages existing gate citations; no new tagging system needed. |
| D6 | Case-evaluator UX | Hide `/tools/deductions`, embed evaluator on packet panel | Concentrates UX where caseworkers actually spend time. |
| D7 | PE triangulation surface | Static aggregate badge linking to finding | Trust signal cheap; per-case PE cron defers to TODO-48. |
| D8 | Engine eval site | `GET /me/packets/:id/engine-verdict` on enrollment-api | Reusable across dashboard + iOS; existing auth pattern applies. |
| D9 | Facade regression test | Golden lockstep across the 12 audit goldens | Reuses audit work as migration test. |

## Architecture (post-implementation)

```
  Packet view request
       │
       ▼
  apps/dashboard/packets/[packetId]/page.tsx  (Next.js RSC)
       │
       ├──▶ GET /me/packets/:id/engine-verdict ──▶ apps/enrollment-api/routes/packets.ts
       │                                                     │
       │                                                     ▼
       │                                       composeVerdict(facts, state, asOf)
       │                                                     │
       │                                                     ▼
       │                {verdict, benefit, gate_trace[], citations[]}
       │
       ◀──────────────────────────────────────────────────────┘
       │
       ▼
  EngineVerdictPanel renders:
    - APPROVE/DENY + $benefit/mo
    - Gate trace table (gross test, EID, std ded, shelter, net)
    - Each row carries 7 CFR citation chip → links to docs/findings + GPO
    - PE static badge: "±$10 PolicyEngine agreement: 73%"

  (@civica/snap-qc-engine consumes the same trace for QC scoring)
```

## Implementation Tasks

- [ ] **T1 (P1)** — `packages/snap-calculator/src/index.ts` — Facade over `snap-rules` (D2)
- [ ] **T2 (P1)** — `packages/snap-calculator/test/golden-facade-equivalence.test.ts` — Lockstep test against 12 audit goldens (D9)
- [ ] **T3 (P1)** — `apps/enrollment-api/src/routes/packets.ts` — `GET /me/packets/:id/engine-verdict` endpoint (D8)
- [ ] **T4 (P1)** — `apps/dashboard/components/EngineVerdictPanel.tsx` + `CitationChip.tsx` (D4, D5)
- [ ] **T5 (P1)** — `apps/dashboard/app/packets/[packetId]/page.tsx` — Wire panel as Suspense section
- [ ] **T6 (P2)** — `packages/snap-qc-engine/src/flows/*` — Deep gate-trace integration (D3)
- [ ] **T7 (P2)** — PE static badge on packet panel (D7)
- [ ] **T8 (P2)** — `/tools/deductions` deprecation banner (D6)
- [ ] **T9 (P3)** — This design doc

## NOT in scope

- Per-packet PolicyEngine pairing cron (deferred to TODO-48)
- iOS consumer of the new endpoint (deferred to TODO-49)
- Variant-profile coverage for PE triangulation (deferred to TODO-50)
- Build-time finding-link checker (deferred to TODO-51)
- Expanding `/tools/deductions` into a full hypothetical evaluator (deferred to TODO-52)
- Migrating `snap-qc-engine` grading rubric — D3 surfaces the gate trace but doesn't redesign QC weights

## What already exists (reused, not rebuilt)

- `composeVerdict()` + `benefit-calc.ts` — produces the gate trace; nothing new engine-side
- `packages/snap-rules/test/golden/composer/` — 12 goldens; reuse as facade lockstep test data
- `data-ops/sample/policyengine-{ca,ma}/oracle_pairing_fy26_all_post_fix.json` — static badge consumes this
- `docs/findings/2026-06-03-v06-fixture-defects-primary-citations.md` — citation chips link to it
- `apps/dashboard/app/packets/[packetId]/page.tsx` Suspense pattern — packet-detail Suspense foundation from May 2026 is the host
- `apps/enrollment-api/src/lib/auth.ts` `requireNavigator`/`requireApplicant` — already covers the new endpoint's auth scope

## Failure modes

| Codepath | Failure mode | Test? | Error handling? | Silent? |
|---|---|---|---|---|
| Endpoint auth | Wrong navigator queries another org's packet | T3 RLS scope test | RLS denies via `is_navigator_in_org` | No (403) |
| Facade math drift | snap-calculator caller hardcoded FY25 expectation | **T2 catches** | n/a | No (test fails loudly) |
| Gate trace shape | composeVerdict changes its trace key names | T4 snapshot catches | n/a | No (snapshot fails) |
| Citation link broken | Finding doc renamed/moved | **Gap — covered by TODO-51** | Link 404 | **Yes (silent)** ⚠️ |
| PE badge stale | Static "73%" doesn't refresh | n/a (static by design) | n/a | Yes (by design) |

## Parallelization strategy

| Lane | Tasks | Notes |
|---|---|---|
| A — packages/ | T1, T2, T6 | Independent of B + C |
| B — apps/enrollment-api/ | T3 | Independent |
| C — apps/dashboard/ | T4, T5, T7, T8 | T5 depends on T3 + T4; T4/T7/T8 independent of each other |

Launch A + B + C in parallel. Within C, T4 first, then T5. T6 in Lane A is independent of T1+T2.

No conflict flags — Lane A and Lane C don't share files.

## Test plan (caseworker-facing)

### Affected pages/routes
- `/packets/[packetId]` — gain a new "Engine verdict" section between API Verification and Notes
- `/tools/deductions` — deprecation banner added, math unified via facade
- `/findings/error-rate` — PE aggregate badge if not already there

### Key interactions to verify
- Open a CA packet → engine panel renders verdict + benefit + 5+ gate rows + citation chips
- Click a citation chip → navigates to `docs/findings/[slug]` with the citation in view
- Switch packet state CA → MA (via test fixture or staging) → benefit number changes per state SUA/BBCE
- `/tools/deductions` produces the same benefit as the packet panel for equivalent inputs

### Edge cases
- Packet with `cat_elig: PA` (cat-elig path) — verdict surface should still render
- Packet missing income or shelter (engine SKIP path) — panel should show "engine SKIPPED: missing X" gracefully
- Refugee packet post-OBBBA cutoff — engine returns DENY, panel renders DENY + cited regulation
- HH-1 packet hitting minimum benefit floor ($24) — panel surfaces the floor rule explicitly

### Critical paths
- Endpoint → composeVerdict → trace → panel → citation chip → finding doc → GPO URL
- Facade equivalence: every snap-calculator call site produces identical-or-better math

## Open questions

- Should the engine panel show the `as_of_date` (so caseworkers know which FY's tables produced the verdict)? **Resolved (D10 batch): yes, in the metadata caption under the section title.**
- Should there be an "engine has not seen this case yet" path for packets missing required Facts fields? **Resolved (D4): yes, surfaced as the SKIP state with a "Needs: X" warning pill.**

## Design spec (from /plan-design-review 2026-06-03)

### Zone placement (D3)

The plan splits the engine output across both zones, per DESIGN.md §3 + the 2026-05-28 Decide/Evidence decision:

- **`EngineVerdictBadge`** — Decide zone. Always-open `Card` next to `ReviewStatusCard` + `WorkHoursCard`. Shows verdict pill, benefit amount, household size, state, `as_of_date`. The at-a-glance read.
- **`EngineGateTrace`** — Evidence zone. Collapsible `EvidenceSection` next to `APIVerificationPanel` + `DocumentsSection`. Auto-opens when verdict = DENY or SKIP (flagged behavior per `EvidenceSection` spec). Shows the gate-by-gate table + citations.

### Five-state matrix (D4)

| State | Pill color | Pill text | A11y | Caseworker sees |
|---|---|---|---|---|
| Loading | `bg-paper` + skeleton rows | — | `aria-busy="true"` on container | Three 1.5-line shimmer rows + verdict skeleton |
| APPROVE | `bg-pine text-white` | "Approve" | `role="img"` + `aria-label="Engine verdict: Approve"` | Pine pill + `$591/mo` (32px tabular-nums) + meta caption |
| DENY | `bg-brick text-white` | "Deny" | `role="img"` + `aria-label="Engine verdict: Deny — {cited gate}"` | Brick pill + cited gate that triggered DENY (e.g. "Gross income above 130% FPL") |
| SKIP | `bg-warning text-white` | "Needs info" | `role="img"` + `aria-label="Engine paused — missing {fields}"` | Warning pill + "Needs: shelter, asset details" |
| ERROR | `bg-error text-white` | "Engine error" | `role="alert"` (not `role="img"`) | Error pill + "Couldn't compute. Retry" button (44×44 touch target) |

### Disagreement flag (D5)

Add a navigator-only "I disagree" affordance on the verdict pill (Decide zone). Behavior:
- Renders as `<button>` next to the pill with text "Flag disagreement" (no decorative glyph).
- Click opens a small inline form (no modal) with a 280-char free-text "Why?" field + Submit.
- Stored in `packet_notes` with `type = 'engine_disagreement'`, joined to the gate row that the navigator clicked into.
- Visible to navigator-admin role on the `/qc-review` queue.
- Skipped for applicant role (read-only verdict view).

### Citation link treatment (D6 → D7 resolved)

Citations render as inline pine-colored text links (matches DESIGN.md §1 "pine for text links") with two refinements to signal "this is reference material, not a CTA":

- **Font:** Hanken Grotesk monospaced numerals (`font-feature-settings: "tnum"`) at 13px.
- **No underline by default.** Underline appears on hover/focus (matches academic-citation feel).
- **Hover tooltip:** shows the GPO URL string (e.g. "Opens www.govinfo.gov/.../CFR-2024-title7-vol4-sec273-9.xml") so the caseworker knows the click leaves the dashboard before they click.

### Responsive + a11y spec (D8)

- **≥ md (768px):** `<table>` semantic. Columns: Gate name (`<th scope="row">`), result amount (right-aligned tabular-nums), citation link.
- **< md:** CSS Grid stacked rows. Each gate becomes a 3-line stacked block: name (16px ink), amount (right-aligned 18px ink), citation (pine link 14px). Vertical scroll OK.
- **Touch targets:** 44×44px minimum padding around each citation link and each chip button (per §6.3).
- **Focus rings:** `focus:ring-2 focus:ring-pine/30` on all interactive elements (per §6.2).
- **Color is never the only signal:** every pill carries text + color + `role="img"` + `aria-label` (per §6.4 + StatusBadge precedent).
- **`prefers-reduced-motion`:** skeleton loading state honors the global CSS media query (already enforced in `globals.css`).

### Remaining decisions resolved (D9 batch)

- `as_of_date`: lives in the metadata caption under the section title: `"Civica SNAP rules engine v1.0 · FY26 tables · as of {date}"` (13px graphite, never `text-muted` per §6.6).
- Finding doc 404 (e.g. doc renamed): fall back to `"Citation source temporarily unavailable. Reference: {raw_citation_string}"`. TODO-51 (build-time link checker) makes this rare.
- What-if hypothetical evaluator on the panel: **NOT in v1.** Defer to TODO-52. Panel renders the real packet's verdict only.
- `/tools/deductions` deprecation banner copy: `"This calculator is now part of the packet view. Open any packet to see the engine's verdict + breakdown."` + pine button "View packets →" linking to `/packets`.
- PE static badge click target: opens `docs/findings/2026-06-03-policyengine-full-129-triangulation.md` in a new tab (the finding). The raw JSON is a v2 surface (TODO-48).
- Citation link hover behavior: shows the GPO URL on tooltip (already spec'd above).
- Disagreement flag visibility: navigator role only; applicant view has no flag button.

## Implementation Tasks (updated)

- [ ] **T1 (P1)** — `packages/snap-calculator/src/index.ts` — Facade over `snap-rules` (D2)
- [ ] **T2 (P1)** — `packages/snap-calculator/test/golden-facade-equivalence.test.ts` — Lockstep test (D9 of eng-review)
- [ ] **T3 (P1)** — `apps/enrollment-api/src/routes/packets.ts` — `GET /me/packets/:id/engine-verdict` (D8 of eng-review)
- [ ] **T4a (P1)** — `apps/dashboard/components/EngineVerdictBadge.tsx` — Decide zone pill + benefit + meta caption + disagreement flag (D3 + D4 + D5)
- [ ] **T4b (P1)** — `apps/dashboard/components/packet-detail/EngineGateTrace.tsx` — Evidence zone collapsible with table/stack responsive (D3 + D6/D7 + D8)
- [ ] **T4c (P1)** — `apps/dashboard/components/CitationLink.tsx` — Pine + monospace + hover-tooltip pattern (D7)
- [ ] **T5 (P1)** — `apps/dashboard/app/packets/[packetId]/page.tsx` — Wire badge to Decide zone + trace to Evidence zone
- [ ] **T6 (P2)** — `packages/snap-qc-engine/src/flows/*` — Deep gate-trace integration (D3 of eng-review)
- [ ] **T7 (P2)** — PE static badge on EngineVerdictBadge + finding link target (D7 of eng-review + D9 batch)
- [ ] **T8 (P2)** — `/tools/deductions` deprecation banner with the resolved copy (D6 of eng-review + D9 batch)
- [ ] **T9 (P3)** — This design doc (now includes the spec)

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 9 decisions locked + 9 tasks + 5 TODOs |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (PLAN) | score: 4/10 → 10/10, 9 design decisions, all 7 passes complete |
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | optional |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | optional |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | optional |

**UNRESOLVED:** 0 — all 19 decision points (10 eng + 9 design) answered.
**VERDICT:** ENG + DESIGN CLEARED — ready to implement. Lane C (dashboard) now has T4a/T4b/T4c sub-tasks instead of monolithic T4, all with bound DESIGN.md tokens.
