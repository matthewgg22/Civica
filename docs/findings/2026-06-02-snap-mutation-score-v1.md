---
id: 2026-06-02-snap-mutation-score-v1
date: 2026-06-02
scope: [snap, eligibility-engine, mutation-testing, model-validation, sr-11-7]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: file
    ref: tools/profile-harness/src/mutation-score/index.ts
    note: "Mutation-score driver: applies each constant/structural patch via file find-replace, runs harness in fresh child process per state (fresh ESM module cache), reverts via git checkout HEAD, classifies + emits JSON report"
  - kind: file
    ref: tools/profile-harness/src/mutation-score/mutations.json
    note: "12 mutations encoded (10 from the plan + M21 OBBBA §10104 cutoff; 5 structural mutations deferred to v1.1)"
  - kind: file
    ref: tools/profile-harness/src/cli.ts
    line: 187
    note: "Added --json mode to existing CLI so the driver can drive it via child process (in-process runHarness silently re-uses cached engine module across mutations — bug surfaced during the first run)"
  - kind: file
    ref: tools/profile-harness/src/mutation-score/index.ts
    line: 200
    note: "Classifier treats PARAMS_MISMATCH banner triggered by a mutation as CAUGHT (the engine's params block diverged from the oracle's — that IS what the test is checking, even though benefit assertions were silently skipped run-wide)"
---

## What we found

Ran the first mutation-score pass against the v0.6 SNAP oracle on 2026-06-02. **Mutation score 72.7% (8 caught / 11 scorable); ZERO contamination red flags; 3 documented coverage gaps; 1 expected-uncaught (the OBBBA §10104 date probe).** Independence holds: the three load-bearing red-flag mutations (M01 benefit reduction rate, M02 EID rate, M03 standard deduction) all caught.

| ID | Bucket | Citation | Result | Caught via | Notes |
|---|---|---|---|---|---|
| M01 | benefit | 7 CFR 273.10(e) | ✓ CAUGHT | 41 profiles flipped | Determinative red-flag |
| M02 | benefit | 7 CFR 273.9(d)(2) | ✓ CAUGHT | 38 profiles flipped | EID rate |
| M03 | benefit | 7 CFR 273.9(d)(1) | ✓ CAUGHT | PARAMS_MISMATCH | Determinative red-flag (SD HH4) |
| M04 | benefit | 7 CFR 273.9(d)(6) | ✓ CAUGHT | PARAMS_MISMATCH | Shelter cap |
| M05 | benefit | 7 CFR 273.9(d)(6) | ✓ CAUGHT | 8 profiles flipped | E/D cap exemption (structural mutation) |
| M06 | verdict | 7 CFR 273.9(a)(1) | ○ COVERAGE_GAP | — | No KS just-over-130% profile |
| M07 | verdict | 7 CFR 273.9(a)(1) | ○ COVERAGE_GAP | — | No KS just-under-130% profile |
| M08 | verdict | 7 CFR 273.9(a)(2) | ✓ CAUGHT | 1 profile (P58) | Net-edge mutation |
| M09 | verdict | 7 CFR 273.8 | ✓ CAUGHT | PARAMS_MISMATCH | Asset limit in KS |
| M12 | benefit | 7 CFR 273.9(d)(3) | ○ COVERAGE_GAP | — | No small-medical determinative profile |
| M20 | benefit | 7 CFR 273.10(e)(2) | ✓ CAUGHT | PARAMS_MISMATCH | Min-benefit floor |
| M21 | benefit | OBBBA §10104 | (expected uncaught) | — | No profile brackets the contested cutoff window |

Caught counts by bucket: **verdict 2 of 4 (50%); benefit 6 of 8 (75%); combined 8 of 11 scorable (72.7%)**.

## Why it matters

