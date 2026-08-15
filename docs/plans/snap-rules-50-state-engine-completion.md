# Completing the SNAP calculator for all 53 jurisdictions

**Status:** draft, not authorized to execute · **Date:** 2026-08-12 · **Companion to:** [mae-state-corpus-framework.md](mae-state-corpus-framework.md), [snap-rules-matrix.md](snap-rules-matrix.md)

**This plan is a plan, not a go-ahead.** `packages/snap-rules` is fully parked per the
standing rule — every state and every batch below needs its own separate, explicit
go-ahead before any code lands, exactly like every corpus state did. Nothing in this
document authorizes touching the engine. It exists so a "go" on any row can be acted on
immediately instead of re-deriving scope each time.

---

## 1. Two systems, two different completion states

The 50-state corpus expansion (batches 1–5, all merged) built **Demeter's chat corpus** —
53 jurisdictions' worth of cited policy text that lets Mae answer questions accurately.
That is a separate system from **the calculator** (`packages/snap-rules`'s `StatePolicy`
registry) — the thing that actually runs a real eligibility/benefit determination against
a household's facts. A jurisdiction can have a fully verified corpus and *no* calculator
at all; today, most do.

```
   CORPUS (packages/demeter-engine)        ENGINE (packages/snap-rules)
   "what does Mae say about this state"    "what does the calculator DO for this state"
   53 / 53 jurisdictions          ────▶     18 / 53 jurisdictions have StatePolicy
                                            16 / 53 have oracle-verified expected outputs
                                             1 / 18 (AK) has a policy axis that looks stale
```

## 2. Current state of the calculator (verified against `origin/codex/rebuild-feb18`, plus
this plan's own individual-tier landings)

