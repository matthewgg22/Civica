# BenefitsCal Bridge — Extension-First Plan

Status: planning (eng-review cleared 2026-05-28)
Supersedes: the dual-mode (headless Mode A + extension Mode B) framing from
the same-day /plan-eng-review. Headless automation is now a v2 appendix.

## Premise — what this is and is NOT

**We are building a bridge, not a portal.**

- ❌ NOT a benefits-application portal. NOT a clone of BenefitsCal.
- ❌ NOT a consumer page where people fill out SNAP applications on a Civica site.
- ✅ A bridge that reads data already in the **existing Civica dashboard** and
  fills the **existing BenefitsCal government page** (benefitscal.com) to submit.

California owns BenefitsCal. We never touch its code. We drive it from outside.

## The architectural collapse (key decision, 2026-05-28)

The earlier plan had two codebases: a headless Browserless service (Mode A) and
a browser extension (Mode B). **They collapse into one.** Civica is its first
power user.

**Framing (autoplan premise gate, 2026-05-28):** the extension is the
**submission RAIL** — the "Playwright ops now" plumbing from
`docs/designs/cbo-saas-repositioning.md` Decision #8 — NOT the product. The
**product/moat is the QC dry-run engine** ("caseworker before the caseworker").
The extension delivers the engine's pre-verified packets to the gov page. This
is why V1-12 (QC confidence surfaced at submission) is load-bearing, not a
nice-to-have: it is the visible edge of the moat. Build the rail well, but never
confuse it for the differentiator.

```
            ONE THING WE BUILD: the extension
                         │
        ┌────────────────┴────────────────┐
        ▼                                  ▼
  Civica staff use it              External CBO uses it
  (logged in as VoteNow CBO)       (logged in as their own CBO)
  "Mode A" (Civica-as-CBO)         "Mode B" (partner CBO)
        │                                  │
        └── both: extension reads Civica data,
            fills the gov page, HUMAN reviews + clicks Next + submits
```

Headless server-side automation (fill with no human browser) is a **v2
optimization**, de-risked because it replays the exact fill logic the extension
already proved. See Appendix A.

### Why extension-first wins

1. **One codebase, not two.** Extension content script is the only fill engine.
2. **Compliance is stronger.** Every submission has a real human reviewing +
   clicking through on the actual gov page. No "headless robot submitted 800
   apps" regulatory red flag. The mass-throughput rubber-stamp concern only
   existed in headless v2.
3. **Zero Browserless cost in v1.** Everything runs in humans' browsers.
4. **No anti-bot surface, no account-rotation races, no queue orchestration** —
   all the riskiest infra (CF Queue, advisory locks, Browserless anti-detect)
   moves to v2 and may never be needed.
5. **Ships ~3 weeks / 2 packages instead of ~6 weeks / 5 packages.**

## Shared-core architecture

The selector map is the load-bearing artifact both the extension and (future)
headless driver consume. The **fill mechanism differs**, the **map does not.**

```
@civica/benefitscal-cbo/core   (browser-safe, no Playwright)
  ├── selector map: page-code → field → { label, fallback selector }
  ├── field-map:    Civica packet field → BenefitsCal portal field
  ├── normalize:    Civica data → portal-shaped values
  └── schemas:      BenefitsCalPayload (Zod)
        │
        ├── consumed by → extension content script (document.querySelector + label match)
        └── consumed by → [v2] Playwright driver (getByLabel)   ← Appendix A
```

`@civica/benefitscal-cbo/driver` (the Playwright/Browserless code already
written) stays in the repo as v2 reference but is NOT on the v1 critical path.

## v1 Task list (extension-first)

Priority: P0 blocks everything; P1 is the build; P2 is polish.

### Foundation
- [ ] **V1-1 (P1, human ~6h / CC ~1h)** — Split `@civica/benefitscal-cbo` into
  `/core` (browser-safe: selector map, field-map, normalize, schemas) and
  `/driver` (Playwright, v2 only) via package.json `exports`. Extension imports
  `/core` only.
  - Verify: `pnpm --filter @civica/benefitscal-cbo build && tsc --noEmit`; confirm no Playwright in the `/core` import graph.

