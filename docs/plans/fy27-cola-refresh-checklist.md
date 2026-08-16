# FY27 SNAP COLA refresh checklist (snap-rules)

**Status:** ⏳ blocked — USDA FNS has not yet published the FY27 COLA memo
(confirmed via live search 2026-08-16; FY26's equivalent memo published
2025-08-13, FY27's is overdue/imminent by that same-year cadence but not
out). **Do not fill in any dollar figure below until the memo is published
and fetched from a primary source.** See issue [#803](https://github.com/matthewgg22/Civica/issues/803).

**Purpose of this doc:** when the memo lands, the actual refresh should be
a mechanical "append one snapshot per file, re-run the sweep" operation —
not a re-discovery of scope. This is the map. `refactor(snap-rules): add
dated-snapshot structure to territory/AK allotment tables ahead of FY27
(#803)` did the structural prep this checklist assumes; it changed no
dollar figures.

## Before touching any file

1. Fetch the actual FY27 COLA memo from a primary USDA FNS source (not a
   restatement) — same standard as every existing FY26 entry in this
   codebase (each cites the specific PDF/URL it was pulled from). Save
   the source URL; every new snapshot's comment must cite it, same
   convention as `federal-tables.ts`'s FY26 entry.
2. Fetch HHS's 2026 Poverty Guidelines (Federal Register, Jan 2027 —
   these drive FY27 SNAP, same one-year lag as FY26's Jan-2025-guidelines-
   drive-FY26 relationship documented in `federal-tables.ts`).
3. Confirm the effective date range: almost certainly
   `2026-10-01` – `2027-09-30`, but verify against the memo itself (some
   years the effective date has been delayed — see the FY22 TFP
   re-evaluation delay precedent).
