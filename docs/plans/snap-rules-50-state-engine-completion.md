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
states.ts`) exists for **44 states**: CA, WA, TX, NY, GA, MI, IL, FL, MA, NV, AZ, OR, WI,
MN, OH, KS, PA, AK, NC, NJ, VA, TN, IN, MO, MD, CO, SC, LA, OK, ME, RI, MT, AL, KY, CT, UT,
IA, AR, ID, WV, NH, MS, NM, NE. The individual tier (§6 step 3) is CLOSED at 13/13;
CT/UT/IA/AR (first batch-tier segment), MS/NM/NE (second batch-tier segment), and
ID/WV/NH (third batch-tier segment) are all now DONE, built and merged as one batch each
per the execution log's entries below.

The oracle fixture (`data-ops/sample/civica-test-profiles/v0.6.json`, `expected_by_state`)
— the independently-computed ground truth every `/profile-simulation` run grades the
engine against — has full 92-case coverage (minus TN's 3 deliberately-unauthored
genuinely-indeterminate profiles, see below) for **35 of those 44**: CA, WA, TX, GA, MI,
IL, FL, MA, NV, OR, WI, KS, OH, AK, NC, VA, IN, MO, MD, CO, SC, LA, OK, ME, RI, MT, KY,
IA, AR, NH, NM, NE clear CLEAN (129/0/0); NY (127/2/0), AZ (128/1/0), and CT (128/1/0) are
documented pre-existing partials in the same "clean" bucket — CT's single disclosed fail
is the SAME #830 architecture-gap shape as NY's/AZ's, not a coverage gap. PA, NJ, TN, AL,
UT, ID, WV, and MS also have all 92 (or 89, for TN) rows authored, per the execution log's
entries below, but all eight grade 34/0/95 — most of their profiles legitimately SKIP on
the null-SUA gap, not a coverage gap, so none is counted as "clean" here. (AL's own oracle
achieves genuine FULL 92/92 coverage — unlike TN's 89/92 — but the SKIP-heavy grade is
unavoidable given AL's own null SUA; see AL's execution-log entry for why full authored
coverage and a clean harness grade are different things. MS was the FIRST non-BBCE state
to carry this null-SUA shape — PA/NJ/TN/AL/UT are all BBCE states; ID and WV followed.)

One state has a `StatePolicy` but no oracle coverage at all:

| State | Has `StatePolicy` | Has oracle coverage | Why not |
|---|---|---|---|
| **MN** | yes | no | **Structurally blocked**, not just unauthored — `sua_by_tier: null`; the engine can't compute a shelter-deduction-dependent benefit for MN until a real SUA figure lands (per [[project_snap_rules_oracle_authoring]]) |

(PA's oracle-authoring pass, listed as outstanding earlier in this plan's drafting, has
since landed — see the execution log's PA entry — so PA is no longer in this table.)

One state's `StatePolicy` is present, oracle-covered, and **looks wrong**:

- **AK** — `bbce: false` in the engine, but AK's own corpus pack (batch 5, built this
  session, primary-sourced) confirms AK adopted 200% FPL BBCE effective **7/1/2025**. The
  engine entry predates the whole corpus expansion (an early "Wave B" commit) and the
  file's own header comment already flags AK — alongside TX and KS — as a **"policy
  archetype... illustrative until the FNS-published values are loaded,"** not a verified
  entry. This is a real, pre-disclosed gap, not a surprise regression — but it's live in
  the engine today and, if used for a real determination, would wrongly deny categorical
  eligibility to AK households between 130%–200% FPL.

**9 states have neither** `StatePolicy` nor oracle coverage — the full remaining scope:
DC, DE, GU, HI, ND,
SD, VI, VT, WY. (NC, NJ, VA, TN, IN, MO, MD, CO, SC, LA, OK, AL, and KY — all thirteen
"individual tier" states, §6 — are DONE; see the execution log's
NC/NJ/VA/TN/IN/MO/MD/CO/SC/LA/OK/AL/KY entries. **The individual tier is CLOSED at
13/13.** ME, RI, MT (fourth batch-tier group), CT, UT, IA, AR (first batch-tier group),
MS, NM, NE (second batch-tier group), and ID, WV, NH (third batch-tier group) are all
DONE (execution log's entries below) — that's all three remaining planned batch-tier
segments through the third group. DE/SD/ND, VT/WY/DC, and VI remain unstarted.)

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
3. Individual tier (~4M+ population): ~~NC~~ (done), ~~NJ~~ (done), ~~VA~~ (done),
   ~~TN~~ (done), ~~IN~~ (done), ~~MO~~ (done), ~~MD~~ (done), ~~CO~~ (done), ~~SC~~ (done),
   ~~LA~~ (done), ~~OK~~ (done — 13th and FINAL individual-tier state), ~~AL~~ (done —
   rebased against SC/LA/OK, see AL's execution-log entry), ~~KY~~ (done — rebased against
   SC/LA/OK/ME/RI/MT then again against AL, see KY's execution-log entry). **The individual
   tier is CLOSED at 13/13.**
4. Schema step: extend `AllotmentTier` for HI/GU (own small PR, own go-ahead) — VI's own
   batch-tier build also confirmed it needs this exact extension (#858), so this step now
   unblocks HI/GU/VI together, not just HI/GU.
5. HI, GU, VI (now unblocked, pending step 4)
6. Batch tier (<4M population, N≤3 per batch): ~~CT, UT, IA, AR~~ (done — first batch-tier
   segment, see the execution log's CT/UT/IA/AR entries below) / ~~MS, NM, NE~~ (done —
   second batch-tier segment, see the execution log's MS/NM/NE entries below) /
   ~~ID, WV, NH~~ (done — third batch-tier segment, see the execution log's ID/WV/NH
   entries below) / ~~ME, RI, MT~~ (done — fourth batch-tier group, see the execution
   log's ME/RI/MT entries) / DE, SD, ND / VT, WY, DC / VI (built, PR #859 open, filed
   #858 — none of DE/SD/ND, VT/WY/DC, or VI is merged yet; all were concurrently in
   flight as of this build, not read or coordinated with).
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

- **TN (individual tier, §6 step 3, fourth state after NC/NJ/VA)** — built Tennessee's
  `StatePolicy` entry AND full 92-profile oracle coverage from scratch (TN had neither
  before this PR), translating TN's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/tn/`, PROVENANCE.md + supplements.json +
  authorities.json), built 2026-08-11, into the engine's stricter typed shape per §5's
  process. bbce: true, bbce_threshold_pct: 200 (TN Rule 1240-01-14-.15(2), "Expanded
  Categorical Eligibility," amended 1/15/2026, EFFECTIVE 4/15/2026 — under 4 months old at
  this build; several calculator sites still quote TN's OLD 130% ceiling, a live disclosed
  secondary-source staleness risk), bbce_fpl_basis: federal_fiscal_year (an honest
  inference — TN's rule text states no explicit FFY-vs-calendar framing, unlike AK's/NC's/
  VA's — following this file's established default absent contrary evidence), asset_waiver:
  true (TDHS Policy 24.12), allotment_tier: "48", drug_felony_ban: "modified" (Tenn. Code
  Ann. § 71-5-308, permanent ban for Class A felony drug convictions only, conditional
  eligibility for others — corroborated via two independent secondary legal-research
  sources after BOTH primary statute-text hosts, law.justia.com and casetext.com, returned
  HTTP 403 on every attempt, a genuine disclosed access barrier unlike any other axis in
  this entry), abawd_waiver_avail: false (an affirmatively sourced, currently-zero finding
  — USDA's official FY2025-2029 waiver index confirms TN submitted no waiver request for
  FY2025 or FY2026, corroborated by TDHS's own ABAWD page), rmp_operated: false (confirmed
  absent from USDA's own RMP state list, no TN RMP bill ever found introduced).

  TENNESSEE UNIQUELY RUNS TWO PARALLEL, INDEPENDENTLY-DATED CITATION FAMILIES the corpus
  pack found genuinely out of sync in BOTH directions — codified "TN Rule" 1240-01 vs
  TDHS's own operational "TDHS Policy" 24.xx series (the rule is ahead of the policy on
  BBCE; both are behind current federal law on the ABAWD 18-64 age range; the rule is
  behind the policy on TN's 6-month default certification period, the shortest default this
  roster has documented, informational only — no engine axis exists for certification
  period). Every axis above states explicitly which family it draws from and, where they
  conflict, which one is operative and why — matching the corpus pack's own navigation of
  the conflict rather than silently picking a winner.

  sua_by_tier: **null** — same disclosed-gap discipline as PA's/NJ's/MN's null entries.
  TDHS Policy 24.12 and Policy 24.18 both explicitly defer dollar figures to a non-public
  "Family Assistance Standards Desk Guide"; the only publicly fetchable table (codified TN
  Rule 1240-01-04-.27) carries strong internal evidence of being stale by a decade-plus
  (its own Standard Deduction and 1-person Maximum Coupon Allotment figures don't match any
  recent FY's COLA-adjusted figures, cross-checked against VA's current FFY2026 figures in
  this same file).

  ***GENUINE STRUCTURAL FINDING, filed as
  [#830](https://github.com/matthewgg22/Civica/issues/830) rather than silently encoded or
  guessed around:*** TN's Expanded CE requires BOTH gross ≤200% FPL AND net ≤100% FPL — a
  net-income ceiling on top of the BBCE gross screen that no other BBCE state in this file
  has been found to carry. `StatePolicy` has no axis for this, and `verdict.ts`'s
  `bbceConferred` logic unconditionally skips BOTH remaining income tests for every BBCE
  state alike once the gross threshold clears — a genuine ENGINE architecture gap, not a
  per-state value this entry's schema can express. Independently verified impact (Python
  calculator, #636 methodology, built by porting `verdict.ts`/`benefit-calc.ts`/every
  `gates/*.ts` faithfully, then cross-validated to an EXACT match — verdict AND benefit,
  zero mismatches, zero indeterminate cases — against both PA's and NJ's already-merged,
  already-graded oracles before trusting it for TN): of the 34 profiles the engine can
  actually compute for TN today (the other 58 SKIP on the null-SUA gap above, before ever
  reaching the income tests), this architecture gap has ZERO practical effect — TN's true
  policy (net test enforced) and the engine's actual behavior (net test skipped once
  BBCE-conferred) compute byte-identical results for all 34. The gap DOES surface once
  compounded with the null-SUA gap: 3 of the 92 base profiles
  (`D01-single-adult-over-gross-limit`, `M01-gross-at-165-fpl-bbce-flip`,
  `P59-single-adult-at-hh1-bbce-boundary`) clear TN's 200% gross screen at every plausible
  SUA value in a $0–$1,500 sweep, but the net test's pass/fail genuinely flips depending on
  the (currently unconfirmed) real TN SUA figure — left **deliberately unauthored** (no
  `TN` key in `expected_by_state`) rather than fabricating either a plausible SUA dollar
  figure or a verdict with no defensible basis. Two further indeterminate cases surfaced
  among the 18 non-`expected_by_state` variant profiles
  (`M23-variable-gig-income-anticipation`'s two variants) plus one pre-existing-but-
  previously-invisible case (`P58-elderly-retiree-tips-over-net-limit`'s `above_net_limit`
  variant, already silently indeterminate in PA's and NJ's merged oracles too, since P58's
  SUA tier is non-"none" for every null-SUA state — TN is simply the first build to
  surface a *base* profile hitting the same pattern) — no `verdict_by_state.TN` override
  was added for any of the three, following the exact precedent PA's and NJ's already-
  merged P58 entries already established (no override, silently falls back to the shared
  default `verdict`, harmless since the row SKIPs regardless).

  One profile, `MX4-bbce-max-income-with-any-benefit`, is a clean real-world demonstration
  of the stakes: TN denies it (HH3, $4,440 gross clears TN's $4,442 200%-FPL gross
  threshold by $2, but net income after the full deduction stack exceeds TN's 100% FPL net
  ceiling at every plausible SUA value in the sweep) where every other 200%-BBCE state in
  this file with either a real or null SUA and no net ceiling (VA, NC, PA) approves it —
  the same profile DENYs for NJ too, but for an unrelated reason (NJ's 185% gross threshold,
  not a net test). TN's resulting DENY set is otherwise IDENTICAL to VA's and NC's across
  all 89 authored profiles (both share bbce/asset_waiver/abawd_waiver_avail exactly), with
  MX4 the sole addition — a precise, well-evidenced illustration of the one real axis where
  TN's policy diverges from its closest structural twins in this file.

  Also verified: `M12-abawd-in-a-waived-area` DENYs for TN (matching NC's and VA's DENY,
  diverging from PA's and NJ's APPROVE) — the sole cause is `abawd_waiver_avail: false`
  (TN holds no ABAWD waiver anywhere, unlike PA/NJ), independently confirmed
  SUA-sweep-invariant.

  SCHEMA GAP already documented for NJ (#824), NOT re-filed: TDHS Policy 24.12 names
  boats/vacation homes/mobile homes as countable non-liquid resource equity, a departure
  from VA's/NC's blanket vehicle exclusion — the same pre-existing `Facts.assets`
  flat-number gap NJ's entry already discloses. Zero of the 92 profiles model this resource
  type; no practical effect today.

  Oracle: built a fresh, independent Python calculator (not derived from engine output) by
  porting `verdict.ts`/`benefit-calc.ts`/every `gates/*.ts` file directly, FY26 constants
  from `federal-tables.ts`. Cross-validated before trusting it for TN: exact match (verdict
  AND benefit for the 34/92 computable profiles; verdict-only, SUA-sweep-invariance-proven,
  for the 58/92 null-SUA-blocked profiles, INCLUDING zero indeterminate cases) against both
  PA's and NJ's already-merged, already-graded oracles under their own StatePolicy params —
  PA being TN's closest structural axis-twin (same 200% BBCE, same asset_waiver, same
  "modified" drug ban), NJ a second independent cross-check (185% BBCE, "none" drug ban,
  different abawd_waiver_avail) — before applying the TN-specific net-test patch (#830) as
  an isolated, well-understood additive change. Authored 89 of 92 `expected_by_state.TN`
  entries (76 APPROVE / 13 DENY), 3 deliberately unauthored per the indeterminacy finding
  above. Also checked all 37 rows across the 18 non-`expected_by_state` variant profiles for
  a TN-specific `verdict_by_state` override — found zero divergence from the shared default
  `verdict` among the 34 determinate rows (the remaining 3 are the indeterminate cases noted
  above), so no override was authored.

  Verification: `/profile-simulation state=TN` — 34 PASS / 0 FAIL / 95 SKIP (of 129), every
  SKIP attributable to either the documented null-SUA gap (92) or the 3 deliberately
  unauthored `no-expectation-for-state` rows — matching PA's and NJ's exact shape, not
  PA-before-this-file's/NC's/VA's clean 129/0/0 bar (structurally impossible for a
  null-SUA state). Confirmed zero regression: every other registered state's harness run
  unchanged from its documented baseline (CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA
  all 129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA 34/0/95; NJ 34/0/95 — all
  pre-existing, none newly introduced). `tsc --noEmit -p packages/snap-rules` clean,
  323/323 snap-rules tests pass (0 new), 44/47 profile-harness tests pass (3 pre-existing
  skips). Did not touch `packages/demeter-engine` (TN's corpus was already complete and out
  of scope) or any other state's `StatePolicy`/oracle coverage. Filed
  [#830](https://github.com/matthewgg22/Civica/issues/830) for the BBCE net-income-ceiling
  architecture gap rather than guessing around it. PR
  [#831](https://github.com/matthewgg22/Civica/pull/831), **merged**.

- **IN (individual tier, §6 step 3, fifth state after NC/NJ/VA/TN)** — built Indiana's `StatePolicy` entry AND full
  92-profile oracle coverage from scratch (IN had neither before this PR), translating
  Indiana's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/in/`, PROVENANCE.md + supplements.json), built
  2026-08-11, into the engine's stricter typed shape per §5's process.

  `bbce: false` — Indiana's own flagship corpus finding, and a genuine MINORITY position in
  this roster (most already-built states have adopted some form of BBCE): IN PPM 3010.05.00
  states the plain 130%/100% FPL federal test directly, independently cross-checked against
  IN PPM 2414.10.05's narrow Basic-CE-only (SSI/TANF) categorical-eligibility definition —
  no expanded/broad-based pathway anywhere in Chapter 2400 or 3000. This CONFIRMS (does not
  correct) a claim several SNAP-calculator sites already make about Indiana. Because bbce is
  false, `bbce_threshold_pct` is omitted and `bbce_fpl_basis` is null — the same shape this
  file's KS entry established for a non-BBCE state. `asset_waiver: false` — the narrow
  SSI/TANF-only minority is exempt via ordinary federal cat-elig, but the general-case NPA
  household faces the plain federal $3,000/$4,500 resource limit (IN PPM 3005.05.00), same
  posture as KS. `drug_felony_ban: "modified"` — Ind. Code Ann. § 12-14-30-3, a genuine
  opt-out from the federal LIFETIME ban (eff. 1/1/2020) conditioned on completion of or
  current compliance with probation/parole/community-corrections/reentry-court supervision;
  Indiana's own statute-lookup site (iga.in.gov) is an unexecutable client-side JS SPA and
  two third-party mirrors both failed outright (justia 403, casetext 410) — this finding
  rests on three convergent secondary sources (IN's own FSSA FAQ, the Public Health Law
  Center, the Network for Public Health Law's 50-state survey), disclosed as a genuine access
  barrier rather than smoothed over, same discipline as this file's PA entry.
  `abawd_waiver_avail: false` — an AFFIRMATIVELY SOURCED zero finding (IN PPM 2438.17.05:
  "there are currently no such designations"), cross-checked against USDA's official waiver
  index and the independent abawdmap.us aggregator; no per-county lookup needed since the
  real answer is a genuine statewide zero, same shape as MA/NC/VA's `false` entries.
  `rmp_operated: false` — Indiana absent from USDA's current RMP state list, no pending IN
  RMP bill found. `allotment_tier: "48"` — IN's Standard Deduction/shelter cap/homeless
  allowance figures reproduce federal-tables.ts's FY26 snapshot exactly, the same
  "shared-source signal" NC's/VA's entries use.

  `sua_by_tier` — FULLY POPULATED, not null, a genuine contrast with this file's PA/NJ/MN
  null entries: IN PPM 3020.00.00's four flat-dollar tiers are current (dated 10/01/2025),
  cross-checked two ways (the manual's own prior-period COLA-step column, AND an exact match
  against VA's already-independently-confirmed FFY2026 Standard Deduction figures). HCSUA
  ($486), LUA ($283), and phone ($36) map cleanly onto IN's SUA-1/SUA-2/SUA-4 tiers; IN's
  SUA-3 ("single utility," $62, exactly one non-heating/non-telephone utility) has no slot in
  this schema — same documented gap as IL's/OH's/NV's/AZ's single-utility cases, falling
  through to NONE ($0).

  Not representable in this schema, and not silently dropped: Indiana's vehicle-resource rule
  is a genuine HYBRID this roster hadn't seen combined before — a blanket exclusion for
  ordinary transportation vehicles (IN PPM 2615.60.10, matching NC's/VA's pattern) but boats/
  campers/trailers counted at equity value (IN PPM 2615.60.25, matching TN's pattern). This is
  the SAME pre-existing gap already filed as #824 (`Facts.assets` has no per-asset-type
  breakdown; no `StatePolicy` axis for vehicle treatment) — not re-filed, just newly confirmed
  present for Indiana; zero of the 92 oracle profiles model a boat/camper resource, so no
  practical effect today. (Informational only, no engine axis: IN's Elderly Simplified
  Application Project offers a 36-month certification period — the longest such period this
  roster has documented; this engine does not model certification-period length for any
  state.)

  Oracle: KS is Indiana's closest axis-twin among registered states — identical `bbce: false`,
  `bbce_threshold_pct: undefined`, `bbce_fpl_basis: null`, `asset_waiver: false`,
  `drug_felony_ban: "modified"`, `abawd_waiver_avail: false`, `allotment_tier: "48"`, and
  `rmp_operated: false` (differing only in SUA dollar figures and label). Built a fresh,
  independent Python calculator (not derived from engine output) from the same CFR / federal-
  tables.ts citations documented in verdict.ts/benefit-calc.ts. Cross-validated 92/92 exact
  match (verdict AND benefit) reproducing KS's already-graded `expected_by_state.KS` oracle
  under KS's own policy params, PLUS all 37 non-`expected_by_state` variant rows (same #636
  discipline NC's/VA's builds used — 0 mismatches against KS's already-graded
  `verdict_by_state` overrides), before trusting the calculator for Indiana. Authored all 92
  `expected_by_state.IN` entries: verdicts came back IDENTICAL to KS's on all 92 profiles (0
  divergence — expected, since every verdict-controlling axis is identical between the two
  states; only benefit-dollar figures differ, driven by the SUA value differences). Of the 37
  variant rows, exactly 2 (`M23-variable-gig-income-anticipation`'s "averaged" and
  "recent_high_month" variants) needed an IN-specific `verdict_by_state` override — DENY,
  matching KS's own value exactly, since both are non-BBCE federal-130%-gross-test states
  where several BBCE states above 130% approve; every other variant row uses the shared
  default `verdict`, zero further divergence found.

  Verification: `/profile-simulation state=IN` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA's bar, not PA's/NJ's/MN's
  SKIP-heavy shape). Every other registered state's harness run reconfirmed unchanged from
  its documented baseline (CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA all 129/0/0; NY
  127/2/0; AZ 128/1/0; MN 0/0/129; PA 34/0/95; NJ 34/0/95 — all pre-existing, none newly
  introduced). `tsc --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests pass (0
  new — a schema-conformant pure addition needed no new unit tests), 44/47 profile-harness
  tests pass (3 pre-existing skips). Did not touch `packages/demeter-engine` (IN's corpus was
  already complete and out of scope), TN, or any other state's
  `StatePolicy`/oracle coverage. PR
  [#833](https://github.com/matthewgg22/Civica/pull/833), **merged**.

- **MO (individual tier, §6 step 3, sixth state after NC/NJ/VA/TN/IN — TN's PR #831 and
  IN's PR #833 were both open and CI-green but not yet merged as of this build; not
  coordinated with, per the task's own instruction that a human reconciles the eventual
  rebase — this entry now sits after both in the log to reflect the actual merge order once
  reconciled)** — built Missouri's
  `StatePolicy` entry AND full 92-profile oracle coverage from scratch (MO had neither
  before this PR), translating MO's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/mo/`, PROVENANCE.md + supplements.json, built
  2026-08-11) into the engine's stricter typed shape per §5's process.

  `bbce: false` — THIS PACK'S FLAGSHIP FINDING, a genuine secondary-source CORRECTION
  (several calculator sites wrongly claim MO runs 200% FPL BBCE): MO's own current
  income-limit table (MO IM Manual 1115.099.00, cross-checked against the DSS SNAP Program
  Changes Flyer dated 10/2025) publishes only the plain federal 130%/100% FPL columns, no
  BBCE tier anywhere — MO's own analog to this file's KS/IN no-BBCE archetype, but sharper
  because it disproves an actively wrong numbered claim rather than merely confirming an
  accurate absence. `asset_waiver: false` — a genuine THIRD categorical-eligibility
  structural pattern this file had not yet documented: MO IM Manual 1135.035.00 extends CE
  to households receiving specific TANF-funded "special support services" (Child Care
  assistance, Community Partnerships), broader than Basic-CE-only (IN's pattern) but
  SERVICES-CONDITIONED rather than a blanket income-ceiling raise (BBCE's mechanism) —
  this schema has no slot for that distinct axis, so `asset_waiver: false` correctly
  describes the general (non-cat-elig) population, documented at length inline rather than
  silently assumed. `drug_felony_ban: "modified"` — MO's own statute (RSMo § 208.247) was
  fetched directly and in full from revisor.mo.gov with NO access barrier (a genuine plus
  over IN's equivalent, which needed secondary corroboration); the modified-ban condition
  is genuinely STRICTER than IN's — requiring participant-PAID voluntary urinalysis testing
  in addition to treatment-compliance and no-additional-conviction conditions IN's own ban
  does not require. `abawd_waiver_avail: false` — affirmatively sourced from three
  convergent sources (USDA's waiver index, the abawdmap.us aggregator, MO's own 3.7%
  unemployment rate) despite MO's own manual being silent on waiver status (a slightly
  weaker evidentiary posture than VA's affirmative "No exempt areas" text, still preferred
  over guessing). `rmp_operated: false` — confirmed absent from USDA's RMP list, with the
  same repeated-dead-legislative-bill pattern (four sessions, 2022-2025) this file's NJ
  entry documents. `allotment_tier: "48"`.

  `sua_by_tier` — POPULATED with disclosed confidence rather than set to `null`: MO's own
  manual (1115.035.25.15) publishes SUA $495 / NHCS $363 / LUA $158 / telephone $79, dated
  to IM-50 (Sept 2024, FFY2025) with no confirmed FFY2026 update located despite a targeted
  search — a "sourced but possibly one FY stale" figure, not PA's/NJ's/MN's "no figure
  exists at all" gap, so populated with the staleness risk disclosed inline (same
  discipline as MA's already-PENDING-VERIFICATION entry) rather than blocking benefit
  computation. Also surfaced a genuine NAMING-COLLISION mapping trap: MO's own manual calls
  its $158 (exactly-one-utility) tier "LUA," but this schema's `LUA` slot instead maps to
  MO's differently-named $363 NHCS (2+-utilities) tier — mirroring OH's exact precedent in
  this file (OH's own "LUA" = 2+ utilities, mapped; OH's separately-named "Single SUA" =
  one utility, unmapped) rather than MO's literal label, since the schema's `LUA` field
  functionally represents whichever tier `determineSUATier`'s single LIMITED branch
  (`has_electric_or_gas === "yes"`, no distinction of utility COUNT) actually reaches. MO's
  own $158 one-utility tier is the disclosed, unmapped 4th tier, same treatment as OH's
  $108 Single SUA and IL's $78 Single Utility.

  Two already-known, already-filed gaps recur for MO and were NOT re-filed, per the task's
  own instruction: the blanket "exclude the value of all vehicles" resource rule (broader
  than any prior state in this file, including IN's hybrid rule) has no `Facts.assets`
  slot (#824's shape); MO's child-support EXCLUSION mechanism (MO IM Manual 1115.035.20,
  applied even to the gross 130% FPL test itself, matching this file's VA/NJ/IL pattern)
  is not modeled by `benefit-calc.ts`'s engine-wide ordinary-deduction-only mechanism
  (also #824) — exactly one of the 92 profiles (A08, $300 child support) is affected, its
  MO entry uses the engine's standard mechanic since A08's verdict is unaffected either
  way, the same acceptance NJ's A08 entry already documents. The resource-limit dollar
  figure itself ($3,000/$4,500) rests on secondary corroboration only (MO IM Manual
  1110.005.00 returned a password wall, sibling Vehicles subsection did not) but is
  immaterial to the engine regardless — the figure is the plain federal standard read from
  `federal-tables.ts`, not a per-state `StatePolicy` field, and MO's secondary-sourced
  figure matches it exactly.

  Oracle: built a fresh, independent Python calculator (not derived from engine output,
  per #636) directly from `verdict.ts`/`benefit-calc.ts`/`income-tests.ts`/`asset-test.ts`/
  `abawd.ts`/`disqualifications.ts`/`student.ts`/`composition.ts`/`immigration.ts`/
  `facts.ts`/`federal-tables.ts`'s own read source (not just their doc-comments), mirroring
  every gate and the benefit-calc formula exactly, including the half-up rounding
  (`roundDollar`) and floor rounding (`floorDollar`) conventions from `decimal.ts`.
  Cross-validated BEFORE trusting it for MO, in two directions since MO (unlike NJ/PA) has
  a real, non-null SUA needing full benefit-calc exercise: (1) 92/92 exact match (verdict
  AND benefit) reproducing VA's already-graded oracle under VA's own StatePolicy params —
  VA is MO's structural benefit-calc twin in this file (both need the full shelter/SUA/
  benefit pathway exercised, unlike NJ's/PA's null-SUA-blocked entries); (2) 92/92 verdict
  match (KS ships no real benefit figures, so verdict-only) reproducing KS's already-graded
  oracle under KS's own StatePolicy params — KS is MO's structural GATING twin (both
  non-BBCE, both `asset_waiver: false`, both facing the plain federal 130%/100% test).
  Independently confirmed KS and MO's own computed verdicts are IDENTICAL across all 92
  profiles under their respective real policy params (differing only in benefit dollar
  amount, since MO's own SUA figures are higher than KS's) — a strong internal-consistency
  signal beyond the two cross-validations themselves. Also checked all 37 rows across the
  18 non-`expected_by_state` variant profiles (facts_patch A/B pairs) for an MO-specific
  `verdict_by_state` override, the same discipline NC's/VA's builds used — found ONE real
  divergence (unlike NC's/VA's zero): `M23-variable-gig-income-anticipation`'s two variants
  ($1,800 and $2,200 gross HH1) both clear every BBCE-200/185/165 state's threshold but
  fail MO's plain federal 130% screen ($1,696/97) — the same direction KS/OH/GA already
  fail for the identical reason; authored `"MO": "DENY"` into both variants'
  `verdict_by_state` blocks, matching KS's already-authored value exactly (an independent
  confirmation the divergence is real, not a calculator bug). Authored all 92
  `expected_by_state.MO` entries: 70 APPROVE / 22 DENY.

  Verification: `/profile-simulation state=MO` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA's bar, not PA's/NJ's/MN's
  SKIP-heavy shape — MO's real, disclosed-confidence SUA figures mean it did not need
  PA's/NJ's null-SUA fallback). Every other registered state's harness run reconfirmed
  unchanged from its documented baseline, all 21 pre-existing states checked individually
  (not just spot-checked): CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA all 129/0/0; AZ
  128/1/0; MN 0/0/129; PA 34/0/95; NJ 34/0/95 — every one identical to its pre-MO
  documented baseline, zero regressions. `tsc --noEmit -p packages/snap-rules` clean,
  323/323 snap-rules tests pass (0 new — a schema-conformant pure addition needed no new
  unit tests), 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  `packages/demeter-engine` (MO's corpus was already complete and out of scope) or any
  other state's `StatePolicy`/oracle coverage, including TN's or IN's in-flight PRs. PR
  [#835](https://github.com/matthewgg22/Civica/pull/835), awaiting merge go-ahead.

- **MD (individual tier, §6 step 3, seventh state after NC/NJ/VA/TN/IN/MO)** — built
  Maryland's `StatePolicy` entry AND full 92-profile oracle coverage from scratch (MD had
  neither before this PR), translating MD's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/md/`, PROVENANCE.md + supplements.json +
  freshness.json, built 2026-08-11) into the engine's stricter typed shape per §5's
  process.

  `bbce: true` / `bbce_threshold_pct: 200` / `bbce_fpl_basis: federal_fiscal_year` —
  CONFIRMED, not corrected: unlike this file's own MO entry (which DISPROVED a wrong
  secondary-source BBCE claim), this pack independently checked the same kind of
  widely-repeated claim against Maryland's own primary source (MD SNAP Manual Section
  115.2(F)) and found it accurate, cross-validated against the October 2025 DHS Income
  Guidelines and FIA Action Transmittal AT 26-05. `asset_waiver: true` follows directly —
  Maryland's own manual instructs caseworkers that the resource test is, in practice,
  never actually applied to a BBCE-covered household ("you should not have any
  non-categorically eligible SNAP households," stated in three separate sections).
  `allotment_tier: "48"` — MD's own Standard Deduction ($209/$209/$209/$223/$261/$299),
  Excess Shelter cap ($744), and Homeless Shelter Allowance ($198.99), all confirmed
  current for FFY2026 via MD SNAP Manual Section 600 and independently cross-validated by
  AT 26-05, match `federal-tables.ts`'s FY26 snapshot exactly — the same shared-source
  signal NC's/VA's/MO's entries already use.

  `drug_felony_ban: "modified"` — this pack's flagship finding, and a genuine THREE-TIER
  structure that directly CONTRADICTS a specific, widely-repeated secondary-source claim
  that Maryland "eliminated drug testing requirements" for drug-felony SNAP applicants.
  TIER 1 (Section 100.62(H)): volume-dealer/drug-kingpin convictions, no stated time
  limit. TIER 2, genuinely broader (Section 100.7(J)): manufacture/distribution/
  possession-with-intent-to-distribute convictions after July 1, 2000 carry a one-year
  disqualification PLUS two years of MANDATORY substance-abuse testing and treatment —
  directly contradicting the "eliminated testing" secondary claim. TIER 3 (implicit):
  simple possession is untouched by either provision. "Modified" is the correct
  classification per #805's rule; gate behavior unchanged (fails open, same as every
  other "modified" entry) until the engine models the actual condition. `abawd_waiver_
  avail: false` — the CLEANEST, most current primary source this pack's researcher found
  anywhere: FIA Action Transmittal AT 26-09 (issued 10/16/2025) asks and answers directly,
  "Q7. Does Maryland DHS still have an ABAWD waiver? A7. No," with no county-level
  distinction anywhere in Maryland's own text — same uniform-statewide-zero-waiver shape
  as this file's VA/MO/TN entries, no county lookup needed.

  `rmp_operated: true` — Maryland IS on USDA's own RMP state list (already cited in this
  file's own TN entry above: "AZ/CA/IL(Cook+Franklin only)/MD/MA/MI/NY/RI/VA"). NOT a
  first for this file — five other already-registered states (CA, GA, FL, NV, VA) already
  carry `rmp_operated: true`; the task brief that prompted this build's premise ("every
  state built so far is `false`") does not match what's actually in `states.ts` and is
  noted here rather than silently repeated. Distinctively, Maryland's RMP is established
  DIRECTLY BY STATE STATUTE (Md. Code, Human Services § 5-505, fetched with no access
  barrier) rather than only administrative adoption of 7 CFR 274.7(g) — though Maryland's
  own DHS page discloses the program is an expanding county-by-county pilot, not yet fully
  statewide. `rmp_operated` has no consumer anywhere in `verdict.ts` or `benefit-calc.ts`
  (grep-confirmed) — purely informational, so the geographic-rollout nuance has zero
  effect on oracle coverage.

  `sua_by_tier` — FULLY POPULATED, not null: HCSUA $572 / LUA $350 / phone $40, all from
  MD SNAP Manual Section 600, independently cross-validated by AT 26-05 — clean 1:1 fits
  for this schema's three tiers, no OH/MO-style naming-collision trap. NOT modeled (a
  disclosed, out-of-schema mechanism, same class of gap as NJ's/MO's/TN's already-accepted
  Facts-shape limits, not re-filed as a new issue per this task's own instruction): Md.
  Code, Human Services § 5-501(d) establishes a Maryland-specific state-funded top-up — a
  household with a member 60 (statute) or 62 (the manual's own cross-reference; the
  corpus pack disclosed this internal discrepancy rather than resolving it) or older whose
  federal benefit would compute under $50/month gets a state supplement bringing it to
  $50, distinct from the plain federal $24 minimum `minimumBenefitFor()` already applies.
  No engine axis exists for a composition-conditioned minimum-benefit floor (only AK's
  zone-based floor varies by state today, and that varies by geography, not household age
  composition). Also disclosed, and immaterial regardless: a genuine internal contradiction
  within Maryland's OWN currently-published manual on the (rarely-reached, since BBCE
  waives it) resource limit — Section 200 states $2,250/$3,250, Section 600 states the
  current-federal-matching $3,000/$4,500 — not a stale-vs-current gap like MO's SUA
  finding, but two sections of the same live document disagreeing with each other.

  Oracle: built a fresh, independent Python calculator (not derived from engine output,
  per #636) directly from `verdict.ts`/`benefit-calc.ts`/`gates/{income-tests,asset-test,
  abawd,student,composition,immigration,disqualifications,categorical}.ts`/`facts.ts`/
  `constants/federal-tables.ts`'s own read source (not just their doc-comments), mirroring
  every gate and the benefit-calc formula exactly, including `decimal.ts`'s half-up
  (`roundDollar`), floor (`floorDollar`), and ceiling (`ceilDollar`) rounding conventions.
  Cross-validated BEFORE trusting it for MD: 92/92 exact match (verdict AND benefit)
  reproducing VA's already-graded oracle under VA's own `StatePolicy` params — VA is MD's
  closest structural axis-twin in this file (identical bbce/200%/federal_fiscal_year,
  identical asset_waiver, identical abawd_waiver_avail, identical allotment_tier; both
  need the full shelter/SUA/benefit pathway exercised, unlike NJ's/PA's/TN's null-SUA-
  blocked entries; the only math-relevant difference is the SUA dollar figures themselves,
  since `drug_felony_ban` and `rmp_operated` have no verdict/benefit-math consumer,
  grep-confirmed against `verdict.ts`/`disqualifications.ts`/`benefit-calc.ts`). Also
  checked all 37 rows across the 18 non-`expected_by_state` variant profiles (facts_patch
  A/B pairs) for an MD-specific `verdict_by_state` override, the same discipline every
  prior state's build used — found ZERO divergence from the shared default verdict for MD
  (matching NC's/VA's zero-override result, not MO's one-override `M23` finding — MD's
  bbce/200%/federal_fiscal_year axes are identical to VA's, so MD's computed verdicts are
  IDENTICAL to VA's across all 92 base profiles and all 37 variant rows, confirmed
  explicitly, differing only in benefit dollar amount where SUA values diverge and the
  household isn't shelter-capped). Authored all 92 `expected_by_state.MD` entries:
  80 APPROVE / 12 DENY (the same DENY set as VA's, since both states share every
  financial-gate-relevant axis).

  Verification: `/profile-simulation state=MD` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/IN/MO's bar, not PA's/NJ's/
  TN's/MN's SKIP-heavy shape). Every other registered state's harness run reconfirmed
  unchanged from its documented baseline, all 24 pre-existing states checked individually
  (not spot-checked): CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO all 129/0/0;
  NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 — every one identical to its
  pre-MD documented baseline, zero regressions. `tsc --noEmit -p packages/snap-rules`
  clean, 323/323 snap-rules tests pass (0 new — a schema-conformant pure addition needed
  no new unit tests), 44/47 profile-harness tests pass (3 pre-existing skips). Did not
  touch `packages/demeter-engine` (MD's corpus was already complete and out of scope) or
  any other state's `StatePolicy`/oracle coverage. No new GitHub issue filed — every gap
  found (the $50 elderly state-supplement mechanism, the two internal manual
  contradictions, the drug-felony date inconsistency) is a per-state disclosed gap of an
  already-documented class (#824-style Facts-shape/mechanism gaps), not a new engine
  architecture gap, per this task's own instruction. PR TBD, awaiting merge go-ahead.

- **CO (individual tier, §6 step 3, eighth state after NC/NJ/VA/TN/IN/MO/MD)** — built
  Colorado's `StatePolicy` entry AND full 92-profile oracle coverage from scratch (CO had
  neither before this PR), translating CO's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/co/`, PROVENANCE.md + supplements.json +
  authorities.json, built 2026-08-11) into the engine's stricter typed shape per §5's
  process.

  STRUCTURAL DEPARTURE this file had not seen before, load-bearing for every dollar-figure
  axis in this entry: Colorado has NO separate narrative policy manual — unlike every
  prior state in this roster (MO's SNAP Manual, MD's SNAP Manual, IN's PPM, VA's SNAP
  Manual Part, etc.), Colorado's ENTIRE detailed SNAP policy lives directly inside 10 CCR
  2506-1 ("RULE MANUAL VOLUME 4, SNAP"), a formally promulgated regulation subject to the
  State Board of Human Services' quarterly rulemaking cycle. The corpus pack's own
  hypothesis (stated as a hypothesis, not confirmed causation): this slower
  formal-rulemaking path is why Colorado's own regulation text lags a full cycle behind
  CDHS's own website on BOTH the FFY2026 COLA (every dollar figure in 10 CCR
  2506-1-4.207/4.407 is labeled "Effective October 1, 2024," FFY2025) AND the 2025 OBBBA
  changes (10 CCR 2506-1-4.311's ABAWD text still recites the pre-OBBBA 18-54 age range
  despite a "[Effective 1/4/2025]" header).

  `bbce: true` / `bbce_threshold_pct: 200` / `bbce_fpl_basis: federal_fiscal_year` —
  CONFIRMED, not corrected: 10 CCR 2506-1-4.206 names Expanded Categorical Eligibility
  (ECE) directly at 200% FPL, cross-validated against this file's Maryland entry's
  identical nationwide FFY2026 figures. `asset_waiver: true` follows directly (10 CCR
  2506-1-4.408(E): the $3,000/$4,500 resource limit applies only to the smaller Standard
  Eligibility population). `allotment_tier: "48"` — no Colorado-specific elevated
  max-allotment schedule found (the regulation's own table is the section already flagged
  stale below, not evidence of a genuinely elevated table).

  `sua_by_tier` — POPULATED WITH DISCLOSED STALENESS, not null, a genuinely BROADER
  staleness gap than any prior state's disclosed SUA finding: Colorado's own regulation
  (10 CCR 2506-1-4.407.31) publishes a real FOUR-tier SUA — HCUA (Heating/Cooling) $578,
  BUA (Basic, 2+ non-heat utilities) $367, OUA (One Utility) $69, Telephone $94 — but EVERY
  one of the four figures is explicitly labeled "Effective October 1, 2024" (FFY2025), and
  the corpus pack's targeted search could not locate a Colorado-specific FFY2026 update to
  any of them. Populated anyway per MO's disclosed-confidence precedent (a real, if
  one-cycle-stale, sourced figure is materially different from PA's/NJ's/TN's/MN's "no
  figure exists at all" null gap) — but flagged as the broadest single-state staleness risk
  this file has recorded, worth re-verification before trusted for a real determination.
  Also surfaced the SAME naming-collision mapping trap this file's OH and MO entries
  already document: `determineSUATier`'s single LIMITED branch has no utility-COUNT
  distinction, so Colorado's own $367 BUA (2+ utilities) tier maps to this schema's `LUA`
  slot, NOT Colorado's own differently-scoped $69 OUA (exactly one utility) tier, which is
  the disclosed, unmapped 4th tier — same treatment as OH's $108 Single SUA, IL's $78
  Single Utility, MO's own $158 one-utility tier.

  `drug_felony_ban: "modified"` — a genuine, disclosed NARROWING of the widely-repeated
  secondary-source "modified ban" characterization: C.R.S. § 26-2-305(1)(c) disqualifies a
  household member ONLY for a felony conviction DIRECTLY RELATED to using SNAP benefits
  themselves to purchase controlled substances, where that misuse is part of the court's
  own findings — materially narrower than "any drug felony." "Modified" remains the
  correct #805 classification (a real, conditional restriction this engine does not yet
  model at the facts level); gate behavior unchanged (fails open) — see #805.

  `abawd_waiver_avail: false` — an AFFIRMATIVELY SOURCED, currently-zero finding: Colorado
  holds ZERO ABAWD waivers anywhere in the state per the independent abawdmap.us
  aggregator and the absence of any Colorado entry on USDA's Time Limit Waivers FY
  2025-2029 index — same uniform-statewide-zero-waiver shape as this file's VA/MO/TN/MD
  entries, no county lookup needed. Disclosed, not re-resolved: a genuine THREE-WAY
  internal contradiction on Colorado's own ABAWD age range (10 CCR 2506-1-4.311's stale
  18-54/pre-OBBBA text vs. CDHS's dedicated ABAWD FAQ's current 18-64 vs. CDHS's own main
  `/snap` page stating BOTH "18 and 56" and "18 to 64" in different paragraphs) — this
  engine's ABAWD gate already applies the correct federal 18-64 ceiling post-OBBBA
  independent of any state axis, so the contradiction has no engine consumer regardless.

  `rmp_operated: false` — Colorado does NOT currently operate a Restaurant Meals Program
  (CDHS's own current SNAP page lists hot/on-premises foods as NOT SNAP-eligible, no RMP
  exception). Disclosed as a genuinely LIVE, actively-moving axis rather than a settled
  zero: SB25-169 (signed 5/13/2025) required a USDA RMP application by January 1, 2026 — a
  deadline that has passed as of this pack's fetch date without a locatable public status
  update, unlike VA's/MO's/TN's/MD's-ABAWD-style settled-zero findings.

  Not representable in this schema, and not silently dropped — the SAME pre-existing gaps
  already filed as #824, not re-filed, just newly confirmed present for Colorado: (a) all
  vehicles excluded as a resource regardless of type (10 CCR 2506-1-4.410(A), matching
  MO's/MD's blanket pattern; immaterial regardless since `asset_waiver: true` means the
  resource test never runs); (b) legally obligated child support treated as an INCOME
  EXCLUSION applied before the gross test (10 CCR 2506-1-4.407(D)/4.407.5, matching
  VA/NJ/IL/MO's mechanism, not modeled by `benefit-calc.ts`'s engine-wide
  ordinary-deduction-only mechanism; A08's $300 child-support profile's CO verdict is
  unaffected either way, same acceptance as NJ's/MO's A08 entries); (c) a flat $165
  Standard Medical Expense Deduction (SMED) shortcut for verified expenses $35.01-$200 (10
  CCR 2506-1-4.407.61, matching MO's flat-shortcut pattern, not modeled by
  `benefit-calc.ts`'s actual-expense-only mechanism; independently verified zero of the 92
  profiles are affected); (d) no engine axis exists for certification-period length
  (Colorado's 6-month/24-month structure, 10 CCR 2506-1-4.208.1).

  Oracle: CO's closest structural axis-twin among all 25 already-registered states is NORTH
  CAROLINA — identical bbce (true/200/federal_fiscal_year), identical asset_waiver (true),
  identical drug_felony_ban ("modified"), identical abawd_waiver_avail (false), identical
  allotment_tier ("48"), identical rmp_operated (false); both also carry a real, non-null
  `sua_by_tier` needing the full shelter/SUA/benefit-calc pathway exercised (unlike
  NJ's/PA's/TN's null-SUA-blocked entries), differing only in the SUA dollar figures
  themselves. Built a fresh, independent Python calculator (not derived from engine output,
  per #636) directly from `verdict.ts`/`benefit-calc.ts`/`gates/{income-tests,asset-test,
  abawd,student,composition,immigration,disqualifications,categorical}.ts`/`facts.ts`/
  `constants/federal-tables.ts`'s own read source (not just their doc-comments), mirroring
  every gate and the benefit-calc formula exactly, including `decimal.ts`'s half-up
  (`roundDollar`) and floor (`floorDollar`) rounding conventions. Cross-validated BEFORE
  trusting it for CO: 92/92 exact match (verdict AND benefit) reproducing NC's
  already-graded oracle under NC's own `StatePolicy` params, PLUS all 37
  non-`expected_by_state` variant rows (0 mismatches), before applying CO's own policy
  params. Also checked all 37 variant rows directly under CO's own params for a
  CO-specific `verdict_by_state` override, the same discipline every prior state's build
  used — found ZERO divergence from the shared default verdict (matching NC's/VA's/MD's
  zero-override result): CO's computed verdicts are IDENTICAL to NC's across all 92 base
  profiles and all 37 variant rows (80 APPROVE / 12 DENY, the same DENY set as NC's/VA's/
  MD's, since all four states share every financial-gate-relevant axis exactly), differing
  only in benefit dollar amount where SUA values diverge. Authored all 92
  `expected_by_state.CO` entries.

  Verification: `/profile-simulation state=CO` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/IN/MO/MD's bar, not PA's/NJ's/
  TN's/MN's SKIP-heavy shape — CO's real, disclosed-confidence SUA figures mean it did not
  need PA's/NJ's/TN's null-SUA fallback). Every other registered state's harness run
  reconfirmed unchanged from its documented baseline, all 25 pre-existing states checked
  individually (not spot-checked): CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD
  all 129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 — every one
  identical to its pre-CO documented baseline, zero regressions. `tsc --noEmit -p
  packages/snap-rules` clean, 323/323 snap-rules tests pass (0 new — a schema-conformant
  pure addition needed no new unit tests), 44/47 profile-harness tests pass (3
  pre-existing skips). Did not touch `packages/demeter-engine` (CO's corpus was already
  complete and out of scope) or any other state's `StatePolicy`/oracle coverage. No new
  GitHub issue filed — every gap found (the four-tier-stale SUA figures, the ABAWD
  three-way internal contradiction, the RMP pending-application status, the narrower
  drug-felony trigger, the SMED/child-support-exclusion/vehicle-exclusion/certification-
  period gaps) is a per-state disclosed gap of an already-documented class (#824-style
  Facts-shape/mechanism gaps, or a genuinely time-sensitive fact worth re-checking later,
  not an engine architecture gap), per this task's own instruction. PR TBD, awaiting merge
  go-ahead.

- **SC (individual tier, §6 step 3, ninth state after NC/NJ/VA/TN/IN/MO/MD/CO)** — built
  South Carolina's `StatePolicy` entry AND full 92-profile oracle coverage from scratch (SC
  had neither before this PR), translating SC's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/sc/`, PROVENANCE.md + supplements.json, built
  2026-08-11) into the engine's stricter typed shape per §5's process.

  `bbce: true` / `bbce_threshold_pct: 130` / `bbce_fpl_basis: federal_fiscal_year` — THIS
  PACK'S FLAGSHIP FINDING, a genuine CORRECTION to the widely-repeated secondary-source
  assumption that BBCE states run a 200% FPL ceiling: SC SNAP Manual (Vol. 70, June 2026)
  § 4.1(D) grants "Family Independence Information and Referral Services" categorical
  eligibility only to households at or below 130% FPL — and SC's ORDINARY gross income test
  (§ 13.6(2)(B)) is ALSO 130% FPL, the plain federal floor with no state-elected increase.
  SC's BBCE analog therefore does NOT expand income eligibility at all; what it actually
  does is waive the resource test (and the separate net income test) for households already
  inside the ordinary 130% gross limit. Encoded honestly as `bbce: true,
  bbce_threshold_pct: 130` rather than `bbce: false` — SC's own manual frames this as a
  categorical-eligibility mechanism, and `verdict.ts`'s existing gate logic already does the
  right thing with these values with ZERO code change needed: because
  `GROSS_INCOME_TEST_RATIO` is also 1.30 (130%), the BBCE-raised threshold is numerically
  identical to the federal default, so the gross test behaves exactly like a non-BBCE
  state's — but `policy.bbce === true` still marks `bbceConferred = true` once that
  (unchanged) threshold clears, which correctly skips BOTH the net income test AND (via
  `asset_waiver: true`, redundantly-but-consistently) the asset test for every NPA household
  that clears it. A genuinely clean demonstration that the `bbce`/`bbce_threshold_pct` split
  this schema already supports (decoupled from `asset_waiver`) was expressive enough for a
  state whose "raised" threshold equals its ordinary one — no engine change, no new axis, no
  disclosed gap needed. (E/D households still take the net-only federal path per every other
  state's existing behavior, since `grossTestApplies` is false for them regardless of
  BBCE — pre-existing, shared engine behavior, not new here.)

  `asset_waiver: true` — flows directly from the same § 4.1(D) finding: "will have the
  household's resources excluded when determining eligibility" for every household within
  the 130% pathway — effectively every NPA household that isn't already gross-income-denied,
  since the pathway's ceiling equals the ordinary gross test.

  `sua_by_tier` — FULLY POPULATED, not null, a genuinely CLEAN case: SC's own SNAP Manual is
  dated June 2026, roughly two months before the corpus pack's fetch date — no staleness
  disclosure needed, unlike this file's CO entry (four-tier-stale) or MO entry
  (one-cycle-stale). § 12.5(2)-(3): Mandatory Utility Allowance (MUA) $388/mo (heating/
  cooling qualifying), Basic Utility Allowance (BUA) $265/mo (2+ non-heating utilities),
  standalone Telephone Allowance $27/mo. These map cleanly onto this schema's three tiers by
  FUNCTION — MUA → HCSUA, BUA → LUA, Telephone → phone — with NO naming-collision trap
  (contrast OH's/MO's/CO's disclosed "LUA slot actually maps to the state's 2+-utility tier,
  not its differently-scoped 1-utility tier" gap: SC's BUA is ALREADY a 2+-utility standard
  by SC's own definition, so no fourth, unmapped tier exists here).

  `allotment_tier: "48"` — SC's own Standard Deduction, Excess Shelter cap ($744), and
  resource limits ($3,000/$4,500) all match `federal-tables.ts`'s FY26 snapshot exactly, the
  same shared-source signal NC's/VA's/MO's/MD's/CO's entries use.

  `drug_felony_ban: "full"` — THIS PACK'S SECOND FLAGSHIP FINDING, a genuine CONFIRMATION of
  the minority nationwide position: SC SNAP Manual § 2.3(7) restates 21 U.S.C.
  § 862a(a)(2)'s plain federal lifetime ban verbatim as SCDSS policy, with NO separate SC
  statute located anywhere opting out or narrowing it under § 862a(d)(1) — corroborated by
  two independent secondary aggregators (Network for Public Health Law's 50-state survey
  codes SC as "kept full federal ban," no statute cited; Prison Policy Initiative, Feb.
  2026). SC and Guam are the only two US jurisdictions in this posture nationwide. SC is
  only the SECOND state in this file (after TX) to carry `"full"` rather than
  `"none"`/`"modified"`/`"unconfirmed"`.

  `abawd_waiver_avail: false` — an AFFIRMATIVELY SOURCED, currently-zero finding: independent
  ABAWDMap.us aggregator states "No waiver — rule applies" for South Carolina, and no SC
  entry appears on USDA's Time Limit Waivers FY2025-2029 index. SC's own manual (§ 8.12,
  § 8.15) already reflects the full 2025 OBBBA ABAWD changes with no internal contradiction
  found — a genuine contrast with this file's CO entry, which found a three-way internal
  contradiction and stale pre-OBBBA regulation text. No county-level lookup needed, same
  uniform-statewide-zero-waiver shape as VA/MO/TN/MD/CO's entries.

  `rmp_operated: false` — SC is absent from USDA FNA's own current Restaurant Meals Program
  state list, cross-checked against this file's MO/IN/TN entries' own independent fetches of
  the same list. SC's manual describes only a narrower federal-baseline "Homeless Meal
  Provider" concessional-price mechanism limited to homeless households, not the broader
  elderly/disabled population an RMP typically covers — immaterial regardless, since
  `rmp_operated` has no consumer anywhere in `verdict.ts` or `benefit-calc.ts`
  (grep-confirmed, same as every other state's entry in this file).

  Not representable in this schema, and not silently dropped — the SAME pre-existing gaps
  already filed as #824, not re-filed, just newly confirmed present for South Carolina in
  genuinely novel shapes: (a) SC's vehicle-resource rule (§ 10.3(B)(vii), § 10.7(AA)) is a
  STRUCTURAL DEPARTURE this roster has not documented before — ONE exempt vehicle PER
  LICENSED DRIVER (not per household), conditioned on South Carolina vehicle registration,
  with any other vehicle counted at the higher of fair-market-value-over-$4,650 or full
  equity value; immaterial regardless, since `asset_waiver: true` means the resource test
  never runs for the 130%-pathway population this axis governs; (b) SC's flat $175 Standard
  Medical (SM) Deduction shortcut for verified expenses $35.01-$210 (§ 12.8), matching MO's/
  CO's flat-shortcut pattern with its own distinct dollar figures, not modeled by
  `benefit-calc.ts`'s actual-expense-only mechanism; independently verified zero of the 92
  profiles are affected; (c) legally obligated child support (§ 12.7) is an ORDINARY
  POST-GROSS-INCOME DEDUCTION applied at net-income Step (F), matching this file's MD/IN/TN
  pattern (NOT VA/NJ/IL/MO/CO's income-exclusion-before-the-gross-test mechanism) — A08's
  $300 child-support profile's SC verdict is unaffected either way, same acceptance as every
  prior state's A08 entry; (d) no engine axis exists for certification-period length (SC's
  plain federal 6-month/24-month structure, § 13.8(1), matching CO's finding).

  Genuinely time-sensitive and NOT modeled (no engine axis exists for SNAP-eligible-food
  restrictions at all): SC's USDA-approved candy/soda/energy-drink exclusion is real and
  imminent but NOT YET EFFECTIVE as of the corpus pack's 2026-08-11 fetch date — approved by
  Secretary Rollins 12/10/2025, modified 8/3/2026, EFFECTIVE 8/31/2026. No engine consumer
  exists for SNAP food-eligibility rules at all, so this has zero effect on any oracle
  profile — noted here only because a future re-verification pass after 8/31/2026 should not
  be surprised to find it already reflected in SC's own manual by then.

  Oracle: SC's closest structural axis-twin among all 26 already-registered states is
  TEXAS — matching 6 of 7 comparison axes exactly (`bbce: true`, `asset_waiver: true`,
  `drug_felony_ban: "full"` — the ONLY other `"full"` entry in this file, `abawd_waiver_avail:
  false`, `allotment_tier: "48"`, `rmp_operated: false`), differing only in
  `bbce_threshold_pct` (TX 165 vs SC 130) — a stronger match than any 130%-threshold state in
  this file (OH/GA/NY each differ on `asset_waiver`, `drug_felony_ban`, or `rmp_operated`, at
  only 5/7). Built a fresh, independent Python calculator (not derived from engine output,
  per #636) directly from `verdict.ts`/`benefit-calc.ts`/`gates/{income-tests,asset-test,
  abawd,student,composition,immigration,disqualifications,categorical}.ts`/`facts.ts`/
  `constants/federal-tables.ts`'s own read source (not just their doc-comments), mirroring
  every gate and the benefit-calc formula exactly, including `decimal.ts`'s half-up
  (`roundDollar`) and floor (`floorDollar`) rounding conventions. Cross-validated BEFORE
  trusting it for SC: 92/92 exact match (verdict AND benefit) reproducing TX's
  already-graded oracle under TX's own `StatePolicy` params, PLUS all 37
  non-`expected_by_state` variant rows (0 mismatches), before applying SC's own policy
  params. As a second, independent sanity check (not a formal cross-validation, since
  neither is SC's structural twin), compared SC's own computed DENY set against KS's
  (non-BBCE, `asset_waiver: false`) and OH's (BBCE-130, `asset_waiver: true`) already-graded
  oracles: SC's DENY set is exactly KS's DENY set MINUS the 2 asset-limit-driven denials
  (D02, M02 — explained by `asset_waiver: true`) PLUS the 1 drug-felony denial KS's
  `"modified"` ban fails open on (M29 — explained by `drug_felony_ban: "full"`); separately,
  SC's DENY set is exactly OH's DENY set PLUS those same 2 profiles (M29, plus
  M12-abawd-in-a-waived-area — explained by `abawd_waiver_avail: false` vs OH's `true`), with
  zero unexplained divergence in either direction — a strong internal-consistency signal
  beyond the formal TX cross-validation itself.

  Also checked all 37 rows across the 18 non-`expected_by_state` variant profiles
  (facts_patch A/B pairs) for an SC-specific `verdict_by_state` override, the same
  discipline every prior state's build used — found ONE real divergence (matching MO's
  one-override precedent, not NC's/VA's/MD's/CO's zero-override result):
  `M23-variable-gig-income-anticipation`'s two variants ($1,800 and $2,200 gross HH1) both
  clear TX's 165% threshold ($2,153) but fail SC's effective 130% screen (~$1,697) for the
  same reason KS/OH/GA/IN/MO already fail — authored `"SC": "DENY"` into both variants'
  `verdict_by_state` blocks. Authored all 92 `expected_by_state.SC` entries: 71 APPROVE /
  21 DENY.

  Verification: `/profile-simulation state=SC` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/IN/MO/MD/CO's bar, not PA's/NJ's/
  TN's/MN's SKIP-heavy shape — SC's real, current SUA figures mean it did not need PA's/
  NJ's/TN's null-SUA fallback). Every other registered state's harness run reconfirmed
  unchanged from its documented baseline, all 26 pre-existing states checked individually
  (not spot-checked): CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/CO all
  129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 — every one identical to
  its pre-SC documented baseline, zero regressions. `tsc --noEmit -p packages/snap-rules`
  clean, 323/323 snap-rules tests pass (0 new — a schema-conformant pure addition needed no
  new unit tests), 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  `packages/demeter-engine` (SC's corpus was already complete and out of scope) or any other
  state's `StatePolicy`/oracle coverage. No new GitHub issue filed — every gap found (the
  vehicle-per-licensed-driver rule, the SMED/child-support-exclusion/certification-period
  gaps, the not-yet-effective food-restriction waiver) is a per-state disclosed gap of an
  already-documented class (#824-style Facts-shape/mechanism gaps, or a genuinely
  time-sensitive fact worth re-checking after 8/31/2026), not a new engine architecture gap,
  per this task's own instruction. PR TBD, awaiting merge go-ahead.

- **LA (individual tier, §6 step 3, tenth state after NC/NJ/VA/TN/IN/MO/MD/CO/SC)** — built
  Louisiana's `StatePolicy` entry AND full 92-profile oracle coverage from scratch (LA had
  neither before this PR), translating LA's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/la/`, PROVENANCE.md + supplements.json +
  freshness.json, built 2026-08-12) into the engine's stricter typed shape per §5's process.
  Alabama's individual-tier build (this sequence's 9th-numbered state, but built
  concurrently, not read or coordinated with) was NOT yet merged as of this build — a human
  reconciles the eventual rebase, same pattern this project used for MO-vs-TN/IN.

  `bbce: true` / `bbce_threshold_pct: 200` / `bbce_fpl_basis: federal_fiscal_year` — LA
  E-280-SNAP (Broad-Based Categorical Eligibility): households authorized to receive a
  non-cash TANF/MOE-funded service via FITAP get a FLAT 200% FPL gross income test
  REPLACING the ordinary 130% test, with no additional condition that every household
  member be elderly or disabled — structurally SIMPLER than this file's most recent prior
  corpus finding, Alabama's dual-track 130%/200% structure, confirmed by the corpus pack
  reading E-280-SNAP's FULL text (not just its section heading) specifically to avoid
  pattern-matching Alabama's more complex structure onto Louisiana without verification.
  J-300-SNAP (current FFY2026 Income Eligibility Chart, effective Oct. 1, 2025) confirms
  the federal-fiscal-year cycle: 130% FPL HH1 $1,696/mo, 200% FPL HH1 $2,609/mo, 100% FPL
  (net) HH1 $1,305/mo.

  `asset_waiver: true` — flows directly from the same E-280-SNAP finding: BBCE households
  have their resources EXCLUDED ENTIRELY, and LA's manual instructs staff not to even
  request resource verification for these households (E-280-SNAP, E-281-1-SNAP,
  B-1022-SNAP).

  `sua_by_tier` — FULLY POPULATED, not null: LA B-654-1/2/3-SNAP (effective June 1, 2026)
  publishes SUA $465/mo (heating/cooling households), BUA $258/mo (2+ non-heating
  utilities), standalone Telephone Standard $76/mo. Clean 1:1 functional fit onto this
  schema's three tiers — SUA→HCSUA, BUA→LUA, Telephone→phone — the same shape this file's
  SC entry found, with no naming-collision trap (LA's BUA is already a 2+-utility standard
  by LA's own definition, unlike OH's/MO's/CO's disclosed mismatched-tier gap). LA's
  Standard Deduction ($209/$209/$209/$223/$261/$299), capped excess shelter ($744), and
  $3,000/$4,500 resource limits all match `federal-tables.ts`'s FY26 snapshot exactly.

  `allotment_tier: "48"` — no Louisiana-specific elevated max-allotment schedule found.

  `drug_felony_ban: "none"` — a VERIFIED FULL OPT-OUT, this pack's second flagship finding:
  La. R.S. 46:233.3 (2017 Regular Session HB 681, effective October 1, 2017) exempts ALL
  individuals domiciled in Louisiana from the federal 21 U.S.C. 862a(a)(2) drug-felony SNAP
  ban — per CLASP's "No More Double Punishments" report, Louisiana is among a minority of
  states (alongside North Dakota) that FULLY opted out, not merely modified, the ban.
  Independently corroborated by reading LA's own current disqualification manual directly:
  E-220-SNAP and E-222-SNAP enumerate every category of SNAP member disqualification
  Louisiana's program currently applies, and a drug-related felony conviction, by itself,
  appears on NEITHER list. Access caveat: Justia 403'd on direct fetch of the statute's own
  text; corroborated via convergent secondary sources (CLASP, the Public Health Law
  Center's opt-out map) cross-checked against LA's own primary-source manual, which
  independently confirms the same substantive rule by omission — not a direct read of the
  statute's codified text.

  `abawd_waiver_avail: false` — an AFFIRMATIVELY SOURCED, DOUBLE-LOCKED-OUT finding, this
  pack's third flagship finding: Louisiana's own 2024 Act 308 barred DCFS from seeking or
  renewing ABAWD waivers unless required by federal law — a state-specific choice predating
  OBBBA by roughly a year, expiring LA's last 33 parish-level waivers (more than half the
  state's 64 parishes) October 1, 2024. OBBBA then independently eliminated the federal
  ABAWD-waiver mechanism nationwide (effective November 2025). ABAWDMap.us confirms zero
  ABAWD waivers statewide as of its last review (June 16, 2026). No county-level lookup
  needed, same uniform-statewide-zero-waiver shape as this file's VA/MO/TN/MD/CO/SC
  entries.

  `rmp_operated: false` — Louisiana is ABSENT from USDA FNA's own current Restaurant Meals
  Program state list (fetched Aug. 7, 2026). Disclosed, not modeled (no engine consumer
  exists for this axis, grep-confirmed): LDH separately announced (July 20, 2026) a
  TEMPORARY, STATEWIDE hot-foods disaster waiver for ALL SNAP participants following
  Tropical Storm Arthur, stated effective through August 13, 2026 — a genuinely
  time-sensitive, already-lapsed-as-of-this-build mechanism (LA's own `freshness.json`
  re-checked 2026-08-15: no extension found, fails safe), and a different, disaster-specific
  mechanism from a standing RMP, never conflated with it.

  Not representable in this schema, and not silently dropped — the SAME pre-existing gaps
  already filed as #824, newly confirmed present for Louisiana: (a) all vehicles excluded
  as a resource regardless of type (LA B-1040-SNAP's countable-resources list omits
  vehicles entirely), matching this file's NC/MO/MD/CO pattern; immaterial regardless since
  `asset_waiver: true` means the resource test never runs for the BBCE population this axis
  governs; (b) legally obligated child support (LA B-656-SNAP) is an ORDINARY
  POST-GROSS-INCOME DEDUCTION, matching this file's MD/IN/TN/SC pattern (NOT VA/NJ/IL/MO/
  CO's income-exclusion-before-the-gross-test mechanism) — A08's $300 child-support
  profile's LA verdict is unaffected either way; (c) a flat Homeless Shelter Deduction of
  $198.99/mo (LA B-654-6-SNAP) as an alternative to the capped excess shelter deduction —
  this happens to equal the federal FY26 homeless-deduction figure `federal-tables.ts`
  already uses engine-wide, so LA carries no disclosed divergence here (a different shape
  from MO's/CO's/SC's flat-shortcut findings, which carry LA-irrelevant state-specific
  dollar amounts); (d) no engine axis exists for certification-period length (LA's 12-month
  structure with a 6-month Simplified Report midpoint, S-110-SNAP, matching this file's
  Alabama/MD pattern per the corpus pack, not CO's/SC's 6-month baseline).

  Disclosed research-access gap (not a fabricated citation, per the corpus pack's own
  `freshness.json`): LA's own B-1030-SNAP (the section B-1040-SNAP itself cites for
  "required resource limits") could not be independently located at a stable URL. The
  $3,000/$4,500 resource-limit figures are corroborated via B-1040-17-SNAP's own worked
  numerical example plus independent secondary confirmation, not a direct read of
  B-1030-SNAP's full text — immaterial to every axis authored here since none of them
  depend on the exact resource-limit figure (`asset_waiver` already skips the test).

  Oracle: LA's closest structural axis-twin among all 27 already-registered states is
  OREGON — a FULL 7/7 match on every comparison axis (`bbce: true`,
  `bbce_threshold_pct: 200`, `bbce_fpl_basis: federal_fiscal_year`, `asset_waiver: true`,
  `drug_felony_ban: "none"`, `abawd_waiver_avail: false`, `allotment_tier: "48"`,
  `rmp_operated: false`), differing only in the SUA dollar figures — a stronger match than
  any prior state's chosen twin in this file (VA-via-NC, MD-via-VA, CO-via-NC, SC-via-TX
  were all 6/7). Built a fresh, independent Python calculator (not derived from engine
  output, per #636) directly from `verdict.ts`/`benefit-calc.ts`/`gates/{income-tests,
  asset-test,abawd,student,composition,immigration,disqualifications,categorical}.ts`/
  `facts.ts`/`constants/federal-tables.ts`'s own read source (not just their doc-comments),
  mirroring every gate and the benefit-calc formula exactly, including `decimal.ts`'s
  half-up (`roundDollar`) and floor (`floorDollar`) rounding conventions. Cross-validated
  BEFORE trusting it for LA: 92/92 exact match (verdict AND benefit) reproducing OR's
  already-graded oracle under OR's own `StatePolicy` params, PLUS all 37
  non-`expected_by_state` variant rows (0 mismatches) — 129/129 total, before applying LA's
  own policy params. Also checked all 37 rows across the 18 non-`expected_by_state` variant
  profiles directly under LA's own params for an LA-specific `verdict_by_state` override,
  the same discipline every prior state's build used — found ZERO divergence from the
  shared default verdict (matching NC's/VA's/MD's/CO's zero-override result, not MO's/SC's
  one-override finding): because LA's computed verdict set is identical to OR's on every
  axis that affects eligibility, LA's verdicts are IDENTICAL to OR's across all 92 base
  profiles and all 37 variant rows (80 APPROVE / 12 DENY, the same DENY set as OR's),
  differing only in benefit dollar amount for 8 of the 92 profiles where OR's/LA's SUA
  figures diverge AND the household's excess-shelter deduction isn't already clamped by the
  federal $744 shelter cap (elderly/disabled households with an uncapped shelter deduction,
  plus BBCE-flip and near-threshold profiles where the SUA-driven net-income difference
  doesn't change the verdict). Authored all 92 `expected_by_state.LA` entries: 80 APPROVE /
  12 DENY.

  Verification: `/profile-simulation state=LA` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/IN/MO/MD/CO/SC's bar, not PA's/
  NJ's/TN's/MN's SKIP-heavy shape). Every other registered state's harness run reconfirmed
  unchanged from its documented baseline, all 27 pre-existing states checked individually
  (not spot-checked): CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/CO/SC all
  129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 — every one identical to
  its pre-LA documented baseline, zero regressions. `tsc --noEmit -p packages/snap-rules`
  clean, 323/323 snap-rules tests pass (0 new — a schema-conformant pure addition needed no
  new unit tests), 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  `packages/demeter-engine` (LA's corpus was already complete and out of scope) or any
  other state's `StatePolicy`/oracle coverage. No new GitHub issue filed — every gap found
  (the disclosed B-1030-SNAP access gap, the DCFS-to-LDH agency transfer, the Economic
  Stability/Economic Independence manual rename, the SMED/child-support-exclusion/vehicle-
  exclusion/certification-period gaps) is a per-state disclosed gap of an already-documented
  class (#824-style Facts-shape/mechanism gaps, or a genuinely time-sensitive fact worth
  re-checking later), not a new engine architecture gap, per this task's own instruction.

- **ID (batch-tier segment 3, §6 step 6, first of ID/WV/NH)** — built Idaho's `StatePolicy`
  entry AND full 92-profile oracle coverage from scratch (ID had neither before this PR),
  translating Idaho's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/id/`, PROVENANCE.md + `supplements.json`, built
  2026-08-12) into the engine's stricter typed shape per §5's process. Built as one of
  THREE states in a single batch (ID → WV → NH, strict append-order chain in one worktree,
  each fully verified before the next began) — the third batch-tier segment; TWO OTHER
  batch-tier segments (CT/UT/IA/AR and MS/NM/NE) and three individual-tier states (AL, KY,
  OK) were all concurrently in flight as of this build, not yet merged — not touched or
  coordinated with; a human reconciles the eventual rebase chain, same pattern as
  MO-vs-TN/IN.

  `bbce: FALSE` — a deliberate, reasoned departure from every other BBCE state in this
  file, not an oversight or a missed elevation. IDAPA 16.03.04.010.09 defines Idaho's Broad
  -Based Categorical Eligibility precisely: BBCE-eligible households are "ALSO SUBJECT TO
  resource, gross, and net income eligibility standards" — Idaho's BBCE does NOT raise the
  gross-income ceiling (DHW's own current income-limit table matches the plain federal 130%
  FPL figures exactly) and does NOT exempt households from the net-income test. Setting
  `bbce: true` in this schema — even with `bbce_threshold_pct` left undefined — would still
  incorrectly trip `bbceConferred = true` in `verdict.ts` once a household clears the gross
  test, silently skipping the net income test for a state whose real law confers no such
  skip. `bbce: false` correctly reproduces Idaho's real income-test mechanics byte-for-byte.
  This surfaced a genuine ENGINE-ARCHITECTURE gap, filed as
  [#853](https://github.com/matthewgg22/Civica/issues/853): `StatePolicy.bbce` bundles
  three effects (raised gross ceiling, net-test conferral, conventional asset-waiver
  pairing) that don't universally co-vary — a sibling finding to #830's TN gap, pointing
  the opposite direction (TN needs an ADDITIONAL net-ceiling layered on top of BBCE
  conferral; Idaho needs BBCE's income-test effects to be absent entirely).

  `asset_waiver: FALSE` — also a disclosed, conservative approximation under the SAME #853
  gap, not a confirmed federal-baseline finding. Idaho's REAL resource limit is a flat
  $5,000 for the BBCE population (IDAPA 16.03.04.305), RAISED (not waived) above the
  federal baseline — independently cross-checked against Idaho DHW's own consumer page,
  itself a second, independent primary source correcting a widely-repeated secondary-source
  claim that Idaho BBCE households face "no resource limit" at all (the corpus pack's own
  flagship correction — the corpus pack's OWN first-pass web search synthesis initially
  reproduced that same wrong claim before primary-source verification caught it). This
  schema has no numeric override slot for "a real, enforced, state-specific dollar limit
  distinct from both the boolean waiver and the federal default" — `asset_waiver: false`
  enforces a real test but under-states Idaho's genuine $5,000 generosity for households
  with $3,000-$5,000 in assets. Independently verified this has NO effect on any of the 92
  v0.6 profiles' verdicts (none carries assets in the disclosed band) — a forward-looking
  gap disclosure, not a currently-observed miscompute.

  `sua_by_tier: NULL` — a genuine, disclosed sourcing gap, same discipline as PA's/NJ's/
  MN's null entries. IDAPA 16.03.04.543 confirms Idaho runs a FOUR-tier utility-allowance
  system (Standard/Limited/Minimum/Telephone, a structural match to this roster's Nebraska
  corpus pack's own four-tier finding) but defines each tier by qualifying criteria only,
  with no dollar figures found in a directly-fetched, dated DHW source.

  `drug_felony_ban: "modified"` (IDAPA 16.03.04.287 — eligibility conditioned on ONGOING
  SENTENCE COMPLIANCE, a genuinely different mechanism shape from other "modified" states'
  conviction-count or treatment-program conditions, but correctly the same classification
  per #805); `abawd_waiver_avail: false` (secondary-source-corroborated, no active waiver
  found); `rmp_operated: false`; `allotment_tier: "48"`.

  Oracle: built a fresh, independent Python calculator (not derived from engine output, per
  #636) directly from `verdict.ts`/`benefit-calc.ts`/`gates/{income-tests,asset-test,abawd,
  student,composition,immigration,disqualifications,categorical}.ts`/`facts.ts`/
  `constants/federal-tables.ts`'s own read source, mirroring every gate and the benefit-calc
  formula exactly, including `decimal.ts`'s half-up (`roundDollar`) and floor
  (`floorDollar`) rounding conventions. Cross-validated BEFORE trusting it for ID against
  FOUR already-merged states spanning every code path this batch needs — SC (bbce=true/
  130%/asset_waiver=true/drug="full"), LA (bbce=true/200%/asset_waiver=true/drug="none"),
  MO (bbce=false/asset_waiver=false/drug="modified" — MO is Idaho's true 6-of-7 axis twin),
  MD (bbce=true/200%/asset_waiver=true/drug="modified") — 4 × (92 base + 37 variant) =
  516/516 exact match (verdict AND benefit) reproducing each state's already-graded oracle
  under its own policy params before applying ID's own. Also checked all 37 non-
  `expected_by_state` variant rows directly under ID's own params: TWO real divergences
  found and authored (`M23-variable-gig-income-anticipation`'s `averaged` and
  `recent_high_month` variants both flip from the shared default APPROVE to ID DENY —
  Idaho's plain-federal-130% gross screen denies both income points, matching the exact
  same DENY pattern this file's KS/OH/GA/MO/IN/SC federal-130-or-equivalent states already
  carry for the same two rows). ONE genuinely indeterminate row found and deliberately left
  unoverridden: `P58-elderly-retiree-tips-over-net-limit`'s `above_net_limit` variant (E/D
  household, real verdict depends on the unauthored SUA figure at a break-even point of
  exactly $1,131.50 within the $0-$1,500 sweep range) — this exact profile already carries
  an inline note in v0.6.json about MA/CA SUA-sensitivity for this same row, so ID's
  sensitivity is consistent with, not a departure from, prior-established precedent; the
  row SKIPs for ID regardless of which verdict is authored (null-SUA gate), so leaving it
  unoverridden has zero effect on live grading.

  Authored all 92 `expected_by_state.ID` entries: 70 APPROVE / 22 DENY (materially higher
  DENY count than this file's 200%-BBCE states, exactly as expected for a state running the
  plain federal 130%/100% income tests with no BBCE elevation). 32 of 92 carry a real
  computed $ benefit (`sua_tier === "none"` or `homeless_deduction`); the other 60 are
  blocked by the null-SUA gap (`benefit: null`), proven SUA-invariant via a $0-$1,500
  twelve-point sweep (0 of 60 genuinely indeterminate among the BASE profiles — the one
  indeterminate row found is a VARIANT row, not one of the 92 base profiles).

  Verification: `/profile-simulation state=ID` — 34 PASS / 0 FAIL / 95 SKIP (matching PA's/
  NJ's/TN's null-SUA-gap shape). Every other registered state's harness run reconfirmed
  unchanged from its documented baseline: CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/
  IN/MO/MD/CO/SC/LA all 129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 —
  every one identical to its pre-ID documented baseline, zero regressions. `tsc --noEmit -p
  packages/snap-rules` clean, 323/323 snap-rules tests pass (0 new), 44/47 profile-harness
  tests pass (3 pre-existing skips). Did not touch `packages/demeter-engine` or any other
  state's `StatePolicy`/oracle coverage. Filed #853 for the genuine engine-architecture gap
  found; every OTHER gap (null SUA, the stale ABAWD rule text, unconfirmed SME/shelter-cap
  secondary-source figures) is a per-state disclosed gap of an already-established class,
  not a new architecture issue.

- **WV (batch-tier segment 3, §6 step 6, second of ID/WV/NH)** — built West Virginia's
  `StatePolicy` entry AND full 92-profile oracle coverage from scratch, translating West
  Virginia's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/wv/`, PROVENANCE.md + `supplements.json`, built
  2026-08-12) into the engine's stricter typed shape, appended after ID's entry within the
  same worktree/batch.

  `bbce: true` / `bbce_threshold_pct: 200` / `bbce_fpl_basis: federal_fiscal_year` — WV
  Bureau for Family Assistance's live SNAP page publishes a two-column 130%/200% FPL
  gross-income table, and the corpus pack's Finding 1 confirms the 200% figure applies
  BROADLY across household types, no elderly/disabled/separate-household carve-out
  narrowing it (a genuine contrast with this roster's Nebraska corpus pack's narrower 165%
  column). `asset_waiver: true` — WV BFA's own page states the federal $3,000/$4,500
  baseline in the SAME paragraph as "Most households will not be subject to the asset
  limit," read as the standard BBCE resource-waiver mechanism (unlike Idaho's genuinely
  different raised-not-waived $5,000 mechanism — WV's own page describes a waiver, not an
  elevated dollar figure, so #853's Idaho-specific gap does not apply here).

  `sua_by_tier: NULL` — a genuine, disclosed sourcing gap. The corpus pack's Finding 0
  explicitly distinguishes this from a bot-detection wall (none found anywhere in WV's
  primary sources) — a genuine COVERAGE gap: the West Virginia Income Maintenance Manual
  chapters fetched (9 and 11) carry only procedural content dated 2008-2013, not a current
  deductions table; a secondary-source aggregator dollar figure was deliberately REMOVED
  during the corpus pack's own adversarial refute pass rather than left in unverified.

  `drug_felony_ban: "modified"` — W. Va. Code § 9-2-3a (HB2459, 2019): West Virginia
  exempts ALL individuals domiciled in the state from the federal drug-felony ban UNLESS
  the offense of conviction itself involved SNAP-benefit misuse, loss of life, or physical
  injury — a real, conditional restriction, correctly classified "modified" (not "none" —
  a genuine disqualifying condition exists, unlike NH's unconditional opt-out below; not
  "full" — the overwhelming majority of drug-felony convictions do NOT disqualify).
  Independently verified TWICE by the corpus pack: the statute's own unamended text, and a
  LIVE 2026 WV Board of Review decision (26-BOR-1601) applying this exact three-element
  test to reverse a county denial — the strongest primary-source confirmation of an
  operationally-current drug-felony policy anywhere in this file's roster to date.

  `abawd_waiver_avail: false` — the corpus pack's Finding 3 (flagged explicitly as the
  pack's OWN INFERENCE, not a directly-quoted DoHS/USDA statement) found West Virginia's
  long-standing statewide ABAWD waiver appears to have LAPSED under OBBBA's tightened
  area-waiver threshold (>10% county unemployment; WV's highest county, McDowell, sits at
  ~9.1%). Cross-checked directly against abawdmap.us's live status. `rmp_operated: false`
  (confirmed absent from USDA's current RMP list, Propel's WV guide directly corroborates
  non-participation). `allotment_tier: "48"`.

  Oracle: reused the SAME independent Python calculator from ID's build immediately prior
  in this batch. Cross-validated BEFORE trusting it for WV: MD is WV's true 6-of-7 axis
  twin among already-merged states (differing only in `rmp_operated`, which has no engine
  consumer) — reproduced MD's already-graded 92 base + 37 variant = 129/129 exact match
  under MD's own policy params. Also checked all 37 non-`expected_by_state` variant rows:
  ONE divergence found, the SAME genuinely-indeterminate `P58`/`above_net_limit` row ID's
  entry disclosed above, deliberately left unoverridden for the same reason (SKIPs
  regardless under the null-SUA gate).

  Authored all 92 `expected_by_state.WV` entries: 80 APPROVE / 12 DENY — IDENTICAL DENY set
  to every other 200%-BBCE/asset_waiver-true state in this file with no additional
  net-ceiling overlay (MD, CO, VA, NC, LA). 34 of 92 carry a real computed $ benefit; the
  other 58 are blocked by the null-SUA gap (`benefit: null`), proven SUA-invariant via the
  same twelve-point sweep discipline (0 of 58 genuinely indeterminate among the BASE
  profiles).

  Verification: `/profile-simulation state=WV` — 34 PASS / 0 FAIL / 95 SKIP (matching PA's/
  NJ's/TN's/ID's null-SUA-gap shape exactly). Every other registered state's harness run
  reconfirmed unchanged from its documented baseline, including ID: CA/WA/TX/GA/MI/IL/FL/
  MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/CO/SC/LA all 129/0/0; NY 127/2/0; AZ 128/1/0; MN
  0/0/129; PA/NJ/TN/ID all 34/0/95 — every one identical to its pre-WV documented baseline,
  zero regressions. `tsc --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests
  pass (0 new), 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  `packages/demeter-engine` or any other state's `StatePolicy`/oracle coverage. No new
  GitHub issue filed for WV specifically — every gap found (null SUA, the ABAWD-lapse
  inference) is a per-state disclosed gap of an already-established class.

- **NH (batch-tier segment 3, §6 step 6, third and final of ID/WV/NH)** — built New
  Hampshire's `StatePolicy` entry AND full 92-profile oracle coverage from scratch,
  translating New Hampshire's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/nh/`, PROVENANCE.md + `supplements.json`, built
  2026-08-12) into the engine's stricter typed shape, appended after WV's entry, completing
  this batch.

  `bbce: true` / `bbce_threshold_pct: 200` / `bbce_fpl_basis: federal_fiscal_year` (an
  honest inference — NH DHHS's own FSM text doesn't state FFY-vs-calendar-year framing
  explicitly, same established default WV's entry above uses). This is a MODELING
  SIMPLIFICATION worth naming precisely: NH's corpus pack's flagship Finding 1 documents NH
  actually runs THREE parallel eligibility tracks — a plain 130%/100% FPG track ($3,000
  resource limit), a "Target" elderly/disabled track ($4,500 resource limit), and an
  "Expanded Categorically Eligible" (ECE) track at 200% FPG with NO resource test — but ECE
  itself requires a household to ALSO be authorized for a non-cash MOE-funded service (DHHS
  Form 77u), a condition this engine's `Facts` shape has no field for. This is the SAME
  simplification every other BBCE state in this file already makes (NC's TANF-services
  notice, VA's statutory rule, WV's page above), not a NEW gap specific to NH — disclosed
  here because NH's corpus pack is unusually explicit about the multi-track structure where
  most other states' packs simply state the elevated percentage. `asset_waiver: true`,
  consistent with the ECE track's real waiver, same blanket-simplification treatment.

  `sua_by_tier: POPULATED, not null` — a genuine contrast with this batch's ID/WV entries,
  and a genuinely NEW schema-mismatch shape: NH DHHS's FSM Table I lists FOUR tiers split
  partly by utility TYPE, not purely by qualifying-utility COUNT — Heating/Cooling $1,018,
  Utilities-Only $373 (2+ non-heating utilities), Electric-Only $217 (exactly 1 non-heating,
  non-phone utility), Telephone-Only $39. This engine's `Facts.shelter.sua_tier` enum has no
  slot for NH's standalone Electric-Only tier — mapped HCSUA→Heating/Cooling ($1,018),
  LUA→Utilities-Only ($373, the closer conceptual match to the engine's generic "Limited
  Utility Allowance" than the single-utility Electric-Only tier), phone→Telephone-Only
  ($39). A household with NH's real Electric-Only tier has no representable Facts input —
  an accepted limitation of the SAME already-established class as NJ's boat/motor-home gap
  (#824) and NC's/VA's household-size-dimension SUA gaps, not a new architecture issue. The
  $1,018 Heating/Cooling figure is itself flagged single-source by the corpus pack (no
  second dated DHHS table cross-check found) — used as the best available primary-source
  figure, not fabricated, but disclosed as lower-confidence than this file's typically
  cross-checked SUA figures.

  `drug_felony_ban: "none"` — SR 97-27 (dated August 1997, implementing HB 722-FN, Chapter
  157, Laws of 1997): "an individual's felony drug conviction status is not taken into
  account for purposes of determining eligibility for TANF financial and/or medical
  assistance and food stamps" — a genuine FULL statutory opt-out, independently confirmed
  by the corpus pack fetching SR 97-27's own text directly (not accepting secondary
  sources' "fully opted out" framing at face value), no subsequent SR found narrowing or
  reversing it. `abawd_waiver_avail: false` — directly cross-checked against USDA FNS/FNA's
  own ABAWD Time Limit Waivers FY 2025-2029 index (no FY2026 NH entry) — stronger sourcing
  than WV's own inference above. `rmp_operated: false`; `allotment_tier: "48"`.

  Oracle: reused the SAME independent Python calculator from ID's/WV's builds. Cross-
  validated BEFORE trusting it for NH: LA is NH's FULL 7-of-7 axis twin among already-
  merged states (every axis identical, differing only in the SUA dollar figures — the
  strongest possible twin match this file's precedent recognizes) — reproduced LA's
  already-graded 92 base + 37 variant = 129/129 exact match under LA's own policy params.
  (The calculator was additionally validated against SC/MO/MD earlier in this same batch —
  516/516 combined across all four cross-validation states run this batch, 0 mismatches.)
  Also checked all 37 non-`expected_by_state` variant rows: ZERO divergence from the shared
  default verdict — NH's computed verdict set is IDENTICAL to LA's on every axis that
  affects eligibility, and unlike ID's/WV's entries, NH has a REAL `sua_by_tier` table, so
  `P58`'s `above_net_limit` indeterminacy does not arise — NH's real $1,018 HCSUA figure
  resolves it determinately to DENY, matching LA's own DENY there.

  Authored all 92 `expected_by_state.NH` entries: 80 APPROVE / 12 DENY — IDENTICAL DENY set
  to LA/MD/CO/VA/NC. Benefit dollar amounts differ from LA's/other states' equivalent
  entries per NH's own SUA figures (higher HCSUA $1,018 vs LA's $465, lower LUA $373 vs
  LA's $258 — asymmetric, not uniformly higher or lower), but NO verdict ever flips as a
  result of any SUA-dollar difference.

  Verification: `/profile-simulation state=NH` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/IN/MO/MD/CO/SC/LA's bar, NOT
  ID's/WV's SKIP-heavy shape — NH's real, disclosed-confidence SUA figures mean it did not
  need the null-SUA fallback). Every other registered state's harness run reconfirmed
  unchanged from its documented baseline, including ID and WV (this batch's first two
  states): CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/CO/SC/LA all 129/0/0;
  NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN/ID/WV all 34/0/95 — every one identical to
  its pre-NH documented baseline, zero regressions. `tsc --noEmit -p packages/snap-rules`
  clean, 323/323 snap-rules tests pass (0 new), 44/47 profile-harness tests pass (3
  pre-existing skips). Did not touch `packages/demeter-engine` or any other state's
  `StatePolicy`/oracle coverage. No new GitHub issue filed for NH — the Electric-Only
  SUA-tier gap and the ECE administrative-conferral-condition simplification are both
  per-state disclosed gaps of already-established classes, not new architecture issues.

  **Batch summary (ID/WV/NH, §6 step 6, batch-tier segment 3):** 3 states built one at a
  time in strict append-order within a single worktree, each fully verified (tsc, snap-
  rules unit tests, full-registry harness zero-regression check) before the next began.
  Combined: 2 SKIP-heavy null-SUA states (ID, WV, 34/0/95 each) + 1 clean state (NH,
  129/0/0). One genuine engine-architecture gap filed (#853, Idaho's BBCE-bundling finding,
  a sibling to #830). Pushed to `origin` as `feat/snap-rules-batch3-id-wv-nh`; one PR opened
  covering all three states, not merged — awaiting human review per the standing rule.
  PR TBD, awaiting merge go-ahead.

- **OK (individual tier, §6 step 3, 13th and FINAL individual-tier state after
  NC/NJ/VA/TN/IN/MO/MD/CO/SC/LA — Alabama's and Kentucky's individual-tier builds were
  BOTH concurrently in flight as of this build, neither read or coordinated with; a human
  reconciles the eventual rebase chain, same pattern this project used for MO-vs-TN/IN)**
  — built Oklahoma's `StatePolicy` entry AND full 92-profile oracle coverage from scratch
  (OK had neither before this PR), translating OK's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/ok/`, PROVENANCE.md + supplements.json +
  freshness.json, built 2026-08-12) into the engine's stricter typed shape per §5's
  process.

  `bbce: false` — NOT a plain "OK has no BBCE" finding like IN's or KS's, and the entry
  this build spent the most care disclosing rather than guessing. OK's own regulation,
  OAC 340:50-11-111(b)/(d) (read via the Cornell LII mirror after oklahoma.gov's own
  policy-library host 403'd), makes a household categorically eligible — BOTH the gross
  AND net income tests removed entirely — for TANF/SSI recipients OR households receiving
  services through "2-1-1 Oklahoma" (a TANF-MOE-funded information/referral service). This
  is a genuinely BROADER mechanism than IN's/KS's narrow SSI/TANF-only federal cat-elig,
  and structurally resembles the BBCE pathway every other expanded-cat-elig state in this
  file uses — BUT OKDHS's own SNAP manual states NO percentage-of-FPL ceiling anywhere for
  the 2-1-1 track, unlike Kentucky's dual 130%/200%, Louisiana's flat 200%, or Alabama's
  dual 130%/200%. The corpus pack specifically checked for one (PROVENANCE.md Finding 4)
  and confirmed its absence, not merely failed to find it. This schema's
  `bbce_threshold_pct` field has no honest, sourced number to hold for OK's 2-1-1 pathway
  — the actual gate, if any, sits inside 2-1-1 Oklahoma's own TANF-MOE-funded
  service-eligibility determination, outside OKDHS's own SNAP policy and outside this
  build's primary-source access. Setting `bbce: true` with no threshold would fall through
  `gates/income-tests.ts`'s own ratio fallback to the plain 130% gross ratio while STILL
  skipping the net test entirely via `bbceConferred` — silently granting a real, uncited
  eligibility expansion no source supports. `bbce: false` is the conservative, defensible
  encoding: the general (non-SSI/TANF) NPA population is evaluated under the plain federal
  130%/100% test, and OK's genuine-but-unsourceable 2-1-1 Oklahoma expansion is disclosed
  as an accepted gap rather than guessed into a number. `bbce_fpl_basis: null` follows,
  matching IN's/KS's established shape for a non-BBCE state.

  `asset_waiver: false` — flows from the same finding: Appendix C-3's own resource-
  standards table states the $3,000/$4,500 test applies "ONLY to sponsored-alien
  households and households that are NOT categorically eligible" — the narrow SSI/TANF/
  2-1-1-Oklahoma cat-elig population already skips the resource test via the federal
  pure-cash path (`facts.cat_elig`) this engine already models; the general NPA household
  faces the plain federal resource limit, same posture as IN's/KS's entries.

  `sua_by_tier` — FULLY POPULATED, not null, a genuinely CLEAN 3-tier mapping: Appendix C-3
  (effective 10/1/2025, current FFY2026 figures) publishes exactly three utility
  standards — SUA $412/mo (heating/cooling), BUA $354/mo (utilities billed but not
  heating/cooling), and a standalone Telephone Standard $49/mo — with OAC 340:50-7-31
  confirming a household may receive only ONE, choosing the highest it qualifies for.
  Unlike this file's OH/MO/CO entries, OK's own supplement discloses no separate
  "single utility" fourth tier distinct from BUA — no naming-collision trap, the same
  clean 3-tier shape this file's SC/LA entries already found. HCSUA → $412 (SUA),
  LUA → $354 (BUA), phone → $49. OK's Standard Deduction ($209 HH1-3, $223 HH4, $261 HH5,
  $299 HH6+), capped excess shelter ($744), and Standard Homeless Shelter Deduction ($199)
  all match `federal-tables.ts`'s FY26 snapshot exactly — the same shared-source signal
  this file's NC/VA/MO/MD/CO/SC/LA entries already use.

  `allotment_tier: "48"` — no Oklahoma-specific elevated max-allotment schedule found.

  `drug_felony_ban: "none"` — a VERIFIED FULL OPT-OUT since 1997 (H.B. 2170, 1997 Okla.
  Sess. Laws ch. 414), corroborated by TWO independent secondary sources converging on the
  identical session-law citation (Collateral Consequences Resource Center: "1997 Okla.
  Sess. Laws 414 § 28"; Prison Policy Initiative, Feb. 2026: "1997 Okla. Sess. Law Serv.
  Ch. 414 (H.B. 2170) §§ 28, 31"), cross-checked against OAC 340:50's own CURRENT
  disqualification-category list (fleeing felon, IPV, work-registration noncompliance,
  substantial lottery/gambling winnings, post-2/7/2014 violent-crime convictions) — NONE
  of which mention a drug-felony conviction at all. Disclosed access gap, not a fabricated
  statute read: the corpus pack could NOT independently locate 1997 Okla. Sess. Laws ch.
  414 §§ 28/31 as standalone, currently-numbered Title 56 sections in the Legislature's own
  current compiled text (unlike neighboring sections of the same 1997 chapter, which ARE
  codified today) — resolved via convergent secondary corroboration plus the current
  regulation's own silence, the same evidentiary standard this file's Louisiana entry
  already applies to its own Justia-403 statute-access gap.

  `abawd_waiver_avail: false` — THIS PACK'S FLAGSHIP FINDING, and the most STRUCTURALLY
  PERMANENT zero-waiver finding this file has recorded: 56 O.S. § 241.3(C) (added by Laws
  2013, c. 178, § 1, effective September 1, 2013) states in full, "the Department of Human
  Services shall not request a waiver to provide Supplemental Nutrition Assistance Program
  services to able-bodied adults without dependents." OKDHS is STATUTORILY BARRED by the
  Oklahoma Legislature from ever requesting an area-based ABAWD waiver, regardless of
  local unemployment conditions — a genuinely different and more durable reason than every
  other zero-waiver state in this file (VA/MO/TN/MD/CO/SC/LA), whose absence of a waiver
  reflects a current administrative choice or a failure to meet the federal
  10%-unemployment threshold, either of which COULD change without any legislative action.
  Oklahoma's cannot, absent a legislative repeal of § 241.3(C) itself. No county-level
  lookup needed, same uniform-statewide-zero-waiver shape as this file's VA/MO/TN/MD/CO/
  SC/LA entries — the underlying reason is simply more permanent here.

  `rmp_operated: false` — Oklahoma is ABSENT from USDA FNA's own current Restaurant Meals
  Program state list, cross-checked against this file's MO/IN/TN/MD/CO/SC/LA entries' own
  independent fetches of the same list. OKDHS's own EBT Resource Center page independently
  confirms the practical consequence in plain consumer language: SNAP cannot buy "fast
  food or food that will be heated and eaten in the store." Disclosed, immaterial
  regardless: `rmp_operated` has no consumer anywhere in `verdict.ts` or `benefit-calc.ts`
  (grep-confirmed, same as every other state's entry in this file).

  Not representable in this schema, and not silently dropped — the SAME pre-existing gap
  already filed as #824, not re-filed, just newly confirmed present for Oklahoma: legally
  obligated child support is an ORDINARY POST-GROSS-INCOME DEDUCTION (OAC 340:50-7-31),
  matching this file's MD/IN/TN/SC/LA pattern — A08's $300 child-support profile's OK
  verdict is unaffected either way. Genuinely and honestly DISCLOSED as unverified, not
  guessed either way: the corpus pack could not obtain a full verbatim read of OAC
  340:50-7-1/340:50-7-6 (secondary summaries only) and therefore does NOT assert whether
  Oklahoma blanket-excludes vehicles from the resource test — immaterial regardless, since
  `asset_waiver: false` here means this build never needed to resolve it (the resource
  test only reaches the narrow non-cat-elig population, and none of the 92 profiles'
  assets depend on vehicle classification specifically). No engine axis exists for OK's
  flat 12-month certification period (OAC 340:50-9-6, informational only) or for the
  165%-FPL "assisting household" sub-pathway (OAC 340:50-5-1(c), a separate-household
  mechanic structurally identical to Kentucky's MS 5200(B), not reachable by any of the 92
  profiles).

  Oracle: OK's closest structural axis-twin among all 28 already-registered states is
  INDIANA — matching every verdict-and-benefit-consequential axis exactly (`bbce: false`,
  `bbce_fpl_basis: null`, `asset_waiver: false`, `allotment_tier: "48"`,
  `abawd_waiver_avail: false`), differing only in `drug_felony_ban` (IN "modified" vs OK
  "none" — a value with zero verdict/benefit consequence, grep-confirmed: only `"full"`
  disqualifies anywhere in `gates/disqualifications.ts`) and the SUA dollar figures. Built
  a fresh, independent Python calculator (not derived from engine output, per #636)
  directly from `verdict.ts`/`benefit-calc.ts`/`gates/{income-tests,asset-test,abawd,
  student,composition,immigration,disqualifications,categorical}.ts`/`facts.ts`/
  `constants/federal-tables.ts`'s own read source (not just their doc-comments), mirroring
  every gate and the benefit-calc formula exactly, including `decimal.ts`'s half-up
  (`roundDollar`) and floor (`floorDollar`) rounding conventions. Cross-validated BEFORE
  trusting it for OK: 92/92 exact match (verdict AND benefit) reproducing IN's
  already-graded oracle under IN's own `StatePolicy` params, PLUS all 37
  non-`expected_by_state` variant rows (0 mismatches), before applying OK's own policy
  params. Also checked all 37 rows across the 18 non-`expected_by_state` variant profiles
  directly under OK's own params for an OK-specific `verdict_by_state` override, the same
  discipline every prior state's build used — found ONE real divergence (matching MO's/
  SC's one-override precedent, not NC's/VA's/MD's/CO's/LA's zero-override result):
  `M23-variable-gig-income-anticipation`'s two variants ($1,800 and $2,200 gross HH1) both
  clear every BBCE-165/185/200 state's threshold in this file but fail OK's plain federal
  130% screen ($1,696-97) for the same reason KS/OH/GA/IN/MO already fail — authored
  `"OK": "DENY"` into both variants' `verdict_by_state` blocks, matching IN's/KS's/MO's
  already-authored value exactly (an independent confirmation the divergence is real, not
  a calculator bug). Authored all 92 `expected_by_state.OK` entries: 70 APPROVE / 22 DENY
  — independently confirmed IDENTICAL to IN's own already-graded 92-profile verdict set (0
  divergence, the expected result since every verdict-controlling axis is identical
  between the two states); only benefit-dollar figures differ, driven by OK's SUA values
  ($412/$354/$49) vs IN's ($486/$283/$36).

  Verification: `/profile-simulation state=OK` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/IN/MO/MD/CO/SC/LA's bar, not
  PA's/NJ's/TN's/MN's SKIP-heavy shape — OK's real, current SUA figures mean it did not
  need PA's/NJ's/TN's null-SUA fallback). Every other registered state's harness run
  reconfirmed unchanged from its documented baseline, all 28 pre-existing states checked
  individually (not spot-checked): CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/
  MD/CO/SC/LA all 129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 — every
  one identical to its pre-OK documented baseline, zero regressions. `tsc --noEmit -p
  packages/snap-rules` clean, 323/323 snap-rules tests pass (0 new — a schema-conformant
  pure addition needed no new unit tests), 44/47 profile-harness tests pass (3
  pre-existing skips). Did not touch `packages/demeter-engine` (OK's corpus was already
  complete and out of scope), AL's or KY's concurrently in-flight work (not yet merged,
  not read or coordinated with), or any other state's `StatePolicy`/oracle coverage. No
  new GitHub issue filed — the 2-1-1 Oklahoma no-published-ceiling finding is a genuine
  research/sourcing gap this schema's existing `bbce`/`bbce_threshold_pct` fields ARE
  expressive enough to leave honestly unset for (unlike TN's #830, which needed a field
  the schema had no slot for at all), and every other gap found (the unresolved
  vehicle-resource-treatment question, the certification-period and 165%-assisting-
  household informational gaps) is a per-state disclosed gap of an already-documented
  class (#824-style Facts-shape/mechanism gaps), per this task's own instruction. This is
  the 13th and FINAL individual-tier state (§6 step 3) — NC, NJ, VA, TN, IN, MO, MD, CO,
  SC, and LA are all already merged (10 states); AL and KY were BOTH concurrently
  in-flight and NOT yet merged as of this build. A human reconciles the eventual rebase
  chain across AL/KY/OK, the same pattern this project has used repeatedly (e.g.
  MO-vs-TN/IN); once all three land, the individual tier closes at 13/13. PR TBD, awaiting
  merge go-ahead.

- **ME, RI, MT (batch-tier segment 4, §6 step 6, built as one three-state batch, ME first,
  then RI, then MT — each built fully before the next, in a strict chain within this
  batch's own worktree/branch appended after OK's entry)** — the first BATCH-tier segment
  of this plan's engine build-out (individual tier closed at OK, pending AL/KY's eventual
  rebase reconciliation). AL, KY, and this plan's other three batch-tier segments
  (CT/UT/IA/AR; MS/NM/NE; ID/WV/NH) were ALL concurrently in-flight, not yet merged, as of
  this batch's build — not read or coordinated with; a human reconciles the eventual
  rebase chain, same pattern as MO-vs-TN/IN and AL/KY-vs-OK. Built all three states'
  `StatePolicy` entries AND full 92-profile oracle coverage from scratch (all three were
  genuine blank slates — no `StatePolicy`, no oracle coverage at all before this batch),
  translating each state's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/{me,ri,mt}/`, PROVENANCE.md + supplements.json [+
  freshness.json for ME], all built 2026-08-12) into the engine's stricter typed shape per
  §5's process — re-verification against each corpus's own primary sources, not fresh
  research.

  **Maine** — bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis: "calendar_year", the
  most structurally unusual finding this batch made and the one this build spent the most
  care disclosing correctly rather than guessing: 10-144 C.M.R. Ch. 301, § 999-3's Chart 3
  carries a 165% FPL column, but its own header text scopes it precisely to a household-
  COMPOSITION test for elderly/disabled roommates establishing a separate household
  (Section 111-1(2)(c)) — NOT a categorical-eligibility income ceiling, the way a reader
  skimming only percentages could easily assume. Maine's REAL BBCE ceiling is Chart 4's
  200% FPL test (raised from 185% to 200% effective July 2022 under 22 M.R.S. § 3104(13)),
  and Chart 4 updates on a CALENDAR-YEAR cycle distinct from Charts 1-3's federal-fiscal-
  year cycle — MA is this file's only other `calendar_year` entry, and Maine's own corpus
  independently confirms the same structural shape rather than copying it.
  `bbce_fpl_basis` is documentary only (grep-confirmed: no gate consumes it anywhere in
  this engine), so this finding changes nothing behaviorally, but is disclosed for
  accuracy. asset_waiver: true (Chart 9: the BBCE-majority population has carried no
  resource limit since CY2022). sua_by_tier fully populated, a clean 3-tier mapping
  despite Maine's own distinctive tier names: FSUA $1,096 -> HCSUA, NHUA $598 -> LUA, PhUA
  $114 -> phone. drug_felony_ban: "none" — this batch's flagship correction: 22 M.R.S.
  § 3104(14), read directly and in full, states plainly that an otherwise-eligible person
  "may not be denied assistance because the person has been convicted of a drug-related
  felony," correcting a February 2026 prisonpolicy.org 50-state survey that had
  categorized Maine as NOT opted out — the corpus pack's own research traced the likely
  error to a conflation with 22 M.R.S. § 3104(15), a separate, narrower disqualification
  for certain post-2018 violent-crime/sexual-assault felonies conditioned on supervision
  non-compliance, which this engine has no facts-level axis for either (immaterial to all
  92 oracle profiles). abawd_waiver_avail: false (Maine's FY2025 213-area geographic
  waiver expired 9/30/2025; USDA's own tracker shows no FY2026 renewal). rmp_operated:
  false (absent from USDA's current RMP state list; no pending ME RMP legislation found —
  a genuine, disclosed negative result).

  **Rhode Island** — bbce: true / bbce_threshold_pct: 185, the axis that needed the
  deepest read of this engine's OWN mechanics (not just the corpus) to encode correctly.
  RI's own DHS publishes a genuinely TWO-TIER gross-income ceiling (185% general / 200%
  elderly-disabled, 218-RICR-20-00-1 § 1.5.1), but this engine's `grossTestApplies()`
  (gates/income-tests.ts) already skips the gross-income test UNCONDITIONALLY for any
  elderly/disabled household — state-independent — before `bbce_threshold_pct` is ever
  read for that household; read together with `verdict.ts`'s `bbceConferred` logic (which
  can only become true INSIDE the gross-test block E/D households never enter), RI's real
  200% E/D ceiling has ZERO reachable consequence in this engine, confirmed by direct
  source read, not assumed. `185` is therefore the only load-bearing value — it governs
  every non-E/D RI household, the population this field actually reaches. asset_waiver:
  true (§ 1.5.5(B)(2)(b): every cat-elig pathway, including the 185%/200% "expanded" one,
  is resource-test-exempt). sua_by_tier: HCSUA $844 (RI's single combined SUA tier,
  bundling heat/cooling/cooking-fuel/electricity/phone/water/sewer/trash) / phone $26; LUA
  set to $0, NEVER FABRICATED — RI's own regulation publishes no second non-heat-utility
  standard at all (directs that household to ACTUAL expenses instead), the same disclosed-
  gap shape as this file's VA entry; understates (never overstates) the shelter deduction
  for the small LUA-tier subset, the conservative direction, and independently verified to
  never flip a verdict. drug_felony_ban: "none" — a VERIFIED FULL OPT-OUT confirmed as a
  genuine minority position via primary-source read rather than accepted at face value:
  R.I. Gen. Laws § 40-6-8(d) states the opt-out in full, corroborated by a full read of
  RI's own 268-page SNAP regulation finding NO drug-felony-conviction provision anywhere
  in it. abawd_waiver_avail: false (USDA's own tracker shows RI's most recent entry as
  FY2025 only, no FY2026 renewal) — disclosed, not conflated with RI's SEPARATE
  implementation-timing choice to delay its own OBBBA ABAWD rollout to 3/1/2026 (a date-of-
  effect decision, not a geographic waiver; immaterial to all 92 profiles, none of whose
  ABAWD dates fall in the 11/1/2025-3/1/2026 window this would affect). rmp_operated:
  true — RI's first `true` value in this batch (DHS's own Online Purchasing & Restaurant
  Meals Program page), though a narrow one (nine Subway locations only); documentary only,
  no engine consumer, grep-confirmed.

  **Montana** — bbce: true / bbce_threshold_pct: 200 / bbce_fpl_basis:
  "federal_fiscal_year" (SNAP 304-1's Expanded Categorical Eligibility, gross-income-only,
  no resource test — a clean fit for this engine's existing BBCE mechanism; a SEPARATE
  Traditional CE path for TANF/Tribal TANF/SSI cash recipients maps to this engine's
  existing pure-cash `cat_elig` path). asset_waiver: true (ECE households face no resource
  test; the narrower "regular" track still faces the real $3,000/$4,500 limit).
  sua_by_tier — a genuine FOUR-real-tier structure this build discloses rather than
  silently collapses: SNAP 602-4 publishes SUA $799 (heating/cooling), LUA $267 (2+
  non-heat utilities), a SEPARATE OUA $116 (exactly one non-heat utility), and Telephone
  $34. This schema's three real tiers derive from `determineSUATier`'s single LIMITED
  branch (no utility-COUNT dimension) — the same naming-collision mapping trap this file's
  OH/MO/CO entries already document; MT's $267 LUA (2+ utilities) maps to this schema's
  `LUA` slot, NOT the differently-scoped $116 OUA, the disclosed unmapped 4th tier.
  drug_felony_ban: "modified" — a genuine, disclosed CORRECTION of a widely-repeated
  secondary-source oversimplification (a Propel guide states flatly "Montana won't
  disqualify you because of a drug felony"): MT DPHHS's own manual text, appearing
  word-for-word across three separate sections (SNAP 001, SNAP 304-1, SNAP 602-4),
  disqualifies a person convicted after 08/22/96 of a drug felony "AND not complying with
  conditions of supervision" — a real, conditional restriction, neither a full opt-out
  like ME's/RI's nor no-restriction like the secondary source claimed; no standalone MCA
  statute found for this specific condition (implemented via DPHHS policy/administrative
  rule, not a legislative opt-out). abawd_waiver_avail: false — the CLEANEST, most
  directly-confirmed zero-waiver statement this file has recorded for any state: MT
  DPHHS's own SNAP 802-1 states in full, "As of 11/01/2025, there are no areas within
  Montana with approved ABAWD geographic waivers," a plain primary-source statement, not
  an inference drawn from a federal tracker's absence the way ME's/RI's own entries above
  had to rely on. rmp_operated: false (absent from the corpus's independently-corroborated
  9-state RMP list; MT does carry the standard narrower federal congregate/meal-delivery
  provision, a distinction the corpus pack draws explicitly so the two are never
  conflated).

  Common to all three: no county-level ABAWD lookup needed or added for any state
  (waiverCountiesFor only covers CA/MA today; each state's uniform-statewide answer has no
  county-level nuance for a lookup to represent). Not representable in this schema, and
  not silently dropped, for any of the three: the SAME pre-existing gap class already
  filed as #824 (Facts-shape/mechanism gaps — ME's LIHEAP-receipt axis and narrower
  post-2018 felony provision; RI's LUA/actual-non-heat-expense mechanism and 2-vehicle
  cap; MT's OUA/LUA naming-collision and DPHHS-policy-not-statute drug-felony condition) or
  the OH/MO/CO-precedented naming-collision class (MT's LUA/OUA specifically). No new
  GitHub issue filed for any of the three — every gap found is a per-state disclosed gap
  of an already-documented class, or (RI's two-tier BBCE structure) a case where this
  build confirmed the engine's EXISTING mechanics already produce correct behavior without
  needing a new axis, per this task's own instruction.

  Oracle: built ONE fresh, independent Python calculator (not derived from engine output,
  per #636) directly from `verdict.ts`/`benefit-calc.ts`/`gates/{income-tests,asset-test,
  abawd,student,composition,immigration,disqualifications,categorical}.ts`/`facts.ts`/
  `constants/federal-tables.ts`'s own read source (not just their doc-comments), mirroring
  every gate and the benefit-calc formula exactly, including `decimal.ts`'s half-up
  (`roundDollar`) and floor (`floorDollar`) rounding conventions — reused/parameterized by
  state policy across all three states in this batch per this task's own authorization,
  while still cross-validating fresh for each state per §5 step 4's discipline. ME's
  closest structural axis-twin among all 29 already-registered states is MASSACHUSETTS — a
  FULL match on every verdict-and-benefit-consequential axis (literally identical policy
  shape modulo SUA dollar figures); cross-validated 129/129 exact match (verdict AND
  benefit, all 92 base profiles plus all 37 variant rows) reproducing MA's already-graded
  oracle under MA's own params, PLUS 34/34 against NJ, 129/129 against WI, and 129/129
  against CO (this batch's full cross-validation sweep, all four exact) before trusting
  the calculator for ME. RI's closest twin is NEW JERSEY on every verdict-consequential
  axis except abawd_waiver_avail (NJ holds a real Cape May/Camden waiver; RI holds none —
  an accurate divergence, not a mismatch); cross-validated 34/34 (verdict-only, matching
  NJ's own null-SUA-blocked shape) against NJ PLUS 129/129 (verdict AND benefit) against WI
  to exercise the full benefit-calc pathway with a real SUA figure, since NJ's null SUA
  alone couldn't. MT's closest twin is COLORADO — a FULL match, literally identical policy
  shape modulo SUA dollar figures; cross-validated 129/129 exact match against CO's
  already-graded oracle under CO's own params. Also checked all 37 non-`expected_by_state`
  variant rows across the 18 variant profiles directly under each state's own params for a
  state-specific `verdict_by_state` override — found ZERO divergence for all three states
  (matching NC's/VA's/MD's/CO's/LA's zero-override precedent, not MO's/SC's/OK's one-
  override result). Authored all 92 `expected_by_state` entries for each state: ME 80
  APPROVE / 12 DENY, RI 79 APPROVE / 13 DENY, MT 80 APPROVE / 12 DENY. RI's one extra DENY
  (vs. ME's/MT's 80/12) is independently confirmed to be exactly
  `MX4-bbce-max-income-with-any-benefit` ($4,440 gross HH3 clears every 200%-BBCE state's
  threshold in this file but falls $2 short of RI's own 185% ceiling, $4,109 HH3) — the
  same profile and reason NJ's own 185%-threshold build already found, an independent
  corroboration the divergence is a real policy consequence of the lower threshold, not a
  calculator bug; confirmed by direct diff against ME's DENY set (12/12 identical, MX4 the
  sole addition).

  Verification: `/profile-simulation state=ME` / `state=RI` / `state=MT` — all THREE
  129/129 PASS, 0 FAIL, 0 SKIP (clean, matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/
  NC/VA/IN/MO/MD/CO/SC/LA/OK's bar, not PA's/NJ's/TN's/MN's SKIP-heavy shape — all three
  states' real, current SUA figures meant none needed PA's/NJ's/TN's null-SUA fallback,
  despite RI sharing NJ's 185% threshold). Every other registered state's harness run
  reconfirmed unchanged from its documented baseline after EACH of the three states landed
  (checked individually, not spot-checked, after ME, again after RI, again after MT):
  CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/CO/SC/LA/OK all 129/0/0; NY
  127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 — every one identical to its
  documented baseline at every checkpoint, zero regressions introduced by any of the three
  states. `tsc --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests pass (0
  new — a schema-conformant pure addition needed no new unit tests for any of the three
  states), 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  `packages/demeter-engine` (all three corpora were already complete and out of scope) or
  any other state's `StatePolicy`/oracle coverage. This is the fourth batch-tier segment
  (§6 step 6) — CT/UT/IA/AR, MS/NM/NE, and ID/WV/NH remain, all three concurrently
  in-flight as of this build, not yet merged; DE/SD/ND, VT/WY/DC, and VI remain
  unstarted. PR TBD, awaiting merge go-ahead.

- **AL (individual tier, §6 step 3, ninth state after NC/NJ/VA/TN/IN/MO/MD/CO — SC's own PR
  #846 was open/CI-green but not yet merged as of this build; not coordinated with, per the
  task's own instruction that a human reconciles the eventual rebase, the same pattern
  MO's/AL's own entries above already used for a concurrently-in-flight state)** — built
  Alabama's `StatePolicy` entry AND full 92-profile oracle coverage from scratch (AL had
  neither before this PR), translating AL's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/al/`, PROVENANCE.md + supplements.json +
  freshness.json + authorities.json, built 2026-08-12 from a direct curl fetch of Alabama
  DHR's current per-chapter POE Manual and current Form 1942) into the engine's stricter
  typed shape per §5's process.

  STRUCTURAL FINDING this file had not carried in exactly this shape before: `bbce: true` /
  `bbce_threshold_pct: 130` is a genuine DUAL-TRACK BBCE (closest precedent: Georgia's own
  "BBCE is not income relief" entry) — AL POE § 210(B) extends Expanded Categorical
  Eligibility at 130% FPL generally, OR 200% FPL ONLY for households where every member is
  elderly or disabled AND net income also clears 100% FPL. 130 is the correct
  general-population screen (matching GA's own "record the screen that binds for a regular
  household" precedent); the elevated 200%-for-all-E/D pathway is not separately modeled —
  but unlike GA's entry, this gap is LARGELY SELF-MITIGATING: `gates/income-tests.ts`'s
  existing federal default already routes any E/D-containing household around the gross
  test entirely and straight to the 100% FPL net test, which is exactly the ceiling AL's
  elevated tier separately requires. Independently checked computationally against all 129
  rows (92 base + 37 variants) for the one theoretical residual gap (an E/D household whose
  net clears 100% FPL from a large deduction stack while its gross exceeds 200% FPL) — zero
  such rows exist in this fixture, so the unmodelled sub-screen flips zero verdicts here,
  the same "checked, not assumed" discipline this file's other disclosed-limitation findings
  use. `bbce_fpl_basis: federal_fiscal_year` is an honest inference (AL's manual states no
  explicit FFY-vs-calendar framing), following this file's established TN-precedent default.

  `asset_waiver: true` — AL POE § 210(B) states plainly: "Households qualifying under
  EITHER pathway are exempt from the asset (resource) test" — a cleaner, more direct finding
  than GA's own `false` (GA's TCOS cat-elig does NOT waive the asset test; Alabama's
  genuinely does). `allotment_tier: "48"` — AL's own confirmed Standard Deduction
  ($209/$209/$209/$223/$261/$299, DHR Form 1942 Rev. 10/25) matches federal-tables.ts's
  FY26 snapshot exactly, the same shared-source signal this file's NC/VA/MO/MD/CO entries
  use.

  `drug_felony_ban: "modified"` — this pack's flagship finding, and a genuine CORRECTION to
  an oversimplified widely-repeated secondary-source claim (a 2022-era Equal Justice
  Initiative article reads as saying Alabama retains the unmodified federal lifetime ban).
  AL POE § 101(f) implements Ala. Code § 38-1-8 (Act 2015-185, § 12, eff. ~Jan. 30, 2016): a
  person otherwise disqualified for a drug-related felony becomes SNAP-eligible upon
  completing their sentence, OR while satisfactorily serving probation (including completing
  mandatory drug treatment) — DHR's own manual text confusingly calls the disqualification
  "permanent" in one sentence and describes the statutory pathway back in the very next.
  Justia and FindLaw both 403'd the statute's own text — resolved via convergent secondary
  corroboration (AL Reporter, Alabama Today) cross-checked against DHR's own primary manual
  text, the same access pattern this file's PA/IN entries already disclose.

  `abawd_waiver_avail: false` — an AFFIRMATIVELY SOURCED, currently-zero finding: ABAWDMap.us
  confirms Alabama holds ZERO ABAWD waivers anywhere in the state ("No waiver — rule
  applies"), including its historically high-unemployment Black Belt region (18 rural
  counties, specifically checked given the region's economic profile per the task's own
  prompt) — same uniform-statewide-zero-waiver shape as this file's VA/MO/TN/MD/CO entries,
  no county lookup needed. `rmp_operated: false` — Alabama is absent from USDA FNA's current
  RMP state list; AL POE § 1107 describes exactly one restaurant/prepared-meal mechanism,
  expressly limited to homeless SNAP recipients — no broader elderly/disabled RMP option
  exists, unlike MD's or VA's statewide programs.

  `sua_by_tier: null` — a genuine, disclosed RESEARCH GAP, same discipline as PA's/NJ's/
  TN's/MN's null entries: AL POE § 903(F)-(J) describes the SUA/BUA/Telephone Standard
  STRUCTURE in full, but every dollar figure is deferred to an internal "Basis of Issuance
  Chart" this pack could not locate at any public DHR URL.

  A genuine ACCESS-ARTIFACT finding carried into this entry's provenance, not itself an
  engine value: dhr.alabama.gov hosts a SECOND, materially stale 2022-vintage "Appendix I"
  POE manual PDF, still live and easily surfaced by an ordinary search, with pre-OBBBA ABAWD
  rules and FFY2022 dollar figures — nothing on either DHR page flags it as superseded.
  Every figure in this entry traces to apps.dhr.alabama.gov's CURRENT per-chapter manual and
  Form 1942 (Rev. 10/25) ONLY.

  Not representable in this schema, and not silently dropped: AL POE § 802 excludes ALL
  vehicles as a resource regardless of type (matching MO/MD/CO's blanket pattern),
  immaterial regardless since `asset_waiver: true` means the resource test never runs; AL
  POE § 903(C)'s flat $185 Standard Medical Deduction shortcut (matching MO's/CO's
  flat-shortcut pattern) is NOT modeled by `benefit-calc.ts`'s actual-expense-over-$35-floor
  mechanism — UNLIKE MO's/CO's own "zero profiles affected" finding, this one genuinely IS
  material: `MX1-arguable-max-e-d-deduction-stacked-3000-gross` is the sole determinate
  ("none"-tier) profile with a qualifying ($900/mo) medical expense, and independently
  verified to compute a DIFFERENT benefit dollar amount under each mechanism ($546 via the
  engine's actual mechanism, authored below, vs. $273 under AL's true flat-then-actual-excess
  policy) — the verdict is unaffected (APPROVE either way), but the benefit amount genuinely
  differs; authored per the engine's actual mechanism, same convention every other state's
  benefit figure in this file follows, with the discrepancy disclosed rather than silently
  accepted. Conversely, AL POE § 903(E)'s treatment of legally obligated child support as an
  ORDINARY DEDUCTION is NOT a gap for Alabama — `benefit-calc.ts`'s own child-support
  mechanism already IS the ordinary-deduction mechanism, so AL is one of the states where the
  engine's one hardcoded mechanism happens to already match real policy, unlike NJ's/VA's/
  MO's/CO's income-exclusion states (#824). No engine axis exists for certification-period
  length (AL's own 12-month standard, including for ABAWDs — closer to MD's 12-month pattern
  than CO's/SC's 6-month baseline).

  Oracle: AL's closest structural axis-twin among all 26 already-registered states is OHIO —
  identical `bbce_threshold_pct` (130, an exact numeric match, not just "both under 200"),
  identical `asset_waiver` (true), identical `allotment_tier` ("48"); OH's `drug_felony_ban`
  ("none") differs from AL's ("modified") in label only — both fail open at
  `gates/disqualifications.ts`'s gate, so the two states are behaviorally identical on every
  drug_felony-tagged profile. Built a fresh, independent Python calculator (not derived from
  engine output, per #636) directly from `verdict.ts`/`benefit-calc.ts`/`gates/
  {income-tests,asset-test,abawd,student,composition,immigration,disqualifications,
  categorical}.ts`/`facts.ts`/`constants/federal-tables.ts`'s own read source (not just their
  doc-comments), mirroring every gate and the benefit-calc formula exactly, including
  `decimal.ts`'s half-up (`roundDollar`), floor (`floorDollar`), and ceiling (`ceilDollar`)
  rounding conventions. Cross-validated BEFORE trusting it for AL: 129/129 exact match
  (verdict AND benefit, all 92 base + all 37 variant rows, zero mismatches) reproducing OH's
  already-graded oracle under OH's own StatePolicy params. Since OH's `abawd_waiver_avail`
  (true) differs from AL's (false), this cross-validation exercises every mechanic except the
  ABAWD-waiver-exemption branch itself (a single boolean read, independently verified by
  direct code inspection). Separately cross-validated the calculator's null-SUA
  SKIP-detection and SUA-sweep-invariance-proof mechanics specifically — the pathway AL
  itself needs — by reproducing TN's already-graded null-SUA oracle under TN's own params:
  34/34 exact match on TN's determinate rows, 54/55 exact match on TN's null-SUA-blocked rows
  (the sole "mismatch," `MX4-bbce-max-income-with-any-benefit`, correctly REPRODUCES TN's own
  already-documented #830 net-ceiling-architecture-gap divergence, not a calculator bug), and
  36/37 exact match on TN's 37 variant rows (the sole remaining "mismatch,"
  `P58-elderly-retiree-tips-over-net-limit`'s `above_net_limit` variant, independently
  reproduces TN's own already-documented genuine indeterminacy — the sweep found both
  APPROVE and DENY, confirming, not contradicting, TN's finding). Also checked all 37 rows
  across the 18 non-`expected_by_state` variant profiles directly under AL's own params for
  an AL-specific `verdict_by_state` override — found exactly ONE real divergence:
  `M23-variable-gig-income-anticipation`'s two variants ($1,800 and $2,200 gross HH1) clear
  every 200%/185%-BBCE state's threshold but fail AL's 130% screen — authored `"AL": "DENY"`
  into both variants, matching KS's/MO's/IN's/OH's/GA's own already-authored 130%-or-federal
  value exactly. `P58`'s `above_net_limit` variant is genuinely indeterminate under AL's own
  SUA sweep too (same finding PA/NJ/TN already made) — no override authored.

  Authored all 92 `expected_by_state.AL` entries — a genuine FULL-COVERAGE result unlike
  TN's 89-of-92 (AL's own 130% general-population screen has no compounding net-ceiling
  ambiguity the way TN's uniform 200% screen did, so all 58 null-SUA-blocked profiles proved
  SUA-invariant, zero genuinely indeterminate): 34 determinate (32 APPROVE / 2 DENY, real
  computed benefit) + 58 null-SUA-blocked (40 APPROVE / 18 DENY, benefit: null,
  SUA-invariance-proven across the same $0-$1,500 sweep PA/NJ/TN/MN used) = 72 APPROVE / 20
  DENY overall. AL's DENY set is a strict superset of NC's/VA's/MD's/CO's 12-profile DENY set
  (the same 12, plus 8 additional gross-income-margin profiles — D01, G06, M01, M04, M06,
  MX3, MX4, P59 — that clear 200% FPL but fail AL's lower 130% screen), and differs from OH's
  19-profile DENY set by exactly ONE profile (`M12-abawd-in-a-waived-area`, attributable
  purely to `abawd_waiver_avail`) — both directional differences independently confirmed
  against the raw income/threshold math. Full coverage in the FIXTURE does not mean full
  coverage in the GRADE: `composeVerdict`'s own null-SUA guard SKIPs any profile whose
  `sua_tier` isn't "none"/homeless BEFORE ever consulting the independently-proven invariant
  verdict this oracle carries — the fixture is authored for when a real SUA figure eventually
  lands, the same reason PA's/NJ's/TN's/MN's oracles already exist despite an unavoidably
  SKIP-heavy real grade.

  Verification: `/profile-simulation state=AL` — 34 PASS / 0 FAIL / 95 SKIP (of 129),
  matching PA's/NJ's/TN's exact SKIP-heavy shape (not CA/MA/.../CO's clean 129/0/0 bar) —
  every SKIP attributable to the documented null-SUA guard, no PARAMS_MISMATCH, 0 FAIL.
  Every other registered state's harness run reconfirmed unchanged from its documented
  baseline, all 26 pre-existing states checked individually (not spot-checked):
  CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/CO all 129/0/0; NY 127/2/0; AZ
  128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 — every one identical to its pre-AL documented
  baseline, zero regressions. `tsc --noEmit -p packages/snap-rules` clean, 323/323 snap-rules
  tests pass (0 new — a schema-conformant pure addition needed no new unit tests), 44/47
  profile-harness tests pass (3 pre-existing skips). Did not touch `packages/demeter-engine`
  (AL's corpus was already complete and out of scope) or any other state's
  `StatePolicy`/oracle coverage, including SC's still-open, unmerged PR #846. No new GitHub
  issue filed — every gap found (the stale-duplicate PDF trap, the unmodelled all-E/D 200%
  sub-screen, the null SUA, the flat medical-deduction shortcut's MX1 impact, the blanket
  vehicle exclusion, the 12-month certification period) is a per-state disclosed gap of an
  already-documented class (#824-style Facts-shape/mechanism gaps, or the GA-precedent
  "sub-screen not yet modelled" acceptance), not a new engine architecture gap, per this
  task's own instruction. PR [#848](https://github.com/matthewgg22/Civica/pull/848),
  awaiting merge go-ahead.

- **KY (individual tier, §6 step 3, eleventh state after NC/NJ/VA/TN/IN/MO/MD/CO/SC/LA)** —
  built Kentucky's `StatePolicy` entry AND full 92-profile oracle coverage from scratch (KY
  had neither before this PR), translating KY's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/ky/`, PROVENANCE.md + supplements.json +
  authorities.json, built 2026-08-12) into the engine's stricter typed shape per §5's
  process. At this build's START, two OTHER individual-tier builds were concurrently
  in-flight, NOT yet merged: Alabama (AL, state #10, PR open, based on an older commit
  before SC merged) and Louisiana (LA, state #11, PR #847, based on the current SC-merged
  tip). LA merged (PR #847) partway through this build's session; this branch was rebased
  onto the LA-merged tip of `origin/codex/rebuild-feb18` before finishing (KY's own entry
  therefore appends after LA's below, not after SC's). AL's work was NOT touched or
  coordinated with — it remains open; a human reconciles the eventual rebase chain (same
  MO-vs-TN/IN pattern this project has used before).

  `bbce: true` / `bbce_threshold_pct: 130` / `bbce_fpl_basis: federal_fiscal_year` — Kentucky
  calls its mechanism "Expanded Categorical Eligibility" (ECE), and its own corpus pack
  (Finding 6) flags it as a THIRD ECE/BBCE structural variant this roster has not seen
  before: KY OM Vol. 2 MS 3160/MS 3175/MS 5200 document a genuine DUAL-TRACK income ceiling
  — non-elderly/non-disabled ECE households stay at the ORDINARY 130% FPL gross ceiling (no
  expansion at all), while ONLY households in which EVERY member is elderly or disabled get
  the raised 200% FPL ceiling. This schema's single scalar `bbce_threshold_pct` cannot
  express a composition-conditioned dual ceiling; `130` is set following the SAME
  accepted-limitation reasoning this file's NY entry already established (default/general
  tier, under-approving the narrow all-elderly/disabled 200% population is the safer
  direction of error). Independently verified this has zero effect on KY's oracle coverage:
  none of the 92 base profiles model an all-elderly/disabled multi-member household between
  130% and 200% FPL.

  `asset_waiver: true` — MS 3175 confirms both KY's CE and ECE paths waive the resource test
  entirely (CE also waives income; ECE households are tested only against MS 3160's dual
  gross ceiling above). `sua_by_tier` is FULLY POPULATED, not null — MS 5490/5498 (R.
  10/1/25, FFY2026) publish a flat, size-invariant SUA ($388/mo), BUA ($331/mo, already a
  2+-utility standard by KY's own definition — no naming-collision trap the way OH's/MO's/
  CO's LUA-slot gaps have), and a standalone Telephone Standard ($64/mo) — a clean 1:1
  function-based map onto HCSUA/LUA/phone. `allotment_tier: "48"` — KY's own Standard
  Deduction and $744 shelter cap match `federal-tables.ts`'s FY26 snapshot exactly; KY's
  asset limits ($3,000/$4,500, MS 5000) also match the current national figure, though
  PROVENANCE.md Finding 2 discloses KY's own CONSUMER-FACING page currently shows a stale,
  one-COLA-cycle-old pair ($2,250/$3,500) that the pack treats as a genuine staleness finding
  on KY's own website, not the operative figure (the more recently, more specifically dated
  policy manual controls, and resources are waived for most KY households regardless).

  `drug_felony_ban: "none"` — a VERIFIED FULL STATUTORY OPT-OUT and a genuine roster FIRST:
  PROVENANCE.md Finding 0 reports NO HTTP access barrier on any Kentucky government host,
  including a direct, successful full-text read of the opt-out statute itself (KRS 205.2005,
  eff. 6/29/2021) from Kentucky's own legislature.ky.gov database — a departure from the
  Justia-403 pattern this roster has hit repeatedly for equivalent statutes in LA/VA/IN/MO/
  MD/CO/SC/AL. Independently corroborated by omission: KY's own CURRENT disqualification
  lists (MS 3455, MS 5520) carry no drug-felony category. Disclosed, not silently dropped:
  two internal manual artifacts (MS 5040 dated 2010, MS 7070 dated 4/1/2021) still reference
  drug-felony language; both are treated as stale, unscrubbed artifacts, not evidence of an
  active ban, since KY's most-recently-dated lists control and match the statute.

  A separate finding, NOT modeled and not filed as a new issue: Kentucky also actively
  disqualifies SNAP members $500+ delinquent on legally-obligated child support THEY OWE (MS
  2380/2385, via the KASES data match) — an entirely different, optional state mechanism from
  the federal drug-felony ban, and one PROVENANCE.md notes is "not something this pack found
  explicitly documented in this roster's prior states' packs." `Facts` has no field for a
  child-support-arrearage amount and `gates/disqualifications.ts`'s `disqual[]` tag
  vocabulary has no slot for it — a genuinely new disqualification-MECHANISM gap, but treated
  the same way as SC's vehicle-per-licensed-driver/SMED findings immediately above (an
  already-documented CLASS of "no representable slot" gap): zero of the 92 profiles model an
  arrearage scenario, so it has no practical effect on KY's oracle coverage today.

  `abawd_waiver_avail: false` — PROVENANCE.md Finding 4 (flagship, time-sensitive): all 120
  KY counties became ABAWD-subject 11/1/2025, but a narrow FIVE-county Appalachian waiver
  (Elliott, Lewis, Magoffin, Martin, Wolfe) took effect 12/1/2025. A state-level boolean
  cannot express "5 of 120," and no `KY_WAIVER_COUNTY_FIPS` lookup exists — `false` follows
  the same reasoning as NY's/OR's/VA's/MO's/TN's/MD's/CO's/SC's entries (a small-minority
  waiver makes `false` the correct general-case default). PROVENANCE.md also discloses an
  unresolved aggregator conflict (ABAWDMap.us, "last verified June 16, 2026," does not
  reflect the 5-county waiver) — KY's own, more recently and more specifically dated primary
  source is treated as authoritative. `rmp_operated: false` — confirmed absent from USDA
  FNA's current Restaurant Meals Program state list, cross-checked against this file's MO/
  IN/TN/SC entries' own independent fetches of the same list.

  Oracle: KY's closest structural axis-twin among all 27 already-registered states (NOT AL
  or LA, neither merged as of this build) is NEW YORK — matching ALL 6 axes that materially
  affect grading exactly (`bbce: true`, `bbce_threshold_pct: 130`, `asset_waiver: true`,
  `drug_felony_ban: "none"`, `abawd_waiver_avail: false`, `allotment_tier: "48"`), differing
  only in `rmp_operated` (NY `true` vs KY `false`), which has NO consumer anywhere in
  `verdict.ts`/`benefit-calc.ts` (grep-confirmed) — a practically EXACT match, stronger than
  any twin this roster has used (SC's own TX twin differed on the materially consequential
  `bbce_threshold_pct`). Built a fresh, independent Python calculator (not derived from
  engine output, per #636) directly from `verdict.ts`/`benefit-calc.ts`/`gates/{income-tests,
  asset-test,abawd,student,composition,immigration,disqualifications,categorical}.ts`/
  `facts.ts`/`constants/federal-tables.ts`'s own read source, mirroring every gate and the
  benefit-calc formula exactly, including `decimal.ts`'s half-up (`roundDollar`), floor
  (`floorDollar`), and ceiling (`ceilDollar`) rounding conventions. Cross-validated BEFORE
  trusting it for KY: 92/92 exact match (verdict AND benefit) reproducing NY's already-
  authored `expected_by_state.NY` oracle under NY's own `StatePolicy` params. Of the 37
  non-`expected_by_state` variant rows, 35/37 matched NY's existing `verdict_by_state`
  entries or shared default exactly; the remaining 2 (`M23-variable-gig-income-anticipation`'s
  two variants) are NOT calculator errors — NY's own build never authored an NY-specific
  `verdict_by_state` override for M23, and the calculator's computed DENY for NY under NY's
  real 130% params is independently corroborated by EVERY other already-authored 130%-
  threshold state's own override on the same two rows (OH/GA/KS/MO/IN/SC all DENY) — a
  cross-check that CONFIRMS the calculator and surfaces a pre-existing, out-of-scope gap in
  NY's own coverage rather than undermining KY's build.

  As a second, independent sanity check, compared KY's own computed 92-profile DENY set (20
  of 92) against OH's, GA's, and SC's already-graded oracles, each varying from KY on exactly
  one comparison axis: KY's DENY set is OH's DENY set PLUS exactly
  `M12-abawd-in-a-waived-area` (explained by `abawd_waiver_avail: false` vs OH's `true`);
  KY's DENY set is GA's DENY set MINUS exactly `D02-over-asset-limit-non-bbce` and
  `M02-assets-3-500-asset-test-flip` (explained by `asset_waiver: true` vs GA's `false`);
  KY's DENY set is SC's DENY set MINUS exactly `M29-drug-felony-individual-state-option`
  (explained by `drug_felony_ban: "none"` vs SC's `"full"`) — zero unexplained divergence in
  any of the three comparisons, each triangulating a different axis independently.

  Also checked all 37 rows across the 18 non-`expected_by_state` variant profiles for a
  KY-specific `verdict_by_state` override, the same discipline every prior state's build
  used: found exactly ONE real divergence (matching MO's/SC's one-profile-two-variant
  precedent) — `M23-variable-gig-income-anticipation`'s two variants both clear a 200%/165%
  BBCE screen but fail KY's effective 130% ECE screen for the identical reason OH/GA/KS/MO/
  IN/SC already fail — authored `"KY": "DENY"` into both variants' `verdict_by_state` blocks.
  Authored all 92 `expected_by_state.KY` entries: 72 APPROVE / 20 DENY.

  Verification: `/profile-simulation state=KY` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/IN/MO/MD/CO/SC's bar, not PA's/
  NJ's/TN's/MN's SKIP-heavy shape — KY's real, current, non-null SUA figures mean it did not
  need PA's/NJ's/TN's null-SUA fallback). Every other registered state's harness run
  reconfirmed unchanged from its documented baseline, all 27 pre-existing states checked
  individually (not spot-checked): CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/
  CO/SC all 129/0/0; NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN all 34/0/95 — every one
  identical to its pre-KY documented baseline, zero regressions. `tsc --noEmit -p
  packages/snap-rules` clean, 323/323 snap-rules tests pass (0 new — a schema-conformant pure
  addition needed no new unit tests), 44/47 profile-harness tests pass (3 pre-existing
  skips). Did not touch `packages/demeter-engine` (KY's corpus was already complete and out
  of scope), LA's already-merged entry above, AL's still-concurrently-in-flight work, or any
  other state's `StatePolicy`/oracle coverage. No new GitHub issue filed — the child-support-
  arrearage disqualification-mechanism gap and every other finding above is a per-state
  disclosed gap of an already-documented class (#824/#825-style Facts-shape/mechanism gaps,
  or an NY-precedent multi-tier-BBCE accepted limitation), not a new engine architecture gap,
  per this build's own instructions. PR TBD, awaiting merge go-ahead.

- **CT/UT/IA/AR (first batch-tier segment, §6 step 6)** — built, one at a time in a strict
  chain within one branch, all four states' `StatePolicy` entries AND full 92-profile
  oracle coverage from scratch (none of the four had either before this PR), translating
  each state's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/{ct,ut,ia,ar}/`, all built 2026-08-12) into the
  engine's stricter typed shape per §5's process. Alabama's, Kentucky's, and Oklahoma's
  individual-tier builds were concurrently in flight as of this batch's build, not yet
  merged, and were NOT read or coordinated with — a human reconciles the eventual rebase
  chain, same pattern this project used for MO-vs-TN/IN and LA-vs-Alabama.

  **CT (Connecticut / DSS)** — bbce true / 200% / federal_fiscal_year (Expanded
  Categorical Eligibility, ECE), asset_waiver true, sua_by_tier HCSUA $976 / LUA $430 /
  phone $36 (CT's own, more-than-double-typical figure, plausibly its cold-climate heating
  profile per the corpus pack's own disclosed flag), drug_felony_ban "modified" (CGS
  § 17b-112d, three independent eligibility paths — sentence completed, satisfactorily on
  probation, or completing/completed treatment), abawd_waiver_avail false (CT DSS's own
  page: "Starting December 1, 2025, all towns in Connecticut will now follow special SNAP
  work rules for adults" — directly contradicting a "CT has a statewide ABAWD waiver" claim
  the corpus pack found repeated across multiple secondary sources), rmp_operated false,
  allotment_tier "48". ***GENUINE STRUCTURAL FINDING, but NOT a new architecture gap — the
  SAME gap TN's entry already found and filed as #830, cited here rather than re-filed:***
  CT's ECE explicitly does NOT waive the net (100% FPL) income test — CT DSS's own RCE and
  ECE explainer pages list only the asset limit and the 130% gross test as excluded for
  ECE (RCE's own list, by contrast, explicitly includes the net income limit too). Unlike
  TN (whose null-SUA gap blocks the income tests from ever running for most profiles), CT
  has a real SUA and computes all 92 profiles for real — the gap therefore surfaces
  directly: exactly ONE profile, `MX4-bbce-max-income-with-any-benefit`, diverges between
  the engine's actual (net-test-skipped) behavior and CT's true (net-test-enforced) policy.
  Authored MX4's TRUE value (DENY) rather than the engine's current buggy APPROVE,
  following NY's/AZ's established precedent that the oracle encodes the independently-
  computed correct answer even when it produces one documented, pre-known FAIL rather than
  silently encoding the engine's bug as "correct." Oracle: cross-validated a fresh Python
  calculator against WI (CT's exact axis-twin — all 5 non-SUA comparison axes identical)
  and, as a second independent check, KS — 92/92 + 37/37 exact match against each before
  trusting it for CT. CT's computed DENY set is WI's 12-profile DENY set plus MX4 as the
  13th. Authored 79 APPROVE / 13 DENY. Verification: `/profile-simulation state=CT` — 128
  PASS / 1 FAIL / 0 SKIP (of 129), the single FAIL being the disclosed #830 MX4 case,
  matching NY's 127/2 and AZ's 128/1 precedent for a documented, pre-existing engine-gap
  fail, not a coverage gap.

  **UT (Utah / DWS)** — bbce false (CONFIRMED, not corrected — DWS's own current Table 2
  publishes only the plain federal 130%/100% FPL tests, and Utah Admin. Code
  R986-900-902's own adopted-options list does not include BBCE), asset_waiver false,
  sua_by_tier **null** — a genuine, disclosed DISCOVERABILITY gap, same discipline as
  PA's/MN's/NJ's/TN's null entries: Utah Admin. Code R986-900-902(1)(d) confirms Utah's
  three utility standards exist and are updated annually but are "available upon request,"
  not published on any page the corpus pack's systematic search located — this entry
  explicitly declined to reuse a stale $376 (10/1/2021) figure several secondary
  aggregators still repeat. drug_felony_ban "none" (VERIFIED full opt-out, Utah Code
  § 35A-3-311(2)(a)-(b)), abawd_waiver_avail false (DWS's own current Policy 342, effective
  5/1/2026, already states the correct post-OBBBA 18-64 age range — a genuine positive
  contrast with several other states' stale ABAWD figures this roster's corpus packs have
  found — and Utah is absent from USDA's FY2025-2029 waiver index entirely), rmp_operated
  false, allotment_tier "48". Disclosed, not modeled: Utah's active federal soft-drink
  purchase-restriction demonstration (H.B. 403, effective 1/1/2026 for two years) — no
  engine axis exists for eligible-goods restrictions at all, zero effect on any oracle
  profile. Oracle: UT's closest axis-twin among all 29 already-registered states is
  KANSAS — the ONLY other null-SUA state that is ALSO non-BBCE (every other null-SUA
  state, PA/NJ/TN/MN, is BBCE-200) — 92/92 + 37/37 exact match under KS's own (real-SUA)
  params before applying UT's own null-SUA restriction as an isolated additive change. Of
  UT's 92 base profiles: 34 (sua_tier "none" or homeless_deduction) get a real computed
  verdict + benefit; the other 58 get an independently-computed verdict only (benefit:
  null), proven SUA-invariant via a 31-point $0-$1,500 sweep per profile — 0 of 58
  genuinely indeterminate. UT's computed DENY set (22 of 92) is IDENTICAL to KS's. Checked
  all 37 variant rows: authored 2 UT-specific overrides (both
  `M23-variable-gig-income-anticipation` variants → DENY, matching KS's own pattern); ONE
  genuinely indeterminate variant row (`P58-elderly-retiree-tips-over-net-limit`'s
  `above_net_limit`) left unauthored, the same already-silently-indeterminate case PA's/
  NJ's/TN's merged oracles all share. Authored 70 APPROVE / 22 DENY. Verification:
  `/profile-simulation state=UT` — 34 PASS / 0 FAIL / 95 SKIP (of 129), matching PA's/NJ's/
  TN's exact shape.

  **IA (Iowa / Iowa HHS)** — bbce true / bbce_threshold_pct **160** (a genuinely NEW
  threshold value in this file — no other registered state uses it), via the Promoting
  Awareness of the Benefits of a Healthy Marriage Program (PHMP), a TANF-block-grant-funded
  program with NO separate application (Iowa's ABC computer system determines PHMP
  eligibility automatically whenever a household applies for SNAP). Iowa's own manual
  confirms PHMP categorical eligibility "removes the resource limit and the gross AND net
  income limits" — genuinely waives BOTH remaining income tests, unlike CT's ECE above, so
  no #830-style architecture-gap disclosure was needed for Iowa. bbce_fpl_basis
  "federal_fiscal_year" — an honest inference, same discipline as TN's entry: the corpus
  pack's own Finding 1 discloses Iowa's Employees' Manual runs on TWO different COLA
  cycles across chapters (Chapter E current FFY2026; Chapter C's PHMP/165% tables stamped
  "Revised September 27, 2024," a cycle stale) — this staleness has zero effect on this
  entry's encoded values, since the engine computes IA's actual thresholds itself from
  federal-tables.ts, never from Iowa's own published percentage tables. asset_waiver true,
  sua_by_tier HCSUA (Iowa's "Big" SUA) $554 / LUA (Iowa's "Little" SUA) $292 / phone $36 —
  a naming-convention quirk, not a structural difference. drug_felony_ban "none" (VERIFIED
  full opt-out, and a STRONGER evidentiary basis than most of this file's "none" findings:
  Iowa's Employees' Manual states OUTRIGHT that a felony conviction "does lose certain
  rights of citizenship. However, these people are still considered to be citizens for the
  purposes of SNAP," independently cross-checked against the manual's own comprehensive
  Ineligible Members list, which carries no drug-felony category anywhere). abawd_waiver_
  avail false (Iowa is absent ENTIRELY from USDA's ABAWD Time Limit Waivers FY2025-2029
  state-response index, not merely lacking a currently-active waiver — no evidence Iowa
  has ever requested one in this window). rmp_operated false, allotment_tier "48". Oracle:
  IA's closest available axis-twin among all 30 already-registered states is NORTH
  CAROLINA (matching bbce/bbce_fpl_basis/asset_waiver/abawd_waiver_avail/allotment_tier,
  differing only on drug_felony_ban) — 92/92 + 37/37 exact match under NC's own params
  before applying IA's own 160% threshold. IA's computed DENY set (17 of 92) is NC's
  12-profile DENY set plus exactly 5 additional profiles (D01, M01, MX3, MX4, P59), every
  one carrying gross income in the ~165%-169% FPL band — under NC's 200% ceiling but over
  IA's 160% one, a precise demonstration of IA's genuinely lower threshold. Checked all 37
  variant rows: authored 1 IA-specific override (`M23-variable-gig-income-anticipation`'s
  `recent_high_month` variant → DENY; the `averaged` variant still clears IA's 160%
  screen). Authored 75 APPROVE / 17 DENY. Verification: `/profile-simulation state=IA` —
  129 PASS / 0 FAIL / 0 SKIP, clean.

  **AR (Arkansas / DHS)** — bbce **false**, THIS PACK'S FLAGSHIP FINDING: a genuine
  LEGISLATIVE self-restriction on DHS's own discretion (the same KIND of finding as this
  file's Oklahoma entry, different in SUBJECT). Arkansas Code § 20-76-115 (added by Act 675
  of 2023 / SB306, read in full from the Arkansas Bureau of Legislative Research's own
  emergency-rule filing reproducing the Act's enacted text verbatim) bars DHS from raising
  gross income standards above the plain federal 130% FPL, or granting income-based
  categorical eligibility, absent a separate federal waiver. asset_waiver **false** — a
  DELIBERATE, disclosed simplification: the SAME Act 675 also directs DHS to seek (and DHS
  obtained, per its own April 2025 emergency-rule filing) a federal waiver granting a
  TEMPORARY $5,500 asset limit, for up to 12 months, once every 5 years — this schema's
  flat `asset_waiver` boolean has no axis to express "raised, but only temporarily and
  rarely," so the conservative federal default ($3,000/$4,500) is encoded and the real
  mechanism disclosed inline instead, the same "accepted limitation" treatment this file's
  NJ (#824)/VA/SC entries already give a schema gap they can't fully represent. Arkansas's
  narrower ordinary categorical eligibility (SSI and/or TEA cash-assistance recipients
  only) still waives both tests as a plain federal mechanism, independent of this axis.
  sua_by_tier HCSUA $342 / LUA $274 / phone $51 (notably lower than several of this file's
  other recently-built states; retrieved via WebFetch after every direct curl attempt on
  DHS's PDF host returned a clean HTTP 403 — a disclosed access-barrier workaround using a
  different fetch path to the SAME primary source). drug_felony_ban "none" (VERIFIED full
  opt-out, Ark. Code § 20-76-409, via FindLaw's current-code mirror after Justia's own
  mirror 403'd). abawd_waiver_avail false — an AFFIRMATIVELY SOURCED finding but DISCLOSED
  as resting on a NINE-YEAR-STALE primary source, the oldest individually-dated section
  the corpus pack found anywhere in Arkansas's manual (§ 3501, dated "SNAP Manual
  01/01/17," stating "the state of Arkansas is currently not under a waiver"). rmp_operated
  false, allotment_tier "48". Disclosed, not conflated with RMP: Arkansas's narrower
  homeless-specific contracted-meal mechanism (Manual §§ 120-121, DHS-contracted
  restaurants only, negotiated reduced price) — no engine axis exists for it, and
  `rmp_operated` has no consumer anywhere in verdict.ts/benefit-calc.ts regardless.
  Oracle: AR's closest axis-twin among all 31 already-registered states is MISSOURI — all
  non-SUA comparison axes identical (bbce/asset_waiver/allotment_tier/abawd_waiver_avail/
  rmp_operated) — 92/92 + 37/37 exact match under MO's own params. AR's computed DENY set
  (22 of 92) is IDENTICAL to MO's — independently confirmed the temporary Act-675 $5,500
  asset provision this entry deliberately does not encode has zero effect on any of the 92
  profiles (no profile carries countable assets between $4,500 and $5,500; the fixture's
  asset values jump from $4,400 straight to $10,000). Checked all 37 variant rows:
  authored 2 AR-specific overrides (both `M23-variable-gig-income-anticipation` variants →
  DENY, matching MO's/UT's own pattern). Authored 70 APPROVE / 22 DENY. Verification:
  `/profile-simulation state=AR` — 129 PASS / 0 FAIL / 0 SKIP, clean.

  All four states built via the SAME fresh, independent Python calculator (not derived
  from engine output, per #636), mirroring `verdict.ts`/`benefit-calc.ts`/every
  `gates/*.ts` file/`facts.ts`/`constants/federal-tables.ts`'s own read source directly,
  including `decimal.ts`'s half-up (`roundDollar`) and floor (`floorDollar`) rounding
  conventions — reused and parameterized by state policy across all four states in this
  batch (per this task's own instruction), but cross-validated FRESH against a distinct
  already-merged twin for each state before being trusted for that state's own params (WI
  and KS for CT; KS for UT; NC for IA; MO for AR). Checked all 37 rows across the 18
  non-`expected_by_state` variant profiles for a state-specific `verdict_by_state` override
  for every one of the four states — CT found zero divergence, UT found 3 (2 real
  overrides + 1 indeterminate), IA found 1, AR found 2 — none silently dropped or guessed.

  Confirmed zero regression after EACH state was added, in the required strict chain (CT
  → UT → IA → AR), against every other already-merged registered state PLUS every state
  already added earlier in this same batch: CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/
  VA/IN/MO/MD/CO/SC/LA all 129/0/0 throughout; NY 127/2/0; AZ 128/1/0; MN 0/0/129; PA/NJ/TN
  all 34/0/95 — every one identical to its documented baseline at every checkpoint, zero
  regressions introduced by any of the four states. `tsc --noEmit -p packages/snap-rules`
  clean, 323/323 snap-rules tests pass (0 new — a schema-conformant pure addition needed no
  new unit tests), 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  `packages/demeter-engine` (all four corpus packs were already complete and out of scope)
  or any other state's `StatePolicy`/oracle coverage. No new GitHub issue filed — CT's
  #830 finding cites the already-filed issue rather than re-filing it; every other gap
  found (UT's null-SUA discoverability gap, AR's temporary-asset-limit schema
  simplification, AR's stale ABAWD-waiver source, AR's narrower RMP-adjacent mechanism) is
  a per-state disclosed gap of an already-documented class, not a new engine architecture
  gap, per this task's own instruction. Branch `feat/snap-rules-batch1-ct-ut-ia-ar`, PR
  TBD, awaiting merge go-ahead.

- **MS (batch tier, §6 step 6, first of the second batch-tier segment "MS, NM, NE")** —
  built Mississippi's `StatePolicy` entry AND full 92-profile oracle coverage from scratch
  (MS had neither before this PR), translating MS's already-merged Demeter corpus pack
  (`packages/demeter-engine/src/states/ms/`, PROVENANCE.md + supplements.json, built
  2026-08-12) into the engine's stricter typed shape per §5's process. This is the SECOND
  "batch tier" segment; the first (CT, UT, IA, AR) was concurrently in flight as of this
  build, not yet merged, and not touched or coordinated with — a human reconciles the
  eventual rebase chain, same pattern as MO-vs-TN/IN. AL, KY, and OK (individual tier)
  were also concurrently in flight, not yet merged.

  `bbce: false` — THIS PACK'S FLAGSHIP FINDING, a genuine CONFIRMATION (not a correction)
  of a claim several secondary sources already make: MDHS's current SNAP Policy Manual,
  Rule 15.1, limits categorical eligibility strictly to households where every member
  receives or is eligible for TANF and/or SSI (7 CFR 273.2(j)(2)) — no income-based
  Broad-Based/Expanded CE track exists. `asset_waiver: false` follows directly. `allotment_
  tier: "48"` — MS's own Standard Deduction figures match `federal-tables.ts`'s FY26
  snapshot exactly (Rule 18.2's 8.31%-of-net-income-standard formula, the same national
  minimum-standard-deduction formula 7 CFR 273.9(d)(1)(i) sets).

  `sua_by_tier: null` — a DISCLOSED, genuinely NEW combination for this file: MS is the
  FIRST non-BBCE null-SUA state (PA's/NJ's/TN's null-SUA entries are all BBCE states).
  MDHS's own manual (Rule 18.9) describes the SUA/BUA/telephone-allowance STRUCTURE
  precisely but defers dollar figures to a table the corpus pack could not locate, and
  USDA FNA's own national FY2026 SUA-values PDF returned a live Akamai bot-detection block
  (HTTP 403) to every direct fetch attempt. Populated as null rather than guessed, matching
  PA's/NJ's/TN's disclosed-gap discipline exactly.

  `drug_felony_ban: "none"` — CONFIRMED, not corrected: MDHS's Rule 22.14 states
  unconditionally that Mississippi opted out of the federal drug-felony ban effective
  2019-07-01 (Miss. Code Ann. §43-12-71), with no treatment-program requirement or
  probation-compliance condition found anywhere in MDHS's text — a genuinely UNCONDITIONAL
  opt-out. Because "none" behaves identically to "modified"/"unconfirmed" at today's gate
  (only "full" disqualifies, per #805), this classification has zero effect on MS's
  computed oracle. `abawd_waiver_avail: false` — a STRUCTURALLY DISTINCT finding: MS's
  waiver authority is gated to a formal natural-disaster declaration with the Governor's
  approval (Miss. Code Ann. §43-12-19), NOT the federal unemployment-rate criteria —
  currently zero active waivers statewide, including several historically waiver-eligible
  Delta counties. `rmp_operated: false` — absent from USDA's current RMP state list.

  Not representable in this schema, already filed as #824, not re-filed: MDHS excludes MOST
  vehicles from resources entirely (Rule 16.4.H, no fair-market-value threshold at all for
  on-road vehicles), matching this file's NC/MO/MD/CO/LA blanket-exclusion pattern;
  immaterial to every profile since none of the 92 model a recreational-vehicle resource.

  Oracle: MS's closest structural axis-twin among all 28 already-registered states is
  KANSAS — a FULL match on every axis that has a verdict/benefit consumer (bbce: false,
  bbce_threshold_pct: undefined, bbce_fpl_basis: null, asset_waiver: false,
  abawd_waiver_avail: false, allotment_tier: "48", rmp_operated: false; drug_felony_ban
  differs but has zero grading effect per #805). Built a fresh, independent Python
  calculator (not derived from engine output, per #636) directly from `verdict.ts`/
  `benefit-calc.ts`/`gates/{income-tests,asset-test,abawd,student,composition,immigration,
  disqualifications,categorical}.ts`/`facts.ts`/`constants/federal-tables.ts`'s own read
  source, mirroring every gate and the benefit-calc formula exactly, including
  `decimal.ts`'s half-up (`roundDollar`) and floor (`floorDollar`) rounding conventions.
  Cross-validated BEFORE trusting it for MS: 129/129 exact match (92 base + 37 variant
  rows, verdict AND benefit) reproducing KS's already-graded oracle under KS's own
  StatePolicy params, before applying MS's own null-SUA policy. Confirmed MS's computed
  DENY set is IDENTICAL to KS's DENY set across all 92 base profiles (22 DENY / 70 APPROVE,
  0 divergence) — a strong internal-consistency signal.

  Because `sua_by_tier` is null, MS's composer SKIPS (before any gate runs) for every
  profile with a non-"none" `sua_tier` and no `homeless_deduction` — the SAME shape PA's/
  NJ's/TN's null-SUA entries already established, but MS is the first NON-BBCE state to hit
  it. 32 of the 92 base profiles get a real computed benefit; the other 60 get a verdict-only
  entry (benefit: null), proven SUA-invariant via a $0-$1,500 sweep (step $50) — 0 of the 60
  were genuinely indeterminate at the base-profile level. One variant row IS genuinely
  indeterminate, matching a pattern already silently present in PA's/NJ's/TN's merged
  oracles: `P58-elderly-retiree-tips-over-net-limit`'s "above_net_limit" variant flips
  verdict depending on the (currently unconfirmed) real MS SUA figure — left deliberately
  unauthored, the same treatment PA's/NJ's/TN's already-merged P58 entries established. Two
  variant rows needed an MS-specific `verdict_by_state` override:
  `M23-variable-gig-income-anticipation`'s two variants — authored "MS": "DENY" into both,
  matching KS's/IN's/MO's already-authored value exactly.

  Verification: `/profile-simulation state=MS` — 34 PASS / 0 FAIL / 95 SKIP (of 129), every
  SKIP attributable to the documented null-SUA gap — matching PA's/NJ's/TN's exact 34/0/95
  shape, not the clean 129/0/0 bar the real-SUA states in this file clear. Confirmed zero
  regression: every other registered state's harness run unchanged from its documented
  baseline (CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/OH/KS/AK/NC/VA/IN/MO/MD/CO/SC/LA all 129/0/0;
  NY 127/2/0; AZ 128/1/0; PA/NJ/TN all 34/0/95; MN 0/0/129 — all pre-existing, none newly
  introduced). `tsc --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests pass (0
  new), 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  `packages/demeter-engine` or any other state's StatePolicy/oracle coverage. No new GitHub
  issue filed — every gap found (the null SUA, the vehicle-exclusion gap, the disaster-only
  ABAWD-waiver-authority structure) is a per-state disclosed gap of an already-documented
  class, not a new engine architecture gap. PR TBD, awaiting merge go-ahead.

- **NM (batch tier, §6 step 6, second of "MS, NM, NE")** — built New Mexico's `StatePolicy`
  entry AND full 92-profile oracle coverage from scratch, translating NM's already-merged
  Demeter corpus pack (`packages/demeter-engine/src/states/nm/`, PROVENANCE.md +
  supplements.json, built 2026-08-12) into the engine's stricter typed shape per §5's
  process.

  `bbce: true` / `bbce_threshold_pct: 200` / `bbce_fpl_basis: federal_fiscal_year` — a
  precisely-DATED CORRECTION: NMAC 8.139.420.8 (amended 3/1/2025) raised BBCE from 165% to
  200% FPG effective 2024-10-01; the corpus pack traced a stale "165%" figure several
  secondary/calculator sites still repeat to a specific, still-live, pre-rename PDF.
  `asset_waiver: true` — NMAC 8.139.420.8 exempts broad-based CE households from resource
  VERIFICATION specifically (not an income-test waiver — broad-based CE households still
  must meet BOTH the gross and net income standards). `sua_by_tier` — FULLY POPULATED, a
  genuinely CLEAN case (zero access barriers on HCA's own FFY2026 dollar-figure PDF): HCSUA
  $419, LUA $289, phone $51. `allotment_tier: "48"`.

  `drug_felony_ban: "modified"` — a genuinely DISCLOSED SCOPE AMBIGUITY: N.M. Stat. Ann.
  §27-2B-11(C) invokes the FULL federal opt-out provision but narrows its own scope to
  convictions "on the basis of... DISTRIBUTION of a controlled substance" specifically —
  Public Health Law Center's own analysis independently treats the possession/use scope as
  genuinely open, not resolved. "Modified," not "none," per #805's rule that a real,
  narrower-than-full restriction this engine can't yet model at the facts level gets
  "modified" regardless of a broader secondary-source characterization.

  `abawd_waiver_avail: true` — a genuine, precisely-dated REFINEMENT: NM's waiver footprint
  narrowed sharply (from 29 counties + 18 reservations) but did NOT fully disappear on
  2026-01-01 — HCA's own current page states the new statewide work rules do not apply in
  Luna County or four named Pueblos, a real, currently-active waiver footprint. Chosen
  `true` under this file's established "wrongly denying food is the worse error" reasoning.
  Deliberately did NOT build a per-county ABAWD lookup — four of the five waived
  jurisdictions are PUEBLOS, not counties, the same shape gap NJ's Camden-City finding
  (#825) already disclosed; a partial/wrong Set would be actively worse than the honest
  state-level fallback. `rmp_operated: false`.

  Not representable in this schema, already filed as #824, not re-filed: HCA's own state-
  funded supplement for elderly/disabled no-earned-income households ($32 → $100/month,
  same effective date as the BBCE change) — an additional top-up this engine's
  minimum-benefit mechanism doesn't model; zero of the 92 profiles affected since it's
  additive on top of, not a substitute for, the federal benefit this engine computes.

  Oracle: NM's closest structural axis-twin among all 29 already-registered states is
  OREGON — matching 6 of 7 comparison axes exactly (bbce/200/federal_fiscal_year,
  asset_waiver, allotment_tier, rmp_operated all identical; drug_felony_ban differs with
  zero grading effect), differing only in `abawd_waiver_avail` (NM: true, OR: false) — the
  one axis expected to produce a real, explainable divergence. Built a fresh, independent
  Python calculator (not derived from engine output, per #636), same source list as MS's
  build above. Cross-validated BEFORE trusting it for NM: 129/129 exact match (92 base + 37
  variant rows, verdict AND benefit) reproducing OR's already-graded oracle under OR's own
  StatePolicy params, before applying NM's own policy params.

  Confirmed the ONE expected divergence, and only that one: NM's computed DENY set is
  IDENTICAL to OR's DENY set MINUS `M12-abawd-in-a-waived-area`, which flips APPROVE for NM
  (matching this file's NJ's/PA's precedent) — 11 DENY / 81 APPROVE for NM vs OR's 12 DENY /
  80 APPROVE. Checked all 37 non-`expected_by_state` variant rows directly under NM's own
  params — found ZERO divergence from OR's already-graded values, no `verdict_by_state.NM`
  overrides needed. Authored all 92 `expected_by_state.NM` entries: 81 APPROVE / 11 DENY.
  Since NM's `sua_by_tier` is fully populated (unlike MS's null entry), every APPROVE
  profile gets a real, independently-computed benefit.

  Verification: `/profile-simulation state=NM` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/IN/MO/MD/CO/SC/LA's bar). Every
  other registered state's harness run reconfirmed unchanged from its documented baseline
  (CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/KS/OH/AK/NC/VA/IN/MO/MD/CO/SC/LA all 129/0/0; NY
  127/2/0; AZ 128/1/0; PA/NJ/TN/MS all 34/0/95; MN 0/0/129 — all pre-existing, none newly
  introduced). `tsc --noEmit -p packages/snap-rules` clean, 323/323 snap-rules tests pass (0
  new), 44/47 profile-harness tests pass (3 pre-existing skips). Did not touch
  `packages/demeter-engine` or any other state's StatePolicy/oracle coverage. No new GitHub
  issue filed — every gap found (the NM state-supplement mechanism, the drug-felony
  distribution-only scope ambiguity, the Pueblo-geography ABAWD-lookup gap) is a per-state
  disclosed gap of an already-documented class (#824/#825-style Facts-shape/mechanism
  gaps), not a new engine architecture gap. PR TBD, awaiting merge go-ahead.

- **NE (batch tier, §6 step 6, third and final of "MS, NM, NE")** — built Nebraska's
  `StatePolicy` entry AND full 92-profile oracle coverage from scratch, translating NE's
  already-merged Demeter corpus pack (`packages/demeter-engine/src/states/ne/`,
  PROVENANCE.md + supplements.json, built 2026-08-12) into the engine's stricter typed
  shape per §5's process.

  `bbce: false` — THIS PACK'S FLAGSHIP STRUCTURAL FINDING, a genuine NEW SHAPE this file
  hadn't documented before: Nebraska's DHHS SNAP Program Standards table DOES publish an
  elevated 165% FPL gross-income column, but its own column header reads "Maximum Gross
  Monthly Income for an Elderly, Disabled, Separate Household and ERP Households" — SCOPED
  to four specific household types, NOT a blanket ceiling. An ordinary working-age
  household not enrolled in Nebraska's own Expanded Resource Program (ERP) remains subject
  to the plain federal 130% FPL gross test. Because this engine's `Facts` shape has no
  ERP-enrollment axis, and because E/D households already skip the federal gross test
  entirely regardless of any state's BBCE posture (the SAME outcome NE's own 165% E/D
  column produces via a different mechanism), `bbce: false` is the ACCURATE description of
  NE's actual policy for every population this engine can represent — checked carefully
  against whether this constitutes a genuine engine architecture gap (the TN #830
  net-income-ceiling precedent) and found NOT to be one: unlike TN's gap (a real mismatch
  for households the engine DOES model), NE's `bbce: false` correctly describes every
  population this engine's Facts shape can represent; the ERP-enrollment axis itself is a
  #824-style Facts-shape gap, not a mismatch in how an existing axis applies. No new issue
  filed as a result.

  `asset_waiver: false` — NE's ERP does NOT waive the resource test; it instead RAISES the
  ceiling to a specific, still-enforced $25,000 liquid-resource figure, a genuine
  structural departure this engine's schema has no slot for (immaterial — zero of the 92
  profiles model ERP enrollment). `sua_by_tier` — FULLY POPULATED: HCSUA $615, LUA $321,
  phone $54 (DHHS SNAP Monthly Deductions, zero access barrier). NE publishes a genuine
  FOURTH tier this schema has no slot for — One Utility Allowance (OUA, $63, exactly-one-
  non-heating-non-phone-utility) — the same disclosed, unmapped-4th-tier pattern this
  file's OH/IL/MO/CO entries already document. `allotment_tier: "48"`.

  `drug_felony_ban: "modified"` — THIS PACK'S SECOND FLAGSHIP FINDING, a genuine
  consequential correction the corpus pack's own self-correction process caught: Nebraska
  did NOT opt out of the federal drug-felony ban in 2025 — a 2025 bill (LB319) that would
  have done so passed the Legislature 32-17 but Governor Pillen VETOED it the same day; an
  override motion failed 24-24, six votes short. Nebraska's operative, current statute,
  Neb. Rev. Stat. §68-1017.02(1)(b), remains the older, narrower, treatment-program-
  conditioned rule. `abawd_waiver_avail: false` — a STATUTORY BAR (Neb. Rev. Stat.
  §68-1017.02 directly bars DHHS from seeking area-wide waivers except where federally
  required), not merely a labor-market fact — zero active waivers statewide. `rmp_operated:
  false`.

  Oracle: NE's closest structural axis-twin among all 30 already-registered states is
  INDIANA — a FULL match on every axis that has a verdict/benefit consumer (bbce, asset_
  waiver, drug_felony_ban, abawd_waiver_avail, allotment_tier, rmp_operated all identical)
  — a stronger match than MS's KS twin, since IN also carries a real, non-null SUA, letting
  the full benefit-calc pathway be exercised end-to-end. Built a fresh, independent Python
  calculator (not derived from engine output, per #636), same source list as MS's/NM's
  builds above. Cross-validated BEFORE trusting it for NE: 129/129 exact match (92 base +
  37 variant rows, verdict AND benefit) reproducing IN's already-graded oracle under IN's
  own StatePolicy params, before applying NE's own policy params (differing only in the SUA
  dollar figures).

  Confirmed NE's computed DENY set is IDENTICAL to IN's DENY set across all 92 base
  profiles (22 DENY / 70 APPROVE, 0 divergence). Checked all 37 non-`expected_by_state`
  variant rows directly under NE's own params — found exactly TWO, matching IN's own
  already-authored divergence exactly: `M23-variable-gig-income-anticipation`'s two
  variants — authored "NE": "DENY" into both. Authored all 92 `expected_by_state.NE`
  entries: 70 APPROVE / 22 DENY. Since NE's `sua_by_tier` is fully populated, every APPROVE
  profile gets a real, independently-computed benefit.

  Verification: `/profile-simulation state=NE` — 129/129 PASS, 0 FAIL, 0 SKIP (clean,
  matching CA/MA/TX/WA/GA/FL/IL/OH/MI/NV/OR/WI/KS/AK/NC/VA/IN/MO/MD/CO/SC/LA/NM's bar).
  Every other registered state's harness run reconfirmed unchanged from its documented
  baseline (CA/WA/TX/GA/MI/IL/FL/MA/NV/OR/WI/KS/OH/AK/NC/VA/IN/MO/MD/CO/SC/LA/NM all
  129/0/0; NY 127/2/0; AZ 128/1/0; PA/NJ/TN/MS all 34/0/95; MN 0/0/129 — all pre-existing,
  none newly introduced). `tsc --noEmit -p packages/snap-rules` clean, 323/323 snap-rules
  tests pass (0 new), 44/47 profile-harness tests pass (3 pre-existing skips). Did not
  touch `packages/demeter-engine` or any other state's StatePolicy/oracle coverage. AL, KY,
  and OK (individual tier) and CT/UT/IA/AR (the first batch-tier segment) were all
  concurrently in-flight, not yet merged, as of this build — not touched, not coordinated
  with; a human reconciles the eventual rebase chain. No new GitHub issue filed. PR TBD,
  branch `feat/snap-rules-batch2-ms-nm-ne`, covers all three states (MS, NM, NE) as one PR,
  awaiting merge go-ahead.
