# CBO dashboard: buddy + portal-autofill integration

**Branch:** `claude/cbo-overview`
**Status:** plan (eng-reviewed 2026-06-08)
**Scope decision:** Phase 1 = synthetic demo on the public `/cbo-preview`; Phase 2 = real
data behind a new authenticated `/cbo` route. Both the applicant's *buddy/helper* link
and the *caseworker/navigator assignment* are shown. The "portal upload" feature is the
**approved-answers → BenefitsCal autofill** flow via the extension bridge.

---

## What the user actually wants (mental model)

```
applicant answers ─▶ assigned to CBO caseworker ─▶ BOTH parties approve + consent recorded
                                                              │
                                                              ▼
   CBO officer (already logged into BenefitsCal) + Civica extension
   pulls approved answers from Supabase ─▶ AUTO-FILLS the questionnaire
   (yellow-highlighted) ─▶ officer clicks Next/Accept ─▶ submitted on the CBO's behalf
```

"Agency keychain" = the **extension bridge using the officer's own BenefitsCal session**.
Civica never stores a government-portal password (security decision, Issue 5).

---

## Locked architecture decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Data seam | Build separate demo components now, real components in Phase 2 (duplicate UI). **Share only the TypeScript view-model interfaces** to limit drift. |
| 2 | Auth boundary | `/cbo-preview` stays PUBLIC + synthetic forever. Real data lives behind a NEW role-gated `/cbo` route. Real PII never touches a public prefix. |
| 3 | Buddy read path | New packet-scoped `GET /packets/:id/buddies` (navigator/admin auth) in `buddy.ts`. The existing buddy API is buddy-scoped only. |
| 5 | Autofill engine | Extension bridge, officer's own login. No stored portal password. Autofill content-script = TODO-14. |

(Issue 4 — portal status pills — dropped per user reframe; the portal card shows
approved-answers-into-BenefitsCal, not a submission-status badge.)

---

## Phase 1 — synthetic demo on `/cbo-preview` (ships now)

Pure presentational, public, no auth, no real data. Lives under
`apps/dashboard/components/cbo/` and `apps/dashboard/lib/cbo/demo-pipeline.ts`.

### 1.1 Extend the view-model (shared types)
Add to `QueueApplication` ([demo-pipeline.ts:69](../../apps/dashboard/lib/cbo/demo-pipeline.ts)):

```ts
// SHARED interfaces — Phase 2 real adapter will populate the same shapes.
export interface CaseAssignment {
  caseworker: string;          // CBO officer who owns the case
  status: "unassigned" | "assigned" | "reviewing" | "approved";
  assignedAt: string | null;
}
export interface BuddyLink {
  helperName: string;          // applicant's personal helper
  relationship: string;        // "family" | "friend" | "navigator"
  status: "active" | "pending" | "completed";
  lastActive: string;
}
export interface PortalAutofill {
  applicantApproved: boolean;
  cboApproved: boolean;
  consent: "in_person" | "telephonic" | "async_portal" | null;
  // approved answer -> the BenefitsCal field it fills (per-field mapping demo)
  fieldMap: { answer: string; value: string; benefitsCalField: string; section: string }[];
  docCount: number;
}
// QueueApplication gains: assignment, buddy, portal
```

### 1.2 Three demo cards (prop-only, no fetch)
- `components/cbo/CaseAssignmentCard.tsx` — caseworker + assignment status + an
  "Assign / Approve" affordance (visual only).
- `components/cbo/BuddyLinkCard.tsx` — applicant's helper, relationship, last active.
- `components/cbo/PortalAutofillCard.tsx` — dual-approval + consent gate, then the
  per-field `answer → BenefitsCal field` mapping with the **yellow-highlighted
  autopopulated** look, and an "Enter into BenefitsCal (officer clicks Next/Accept)"
  depiction.

### 1.3 Render them on the demo detail page
Insert into [application/[id]/page.tsx](../../apps/dashboard/app/cbo-preview/application/[id]/page.tsx)
after the "Navigator flags + pipeline" section (~:239). The `Navigator` summary cell
(:127) becomes the `CaseAssignmentCard`'s compact echo.