This is the SR 11-7 "effective challenge" proof, run as mutation testing. Each surviving mutation either documents a real fixture coverage gap (which the plan predicted would happen for several mutations — it's the test working as designed, surfacing missing scenarios) OR fires the contamination alarm. None fired the alarm.

The classifier was refined during the run after a subtle gotcha surfaced:

1. **First run:** in-process driver. Node ESM module cache held the *first-loaded* engine module across mutations — patching files on disk had zero effect on subsequent `runHarness` calls in the same process. All mutations falsely reported "no change." Symptom: M01 mutated_totals identical to baseline.
2. **Fix:** spawn a fresh `tsx src/cli.ts --state X --json` child per harness invocation; module cache resets per process. Added `--json` mode to existing CLI for this. Cost: ~2-3s per harness run × ~14 runs = ~40s. Cheap.
3. **Second run:** M01 caught 41 flips, M02 caught 38 flips, M05 caught 8 flips, M08 caught 1 flip. But M03 (SD HH4 mutation) still reported "CONTAMINATION_RED_FLAG" — odd, because SD is one of the most determinative constants in benefit math.
4. **Diagnosis:** the harness has a defensive `detectParamsMismatch()` check that compares engine's `getEngineParams()` against the oracle's `meta.params`. If they differ, the harness emits a `PARAMS_MISMATCH` banner and *silently disables benefit assertions run-wide*. M03 changes engine's `sd[4]` from $223 to $173 — params mismatch fires, benefits skipped, no kind=PASS→FAIL flips. Same for M04 (shelter_cap), M09 (asset_limit), M20 (min_benefit).
5. **Fix:** treat a mutation-triggered PARAMS_MISMATCH as a CAUGHT signal. The engine's params block diverging from the oracle's *is* the oracle catching the engine. The defensive run-wide disable is unrelated to whether the mutation was detected. M03 reclassified CAUGHT-via-PARAMS_MISMATCH.

## What "caught" proves — and what it doesn't

The bucket split matters:

- **Verdict mutations caught (M08, M09): true independence proof.** The expected verdicts on those profiles were authored from CFR citations and didn't move when the engine moved.
- **Benefit mutations caught (M01, M02, M03, M04, M05, M20): twin-consistency proof.** Both the TS engine and the Python v0.6 generator compute benefit dollars from `b = round(maxA - 0.30 * N)` with the same FY26 constants. Mutating the TS rate to 0.32 makes TS drift from its Python twin — caught — but does not prove the *original* $804 for A01 was independently derived from policy. It proves the two encodings agree.
- **Combined: 8 of 11 scorable mutations caught (72.7%) with zero contamination signals.** The structural prerequisite (oracle git history clean, no shared imports, no shared data file — see 2026-06-02-snap-oracle-contamination-sanity-check.md) was already proven; this round proves *operationally* that the engine cannot have leaked into the oracle's expected values.

The 3 coverage gaps are the plan working as designed — each surfaces a missing fixture profile:

- **M06/M07** (gross 130%→140% / 130%→120% in KS): no KS profile sits at the gross-test boundary. Plan called this out. Adding M03/M04-style profiles in a non-BBCE state would close both.
- **M12** (medical floor $35→$0): no profile has medical expenses small enough that the floor removal changes the result. Add a profile with medical = $30-40 and E/D = true.

M21 (OBBBA §10104 cutoff date) was authored as expected-uncaught — a deliberate probe for whether any profile's `as_of_date` brackets the contested 2025-07-04 to 2025-11-01 window AND has internet expense. None do. This documents the missing fixture for the engine cutoff date the triple-check (`2026-06-02-snap-source-citation-triple-check.md`) flagged as possibly wrong.

## What changes

- [x] Driver shipped at `tools/profile-harness/src/mutation-score/`.
- [x] `--json` output mode added to existing harness CLI.
- [x] First mutation-score run executed; report at `/tmp/mutation-score-v3.json` (also re-runnable via `pnpm --filter @civica/profile-harness run mutation-score --out path.json`).
- [ ] Encode the 5 structural mutations deferred to v1.1 (M11 gross-test-on-E/D, M13 EID-on-unearned, M14 categorical waiver, M15-M19 student/ABAWD/COFA gate inversions). Each needs a feature-flag mode in the engine rather than a find/replace patch.
- [ ] Add the missing-fixture profiles to close M06/M07/M12 coverage gaps. Cite this finding in the commit message that adds them.
- [ ] Add an HH9+ profile (also closes the $6 max_allotment_each_additional drift bug's dormant-in-test status).
- [ ] **PolicyEngine US offline pairing** — still required to close the benefit-side independence loop. Mutation testing proved twin-consistency; PolicyEngine pairing would prove the original benefit derivation matches an independent third party.

## Open questions

1. The driver applies patches via file find/replace and reverts via `git checkout HEAD --`. If the process is killed mid-mutation (SIGTERM, Ctrl+C between the patch and revert), the working tree could be left dirty. The pre-flight check on the next run catches this, but it would be nicer to add a SIGINT handler that reverts before exit.
2. The classifier currently buckets "caught via PARAMS_MISMATCH" identically to "caught via per-profile flip" — same CAUGHT label. For more granular reporting, the JSON keeps the distinction (`params_mismatch_triggered_by_mutation: bool`). The summary headline rolls them up. Worth surfacing the split in the markdown summary if the report gets a UI.
3. The harness's `getEngineParams()` exposes a fixed set: asset_limit, asset_limit_ed, shelter_cap, min_benefit, homeless_ded, sd by size, sua by tier. Mutations to constants *outside* this set (like M01's 30% rate, hardcoded in benefit-calc.ts) don't trigger PARAMS_MISMATCH and must rely on per-profile flips. That's why M01 caught via 41 flips, not the banner.
4. Should the structural mutations (M05's "always cap" / M11's "apply gross to E/D") be modeled as feature flags in the engine, or applied via more sophisticated patch operations (AST manipulation)? Feature flags are cleaner but require engine-side scaffolding; AST patches are more invasive but keep the engine pure. Defer the call.
