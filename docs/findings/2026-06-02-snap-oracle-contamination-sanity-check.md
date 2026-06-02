---
id: 2026-06-02-snap-oracle-contamination-sanity-check
date: 2026-06-02
scope: [snap, eligibility-engine, mutation-testing, model-validation, independence-proof]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: git
    ref: "6e465be7"
    note: "The ONE commit that ever touched data-ops/test-scenarios/civica/civica_test_profiles.json (full git log --all --follow). Zero subsequent edits."
  - kind: file
    ref: data-ops/test-scenarios/civica/civica_test_profiles_generator.py
    line: 1
    note: "Generator imports: json, copy, os, argparse, datetime, re. No engine surfaces."
  - kind: file
    ref: packages/snap-rules/src/facts.ts
    line: 2
    note: "Engine comment: 'Defined here (not imported from the harness) so packages/snap-rules has zero dependency on tools/'. Schema mirrored by hand, not imported."
  - kind: file
    ref: packages/snap-rules/src/constants/federal-tables.ts
    line: 70
    note: "TS engine FY26 constants encoded independently of Python generator (no shared JSON data file)"
  - kind: file
    ref: data-ops/test-scenarios/civica/civica_test_profiles_generator.py
    line: 8
    note: "Python generator FY26 constants encoded independently of TS engine"
---

## What we found

The v0.6 SNAP oracle (`civica_test_profiles.json`) passes the three-part contamination sanity check that precedes mutation testing for independence: **(1) git history shows one commit and zero post-creation edits, (2) the Python generator and the TS/Swift engine share no imports or runtime data, and (3) federal constants are independently encoded in each language with no shared data file.** As a side-effect of the audit, surfaced one unrelated drift bug in the TS engine: `max_allotment_each_additional = 224`, FNS COLA spec value is `$218` — a $6 over-credit per HH member beyond 8.

## Why it matters

Before running the 20-mutation independence test against the v0.6 oracle, the prerequisite question is: **could the oracle have been edited to track engine output?** If yes, every "mutation caught" reading is meaningless — both sides moved together. If no, then mutation-pass actually proves what it claims to prove (or at least the verdict half of it; see the benefit-mutation caveat in finding `2026-06-02-snap-source-citation-triple-check.md` and below).

Triple-checked here:

**(1) Oracle git history is the cleanest possible signal.**

```
$ git log --all --follow data-ops/test-scenarios/civica/civica_test_profiles.json
6e465be7 test(qa): wire v0.6 SNAP test-profile suite into iOS + TS batch runners
```

One commit. Date: 2026-06-02 14:22:43. Zero subsequent edits to the JSON. The working tree is clean on this file. There is no opportunity for "we ran the engine, saw the test fail, edited the expected value to match" — that pattern requires multiple commits or a dirty working tree, neither exists.

**(2) Generator-engine import boundary is enforced by code.**

The Python generator imports `json, copy, os, argparse, datetime, re` — stdlib only. No reference anywhere in the file to `snap-rules`, `packages/snap`, `civica/Features`, `verdict.ts`, `composer`, `computeBenefit`, `federal-tables`, or any engine path.

The TS engine has exactly two textual references to the oracle path:

- `packages/snap-rules/src/facts-schema.ts:3` — comment: "Mirrors data-ops/sample/civica-test-profiles/v0.6.schema.json"
- `packages/snap-rules/src/facts.ts:2-4` — comment: "Defined here (**not imported from the harness**) so packages/snap-rules has zero dependency on tools/"

Both are comments. No `import` / `require` / `readFileSync` of any oracle file. The engine cannot read the oracle, including at test time. The harness reads the oracle (correct — it grades against it), but no harness adapter passes expected values as engine input (`grep -nE 'expected.*facts|facts.*expected' tools/profile-harness/src/`: empty).

**(3) Federal constants independently encoded in both languages.**

Python generator, line 8-10:

```python
"asset_limit": 3000, "asset_limit_ed": 4500, "homeless_ded": 198.99, "min_benefit": 24, "shelter_cap": 744,
"max_allot": {1:298, 2:546, 3:785, 4:994, 5:1183, 6:1421, 7:1571, 8:1789},
"sd": {1:209, 2:209, 3:209, 4:223, 5:261, 6:299},
"fpl": {1:1305, 2:1764, 3:2222, 4:2680, 5:3139, 6:3597, 7:4056, 8:4514}
```

TS engine, `federal-tables.ts` FY26 block:

```typescript
max_allotment: new Map([[1, "298"], [2, "546"], [3, "785"], [4, "994"], [5, "1183"], [6, "1421"], [7, "1571"], [8, "1789"]]),
standard_deduction: new Map([[1, "209"], [2, "209"], [3, "209"], [4, "223"], [5, "261"], [6, "299"]]),
shelter_cap: "744", minimum_benefit: "24", homeless_deduction: "198.99",
asset_limit_household: "3000", asset_limit_elderly_disabled: "4500",
```

Values agree because both encoded the same FY26 FNS COLA memo independently — not because they share a data file. There is no `fy26.json` or similar that both languages read. If FNS issues a correction tomorrow, both files need separate manual updates (drift risk, NOT a contamination conduit).

**No shared JSON data file**:

```
$ grep -lE 'fy26|FY26|cola' packages/snap-rules/src/constants/federal-tables.ts data-ops/test-scenarios/civica/civica_test_profiles_generator.py
# both files match; no third file is shared
```

## What this proves — and what it doesn't

**Proves:** the v0.6 oracle was not contaminated by the engine. Expected verdicts and expected benefits were authored once (at commit 6e465be7), and have not been edited to track engine output since. The engine cannot have leaked into the oracle through code paths — there are none. The independence requirement for SR 11-7 mutation testing is satisfied at the structural level.

**Does NOT prove:** that the *original* authoring of the benefits was independent. The Python generator and the TS engine both compute `b = round(maxA - 0.30 * N)` with identical constants. They agree because they encode the same source policy — not because the values were independently derived from policy. This is the **twin-consistency vs full-independence** distinction the prior finding (`2026-06-02-snap-source-citation-triple-check.md`) flagged and the mutation-plan critique reiterated.

The honest statement for any pitch is:

> "The expected verdicts on the v0.6 oracle were independently authored from CFR citations. The expected benefit dollar amounts were computed by a standalone Python generator using the same FY26 FNS COLA constants the engine encodes; ongoing oracle integrity is verified by mutation testing (catches drift from the Python twin); third-source benefit validation against PolicyEngine US (offline, AGPL-3.0) closes the original-derivation gap on benefit math."

## Side-effect finding: $6 drift bug in TS engine

While auditing the constants, `federal-tables.ts:104` encodes `max_allotment_each_additional: new Decimal("224")`. The federal signoff (`2026-06-02-snap-source-citation-triple-check.md`, FNS COLA memo verified) gives the FY26 value as **$218 per additional member**. TS over-credits HH9+ by $6/person/month.

Not a contamination issue — neither the Python generator nor the v0.6 fixture exercises HH9+ at the moment (Python's `max_allot` dict stops at HH8; fixture profiles top out at HH7 per `P60`). The bug is dormant in test scope but would produce wrong benefits in production for any household with 9+ members.

Filed as separate concern. Fix: change `"224"` → `"218"`. Add a HH9+ profile to the fixture to lock the value via test pressure.

## What changes

- [x] Triple-check executed: all three signals clean.
- [ ] Run the 20-mutation independence test from `~/Desktop/Civica USDA data/analysis/civica_engine_independence_mutation_plan.md` with confidence the result is meaningful (verdict side fully proves independence; benefit side proves twin-consistency).
- [ ] Build the `tools/profile-harness/mutation-score.ts` driver: reads a `mutations.json`, applies temporary git patches, re-runs harness per state, emits caught/uncaught + flipped-profile list, reverts cleanly. ~30-60 min work.
- [ ] Wire PolicyEngine US (offline) for 15-profile benefit corroboration. This is the only thing that closes the full benefit-independence loop.
- [ ] Fix TS `max_allotment_each_additional: 224` → `218`. Add HH9+ test profile.

## Open questions

1. Is there value in **also** running a git-blame on the schema file (`v0.6.schema.json`)? If the schema were edited to relax a constraint after the engine failed validation, that's a different contamination vector — adjacent but real. The schema file doesn't appear to exist at the declared path; need to confirm.
2. **Does the Wave 3 Swift port and Wave 4 iOS production engine also pass the same boundary check?** This finding covered Python generator vs TS port. Should re-run the import-boundary scan against the Swift CLI + iOS code paths before claiming independence across all three engines.
3. The Python generator was committed at `6e465be7` — the same commit as the oracle JSON. Best practice for SR 11-7: the generator should ideally be committed *before* the JSON in a separate commit, demonstrating the JSON was produced as output of the generator, not hand-authored to match an engine run. Current state is ambiguous (same commit). Not a problem now; worth a note for v0.7+.