- [ ] **V1-1a (P0, human ~1d / CC ~3h)** — **Materialize SELECTORS.md into a
  typed `/core` selector map** and DELETE the stale `field-map.ts` placeholders
  (its `[name=ssn]` / `[name=zipCode]` / `/cbo/application/...` entries do NOT
  match the live portal — confirmed by the walk). The real selectors only exist
  as prose today; nothing currently makes them data. One typed map, keyed
  `pageCode → field → { label, fallbackSelector, type }`, is the single source
  both the snapshot harness (V1-9) and the content script (V1-6) load.
  - Surfaced by: Eng + DX voices (CRITICAL, cross-phase theme — both flagged independently).
  - Verify: every field in SELECTORS.md has a typed entry; legacy `field-map.ts` exports removed from `index.ts`.

- [ ] **V1-1b (P0, human ~1d / CC ~3h)** — **React-safe fill primitive in
  `/core`**, unit-tested, shared by the content script (v1) and the Playwright
  driver (v2). Must handle: native-setter + `input`/`change` dispatch (React
  ignores `el.value=`), `<select>`, radios (via click), the password-typed DOB
  input, and contenteditable. This is load-bearing and currently nobody's job —
  Playwright's `getByLabel().fill()` does it for free but the DOM path does not.
  - Surfaced by: Eng voice (CRITICAL).
  - Verify: unit test proves a native-setter fill updates a controlled React fixture's state.

- [ ] **V1-2 (P1, human ~1d / CC ~3h)** — Extend `BenefitsCalPayload` with
  portal-required fields surfaced in the walk: `address.county`, `is_homeless`,
  `marital_status`, `is_college_student`, `citizenship_status`,
  `sex_assigned_at_birth`, `gender` (+ optional `disability_needs_help`,
  `is_deaf_hoh`, `ssn_reason`). Update field-map + normalize + tests.
  - **SSN data contract (Eng, CRITICAL):** the schema carries `ssn_last4` ONLY
    (full SSN comes from doc scan, not stored). The extension fills `ssn_last4`
    or selects the "no SSN / applied for SSN" branch (walk §1.14/§1.15) — it does
    NOT inject a full SSN. Keep it that way; do not add a full-SSN egress path.
    Threat model assumes `ssn_last4` is the only SSN data crossing into the gov page.
  - Verify: package tests pass; migration runs against staging Supabase; no full-SSN field added.

- [ ] **V1-3 (P1, human ~2h / CC ~30min)** — County resolution for the gov page's
  county modal (needs a 2-digit ordinal code). **Use the packet's known county
  from intake** (SELECTORS.md §1.3 confirms intake already has it) — NOT a
  ZIP→county lookup. CA ZIPs cross county lines, so ZIP-derived county
  mis-routes the application. ZIP lookup only as a last-resort fallback when
  intake county is absent.
  - Surfaced by: Eng voice (ZIP→county is many-to-one in CA).
  - Verify: packet with intake county → correct ordinal; missing county → fallback path + human prompt.