`StatePolicy` (the calculator's per-state config — `packages/snap-rules/src/constants/
states.ts`) exists for **21 states**: CA, WA, TX, NY, GA, MI, IL, FL, MA, NV, AZ, OR, WI,
MN, OH, KS, PA, AK, NC, NJ, VA.

The oracle fixture (`data-ops/sample/civica-test-profiles/v0.6.json`, `expected_by_state`)
— the independently-computed ground truth every `/profile-simulation` run grades the
engine against — has full 92-case coverage for **19 of those 21**: CA, WA, TX, NY, GA, MI,
IL, FL, MA, NV, AZ, OR, WI, KS, OH, AK, NC, VA. (PA and NJ also have all 92 rows authored,
per the execution log's PA/NJ entries below, but both grade 34/0/95 — most of their
profiles legitimately SKIP on the null-SUA gap, not a coverage gap, so neither is counted
as "clean" here.)

Two states have a `StatePolicy` but no oracle coverage yet, for different reasons:

| State | Has `StatePolicy` | Has oracle coverage | Why not |
|---|---|---|---|
| **PA** | yes | no | Never authored — corpus build (#749) predates any oracle-authoring pass for PA |
| **MN** | yes | no | **Structurally blocked**, not just unauthored — `sua_by_tier: null`; the engine can't compute a shelter-deduction-dependent benefit for MN until a real SUA figure lands (per [[project_snap_rules_oracle_authoring]]) |

One state's `StatePolicy` is present, oracle-covered, and **looks wrong**:

- **AK** — `bbce: false` in the engine, but AK's own corpus pack (batch 5, built this
  session, primary-sourced) confirms AK adopted 200% FPL BBCE effective **7/1/2025**. The
  engine entry predates the whole corpus expansion (an early "Wave B" commit) and the
  file's own header comment already flags AK — alongside TX and KS — as a **"policy
  archetype... illustrative until the FNS-published values are loaded,"** not a verified
  entry. This is a real, pre-disclosed gap, not a surprise regression — but it's live in
  the engine today and, if used for a real determination, would wrongly deny categorical
  eligibility to AK households between 130%–200% FPL.

**32 states have neither** `StatePolicy` nor oracle coverage — the full remaining scope:
AL, AR, CO, CT, DC, DE, GU, HI, IA, ID, IN, KY, LA, MD, ME, MO, MS, MT, ND, NE, NH,
NM, OK, RI, SC, SD, TN, UT, VI, VT, WV, WY. (NC, NJ, and VA — the first three "individual
tier" states, §6 — are DONE; see the execution log's NC/NJ/VA entries.)

## 3. Structural design: what's universal (fix once) vs. what's genuinely per-state (author 53×)

This is the question to answer *before* building 35+ more states — not after — because
retrofitting a shared/universal fix across states that already shipped is the exact
"change something 50 times" failure mode to avoid. Two systems, evaluated separately;
they are in very different shape today.

### Corpus (`packages/demeter-engine`) — already correctly centralized, confirmed by audit

The architecture audit run earlier this session (Explore agent, file:line cited — see
[[project_demeter_50_state_expansion]] §"Architecture audit") already checked exactly
this question for the corpus and found it sound:

| Element | Where it lives | Per-state duplication risk |
|---|---|---|
| Federal 7 CFR text, OBBBA supersession notes, FY-figure dates | ONE shared file, never duplicated per state | None — confirmed by audit |
| State-specific policy | Each pack's `supplements.json`, appends after the federal layer, never overrides it (`retrieval.ts:428-463`) | None — append-only by design |
| Cross-state leakage | Actively prevented via documented `null` vs `undefined` state semantics (`states/index.ts:258-262`) | None, though issue #780 notes no *regression test* directly asserts this |
| Missing-registration risk | A pack can exist on disk but never get wired into `REGISTRY` with no test catching it | **Real gap — issue #779**, not a duplication problem but a silent-omission one |

**Conclusion: the corpus side needs no structural fix before scaling further.** Keep
building states the same way; #779's registration-safety-net is the only open item, and
it's orthogonal to the "don't repeat 50×" question.

### Engine (`packages/snap-rules`) — mostly sound, three real gaps worth fixing before mass-building

| Element | Current design | Verdict |
|---|---|---|
| FPL table, standard deduction, max-allotment (48-tier), asset limits, shelter cap, homeless deduction, min benefit | ONE shared module, `constants/federal-tables.ts` — "the SOLE source-of-truth for TS-side federal constants... No constant lives in two places" (the file's own header) | **Already correct.** Every state reads this, none duplicate it. |
| ABAWD waiver counties (CA and others) | Per-county lookup tables in `work-requirements/waiver-counties.ts`; `StatePolicy.abawd_waiver_avail` is documented as only the state-level *fallback* for when `county_fips` is unknown, not the real answer | **Already correct pattern** — the model for how a state's own genuinely-granular data should be stored: a real lookup file, with `StatePolicy` holding only a coarse default. |
| AK's per-region SUA | `constants/ak-utility-regions.ts`, same fallback-default pattern as ABAWD counties | **Already correct**, same reasoning. |
| `bbce` / `bbce_threshold_pct` / `bbce_fpl_basis` / `asset_waiver` / `sua_by_tier` / `drug_felony_ban` / `rmp_operated` | One flat value per state in `StatePolicy` | **Genuinely per-state** — these vary state to state by design, not an artifact of poor structure. Authoring these 35× is real, unavoidable work, not duplication to eliminate. |
| `drug_felony_ban: boolean` | A true/false flag standing in for what is, in practice, at least three real states (`full ban`, `modified/conditional ban`, `full opt-out`) | **Structural gap.** Every state with a modified ban (already: PA, MD, WV, KY, NE, HI, AK per its own PROVENANCE.md) is forced to encode it as `false`, with the real nuance pushed into a comment — the type can't express what the policy actually is. Fine at today's scale; a real liability once ~15-20 of 53 states carry a silently-flattened "modified" value with no queryable signal. **Fix this once, as its own PR, before or early in the batch-tier build-out** — widen to a `"none" \| "modified" \| "full"` enum (or similar), migrate the ~18 existing entries in the same PR, then every new state gets it right from day one instead of needing a 35-state retrofit later. |
| `AllotmentTier: "48" \| "AK"` | Closed union, no room for HI/GU's genuinely elevated allotment tables | **Structural gap**, already noted in §4 below — same "fix the enum once, before the states that need it" logic. |
| No effective-date banding on `StatePolicy` | `federal-tables.ts` already solved this exact problem for FEDERAL figures — `FederalTableSnapshot { effective_start, effective_end, ... }`, an array of dated snapshots, explicitly because "never edit a published table after its effective_end passes... add a new effective-date entry" instead. **`StatePolicy` does not use this pattern at all** — it's a flat, undated `Record<string, StatePolicy>`, one value per state, edited in place whenever policy changes. | **The single highest-value structural fix.** AK's `bbce` flip (issue #804) is exactly the failure mode this would prevent — a real policy change with a real effective date, currently modeled as a silent in-place edit with no record of what was true before. Every future COLA cycle, recert-period change, or new-law adoption across 53 states will hit this same gap repeatedly if it isn't fixed now. **Recommend: reuse the exact `FederalTableSnapshot` shape for `StatePolicy` before building the batch tier** — this is not a new pattern to invent, just extending one that already exists and is already proven for the federal tables. |

**Recommended order given the above**: do the `drug_felony_ban` enum widening and the
`StatePolicy` effective-date-snapshot migration as their own small PRs, early — ideally
before or alongside PA's oracle-authoring pass (§5 step 1), since PA is small, fast, and
low-risk to validate the new shape against before 33 more states build on top of it. The
`AllotmentTier` extension can wait until HI/GU are actually up (§5 step 4) since nothing
else depends on it sooner.

## 4. A schema gap the plan needs to name up front

`AllotmentTier` (`packages/snap-rules/src/constants/states.ts`) is currently a closed union
of exactly `"48" | "AK"`. **HI and Guam both need a real elevated-allotment tier the schema
cannot express today** — HI has its own maximum-allotment table under federal law, same
family as AK's; Guam's corpus pack (batch 5) confirms its benefit figures are genuinely
territory-elevated even though its *income* limits track the 48-state table. USVI may or
may not need its own tier — unconfirmed, check during that state's build.

This means HI and GU (and possibly VI) are **not** simple "copy the pattern, fill in
values" builds like the other 33 — they need a small `AllotmentTier` type extension first
(and the max-allotment lookup wired to it), which is itself a schema change and should be
scoped, reviewed, and gone-ahead-on as its own small step before those three states'
constants land. Doing this quietly as a side effect of one state's PR would bury a
schema decision inside a data PR — flag it as its own commit/PR instead.

## 5. Per-state build process (mirrors the corpus pipeline; different verification step)

This is the same shape the NY/NV/AZ/OR/WI engine work already used successfully — nothing
new to invent, just scaled to 35 more states:

1. **Source and cite all ~9 policy axes** from primary sources, same discipline as the
   corpus PROVENANCE.md work (in fact, most axes are *already sourced* in that state's
   corpus pack — this step is substantially "translate the corpus's already-cited findings
   into the engine's stricter typed shape," not starting from zero):
   - `bbce` / `bbce_threshold_pct` / `bbce_fpl_basis`
   - `asset_waiver`
   - `sua_by_tier` (`HCSUA` / `LUA` / `phone` / `none`, as `Decimal`s — or explicitly `null`
     if genuinely unconfirmed, same discipline MN's entry already models; a `null` SUA
     blocks benefit computation for that state until resolved, so flag it loudly, don't
     bury it)
   - `allotment_tier` (`"48"` for most; `"AK"`/`"HI"`/`"GU"` once §4's schema extension
     lands, for those three)
   - `drug_felony_ban`
   - `abawd_waiver_avail`
   - `rmp_operated`
2. **Add the `StatePolicy` entry** to `packages/snap-rules/src/constants/states.ts`, with
   inline citations in the same comment style every existing entry already uses (see CA's
   or PA's entries for the house style — per-axis source, fetch date, and any known
   internal tension disclosed rather than silently resolved).
3. **Build (not derive) an independent oracle calculator** for that state — per
   [[project_snap_rules_oracle_authoring]]'s established rule: oracle expectations must
   come from a validated independent calculation, never from running the engine itself and
   copying its output. This is the step most likely to catch a real `StatePolicy` bug
   before it ships, and skipping it defeats the whole point of the fixture.
4. **Author all 92 `expected_by_state[STATE]` entries** in `data-ops/sample/
   civica-test-profiles/v0.6.json`, classifying each profile financial-gate /
   non-financial-gate / state-axis-sensitive first (the #636 methodology already used for
   NY/NV/AZ/OR/WI/AK).
5. **Verify via `/profile-simulation state=XX`**, target a clean grade (the pattern used
   throughout: 129/0/0 or equivalent, zero unexplained fails; a pre-known, disclosed fail
   like NY's 2 is acceptable, a silent one is not).
6. **Commit and PR** — `feat(snap-rules):` for the `StatePolicy` addition,
   `test(qa):` for the oracle-fixture authoring, same split-commit convention CLAUDE.md
   already requires for mixed feature+test diffs. **Report to the user and wait for
   merge go-ahead — do not merge on completion alone**, matching how every corpus PR and
   every prior engine PR (NY/NV/AZ/OR/WI/MN) was actually landed.

## 6. Sequencing recommendation

Population-ordered individual builds for larger states, small parallel batches for
smaller ones — the same pacing directive that governed the corpus expansion — but **with
smaller batch sizes than corpus batches used**. Oracle-fixture authoring (92 rows per
state, each needing an independently-computed expected verdict/benefit) is materially
more error-prone per-state than corpus-pack writing was, and corpus batches already grew
to N=5–6 by the end; recommend capping engine batches at **N=3** so merge-conflict rebase
overhead (the established "last-to-merge-needs-N-1-rebases" rule, worse here because
`v0.6.json`'s `expected_by_state` blocks are large and easy to badly interleave, same
failure mode `answer-eval.ts` had) doesn't compound with oracle-authoring's own error
surface.

Suggested order, by 2026 population estimate (skipping HI/GU pending §4's schema work,
skipping MN pending its SUA gap, PA promoted to the front since its `StatePolicy` already
exists and only oracle authoring is outstanding):

1. **PA** (constants already done — pure oracle-authoring, fastest win, do first)
2. **AK correction** (fix `bbce`, re-verify every other axis against the corpus's
   PROVENANCE.md, regenerate all 92 oracle rows since a `bbce` flip changes categorical-
   eligibility outcomes across a large share of the profile set — treat as a full rebuild,
   not a one-line patch, precisely because it's already shipped and wrong)
3. Individual tier (~4M+ population): ~~NC~~ (done), ~~NJ~~ (done), ~~VA~~ (done), TN, IN, MO, MD, CO, SC, AL, LA, KY, OK
4. Schema step: extend `AllotmentTier` for HI/GU (own small PR, own go-ahead)
5. HI, GU (now unblocked)
6. Batch tier (<4M population, N≤3 per batch): CT, UT, IA, AR / MS, NM, NE / ID, WV, NH /
   ME, RI, MT / DE, SD, ND / VT, WY, DC / VI
7. MN, once a real SUA figure is sourced (may unblock independently of this sequencing —
   revisit whenever that specific gap closes)

## 7. Governance — carried forward unchanged

- **File an issue before touching the engine** ([[feedback_engine_math_file_issue_first]])
  — every finding above (AK's stale `bbce`, MN's blocking `null` SUA, the `AllotmentTier`
  gap, the `drug_felony_ban` enum gap, the missing effective-date banding) gets its own
  issue before any code changes, same as every OH/KS/NM discrepancy this expansion already
  found and filed rather than silently fixed.
- **`packages/snap-rules` stays parked** ([[feedback_dashboard_snap_rules_parked]]) — ask
  before every state, every batch, every schema change. This plan does not change that;
  it only means the ask can point at a specific row instead of re-scoping from scratch.
- **Split commits**: `feat(snap-rules):` for constants, `test(qa):` for oracle-fixture
  authoring — never combined, per CLAUDE.md's commit-message convention.

## 8. Issues filed / open items to file

- **[#804](https://github.com/matthewgg22/Civica/issues/804)** — AK's stale `bbce: false`
  constant. Filed.
- **[#805](https://github.com/matthewgg22/Civica/issues/805)** — `drug_felony_ban` boolean
  can't express "modified" (7+ states already need it). Filed.
- **[#806](https://github.com/matthewgg22/Civica/issues/806)** — `StatePolicy` has no
  effective-date banding, unlike `federal-tables.ts`'s already-proven pattern. Filed.

All three issues from this plan are now filed. Execution authorized 2026-08-12 ("agreed
go") in the order below.

## 9. Execution log

Working the recommended order: #805 (enum widening) → #806 (effective-date banding) → PA
oracle-authoring → #804 (AK correction + oracle rebuild) → individual tier → schema step
→ HI/GU → batch tier → MN (once unblocked). Each step still gets its own PR and its own
report back before merge — this "go" authorizes starting the work, not silently merging
all of it.

- **#805 (drug_felony_ban enum)** — widened `StatePolicy.drug_felony_ban` from
  `boolean` to `"none" | "modified" | "full" | "unconfirmed"`, migrated all 18 existing
  entries from citations already in this file or a merged corpus `PROVENANCE.md` (no new
  research): none = MA/IL/OH/MI/NY/NV/OR/MN, modified = FL/PA/AZ/WI/KS/AK, full = TX,
  unconfirmed = CA/WA/GA (genuinely no citation found anywhere in the repo for these
  three). Gate behavior in `disqualifications.ts` unchanged (`"full"` disqualifies, same
  as old `true`; everything else fails open, same as old `false`) — this fixed what the
  value *claims*, not what the gate *does*. 279/279 snap-rules tests + 44/47
  profile-harness tests (3 pre-existing skips) passing, `tsc --noEmit` clean. PR
  [#807](https://github.com/matthewgg22/Civica/pull/807), CI green, awaiting merge
  go-ahead.
- **#806 (effective-date banding)** — reused `federal-tables.ts`'s already-proven
  `FederalTableSnapshot` pattern for `StatePolicy`: added `effective_start`/`effective_end`,
  `STATES` became `Record<string, StatePolicy[]>`, `statePolicyFor(state, asOf)` now
  requires a date. Every existing entry got exactly ONE snapshot spanning 2020-2099 — a
  data-shape-only migration, zero policy values changed. Threaded `asOf` through all 7 real
  call sites (`verdict.ts`, `benefit-calc.ts`, 4 gates, `constants/index.ts`); confirmed via
  repo-wide grep that 3 other references outside `packages/snap-rules` are comment-only, no
  real blast radius beyond the package. `composeVerdict` gracefully catches the new
  `NoStatePolicyForDateError` the same way it already caught `UnknownStateError`. 279/279
  snap-rules tests + 44/47 profile-harness tests (3 pre-existing skips) passing, `tsc
  --noEmit` clean. Built independently off `origin/codex/rebuild-feb18` (predates #807).

  **#807 merged 2026-08-15; #806 rebased against it — a NEW engine-specific rebase lesson,
  distinct from every corpus-batch rebase this expansion has hit so far.** `states.ts`'s
  reindentation (every field gained 2 spaces when wrapped in an array) meant git's line-diff
  conflicted on nearly the entire file — resolving that via inline conflict markers would
  have been extremely error-prone. Fix: regenerated the array-wrapped structure directly
  from #807's ALREADY-MERGED `states.ts` (preserving its enum values) rather than
  hand-resolving each conflict block. **Caught a real, easy-to-miss bug in doing so**:
  `verdict.ts` and `gates/disqualifications.ts` auto-merged CLEANLY with no conflict markers
  at all — but silently kept the PRE-#807 gate logic (`if (policy.drug_felony_ban)`, a
  boolean-truthy check) instead of #807's `if (policy.drug_felony_ban === "full")`, because
  #806 had only touched the `statePolicyFor(state)` call on a neighboring line, not the gate
  check itself. Combined with #807's string-enum values, the STALE boolean check would have
  disqualified every household in every state with ANY `drug_felony_ban` classification
  (`"none"`, `"modified"`, `"unconfirmed"` all being non-empty strings) — a severe, silent
  regression that a clean auto-merge and passing typecheck would NOT have caught, since
  `policy.drug_felony_ban` still type-checks as truthy-testable. Caught only by explicitly
  re-reading the gate logic after the merge rather than trusting "no conflict = correct."
  **Lesson for any future engine-side rebase** (distinct from the corpus's answer-eval.ts
  lesson): when two branches touch the SAME function from different angles (one touches the
  call, one touches what's inside the call's result), a clean git auto-merge is not proof of
  correctness — explicitly diff the merged file's LOGIC against both parent branches' intent,
  not just against conflict-marker absence. Also caught and fixed a related process mistake:
  my first resolution attempt was a plain commit (one parent), not a real merge — which would
  have made the PR diff misleadingly re-show all of #807's changes as new. Fixed by resetting
  and redoing as a proper two-parent merge commit before pushing.

  Reconciliation verified: `tsc --noEmit` clean, 279/279 snap-rules tests + 44/47
  profile-harness tests (3 pre-existing skips) passing, three-dot diff against origin
  correctly scoped to #806's real incremental changes only. PR
  [#808](https://github.com/matthewgg22/Civica/pull/808), CI running, awaiting merge
  go-ahead.
- **PA oracle-authoring (#636 methodology)** — authored `expected_by_state.PA` for all 92
  `expected_by_state`-shaped v0.6 profiles, following the NY/NV/AZ/OR/WI methodology.
  Fixture-only; PA's `StatePolicy` untouched (out of scope per the standing
  snap-rules-parked rule). Independent calculator built fresh (not derived from
  `packages/snap-rules` output), cross-validated against WI's already-graded oracle
  (PA's near-twin on every axis except `abawd_waiver_avail`/SUA presence): 92/92 exact
  match running the calculator under WI's policy params before trusting it for PA. PA's
  null-SUA gap (`StatePolicy.sua_by_tier: null`) means 58 of 92 profiles legitimately SKIP
  in real grading (`composeVerdict` bails before any gate runs); those keep `benefit: null`
  and only get a `verdict` when independently proven SUA-invariant across a $0-$1000 sweep
  (0 profiles were genuinely indeterminate). Verification: 34 PASS / 0 FAIL / 95 SKIP,
  every SKIP attributable to the documented null-SUA gap. 279/279 snap-rules tests, `tsc
  --noEmit` clean. PR [#809](https://github.com/matthewgg22/Civica/pull/809), **merged**.

- **AK bbce/asset_waiver correction + oracle rebuild (#804)** — `StatePolicy.AK` carried
  `bbce: false`, but AK's Demeter corpus pack (built and merged the same session)
  independently confirmed AK adopted BBCE effective 2025-07-01 (DOH's own BBCE FAQ,
  06/26/25). First real use of #806's effective-dated-snapshot capability: split into a
  pre-BBCE snapshot (2020-01-01..2025-06-30, unchanged) and a post-BBCE snapshot
  (2025-07-01 onward, `bbce: true`, `bbce_threshold_pct: 200`, `asset_waiver: true`) rather
  than editing the single placeholder in place. All 92 `expected_by_state.AK` entries
  rebuilt (not patched) under an independent Python calculator, self-validated by
  reproducing all 92 pre-fix verdicts exactly under the old `bbce: false` assumption, and
  cross-validated against WI's already-graded BBCE-200 oracle (10 DENY→APPROVE flips, all
  matching WI's mechanics; 3 unflipped DENYs matching WI's too). `benefit` stayed `null`
  throughout — AK's benefit-amount math had its own separately-tracked gap, filed as #814.
  Verification: 129/129 PASS, 0 FAIL, 0 SKIP (verdict-only). 279/279 snap-rules tests,
  44/47 profile-harness tests (3 pre-existing skips), `tsc --noEmit` clean. PR
  [#815](https://github.com/matthewgg22/Civica/pull/815), **merged**.

- **#814 (AK zone-based max allotment + minimum benefit)** — `StatePolicy.allotment_tier`
  was correctly authored `"AK"` since #806, but `maxAllotmentFor()`/`minimumBenefitFor()` in
  `federal-tables.ts` took no state parameter at all and always returned the single
  48-contiguous national table, silently understating every AK household's benefit ceiling
  (and floor) across all three of AK's real geographic zones (Urban/Rural I/Rural II).
  Fixed by mirroring `ak-utility-regions.ts`'s (#631) two-tier pattern: a new
  `constants/ak-allotment-zones.ts` module holds AK's real zone-keyed max-allotment and
  minimum-benefit tables (sourced from USDA FNS's own AK-specific FY26 table, cross-checked
  against `packages/demeter-engine`'s AK corpus pack) plus a `county_fips` → zone resolver
  built from 7 CFR 272.7(b)'s federal zone-geography definitions — a DIFFERENT source than
  the dollar figures, since neither AK DOH nor the corpus pack had a single published
  community-to-zone master list. `maxAllotmentFor`/`minimumBenefitFor` gained optional
  `state`/`countyFips` params that are a no-op for every non-AK state (verified via a
  1,472-comparison git-stash diff: byte-identical output before/after across 17 states × 4
  dates × 10 sizes). Zone geography coverage is partial and disclosed: 23 of AK's 30
  boroughs/census areas resolve with either an unambiguous or a documented majority-share
  judgment call; one (Chugach Census Area) is deliberately left unmapped (genuine
  Valdez/Cordova split) and falls through to the Urban default. AK's own zone-specific
  minimum-benefit floors ($31/$39/$48 vs the $24 federal default) got the same fix in the
  same PR — in scope, not deferred. AK's own $358/$374 standard deduction (vs. the federal
  table this engine still uses for every state) stayed OUT of scope — a separate, disclosed
  gap. Oracle: rebuilt AK's benefit-dollar-amount oracle for all 81 APPROVE profiles (11
  DENY profiles keep `benefit: null` — no benefit to compute) via an independent Python
  calculator (not derived from engine output), cross-validated 81/81 exact match against
  the live engine post-fix. Verification: 129/129 PASS, 0 FAIL, 0 SKIP, now exercising real
  benefit-dollar assertions (not verdict-only) with no PARAMS_MISMATCH. Every other
  registered state's harness totals unchanged from baseline (CA/MA/TX/WA/GA/FL/IL/OH/MI/
  KS/WI clean 129/0/0; NY 127/2 and AZ 128/1 pre-existing known fails; MN all-SKIP;
  PA 34/0/95 — all identical to pre-#814). 316/316 snap-rules tests (279 pre-existing + 37
  new), 44/47 profile-harness tests (3 pre-existing skips), `tsc --noEmit` clean. PR
  [#817](https://github.com/matthewgg22/Civica/pull/817), branch
  `fix/ak-allotment-tier-not-consumed`, **merged**.

- **#812 (AK's own FPL table, not the 48-contiguous one)** — `federal-tables.ts`'s
  `FederalTableSnapshot` carried a single `fpl_annual_first_person`/`fpl_annual_each_additional`
  pair documented as "48 contiguous states + DC," and `fplMonthly()` applied it to every
  state, including AK. HHS publishes separate, higher poverty guidelines for AK (and HI)
  every year in the same Federal Register notice — this was an eligibility-verdict bug (both
  the gross AND net income tests in `gates/income-tests.ts` screened AK households against
  the wrong, lower FPL), not just a benefit-amount bug like #814/#817's max-allotment gap.
  Replaced the flat fields with a `fpl_by_region: { contiguous, ak, hi }` axis
  (`RegionalFplTable`, each region carrying its own annual figures AND its own
  monthly-rounding convention); `fplMonthly(size, asOf, state)` now takes `state` and selects
  the region. `hi` is `null` (HI has no `StatePolicy` registered yet, out of scope here) with
  a `NoFplTableForRegionError` thrown if ever reached, not a silent copy of the contiguous
  figures.

  Sourced AK's real annual guideline directly from the Federal Register notices themselves
  (govinfo.gov, not a secondary aggregator): FY26 = $19,550 first person / $6,880 each
  additional (90 FR 5917, Jan 17 2025); FY25 = $18,810 / $6,730 (89 FR 2962, Jan 17 2024).
  Cross-checking those against AK's own published SNAP Standards table (already sourced in
  `packages/demeter-engine/src/states/ak/supplements.json`) surfaced a genuinely non-obvious
  finding: **Alaska's own table rounds the annual→monthly step UP (ceiling), not down —
  the opposite of the 48-contiguous/CDSS ACIN `floor()` convention this function already
  used.** Confirmed by reproducing AK's real published table exactly at 5 independent
  income-standard figures (100%/130%/165% columns, HH1 and HH4) — `floor()` at those same
  inputs would have missed every one of them by $1. AK's 200%-BBCE column ($3,260 HH1,
  $6,700 HH4) needed no special-casing at all: it's exactly the state's own rounded 100%
  monthly figure doubled, which is exactly what `gates/income-tests.ts` already does
  downstream (`fpl.mul(ratio)`).

  Independent-calculator verification against all 92 `expected_by_state.AK` entries in
  `data-ops/sample/civica-test-profiles/v0.6.json` (same #636/#804 methodology: recomputed
  AK's corrected gross/net thresholds from the sourced HHS figures, compared against each
  profile's raw income facts — not derived by running the engine and copying output) found
  **zero verdict flips** among those 92: every income-based DENY in the current AK oracle
  (D08 HH4 $7,500, D10 HH2 $5,000, M19 HH1 $5,600-after-sponsor-deeming) has gross income
  far above even the corrected, higher AK threshold, and the other 8 DENYs are unrelated
  (ABAWD/student/immigration/lottery/disqualification) — AK's real FPL is strictly higher
  than the 48-contiguous table at every household size, so a threshold increase can only
  flip DENY→APPROVE, never the reverse, matching the same directional proof #804/#815 used
  for AK's BBCE correction. One genuine flip WAS found, but not among the 92 direct
  `expected_by_state.AK` entries — a variant profile (`P56` "ongoing_anticipated", HH3
  gross $4,500) whose AK verdict fell back to a generic (non-AK-specific) stored `DENY`
  computed under the old, wrong 48-contiguous-derived $4,442 threshold; AK's real threshold
  is $5,552, so $4,500 now clears it. Added an explicit `AK: APPROVE` override + note to that
  variant, following the M23 pattern #804/#815 established.

  Threaded `state` through every `fplMonthly` call site (`gates/income-tests.ts`'s
  `grossIncomeTest` — already had `state`; `netIncomeTest` — added a new `state` param,
  updated its one caller in `verdict.ts`; `constants/index.ts`'s `getEngineParams` — already
  had `state`). Explicit byte-identical regression check (same technique #815/#817 used):
  1,428 (state × date × size) combinations across all 17 other registered states produced
  IDENTICAL output to the pre-fix formula, 0 mismatches. `/profile-simulation state=AK`:
  129/129 PASS, 0 FAIL, 0 SKIP. Every other state's harness run unchanged from its documented
  baseline (CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS all 129/0/0; PA 34/0/95 all-skip; NY
  127/2/0; AZ 128/1/0; MN 0/0/129 all-skip — all pre-existing, none newly introduced).
  `tsc --noEmit -p packages/snap-rules` clean, 286/286 snap-rules tests pass (7 new in a new
  `federal-tables.test.ts`), 44/47 profile-harness tests pass (3 pre-existing skips). Found
  one further, smaller residual discrepancy while reconciling AK's 130%/165% columns (the
  shared "round monthly FPL once, multiply by ratio downstream" architecture leaves AK's
  federal-130% non-BBCE gross test $1 below AK's own published figure — only reachable for
  AK determinations dated before its 7/1/2025 BBCE effective date, or a per-individual
  BBCE-exclusion category the engine doesn't model yet) — filed as
  [#818](https://github.com/matthewgg22/Civica/issues/818) rather than expanding this fix's
  scope. Did NOT touch #814/#817's `maxAllotmentFor`/
  `minimumBenefitFor`/`ak-allotment-zones.ts` work (separate, already in flight) and did NOT
  build any part of HI's `StatePolicy`, corpus registration, or oracle coverage (out of
  scope; only the table SHAPE is HI-ready). PR
  [#819](https://github.com/matthewgg22/Civica/pull/819), awaiting merge go-ahead.

- **NC (StatePolicy + full oracle authoring, first "individual tier" state, §6)** — North
  Carolina was a genuine blank slate: no `StatePolicy`, no oracle coverage at all, unlike
  every state above (which at minimum had a `StatePolicy` to correct). Every axis was
  TRANSLATED from the already-cited primary-source findings in the merged Demeter corpus
  pack (`packages/demeter-engine/src/states/nc/`, built and merged 2026-08-11) into the
  engine's stricter typed shape — re-verification against the corpus's own primary sources,
  not fresh research. `bbce: true` / `200%` / `federal_fiscal_year` (FNS 220.02(E) "Expanded
  (200%) Categorical Eligibility," conferred via a TANF-services notice printed on the
  application itself); `asset_waiver: true` (FNS 220.05 waives resource + gross + net income
  tests for cat-elig households, stronger than an asset-only waiver); `drug_felony_ban:
  "modified"` (FNS 270.01's DEFAULT is permanent disqualification, with a narrow Class-H/I
  in-state reinstatement path — NC's default-is-disqualification shape is meaningfully
  different from FL's/PA's/AZ's/WI's default-is-eligible modified bans, but "modified" is
  still the correct classification per #805's rule since the ban isn't unconditional);
  `abawd_waiver_avail: false` (N.C. Gen. Stat. § 108A-51.1, a statutory bar on NCDHHS ever
  seeking an ABAWD waiver, in continuous effect since 2015-10-01 — the longest-standing such
  prohibition in this file, and an affirmatively sourced `false`, not a fail-open default);
  `rmp_operated: false` (a genuine secondary-source correction — NC has no ongoing
  Restaurant Meals Program; third-party sites conflate it with an already-expired,
  restaurant-excluded 2024 Hurricane Helene hot-foods waiver); `allotment_tier: "48"`.

  `sua_by_tier` surfaced a NEW schema-mismatch shape this file hadn't seen before: not a
  missing utility TIER (AZ/OH/IL/MI/WI/NV's documented gaps) but a missing HOUSEHOLD-SIZE
  DIMENSION inside an existing tier — NC's real SUA/BUA table (FNS 340.09/360.01) scales
  continuously across 5 size bands ($637→$912 HCSUA, $392→$564 LUA), not just a 2-band split
  like AZ's. Encoded the household-size-1 ("base figure") values, the same "first person"
  convention every other size-scaled federal table in this codebase already uses, and
  disclosed the resulting under-statement for size-2+ households in a code comment —
  independently verified this changes only a small, disclosed subset of the 92 oracle
  profiles' benefit dollar amounts (most multi-person households' excess-shelter deduction
  is already clamped at the federal $744 shelter cap regardless of the exact SUA figure fed
  in, so the approximation is invisible for them).

  Oracle: built a fresh, independent Python calculator (not derived from engine output) from
  the same 7 CFR / federal-tables.ts citations documented in verdict.ts/benefit-calc.ts's own
  comments. Cross-validated 92/92 exact match against WI's already-graded oracle run under
  WI's own StatePolicy params before trusting it for NC — WI is NC's closest axis-twin in
  this file (identical bbce/200%/federal_fiscal_year, asset_waiver, drug_felony_ban
  "modified", abawd_waiver_avail false, allotment_tier "48"; only the SUA dollar figures and
  the underlying policy citations differ). Also checked all 37 rows across the 18
  non-`expected_by_state` variant profiles (facts_patch A/B pairs) for an NC-specific
  `verdict_by_state` override, the same discipline AK's M23/P56 overrides needed — found
  zero divergence from the shared default `verdict` for NC, so no override was authored.
  Authored all 92 `expected_by_state.NC` entries.

  Verification: `/profile-simulation state=NC` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK's bar, not PA's/MN's SKIP-heavy grade).
  Every other registered state's harness run reconfirmed unchanged from its documented
  baseline (CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK all 129/0/0; PA 34/0/95; NY 127/2/0;
  AZ 128/1/0; MN 0/0/129 all-skip). `tsc --noEmit -p packages/snap-rules` clean, 323/323
  snap-rules tests pass (0 new — a schema-conformant pure addition needed no new unit
  tests), 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  `packages/demeter-engine` (NC's corpus was already complete and out of scope) or any other
  state's `StatePolicy`/oracle coverage. PR
  [#822](https://github.com/matthewgg22/Civica/pull/822), **merged**.

- **NJ (individual tier, §6 step 3)** — built New Jersey's `StatePolicy` entry AND full
  92-profile oracle coverage from scratch (NJ had neither before this PR), translating
  NJ's already-merged Demeter corpus pack (`packages/demeter-engine/src/states/nj/`,
  PROVENANCE.md) into the engine's stricter typed shape per §5's process. bbce: true,
  bbce_threshold_pct: **185** (N.J.A.C. 10:87-2.36's Expanded Categorical Eligibility —
  notably lower than most other BBCE-200 states in this file), bbce_fpl_basis:
  federal_fiscal_year, asset_waiver: true (10:87-4.1(b)), allotment_tier: "48",
  drug_felony_ban: "none" (a VERIFIED full opt-out — N.J.A.C. 10:87-3.18's own History
  note confirms the drug-felony provision's 2012 repeal, corroborated by N.J.S.A.
  44:10-48(d)(1) via the Collateral Consequences Resource Center's national survey since
  Justia/FindLaw both 403'd the raw statute text), abawd_waiver_avail: true (NJ holds a
  real, time-bound waiver in Cape May County + Camden City through 1/31/2027 — chosen
  permissive under the same "wrongly denying food is the worse error" reasoning CA's/
  MI's/NV's/AZ's entries use), rmp_operated: false (confirmed absent from USDA's own RMP
  list; NJ has left an RMP bill to die in three separate legislative sessions).
  sua_by_tier: **null** — same disclosed-gap discipline as PA's and MN's null entries:
  the corpus pack could only secondarily corroborate ONE of the three required tiers
  (HCSUA $977, via a NJ Medicaid Communication referencing DFD's figures, not
  independently fetchable) and could not locate NJ's LUA or UTA/phone figures at all.

  Deliberately did NOT build a real per-county ABAWD lookup for NJ (unlike CA's/MA's
  `WAIVER_COUNTIES_BY_STATE` entries) despite the waiver geography being well-documented:
  Cape May County is a clean county-FIPS match but Camden City is a SUB-COUNTY
  MUNICIPALITY inside the much larger Camden County — the existing lookup is keyed by
  county-level FIPS only, which cannot represent "this one city, not the rest of its
  county," and a partial/wrong Set would have been actively worse than the honest
  fallback (would confidently DENY Camden City's real exemption for any household
  reporting Camden County's FIPS). Filed as
  [#825](https://github.com/matthewgg22/Civica/issues/825) rather than building an
  inaccurate lookup to close it quietly.

  Two genuinely novel corpus findings — NJ counts boats/motor homes as a resource at
  fair-market value (a real exception to the usual all-vehicle exclusion), and NJ treats
  legally-obligated child support as an income EXCLUSION rather than an ordinary
  deduction — have **no representable slot in the current schema at all** (a `Facts`-shape
  gap, not a per-state value): `Facts.assets` has no per-asset-type breakdown, and
  `benefit-calc.ts` implements only the ordinary-deduction child-support mechanism,
  engine-wide, with no per-state axis to switch it. Documented inline in NJ's entry
  (same "accepted limitation" treatment as NY's multi-tier BBCE and WI's multi-tier SUA
  gaps) and filed as
  [#824](https://github.com/matthewgg22/Civica/issues/824) rather than silently ignored
  or worked around. Zero of the 92 v0.6 profiles model a boat/motor-home resource
  (no practical effect); exactly one profile (A08) carries a nonzero
  `child_support_paid` ($300) — its NJ oracle entry uses the engine's standard
  ordinary-deduction mechanic since A08's verdict is unaffected either way and the
  corpus pack doesn't fully specify NJ's exclusion mechanics (whether it also changes
  the base the 20% earned-income deduction applies to).

  Independent calculator built fresh in Python from the CFR rules + the actual
  `packages/snap-rules` source read (not derived by running the engine and copying
  output), per #636. Cross-validated before trusting it for NJ: 92/92 exact match
  (verdict AND benefit) reproducing WI's already-graded oracle under WI's exact policy
  params, and 34/34 exact match reproducing PA's already-graded oracle (PA being NJ's
  true structural near-twin — same null-SUA architecture) under PA's params. All 92
  `expected_by_state.NJ` entries authored into `data-ops/sample/civica-test-profiles/
  v0.6.json`: 34 profiles (`sua_tier === "none"` or `homeless_deduction`) got a real
  computed benefit; the other 58 (blocked by the null-SUA gap, same as PA) got an
  independently-computed verdict only (benefit: null), proven SUA-invariant via a
  12-point $0–$1,500 sweep per profile (0 of 58 were genuinely indeterminate — same
  clean result PA and AK found). Two expected, explained state-axis-sensitive
  divergences from WI/PA: `M12-abawd-in-a-waived-area` (APPROVE for NJ, matching PA's
  `abawd_waiver_avail: true`, vs WI's DENY under `false`) and
  `MX4-bbce-max-income-with-any-benefit` (DENY for NJ under the 185% threshold — this
  profile is deliberately engineered to sit just under WI's/PA's 200%, and $4,440 clears
  185%'s $4,109 HH3 threshold by exactly $2 under). Verification:
  `/profile-simulation state=NJ` — 34 PASS / 0 FAIL / 95 SKIP (of 129), every SKIP
  attributable to the documented null-SUA gap, no PARAMS_MISMATCH — matching PA's exact
  shape. Confirmed zero regression: every other registered state's harness run unchanged
  from its documented baseline (CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS all 129/0/0; PA
  34/0/95; NY 127/2/0; AZ 128/1/0; MN 0/0/129 — all pre-existing, none newly introduced).
  `tsc --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests pass, 44/47
  profile-harness tests pass (3 pre-existing skips). PR
  [#826](https://github.com/matthewgg22/Civica/pull/826), awaiting merge go-ahead.

- **VA (individual tier, §6 step 3, third state after NC and NJ)** — built Virginia's
  `StatePolicy` entry AND full 92-profile oracle coverage from scratch (VA had neither
  before this PR), translating VA's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/va/`, PROVENANCE.md), built 2026-08-11, into the
  engine's stricter typed shape per §5's process. bbce: true, bbce_threshold_pct: 200,
  bbce_fpl_basis: federal_fiscal_year (VA SNAP Manual Part II.G.3) — a genuinely unusual
  structural finding for this roster: VA's 200% threshold AND its no-asset-limit rule are
  codified DIRECTLY IN STATUTE (Va. Code § 63.2-801(B)), not just agency policy/regulation
  the way every other BBCE state in this file sets it; asset_waiver: true (Part IX.B);
  drug_felony_ban: "none" — a VERIFIED FULL STATUTORY OPT-OUT (Va. Code § 63.2-505.2,
  amended 2020 cc. 221/361, corroborated by contemporaneous Virginia Mercury/VPM coverage);
  abawd_waiver_avail: false — VA holds ZERO ABAWD waivers anywhere in the Commonwealth as
  of this build, a genuine reversal from its own multi-year waiver history through mid-2025,
  independently corroborated by two sources (VA's own manual's Appendix I AND USDA's
  official FY2025-2029 waiver-response index); no county-level lookup was needed or added,
  since a real answer of "nowhere" has no county-level nuance for a lookup to represent, the
  same MA-empty-set reasoning already established in this file; rmp_operated: true — VRMP is
  statutorily MANDATORY statewide (Va. Code § 63.2-801(A)), confirmed on USDA's own RMP
  state list — a direct contrast with this file's NJ entry, where a similarly-worded bill
  has died in committee three separate sessions; allotment_tier: "48" (VA's own Standard
  Deduction/shelter cap/homeless allowance figures match federal-tables.ts's FY26 snapshot
  exactly, the same "shared source" signal NC's entry used).

  sua_by_tier surfaced a NEW kind of schema-mismatch gap this file hadn't seen: not a state
  publishing a real standard the engine's schema merely has no SLOT for (IL/OH/NV/MI/WI's
  documented gaps), but a state whose own policy has literally no LUA-equivalent standard at
  all — VA's utility standard bundles heat/cooling/electric/water/phone into ONE tier
  ($375 for 1-3 persons / $476 for 4+, size-scaled like NC but only two bands and, distinctly,
  only two tiers total), and a household without a heating/cooling expense uses ACTUAL costs
  in real VA practice rather than a second published standard — a mechanism this engine's
  `Facts` shape doesn't carry, the same category of accepted limitation as NJ's boat/
  motor-home and child-support-exclusion gaps (#824). HCSUA encodes VA's 1-3-person band
  ($375, AZ-style 2-band precedent — this schema has no household-size dimension); phone
  maps VA's flat $54 standard cleanly; LUA is set to $0 (never fabricated) rather than
  guessed, disclosed at length inline — independently verified this affects exactly 2 of the
  92 oracle profiles' benefit-dollar amount (A02, A09; both LUA-tier in the base fixture),
  never their verdict. Also disclosed: 6 of 92 profiles are 4+-person households on the
  HCSUA tier, where the 1-3-band approximation under-states VA's real $476 figure by
  $101/month — independently verified none of their verdicts flip either.

  Oracle: built a fresh, independent Python calculator (not derived from engine output) from
  the same CFR / federal-tables.ts citations documented in verdict.ts/benefit-calc.ts.
  Cross-validated 92/92 exact match (verdict AND benefit) against NC's already-graded oracle
  run under NC's own StatePolicy params before trusting it for VA — NC is VA's closest
  structural axis-twin in this file (both 200%/federal_fiscal_year BBCE, both asset_waiver
  true, both a real non-null sua_by_tier, both abawd_waiver_avail false), a materially
  stronger cross-validation than NJ's null-SUA-blocked entry would allow since VA needed the
  full benefit-calc pathway exercised, not just verdict-level agreement. Also checked all 37
  rows across the 18 non-`expected_by_state` variant profiles (facts_patch A/B pairs) for a
  VA-specific `verdict_by_state` override, the same discipline NC's/AK's builds used — found
  zero divergence from the shared default verdict for VA, so no override was authored.
  Authored all 92 `expected_by_state.VA` entries: 80 APPROVE / 12 DENY, with the DENY set
  IDENTICAL to NC's (both share bbce/asset_waiver/abawd_waiver_avail exactly, so no
  financial-gate divergence exists between them). 12 of the 92 APPROVE profiles carry a
  lower benefit dollar figure than NC's/WI's equivalent entries, purely a function of VA's
  lower HCSUA — no verdict ever flips as a result of any SUA-dollar difference, since every
  BBCE state in this file skips the net income test once the raised gross threshold clears,
  so the SUA value only ever changes the benefit AMOUNT, never eligibility.

  Verification: `/profile-simulation state=VA` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC's bar, not PA's/NJ's/MN's SKIP-heavy
  shape). Every other registered state's harness run reconfirmed unchanged from its
  documented baseline (CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC all 129/0/0; NY 127/2/0;
  AZ 128/1/0; MN 0/0/129; PA 34/0/95; NJ 34/0/95 — all pre-existing, none newly introduced).
  `tsc --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests pass (0 new — a
  schema-conformant pure addition needed no new unit tests), 44/47 profile-harness tests
  pass (3 pre-existing skips). Did not touch `packages/demeter-engine` (VA's corpus was
  already complete and out of scope) or any other state's `StatePolicy`/oracle coverage. PR
  [#829](https://github.com/matthewgg22/Civica/pull/829), awaiting merge go-ahead.
