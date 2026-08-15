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

## 2. Current state of the calculator (verified against `origin/codex/rebuild-feb18`)

`StatePolicy` (the calculator's per-state config — `packages/snap-rules/src/constants/
states.ts`) exists for **18 states**: CA, WA, TX, NY, GA, MI, IL, FL, MA, NV, AZ, OR, WI,
MN, OH, KS, PA, AK.

The oracle fixture (`data-ops/sample/civica-test-profiles/v0.6.json`, `expected_by_state`)
— the independently-computed ground truth every `/profile-simulation` run grades the
engine against — has full 92-case coverage for **16 of those 18**: CA, WA, TX, NY, GA, MI,
IL, FL, MA, NV, AZ, OR, WI, KS, OH, AK.

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

**35 states have neither** `StatePolicy` nor oracle coverage — the full remaining scope:
AL, AR, CO, CT, DC, DE, GU, HI, IA, ID, IN, KY, LA, MD, ME, MO, MS, MT, NC, ND, NE, NH, NJ,
NM, OK, RI, SC, SD, TN, UT, VA, VI, VT, WV, WY.

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
3. Individual tier (~4M+ population): NC, NJ, VA, TN, IN, MO, MD, CO, SC, AL, LA, KY, OK
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
  [#807](https://github.com/matthewgg22/Civica/pull/807), CI running, awaiting merge
  go-ahead.