4. File an issue first if this touches anything beyond pure data-entry
   (per this repo's CLAUDE.md: "Engine-math: file issue first"). Pure
   append-a-snapshot data entry following this checklist should NOT need
   a new issue beyond #803's continuation — but if the memo changes
   *structure* (e.g. a new territory tier, a new rounding convention),
   stop and file one before writing code.

## The five allotment table-sets (dated-snapshot ready — just append)

Each of these already has the `*Snapshot` interface + `*_SNAPSHOTS` array
+ `*For(asOf)` lookup function (added by #803's structural refactor). For
each file: define a new `FY27` constant snapshot object with
`fiscal_year: 2027`, `effective_start`/`effective_end` for the FY27
window, all the same dollar-figure fields as the existing FY26 entry, and
push it into that file's `_SNAPSHOTS` array. **Never edit the FY26 constant
in place** — the whole point of this structure is FY26 stays byte-exact
and addressable by date after FY27 lands.

| # | File | Snapshot type | Array to append to | Fields needed |
|---|------|---------------|---------------------|----------------|
| 1 | `packages/snap-rules/src/constants/federal-tables.ts` | `FederalTableSnapshot` | `SNAPSHOTS` | `fpl_by_region.{contiguous,ak,hi}` (annual first-person + each-additional + rounding), `max_allotment` (HH1-8) + `max_allotment_each_additional`, `standard_deduction` (HH1-3/4/5/6+), `shelter_cap`, `minimum_benefit`, `homeless_deduction`, `asset_limit_household`, `asset_limit_elderly_disabled`, `earned_income_deduction_rate` (statutory 0.20, confirm unchanged), `medical_floor` (statutory $35, confirm unchanged) |
| 2 | `packages/snap-rules/src/constants/ak-allotment-zones.ts` | `AkAllotmentSnapshot` | `AK_SNAPSHOTS` (module-private; add a new `AK_FY27` const first) | `urban`/`rural1`/`rural2` zone tables (each: `max_allotment` HH1-8 + `max_allotment_each_additional` + `minimum_benefit`), `standard_deduction` (HH1-5/6+), `shelter_cap` |
| 3 | `packages/snap-rules/src/constants/vi-allotment-table.ts` | `ViAllotmentSnapshot` | `VI_SNAPSHOTS` (module-private) | `max_allotment` HH1-8 + `max_allotment_each_additional`, `minimum_benefit`, `standard_deduction` (HH1-2/3/4/5/6+), `shelter_cap` |
| 4 | `packages/snap-rules/src/constants/hi-allotment-table.ts` | `HiAllotmentSnapshot` | `HI_SNAPSHOTS` (module-private) | Same shape as VI |
| 5 | `packages/snap-rules/src/constants/gu-allotment-table.ts` | `GuAllotmentSnapshot` | `GU_SNAPSHOTS` (module-private) | Same shape as VI/HI |

Source for #2-5's dollar figures: USDA FNS's own "SNAP FY 20XX Maximum
Allotment Amounts for Alaska, Hawaii, Guam, and U.S. Virgin Islands" table
(same publication class #814/#858/#861 used for FY26 — check
`fns-prod.azureedge.us` for the FY27 filename pattern) plus each
territory's own COLA-memo-restatement page if the federal PDF is
unavailable (state DHS/DOH mirrors, same secondary-corroboration pattern
already used for FY26).

`GU_ALLOTMENT_TABLE`'s income-eligibility limits are NOT elevated (see
`gu-allotment-table.ts`'s header) — confirm this asymmetry still holds for
FY27 before assuming GU needs no `fpl_by_region` entry; USDA could in
principle change this in a future memo.

## The three FPL regions (inside `federal-tables.ts`'s `FederalTableSnapshot`)

Already covered by table #1 above (`fpl_by_region.contiguous/ak/hi`) — not
a separate file, called out again here because it's easy to miss as "just
part of the federal snapshot": HHS publishes THREE poverty-guideline sets
in the same Federal Register notice (48-contiguous+DC, Alaska, Hawaii).
Pull all three from the SAME notice, not three different sources. Confirm
each region's `monthly_rounding` convention (`floor` for contiguous,
`ceiling` for AK/HI per the FY26 reconciliation) still holds — don't
assume it's stable without re-deriving it against the FY27 memo's own
published income-eligibility table, same walk-through
`fplMonthly()`'s doc-comment in `federal-tables.ts` shows for FY26.

## `states.ts`'s per-state `sua_by_tier` (already dated — append a new `StatePolicy` array entry, don't touch the shape)

`StatePolicy[]` already carries `effective_start`/`effective_end` per
entry (added #806/#808) — this axis needs NO structural refactor, only
new data. As of 2026-08-16, every state's `StatePolicy[]` array has a
SINGLE entry with the wide placeholder range `2020-01-01` – `2099-12-31`
(a deliberate simplification documented at `states.ts`'s `STATES` comment,
"currently a SINGLE snapshot ... a deliberate placeholder range wide
enough to cover any realistic determination date"). When FY27 SUA figures
land:

1. **Cap the existing entry's `effective_end`** at the FY26→FY27 boundary
   (`2026-09-30`) instead of leaving it at `2099-12-31` — this is the one
   "edit in place" that's actually correct here, because the placeholder
   range was never meant to survive past the first real second snapshot;
   it's not a published-table edit, it's closing a deliberately-open
   placeholder now that a real second date exists.
2. **Append a new `StatePolicy` entry** to the SAME state's array with
   `effective_start: 2026-10-01`, a new placeholder-or-real
   `effective_end`, and the FY27 `sua_by_tier` figures (`HCSUA`, `LUA`,
   `phone`, `none`).
3. Do this for every state whose `sua_by_tier` is currently non-null — 42
   states as of this writing (confirm the current count:
   `grep -c 'sua_by_tier:\s*\{' packages/snap-rules/src/constants/states.ts`).
   States with `sua_by_tier: null` are intentionally unauthored (see the
   field's own doc-comment: "null = not authored, callers MUST NOT
   trust") — leave them null unless you're separately authoring that
   state's SUA for the first time, a bigger scope than a COLA refresh.
4. SUA figures come from EACH STATE'S OWN published FY27 utility standards
   (not one federal table — USDA sets a floor/methodology, but the dollar
   figures are state-published, same as every existing FY26 entry's
   sourcing comment shows).
5. Other `StatePolicy` fields (`bbce`, `bbce_threshold_pct`, `asset_waiver`,
   `allotment_tier`, `drug_felony_ban`, `abawd_waiver_avail`,
   `rmp_operated`) are policy-choice fields, not COLA dollar figures —
   don't touch them as part of a COLA-only refresh unless the FY27 memo
   or a state's own concurrent policy change specifically requires it
   (and if so, that's argument for a SEPARATE, explicitly-scoped PR, not
   folding it into the COLA refresh).

## Flagged during this session, NOT in the original audit's list — needs its own go-ahead

`packages/snap-rules/src/constants/ak-utility-regions.ts` (Alaska's
six-region utility SUA table — Central/Northern/Northwest/South
Central/Southeastern/Southwestern, #631) carries its own FY26-only dollar
figures (`HCSUA`/`LUA`/`phone` per region) with the SAME date-blind shape
`ak-allotment-zones.ts`/`vi-allotment-table.ts`/`hi-allotment-table.ts`/
`gu-allotment-table.ts` had before this PR's refactor — no
`effective_start`/`effective_end` banding at all. It was NOT in #803's
original audit list (the audit named the 5 allotment table-sets, 3 FPL
regions, and `states.ts`'s `sua_by_tier`) and is deliberately NOT
refactored by this PR (out of authorized scope). Flag this to whoever
picks up the FY27 refresh: this file will ALSO need the same
dated-snapshot treatment eventually, ideally BEFORE FY27 numbers are
pasted into it (same append-only rationale as the other four), but that
refactor needs its own explicit go-ahead — don't fold it into a "just
appending FY27 data" pass without asking.

## Verification (mandatory — do not skip)

After every constant is filled in for FY27:

1. `npx tsc --noEmit` in `packages/snap-rules` — clean compile.
2. `pnpm --filter @civica/snap-rules test` — full suite green, including
   existing FY26-pinned fixtures (they must NOT move just because FY27
   exists — this is the same zero-regression bar #803's structural PR
   held itself to).
3. Full 53-jurisdiction harness sweep
   (`pnpm --filter @civica/profile-harness run run -- --state <XX> --engine ts --json --no-preflight`
   for every one of AL AK AZ AR CA CO CT DE DC FL GA GU HI IA ID IL IN KS
   KY LA MA MD ME MI MN MO MS MT NC ND NE NH NJ NM NV NY OH OK OR PA RI SC
   SD TN TX UT VA VI VT WA WI WV WY) — this time the sweep is EXPECTED to
   show FY26→FY27-dated-profile changes wherever the fixture's `as_of_date`
   crosses into FY27 (the v0.6 fixture's `as_of_date` is currently
   `2026-06-01`, inside FY26 — if/when the fixture itself gets an FY27
   variant, that's the profiles that should move; anything ELSE moving is
   a bug in the FY27 entry).
4. `pnpm --filter @civica/profile-harness test` — harness's own suite
   green.
5. Diff the harness's `expected_by_state` oracle rows (v0.6.json,
   `data-ops/sample/civica-test-profiles/`) if/when a new FY27-dated
   fixture variant is authored — that's a SEPARATE, larger undertaking
   (new oracle authorship, its own go-ahead) from the constant refresh
   this checklist covers, per the #636 methodology used for the FY26
   oracle rows.

## Commit / PR shape

Follow this repo's existing convention: `feat(snap-rules): FY27 COLA
refresh — <which axis>` per logically-separable chunk (e.g. one commit for
federal-tables.ts + the 4 territory/AK files together since they're
sourced from the same COLA memo, a separate commit per state's
`sua_by_tier` batch if authored in waves), each citing the primary source
URL in the commit body. File #803-linked follow-up issues for anything
this checklist surfaces as out-of-scope (structural gaps, asymmetries that
changed, etc.) rather than silently expanding the refresh PR's scope.