### Selector map + fill logic
- [ ] **V1-4 (P1, human ~varies / CC n/a)** — Finish the selector walk for
  portal steps 2-9 (People, Household Details, Income, Expenses, Other
  Situations, Document Upload, Review & Submit). Currently only step 0 + step 1
  (~29 page entries) captured. **Runbook ready:** [`docs/runbooks/benefitscal-v1-4-walk-2026-06.md`](../runbooks/benefitscal-v1-4-walk-2026-06.md)
  (PR #485) — sandbox-first per eng D3, PII scrub-on-capture per eng D4, abort-
  before-submit. The one human-gated task left in the closeout submission rail.
  - Verify: every step's fields documented with label + fallback selector.

- **V1-5 (P1, human ~4d / CC ~1d)** — DOM fill logic per section in `/core` as
  map-driven functions the content script calls. **PRs 1-3 of 5 LANDED
  (2026-06-04):**
  - [x] **PR1 #477** — `section-sequence.ts` (SNAP-only vs multi-program ordered
    pageCodes) + staff program-election prompt at extension activation (eng D12).
  - [x] **PR2 #480** — `address-validation.ts`: USPS modal on ABNHA surfaced to
    the human reviewer (`civica:address-validation-required` event, no auto-
    accept), per-member sequential, 5-min timeout → manual-entry fallback.
  - [x] **PR3 #482** — 19 step-1 per-section tests + `makePacket` fixture with
    PortalPage snapshot-freeze (so V1-4 walk-refresh doesn't cascade test churn).
  - [ ] **PR4/PR5** — steps 2-9 fill modules + snapshot replay. **Gated on V1-4
    walk** (need PortalPage entries first). Map-literal dispatch (eng D7); walker
    falls through to `fillPage` for unknown codes (eng D2).
  - Human handles edge cases (address-validation modal, county select, missing
    fields) by acting on the page; fill logic does NOT automate modals in v1.
  - Verify: unit tests with jsdom fixtures per section (PR3 convention).

### The extension (the product)
- [ ] **V1-6 (P1, human ~2w / CC ~3d)** — Build `packages/civica-extension/`
  (Chrome MV3): manifest, popup UI, content script, background service worker,
  options page. Specifics folded in from Design + Eng voices:
  - **manifest `host_permissions` scoped to `benefitscal.com` ONLY** — a wildcard
    is a PII-exfil vector (Eng, security). URL-pattern guard `^/ApplyForBenefits/[A-Z]{5}$`.
  - **Readiness gate before fill** — MutationObserver / hydration check; the
    portal is a React SPA that hard-navigates between steps, and filling before
    hydration silently no-ops (Eng).
  - **Fill-status overlay (the trust layer — the human is the compliance gate):**
    visually mark each auto-filled field (colored border + "filled by Civica"
    tag); popup shows a per-step `filled / missing / needs-review` checklist
    (Design, CRITICAL).
  - **All five states specified:** loading (fetching packets), empty (no applicant
    selected / first-run), error (selector miss / page changed — user-visible,
    not just Sentry), partial fill, success-per-step (Design, HIGH).
  - **Cross-step continuity:** persist active-applicant + current-step context
    across the 9 URL transitions; per-step "re-fill / clear this step" control
    for mid-flow recovery (Design, HIGH).
  - Verify: load unpacked, log into BenefitsCal, see auto-fill + status overlay on captured pages; human clicks Next through to submit; recover from a deliberate mis-fill.

- [ ] **V1-6a (P1, human ~3d / CC ~6h)** — **Pre-submit trust panel** at the
  Review & Submit step: a source-vs-filled diff ("here's everything Civica filled
  from the packet, confirm before you click Submit"). This is the moment the
  human-in-loop compliance premise cashes out — without it, "human reviews" is
  aspirational.
  - Surfaced by: Design voice (MEDIUM, but premise-load-bearing).
  - Verify: diff panel renders filled values against packet source on step 9.

- [ ] **V1-7 (P1, human ~1d / CC ~3h)** — Extension test infra: Vitest +
  `sinon-chrome` (mock `chrome.*`) for unit, Playwright for real-Chrome e2e.
  - Verify: `pnpm --filter civica-extension test && test:e2e`.

- [ ] **V1-8 (P1, human ~3d / CC ~6h)** — OAuth 2.0 device flow: extension
  authenticates to enrollment-api to fetch applicant packets; refresh-token
  rotation. Reuses the iOS JWT pattern. **Token storage hardening (Eng,
  security):** access token in memory only; refresh token in
  `chrome.storage.session` (cleared on browser close) — NOT `chrome.storage.local`
  (plaintext, readable on a shared CBO workstation). Scope tokens minimally.
  - Verify: integration test full device-flow round trip; confirm no token in `chrome.storage.local`.

### Resilience + quality
- [ ] **V1-9 (P1, human ~2d / CC ~4h)** — Recorded HTML snapshot harness: save
  each gov page's HTML to `__fixtures__/portal-snapshots/{XXXXX}.html` during
  the walk; replay against fill logic in CI to catch selector drift at PR time.
  - Verify: CI green on current fixtures; a deliberate selector change breaks CI.

- [ ] **V1-10 (P2, human ~1d / CC ~2h)** — Selector-miss telemetry: content
  script reports `{page, label}` on any miss; Sentry alert when miss-rate >5%/day.
  - Verify: contrived bad selector triggers a metric write + alert.

- [ ] **V1-11 (P2, human ~4h / CC ~1h)** — In-page issue UX, two distinct cases
  (DX voice — selector miss must be user-visible, not just Sentry):
  - **Missing packet data**: highlight the field for the human to fill (NOT a
    hard throw — there's a human in the loop).
  - **Selector miss / portal changed**: distinct in-page message ("Civica
    couldn't fill X — fill manually; an update may be needed") AND fire the V1-10
    telemetry. Today V1-10 only alerts Civica ops; the CBO user sees a silent gap.
  - Verify: packet missing county → "fill county" prompt; simulated selector drift → distinct "couldn't fill" message + telemetry beacon.

### Dashboard support (slim — NOT a portal)
- [ ] **V1-12 (P1, human ~3d / CC ~6h)** — "Ready to submit" list + QC badge on
  the **existing** Civica dashboard. **This is the visible edge of the moat
  (the dry-run engine), not a nice-to-have** — see the reframe above. Shows
  which applicants are ready, with a pre-computed QC confidence score (error-rate
  + snap-rules + doc validity) so staff/CBOs work high-confidence packets fast.
  Filtered list view, NOT an automation trigger, NOT a portal.
  - **Badge spec (Design voice):** define tiers + color semantics + a "what's
    driving this score" tooltip / per-element breakdown ("your org runs hot on
    shelter"). The badge is the trust signal staff triage on; an unexplained
    number isn't actionable.
  - Verify: list renders with tiered QC badges + tooltip; clicking an applicant deep-links the extension.

### Ops + legal (parallel track)
- [ ] **V1-13 (P0 ops/legal)** — Counsel sign-off (TODO-10 batch) on the
  extension model + VoteNow CBO-of-record language. Hard deadline 2026-06-02.
- [ ] **V1-14 (P1 ops, ~10min)** — Set VoteNow CBO account default language to
  English in BenefitsCal settings.
- [ ] **V1-15 (P1 ops, variable)** — Provision Civica staff as named users under
  VoteNow's CBO (browser logins, not headless credentials).
- [ ] **V1-16 (P1 docs, human ~1d / CC ~3h)** — Documentation (expanded from
  DX voice — README today targets v2 operators, not pilot partners):
  - **Partner-CBO Quickstart**: install → auth → first-fill, written for a
    SEIU/UFW/county assister (not an operator). A real getting-started path.
  - **"Maintaining the selector map"**: how to add/verify a field, what gates a
    `todo` entry, how `/core` is structured — so a maintainer can extend it when
    the portal drifts.
  - Update `README.md` to the extension-first model (it still describes the
    superseded Playwright two-phase flow) + the rail-not-product framing.
  - Rename `portal-map/` → `benefitscal-map/` to kill "portal" ambiguity.
  - Verify: a new reader can follow Quickstart to a first fill; README matches current architecture.

## Sequencing

```
P0 (this week):           V1-13 counsel (deadline 2026-06-02)
                                 │
Foundation (parallel):    V1-1 ──┼── V1-2 ── V1-3
                                 │
Map + fill:               V1-4 (walk) ──▶ V1-5 (fill logic) ──▶ V1-9 (snapshot tests)
                                 │
Extension:                V1-6 ──▶ V1-7 ──▶ V1-8 (OAuth)
                                 │
Quality + dash (parallel):V1-10, V1-11, V1-12
                                 │
Ops (parallel throughout):V1-14, V1-15, V1-16
```

Critical path: V1-1 → V1-4/V1-5 → V1-6 → V1-8 → pilot with one CBO.

## NOT in scope (v1)

- Headless/Browserless automation (Appendix A — v2)
- Chrome Web Store / Edge / Firefox publishing (pilot is sideloaded)
- Non-English portal locales (English-default via V1-14)
- Multi-state selector maps (CA only)
- External CBO SSO/IdP (pilot uses Civica OAuth)

## Appendix A — v2: headless Mode A (deferred)

Once the extension proves the fill logic, the headless version removes the human
click for the highest-confidence packets. It REPLAYS the same `/core` map via
Playwright instead of a content script.

Deferred tasks (previously v1, now v2):
- Browserless driver (already written: `src/drivers/browserless.ts`) — promote
  from reference to active.
- CF Queue worker (dashboard "Approve & Submit" → enqueue → worker → Browserless).
- `staffer_account` pool + Postgres advisory lock (race-safe parallel headless jobs).
- `BROWSERLESS_API_KEY` secret (free tier for pilot, paid/self-host when revenue justifies).
- The approve-queue's "Approve" button gains an automation trigger (in v1 it's
  just a status flip + list view).

v2 reopens the mass-throughput compliance question (one staffer approving N
headless submissions) — defer that conversation with counsel until v2 is real.

## Open questions

- V1-4 walk: production CBO account (creates drafts to clean up) vs. wait for a
  sandbox. Decided so far: production is fine for selector capture; delete drafts
  after.
- QC score (V1-12): reuse the existing error-rate engine scorer as-is, or add a
  BenefitsCal-submission-specific confidence model? Lean reuse for v1.

## Autoplan review (2026-05-28, single-model — Codex unavailable)

Premise gate: PASSED with reframe — extension = submission rail (plumbing),
QC engine = product/moat. See "The architectural collapse" section.

### Decision Audit Trail

| # | Phase | Decision | Class | Principle | Rationale |
|---|-------|----------|-------|-----------|-----------|
| 1 | CEO | Reframe extension as rail, not product | PREMISE (user) | — | User-confirmed; aligns with repositioning Decision #8 |
| 2 | Eng | Materialize SELECTORS.md → typed `/core` map; delete stale field-map (V1-1a) | Auto | P1+P4 | Cross-phase CRITICAL (Eng+DX); map is the load-bearing artifact |
| 3 | Eng | React-safe fill primitive in `/core` (V1-1b) | Auto | P1+P4 | DOM path needs what Playwright gives free; shared by v1+v2 |
| 4 | Eng | SSN = `ssn_last4` only, no full-SSN egress (V1-2) | Auto | P5 | Schema is authoritative; correct the threat model |
| 5 | Eng | Token: session storage + in-memory access (V1-8) | Auto | P1 | Mechanical security best practice |
| 6 | Eng | manifest host_permissions = benefitscal.com only (V1-6) | Auto | P1 | Mechanical security; wildcard = PII-exfil vector |
| 7 | Eng | Hydration/readiness gate before fill (V1-6) | Auto | P1 | React SPA; fill-before-hydrate silently no-ops |
| 8 | Eng | County from intake, not ZIP lookup (V1-3) | Auto | P4 | CA ZIPs cross counties; intake already has county |
| 9 | Eng | Surface unvalidated-address modal to human, don't auto-accept | Auto | P5 | Human-in-loop is the gate; auto-accept is a liability |
| 10 | Design | Fill-status overlay + per-step checklist (V1-6) | Auto | P1 | Human-in-loop premise depends on it (CRITICAL) |
| 11 | Design | Enumerate all 5 UI states (V1-6) | Auto | P1 | Completeness |
| 12 | Design | Cross-step continuity + re-fill/clear (V1-6) | Auto | P1 | Mid-flow recovery across 9 steps |
| 13 | Design | Pre-submit source-vs-filled diff (V1-6a) | Auto | P1 | The trust moment the premise cashes out on |
| 14 | Design | QC badge tiers + tooltip (V1-12) | Auto | P1 | Unexplained score isn't actionable |
| 15 | DX | Selector-miss surfaced in-page (V1-11) | Auto | P1 | Today only ops sees it; user gets silent gap |
| 16 | DX | Partner-CBO Quickstart + map-maintenance docs (V1-16) | Auto | P1 | README targets v2 operators, not pilot partners |
| 17 | DX | Multi-state registry seam | Auto-DEFER | P3 | CA-only is v1 scope; add seam when 2nd state is real → NOT-in-scope |

### TTL note (Eng over-read, corrected)

The "15-min TTL" is **inactivity-based** (SELECTORS.md:34) — an actively-clicking
human resets it each action. Not a hard cap on the session. Real risk only for:
(a) a human who walks away mid-flow, (b) headless v2 if a job stalls. Add draft
resume/keepalive handling in v2; for v1, a walk-away just resumes the draft from
the queue (already proven in the walk).

### Cross-phase theme (high-confidence)

**Stale `field-map.ts` vs real `SELECTORS.md`** — flagged independently by both
Eng and DX. The map is the single most load-bearing artifact and it's currently
wrong-on-disk. V1-1a (P0) fixes it before any fill logic is written.

### Taste decisions (RESOLVED at gate, 2026-05-28)

1. **Selector-map delivery → bundled + telemetry for pilot, remote-config
   fast-follow.** Pilot ships the map bundled; selector-miss telemetry catches
   drift; build runtime remote-config BEFORE onboarding a 2nd external CBO. Add
   as a new task **V1-17 (P2, gated on 2nd-CBO onboarding)**: extension fetches
   versioned selector map from enrollment-api at runtime with a bundled fallback.
2. **Multi-state seam → DEFER.** CA-only for v1 (already in NOT-in-scope). Add
   the `stateCode`-keyed `StatePortalMap` seam when state #2 is a concrete
   requirement; `/core` isolation makes the later refactor cheap.

**Plan status: APPROVED via /autoplan (premise reframed, 16 auto-decisions
folded, 2 taste decisions resolved). Ready to implement.**