### 1.4 Seed synthetic data
Add `assignment`, `buddy`, `portal` to each `APPLICANTS` fixture + `buildPipeline`
mapping in `demo-pipeline.ts`. Vary by phase (requesting = unassigned/no approval;
enrolled = approved + autofilled).

---

## Phase 2 — real wiring behind a new `/cbo` route (follow-up)

### 2.1 New authenticated route
`apps/dashboard/app/cbo/` — role-gated (add `/cbo` to STAFF/CBO role allow-list in
`roleRouting.ts`, NOT to `FULLY_PUBLIC_PREFIXES`). Mirrors the staff packet-detail page
but scoped to a partner CBO's caseload.

### 2.2 Real view-model adapter
`lib/cbo/real-adapter.ts` — maps enrollment-api + Supabase data into the SAME
`CaseAssignment` / `BuddyLink` / `PortalAutofill` interfaces from 1.1. Phase-2
components consume the shared types (UI duplicated per Issue 1, types shared).

### 2.3 Buddy read endpoint (new)
`GET /packets/:id/buddies` in [buddy.ts](../../apps/enrollment-api/src/routes/buddy.ts)
(navigator/admin auth via existing `requireNavigator`/`requireAdmin`, actor-context,
RLS, co-located `.test.ts`). Returns column-restricted `{ helper_role, relationship_status,
last_active }[]` for the packet.

### 2.4 Dual-approval + consent state (new)
- Applicant approval + CBO approval flags on the packet (or a small `packet_approvals`
  table). Consent already partly modeled (`consent_type` + `telephonic_consent_recorded_at`
  on `benefitscal_submissions`).
- The "Enter into BenefitsCal" action is gated on `applicantApproved && cboApproved && consent`.

