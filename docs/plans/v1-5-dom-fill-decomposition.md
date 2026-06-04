# V1-5 — DOM fill logic per portal section: plan decomposition (#314)

**Status:** plan, agent-drafted 2026-06-04
**Parent:** [`benefitscal-bridge-extension-first.md`](benefitscal-bridge-extension-first.md) §V1 task list
**Issue:** [#314](https://github.com/matthewgg22/Civica/issues/314)
**Epic:** [#308](https://github.com/matthewgg22/Civica/issues/308)
**Effort estimate (issue body):** ~5 d human / ~1.5 d CC

This plan turns #314 from a single 5-day chunk into 5 reviewable PRs ordered so the V1-4 walk dependency (steps 2-9) only blocks PRs 4–5. PRs 1–3 ship today against work the extension already has on `codex/rebuild-feb18`.

---

## Current state (verified 2026-06-04)

**Selector map** (`packages/benefitscal-cbo/src/core/selector-map.ts`):
- 25 page entries: step 0 (entry flow, 6 pages) + step 1 (Your Information, ~19 pages)
- Steps **2–9 unmapped** (gated on V1-4 walk)

**Fill primitives** (`packages/benefitscal-cbo/src/core/`):
- ✅ `fill.ts` — React-safe `fillElement` + `fillText/fillRadio/fillCheckbox/fillSelect/fillDatePassword`
- ✅ `locate.ts` — label-first `resolveField` DOM resolver
- ✅ `select-option.ts` — radio/checkbox `resolveOption` + `isOptionGroupField`
- ✅ `transforms.ts` — V1-3 value transforms (`ca-county-ordinal`, `formatPhone10Digit`)
- ✅ `normalize.ts` — Civica packet → `BenefitsCalPayload`

**Section walker** (`apps/civica-submitter-extension/src/content.ts`):
- ✅ `fillPage(page, payload, root)` — generic page-fill loop that drives any `PortalPage` from the selector map
- ✅ Per-field event reporter for marking + fingerprinting (V1-6 / V1-6a)
- ❌ No SNAP-only-vs-multi-program section-sequence detection
- ❌ No address-validation-modal flow (the selector map has `ADDRESS_VALIDATION_FLOW`; nothing dispatches to it)
- ❌ Per-section unit tests for steps 2-9 (blocked on V1-4 fixtures)

**Snapshot fixtures** (`packages/benefitscal-cbo/snapshots/` or equivalent):
- ❌ Steps 2-9 fixtures don't exist — blocked on V1-4

## Acceptance criteria from #314 (re-stated)

1. Each implemented section fills its captured fields against jsdom fixtures of the real pages.
2. Section sequence adapts to SNAP-only (no Assets) vs multi-program.
3. Address modal is surfaced to the human, not auto-accepted.
4. Replaying the snapshot fixtures (V1-9) walks the captured flow without throwing.
5. Unit tests per section.

## What can ship today vs after V1-4

| AC | Blocked on V1-4? | Why / first PR |
|---|---|---|
| #2 (dynamic section sequence) | NO | Pure function over the existing step-0/1 pages; SNAP-only/multi-program detection is a `flowType` parameter, not a per-page concern. **PR 1.** |
| #3 (address modal) | NO | `ADDRESS_VALIDATION_FLOW` is already authored in `selector-map.ts:322`. **PR 2.** |
| #5 unit tests for step-1 sections | NO | Step 1 (~19 pages) is mapped; can author per-section tests against synthetic jsdom fixtures. **PR 3.** |
| #1 + #5 (sections for steps 2-9) | YES | Needs `PortalPage` entries from V1-4. **PRs 4–5, deferred.** |
| #4 (snapshot replay) | YES | Needs V1-9 snapshot harness + V1-4 walk fixtures. **PR 5.** |

## Proposed decomposition

### PR 1 — Dynamic section sequence (P0, ~2h CC)

A pure function in `/core` that, given the selector map + an applicant's program election (SNAP-only vs SNAP + Medi-Cal / TANF / GA), returns the **ordered list of `pageCode`s** the extension should expect to encounter.

**File:** `packages/benefitscal-cbo/src/core/section-sequence.ts` (NEW)

```ts
export type FlowProgram = "snap_only" | "snap_plus_medi_cal" | "snap_plus_general_assistance" | "snap_plus_tanf" | "multi_program";

export interface SectionSequenceInput {
  programs: FlowProgram;
  /** Future axes (e.g. assister vs self-serve) plug in here. */
}

export function sectionSequenceFor(input: SectionSequenceInput): string[] {
  // Returns the ordered list of pageCodes the portal will present.
  // SNAP-only flows omit ABS* (Assets) per SELECTORS.md §1.7 BBCE bypass.
  // Steps 0 + 1 are always present; 2-9 depend on `programs`.
}
```

Plus a tiny **navigation helper** the content script consumes:

```ts
export function shouldSkipPageForFlow(pageCode: string, sequence: string[]): boolean;
```

**Tests** (~6 vitest cases):
- `snap_only` returns step-1 sequence + every non-Assets step-2-9 placeholder
- `snap_plus_medi_cal` includes Assets
- ABS pages NOT in `snap_only` output
- Helper returns true for `ABASX` when SNAP-only

**Why ship first:** isolates the SNAP-vs-multi-program logic from page-fill mechanics. Lets PRs 2–5 assume a `sectionSequenceFor()` result without re-litigating.

### PR 2 — Address-validation modal handler (P0, ~3h CC)

The selector map already has `ADDRESS_VALIDATION_FLOW` (USE THIS ADDRESS button, county select with ordinal transform, CONTINUE button, NEXT). Per the issue's acceptance criterion #3 + Eng review: the human clicks USE THIS ADDRESS (liability — never auto-accept an unvalidated gov address); the extension only fills the county dropdown in modal #2.

**Files modified:**
- `apps/civica-submitter-extension/src/content.ts` — detect when the modal is on-screen post-ABNHA, fill county select via the `ca-county-ordinal` transform, render an overlay state with status `partial` + a clear "click USE THIS ADDRESS to confirm" message
- `packages/benefitscal-cbo/src/core/address-modal.ts` (NEW) — pure compute: `isAddressValidationModalPresent(root)`, `fillAddressModalCounty(root, county, payload)` (returns the action outcome)
- Tests: jsdom fixture for the two-modal flow

**Hard guarantees** (encoded as tests):
- Extension never invokes `.click()` on `USE THIS ADDRESS`
- Extension never invokes `.click()` on the modal's `CONTINUE` button (also human-confirmed)
- County select fills only when `payload.address.county` resolves via `ca-county-ordinal`; unknown county → modal stays uncountied, overlay flags it

**Why second:** modal handling is independent of any single section; can ship without V1-4. Earns the AC #3 sign-off and removes a known landmine before the bigger step-2-9 build.

### PR 3 — Per-step-1-section tests (P1, ~4h CC)

Today the extension's fill loop is tested generically in `apps/civica-submitter-extension/test/content-fill.test.ts`. To satisfy AC #5 against step 1's 19 pages, we add per-section test files that drive `fillPage` over each step-1 `PortalPage` against a synthetic jsdom fixture matching the page's field shape.

**Files:** `packages/benefitscal-cbo/test/core/sections/step1-{ABLPR,ABNMI,ABNHA,...}.test.ts` (one per page; ~19 files)

**Convention** (locked in this PR):
- Each test file builds a jsdom doc with `<label>` + `<input>` for every field in the page
- Drives `fillPage(pageEntry, samplePayload, doc)` and asserts:
  - All `source`-bearing fields filled
  - Constant-bearing fields filled (e.g. ABPRI `#snap`)
  - Option-group fields land on the correct option
  - Buttons NEVER clicked
- Each test file pulls its `PortalPage` entry from `PORTAL_PAGES_BY_CODE[code]` — drift in the selector map breaks the test, not silently rebases away from production

**Why third:** independent of V1-4 (step 1 is fully mapped). Establishes the test convention; PRs 4–5 add `step2-*.test.ts` against the same pattern as V1-4 lands pages.

### PR 4 — Step-2-X sections as V1-4 lands them (P1, INCREMENTAL; gated on V1-4)

Once V1-4 starts landing PortalPage entries for steps 2-9, each step rolls in as a separate PR following the PR 3 pattern. Concretely:

| Step | When | What ships |
|---|---|---|
| Step 2 (People) | V1-4 step-2 walk done | New `PortalPage` entries + matching per-page tests (PR 3 convention) |
| Step 3 (Household) | ditto | ditto |
| Step 4 (Income) | ditto | ditto |
| Step 5 (Expenses) | ditto | ditto |
| Step 6 (Assets) | ditto | ditto; uses PR 1's `shouldSkipPageForFlow` for SNAP-only |
| Step 7 (Other Situations) | ditto | ditto |
| Step 8 (Document Upload) | ditto | ditto; file inputs SKIPPED per existing `fillElement` guard |
| Step 9 (Review & Submit) | ditto | ditto; unblocks #316 V1-6a's auto-trigger URL detection |

**Per-step PR shape:** new pages added to `PORTAL_PAGES`, per-page test file, snapshot fixture (if V1-9 is online by then). 6–8 PRs over the course of V1-4 — none larger than a typical day.

### PR 5 — Snapshot-replay harness (P1, gated on V1-4 + V1-9; ~6h CC)

Once V1-9 (snapshot fixture harness) is online and at least one step-2-9 walk is captured, V1-5 closes by adding a snapshot-replay test:

- Loads each captured HTML fixture
- Walks the corresponding `PortalPage` via `fillPage(...)`
- Asserts the walk fills the expected count + reports the expected count of `needsReview` for any unmapped eligibility values

**File:** `apps/civica-submitter-extension/test/snapshot-replay.test.ts`

## Risks + how to defuse

| Risk | Defuse |
|---|---|
| **V1-4 walk delivers a selector map shape the existing `PortalPage` type can't represent** | Treat V1-4 as a forcing function — PR 1's PR body asks reviewers to flag schema gaps before merging |
| **Address modal varies by county** (e.g. some counties have a 3rd "is this a PO Box?" prompt) | PR 2 codifies the 2-modal contract; extra prompts land as `needs-review` + overlay flag, never blind auto-fill |
| **Per-step-1-section tests pin field labels that change in BenefitsCal** | The whole point — drift IS the signal; failing tests trigger a V1-4 re-walk for that page |
| **`fillPage` already does what V1-5 specifies** | Confirmed; PR 3 is *coverage* over the existing primitive, not a re-implementation. Stop short of refactoring the working code. |
| **SNAP-only sequence wrong for partner CBOs serving multi-program applicants** | PR 1's `FlowProgram` enum models this. Default for Civica's pilot is `snap_only`; partner CBOs configure their own program election in the extension popup |
| **Address-modal handler regresses the v1 "human reviews everything" posture** | PR 2's hard-guarantee tests assert NO clicks on USE THIS ADDRESS / CONTINUE / submit; the overlay state explicitly tells the human to click |

## Sequencing recommendation

```
        PR 1 (section seq)          PR 2 (address modal)         PR 3 (step-1 tests)
              │                            │                            │
              └───── ship today ───────────┴────────────────────────────┘
                                           │
                            ┌──── V1-4 walks land step-by-step ───┐
                            │                                      │
                  PRs 4.x (incremental, per-step)            PR 5 (snapshot-replay)
```

PRs 1, 2, 3 are unblocked today. PR 4.x is incremental; expect 6–8 small PRs over 1–2 weeks of V1-4 walks. PR 5 is the closer.

## What this plan deliberately does NOT do

- **No refactor of `fillPage`.** It's working. PR 3 adds coverage; that's it.
- **No re-implementation of the React-safe primitive.** V1-1b shipped; V1-5's "DOM fill logic" is the section-level orchestration sitting on top.
- **No headless / Browserless integration.** That's v2; stays in `/driver` subpath.
- **No anti-bot or rate-limit work.** v1 runs in the human's browser; no rate-limit surface.
- **No section sequencer that auto-clicks the ABNAV "Start <section>" buttons** (the 9 sub-step entry points). Eng review explicitly rejected this — humans navigate.

## Hand-off

If approved as-is, I'd recommend starting with PR 1 (section sequence — smallest, isolates the program-election decision) and PR 2 (address modal — second-smallest, removes a landmine). PR 3 can land in parallel.

The plan-eng-review skill is the right next pass if anything feels off, especially the SNAP-only program-election shape in PR 1 (does the extension *know* the program election before fill, or is it inferred from the packet?). That's an open question to confirm with the operator before PR 1 starts.

## Open questions (operator / eng input needed before PR 1)

1. **Where does the program election live?** Per the existing `BenefitsCalPayload` schema — is the SNAP-only-vs-multi-program signal already on the payload, or does the extension popup ask the assister?
2. **PR 1 enum scope.** Should `FlowProgram` start with the 5-case enum above, or just `snap_only | multi_program` for v1?
3. **Address modal county fallback.** When `payload.address.county` is missing or doesn't map via `ca-county-ordinal`, what's the right UX — leave the dropdown blank + overlay flag, or pre-select a sentinel "(choose your county)" option?