### 2.5 Autofill bridge (extension)
Reuse [extension `GET /packets/:id/payload`](../../apps/enrollment-api/src/routes/extension/)
(built) + per-CBO device-token auth (#317). Remaining: the autofill **content script**
that yellow-highlights and fills the questionnaire (TODO-14), and finishing the
BenefitsCal section selectors (sections 2-10, currently `PORTAL_STEP_TBD`).

---

## NOT in scope

- **Stored per-CBO portal credential vault** — rejected (Issue 5) for liability/ToS.
- **Server-side Playwright unattended submit** — extension-bridge model chosen instead.
- **Finishing BenefitsCal section selectors 2-10 + doc-upload** — pre-existing stub
  (`PORTAL_STEP_TBD`), tracked separately; blocks true end-to-end real autofill but not
  the demo or section-1 wiring.
- **Putting real data on `/cbo-preview`** — explicitly forbidden (public prefix = PII leak).
- **Sharing the demo components themselves** — user chose to duplicate UI; only types shared.

## What already exists (reuse, don't rebuild)

| Sub-problem | Existing code | Plan reuses? |
|-------------|---------------|--------------|
| Case detail render | `cbo-preview/application/[id]/page.tsx` | Yes — insert cards |
| View-model seam | `QueueApplication` + `buildPipeline()` | Yes — extend it |
| Buddy data model + auth | `buddy.ts`, buddy_* tables, RLS, cron | Yes — add 1 read route |
| Approved-answers → portal | `benefitscal.ts` prepare-export/submit | Yes (real phase) |
| Autofill payload | extension `GET /packets/:id/payload` | Yes |
| Officer-session autofill | extension device-token auth (#317) | Yes |
| Consent model | `consent_type` on benefitscal_submissions | Partial — extend |
| Navigator field | `QueueApplication.navigator` | Yes — becomes assignment |

---

## Implementation Tasks
Synthesized from this review's findings. Checkbox as you ship.

- [x] **T1** — dashboard — extend `QueueApplication` with shared assignment/buddy/portal view-model types + synthetic seed (`lib/cbo/demo-pipeline.ts`) ✅ Phase 1
- [x] **T2** — dashboard — `CaseAssignmentCard` + `BuddyLinkCard` + `PortalAutofillCard` (prop-only, yellow autofill mapping) ✅ Phase 1
- [x] **T3** — dashboard — render the 3 cards on the demo detail page ✅ Phase 1
- [x] **T4** — dashboard — unit tests for card branches ✅ Phase 1 (13 tests)
- [x] **T5** — enrollment-api — `GET /packets/:id/buddies` (navigator/admin auth) ✅ Phase 2 (`packets.ts`)
- [x] **T6** — enrollment-api — auth tests: deny applicant/buddy/anon (403) + PII column-restriction ✅ Phase 2 (8 tests)
- [x] **T7** — dashboard — authenticated `/cbo` route (staff-only for now; NOT public prefix) ✅ Phase 2
- [x] **T8** — dashboard — `lib/cbo/real-adapter.ts` mapping + unit tests ✅ Phase 2 (12 tests)
- [ ] **T9** — dual-approval + consent state model → filed as **[#559](https://github.com/matthewgg22/Civica/issues/559)** (needs a hand-applied migration; adapter uses documented proxies until then)
- [x] **T10** — avoid N+1 ✅ Phase 2 — addressed by design: the `/cbo` list does one `snap_packets` query; buddy/status fetches happen only on the detail page, never per row.

**Deferred to follow-up issues:**
- **cbo_assister enablement** (partner-CBO access to `/cbo`) → **[#560](https://github.com/matthewgg22/Civica/issues/560)** — cross-cutting RLS + endpoint auth + operator seeding. `/cbo` ships staff-only (navigator/admin) until then; `roleRouting` already reserves `/cbo` for `cbo_assister`.

Pre-existing deferred dependencies (tracked elsewhere, NOT created here): TODO-14
(extension autofill content-script — now wired with a yellow highlight; see
`apps/civica-submitter-extension/`), BenefitsCal section selectors 2-10
(`PORTAL_STEP_TBD`), per-CBO extension device-token rollout (#317).

**Verification note:** Phase 2 is verified by compile + unit tests + route-gating
(both `/cbo` routes 307 → `/login` without a session). It is NOT browser-verified
with real data — that needs a real staff session + seeded org packets, absent in dev.

---

## Design spec — Phase 1 cards (from /plan-design-review)

Calibrated against [apps/dashboard/DESIGN.md](../../apps/dashboard/DESIGN.md). The cards
are **`<section>` blocks inside the existing print-draft `<article>` sheet** — they reuse
`SectionTitle` (11px uppercase graphite, `border-b border-hairline pb-1 mb-2`), `SummaryCell`,
and the `py-4 border-b border-hairline` section rhythm. **NOT dashboard `Card`s** (no own
border/shadow/rounded). No colored left-borders, no icon-in-circle, no emoji (DESIGN.md §7).

### Placement (Pass 1)
```
Summary
[CASE TEAM]  ← new section, 2-col: Assignment | Buddy (grid sm:grid-cols-2 gap-x-8)
Application responses / Engine determination / Navigator flags + Pipeline / History
[ENTER INTO BENEFITSCAL]  ← new, terminal section, full-width, before footer
Footer
```

### Tokens per state (Pass 5 — amber vs warning enforced)
**CaseAssignmentCard.status** (pill = text label + color, never color alone):
| status | token | label |
|---|---|---|
| unassigned | `text-muted` | "Unassigned" (neutral, no alarm) |
| assigned | `text-ink` + `text-graphite` | name + "Assigned" |
| reviewing | `text-warning` (#B5511E) | "In review" (process/needs-attention) |
| approved | `text-amber` (#C9922A) + ✓ | "Approved" (positive outcome) |

**BuddyLinkCard.status:**
| status | token | label |
|---|---|---|
| active | `text-graphite` | "Active" |
| pending | `text-warning` | "Invite pending" |
| completed | `bg-pine-surface text-ink` chip | "Completed" (success-adjacent fill) |
| none | `text-muted` | "No helper linked — applicant hasn't added one" (warm empty state) |

**PortalAutofillCard:**
- **Approval gate row:** three items "Applicant approved · CBO approved · Consent recorded."
  Satisfied = `text-amber` + ✓ (`role="img"` aria-label); pending = `text-muted` + ○ "Pending."
- **All three satisfied →** full mapping table + active action.
  **Any pending →** mapping table dimmed (`text-muted`), action disabled, one `text-warning`
  line naming the blocker ("Waiting on CBO approval").
- **Mapping table:** ruled two-column, `divide-y divide-hairline`, **no fills on the table
  structure** (per the 2026-06-07 "white ruled tables, no beige fills" decision). Left =
  approved-answer label + value (graphite/ink). Right = BenefitsCal field name (graphite)
  with the VALUE in the **autofill highlight chip: `bg-[#F5E2C0] text-ink`** (amber-surface
  fill + ink text — the AA-safe highlighter look; wheat-as-text is forbidden, §1/§7).
- **Action depiction:** `bg-pine text-white` button "Enter into BenefitsCal" (pine = CTA, §1)
  + helper line "Officer reviews the highlighted fields and clicks Next / Accept in BenefitsCal."
  The sheet's existing "Working draft" badge frames the whole page as non-live.

### Synthetic state mapping by phase (Pass 2/3 — demo is static)
| phase | assignment | buddy | portal gate |
|---|---|---|---|
| requesting | unassigned | none/pending | all pending (locked) |
| live | assigned/reviewing | active | partial (applicant ✓, CBO reviewing) |
| enrolled | approved | completed | all approved + autofilled (**hero state**) |

### Accessibility (Pass 6)
- Every status glyph: `role="img"` + `aria-label`, glyph `aria-hidden` (matches StatusBadge §6.1).
- Highlight is emphasis only — the value text carries meaning (color is never the sole signal).
  Ink on #F5E2C0 ≈ 12:1, AA-safe.
- Mapping table uses real `<dl>`/`<dt>`/`<dd>` (or `<table>` + `<th scope>`), not divs.
- Print: the existing sheet already sets `print-color-adjust: exact`, so the highlight survives print.

### Responsive (Pass 6)
- Case-team 2-col → single column below `sm:` (mirrors existing sections).
- Mapping table 2-col → stacked answer/field pairs below `sm:`, keeping the highlight chip.

### Design tasks (refine eng T2/T3)
- [ ] **D1 (P1)** — autofill value chip = `bg-[#F5E2C0] text-ink` (NOT yellow text); a11y-critical.
- [ ] **D2 (P1)** — status pills: text label + color + `role="img"` glyphs on all three cards.
- [ ] **D3 (P2)** — responsive collapse (Case-team + mapping table) + verify highlight prints.
- [ ] **D4 (P2)** — wire synthetic state-by-phase mapping so the `enrolled` packet shows the hero autofilled state.

### Mockup
One mockup of PortalAutofillCard was planned but the gstack designer needs an OpenAI key
(`design setup`). Spec above is build-ready without it; generate the mockup later if desired.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEARED | 5 issues, all resolved; 0 critical silent gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score 4/10 → 9/10, 7 decisions, 0 unresolved |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **UNRESOLVED:** 0 — eng: 5 decisions answered (data seam, auth boundary, buddy read path, autofill engine, reframe); design: 7 decisions (output mode, placement, autofill token + 4 spec'd).
- **SECURITY:** rejected stored government-portal credential vault (Issue 5); real PII kept off the public `/cbo-preview` prefix (Issue 2). Two CRITICAL PII-auth test paths flagged and planned.
- **DESIGN:** cards spec'd as print-sheet sections (not dashboard Cards); autofill highlight = `bg-[#F5E2C0] text-ink` (wheat-as-text forbidden, AA-safe); amber=positive / warning=process enforced per state.
- **VERDICT:** ENG + DESIGN CLEARED — ready to implement Phase 1. Optional: generate the PortalAutofillCard mockup once `design setup` adds an OpenAI key.

