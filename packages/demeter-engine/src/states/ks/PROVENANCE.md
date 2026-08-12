# Kansas pack — provenance

**Created:** 2026-08-12. Kansas is UNLIKE most of this roster's recent corpus-only builds: it is
NOT a blank slate. Kansas already has a `packages/snap-rules` `StatePolicy` entry AND full
92-profile oracle-fixture coverage (`data-ops/sample/civica-test-profiles/v0.6.json`) — but no
Demeter corpus pack until this task. The existing engine entry, though, carries an explicit
warning sign: its `label` field reads `"Non-BBCE archetype (e.g. KS)"`, and the constants file's
own top-of-file comment (`states.ts` ~line 128) states "Other states (TX/KS/AK) are policy
archetypes used by the fixture; their SUA values are illustrative until the FNS-published values
are loaded." That language signals a SYNTHETIC test-generator placeholder, not independently
researched real Kansas policy — this task's central job was to do real primary-source research on
Kansas as if that entry didn't exist, then explicitly compare findings against it. This task's
scope was CORPUS ONLY — `packages/snap-rules` and the oracle fixture are NOT touched.

Kansas is part of this roster's smaller-population BATCH TIER, built in parallel with Mississippi,
New Mexico, and Nebraska by separate agents in the same window.

## Method

Direct fetch (no access barrier encountered) of Kansas DCF's KEESM Appendix F-2 Food Assistance
Program Standards PDF (the manual's own dated, current dollar-figure table, effective
10/1/2025-9/30/2026), KEESM 2510 (Categorically Eligible Households), and DCF's Food Assistance
program page. Direct fetch of K.S.A. 39-709e from `ksrevisor.gov` (Kansas's own statute database).
WebSearch cross-checks for the ABAWD waiver status (a direct FNS quarterly-waiver-list fetch timed
out), the Restaurant Meals Program state list (cross-checked against this roster's
already-confirmed current 9-state list), and the resource/asset-limit dollar figures (this pack
could not locate a directly-fetched, dated KEESM section stating them explicitly within its fetch
window — several individual KEESM numbered sections in the 5000-5300 series either 404'd or did
not surface the figure in the fetched content).

## Finding 0 — the central task: an independent primary-source discrepancy check against this
repo's own EXISTING, flagged-as-synthetic engine entry

The task brief explicitly instructed this pack to research Kansas AS IF the existing
`packages/snap-rules` entry did not exist, then compare. This pack did so. The result is
genuinely interesting and NOT the pattern earlier "archetype" concerns (e.g. a since-resolved Ohio
case) might suggest:

**This pack's independent research CONFIRMS the existing "archetype" entry's substantive values as
accurate, current, real Kansas policy** — not merely a coincidentally-matching placeholder guess:

- `bbce: false` — CONFIRMED. KEESM 2510 (Categorically Eligible Households), read directly, limits
  categorical eligibility to TANF/SSI-authorized households plus a narrow work-support-services
  track — there is no general, income-threshold-only BBCE track. KEESM Appendix F-2's own current
  gross-income table sets the household-of-1 ceiling at $1,696/month and household-of-4 at
  $3,483/month, matching the plain 130% FPL federal default, not an elevated 200% FPL BBCE
  ceiling.
- `asset_waiver: false` — CONFIRMED, as a direct consequence of the above: without BBCE or a
  broader categorical-eligibility track, the ordinary federal asset test applies to the
  overwhelming majority of Kansas Food Assistance households.
- `sua_by_tier: { HCSUA: 469, LUA: 345, phone: 44 }` — CONFIRMED to the dollar. KEESM Appendix
  F-2, fetched directly and parsed by this pack's own tooling (not a lossy text-extraction
  summary), states Standard Utility Allowance $469, Limited Utility Allowance $345, Telephone
  Standard $44, effective 10/1/2025-9/30/2026 — an exact match to the existing engine's
  "illustrative" values.

**A separate, more granular observation this pack flags rather than silently resolving:** the
`states.ts` file itself contains an apparent PARTIAL, undocumented prior correction that was never
reconciled with its own broader "archetype" framing. Directly above the `KS:` entry (lines
~1037-1042), a comment reads: "Kansas utility standards — KEESM §7226 (Shelter Costs), rev. 07-26,
confirmed live 2026-08-09 at content.dcf.ks.gov/EES/KEESM/Current/keesm7226.htm" — a specific,
dated, URL-cited confirmation claim. But the file's top-of-file comment, one screen above (line
~128), still describes KS as an "archetype" with "illustrative" SUA values, and the `label` field
on the entry itself still reads `"Non-BBCE archetype (e.g. KS)"`. This pack's own fetch (2026-08-12,
three days after the claimed 2026-08-09 confirmation date) corroborates the SUA figures
independently, but did not investigate git history for who added that specific comment or when —
that is a `packages/snap-rules` archaeology question out of this corpus-only pack's scope. This
pack flags the internal inconsistency (a partially-corrected entry still carrying its original
"unverified placeholder" labels) in `freshness.json` for whoever next touches `states.ts` to
reconcile explicitly, rather than silently trusting either signal alone.

**Net effect:** unlike a scenario where a placeholder turns out to be wrong, Kansas's placeholder
turns out to have been either a lucky guess, or — more likely, given the specific dated comment
found nearby — a real but undocumented partial correction whose surrounding "archetype" language
was simply never cleaned up. Either way, a future engineer reconciling `packages/snap-rules`
should update the `label` field and the top-of-file comment to remove Kansas from the "TX/KS/AK...
illustrative" disclaimer, since this pack's independent research now backs those specific values
with real citations — while still treating `drug_felony_ban: false` and `abawd_waiver_avail: false`
(not independently re-derived from a boolean-level primary source by this pack, though this pack's
`K.S.A. 39-709e` finding is directionally consistent with `drug_felony_ban: false`, since Kansas is
a modified-not-full-ban state) as UNCONFIRMED by this pack at the same standard, and treating the
asset limit (this pack's one disclosed sourcing gap) as needing its own direct KEESM citation
before being fully trusted.

## Finding 1 — Kansas's manual citation convention is simpler than several recent roster states':
bare KEESM section numbers, no program-name prefix

Unlike Connecticut's multi-program UPM (requiring a "Program:" tag check per section) or
Kentucky's "MS ####" convention, Kansas's KEESM appears organized as a dedicated economic/
employment-support manual with bare numeric section citations (e.g. "2510," "7226") — this pack
found no evidence of a shared, multi-program manual structure the way CT's UPM has. This is a
comparatively unremarkable structural finding relative to this roster's more distinctive recent
discoveries, but worth recording as the basis for this pack's authorities.json regex design.

## Finding 2 — Kansas's drug-felony policy is a MODIFIED opt-out, correcting a 2022 "lifetime ban"
secondary-source claim

K.S.A. 39-709e, read directly from `ksrevisor.gov` (no access barrier), conditions SNAP/public-
assistance eligibility on a substance-abuse assessment: eligible if assessed as not requiring
treatment, OR if participating in/completed a recommended treatment program; disqualified on a
positive drug test taken while on supervision or in treatment, with a 30-day reapplication window.
This pack found and corrects a 2022 news article (The Beacon) stating flatly that "Kansans with
drug felonies remain banned for life from SNAP" — this pack's direct read of the CURRENT statute
text finds that framing incomplete: the ban is conditional on assessment/treatment/testing
compliance, not an unconditional lifetime bar. This pack could not determine whether the article
was describing a since-superseded earlier version of the law or was simply imprecise, and
discloses that ambiguity rather than asserting a specific "the article was wrong because X" cause.

## Finding 3 — Kansas has NO ABAWD waiver, statewide or county-level, as of this pack's fetch date

WebSearch cross-checks (a direct FNS live-quarterly-list fetch timed out within this pack's
window, a disclosed access limitation) converge on Kansas currently enforcing SNAP work
requirements across all 105 counties, with no active waiver anywhere. The one Kansas-specific
ABAWD relaxation this pack found (a 2020 DCF pandemic-era suspension under the Families First
Coronavirus Response Act) is clearly superseded and not treated as current.

## Finding 4 — no Restaurant Meals Program

Cross-checked against this roster's already-confirmed current USDA FNS RMP state list (Arizona,
Maryland, New York, California, Massachusetts, Rhode Island, Illinois [Cook/Franklin Counties],
Michigan, Virginia) — Kansas absent, and this pack found no pending Kansas legislation analogous
to Connecticut's SB 1475 directing DCF toward one.

## Disclosed gap — the resource/asset-limit dollar figures

Unlike this pack's SUA, income-limit, and deduction figures (each grounded in the directly-fetched
KEESM Appendix F-2 PDF), the $3,000 standard / $4,500 elderly-disabled asset-limit figures rest on
WebSearch-aggregator corroboration only. Several individual KEESM numbered sections in the
5000-5300 series either 404'd or did not state the figure explicitly in the content this pack was
able to fetch within its window. This is disclosed explicitly in `freshness.json`, not silently
upgraded to the same confidence level as this pack's other findings.

## Adversarial refute pass (self-conducted before commit)

Re-read every supplement's drafted claim against the actually-fetched Kansas text, checking
specifically for: claims inferred from a section heading rather than its own body text; dollar
figures not traceable to a specific dated source; and any Kansas-vs-existing-engine-entry contrast
overclaimed as a "gotcha" when the underlying evidence in fact CONFIRMS the existing entry.
Concrete catches from this pass:

- Finding 0 does not overclaim a "the placeholder was wrong" narrative just because the task brief
  primed this pack to look for a discrepancy — the actual finding is a CONFIRMATION, and this pack
  states that plainly rather than manufacturing a contrast that the evidence does not support.
- Finding 0 does not silently trust the in-code "confirmed live 2026-08-09" comment at face value
  either — this pack ran its OWN independent fetch (2026-08-12) rather than treating that comment
  as sufficient, and explicitly flags the internal file inconsistency (unreconciled "archetype"
  label alongside an apparently-already-partial correction) for a future engineer to resolve.
- Finding 2's drug-felony correction does not claim certainty about WHY the 2022 article differs
  from the current statute — it discloses the ambiguity (superseded law vs. imprecise reporting)
  rather than inventing a specific causal account this pack cannot support.
- The asset-limit gap (disclosed gap section) is stated as a genuine sourcing gap, not folded
  into the pack's confident findings — this pack did not attempt to disguise a WebSearch-only
  figure as directly-KEESM-sourced.
- Finding 3's ABAWD-no-waiver claim explicitly flags that the direct FNS fetch failed (timeout)
  rather than presenting the WebSearch-only corroboration as equivalent to a direct fetch.

## Sources

| Source | Access | Dated |
|---|---|---|
| KEESM Appendix F-2, Food Assistance Program Standards | direct fetch, clean, parsed by this pack's own tooling | effective 10/1/2025-9/30/2026 |
| KEESM 2510, Categorically Eligible Households | direct fetch, clean | fetched 2026-08-12 |
| KEESM Appendix Table of Contents | direct fetch, clean | fetched 2026-08-12 |
| K.S.A. 39-709e | direct fetch of ksrevisor.gov, clean, full text read directly, no access barrier | fetched 2026-08-12 |
| Kansas DCF Food Assistance program page | direct fetch, clean | fetched 2026-08-12 |
| USDA FNS SNAP Restaurant Meals Program state list | WebSearch cross-check against this roster's already-confirmed current list | Kansas absent |
| USDA FNS ABAWD Waivers FY2025-2029 | direct fetch attempted, TIMED OUT — WebSearch cross-check corroboration only | disclosed access limitation, see freshness.json |
| Resource/asset-limit figures ($3,000 / $4,500) | WebSearch aggregator corroboration only, NOT a directly-fetched dated KEESM section | disclosed lower-confidence finding, see freshness.json |
| 2022 news article ("Kansans with drug felonies remain banned for life") | WebSearch located, CORRECTED against direct K.S.A. 39-709e text | dated 2022, superseded framing |

## Registration

`states/index.ts` (StateCode union + REGISTRY entry), `packs.ts` (VERIFIED_STATES),
`apps/web/lib/guide-questions.ts` (KS guide questions), `eval/answer-eval.ts` (KS_GOLD, spread
into ALL_GOLD). Kansas is deliberately NOT added to any `engine-citations.ts` per-state constant
map beyond what already exists — Kansas's `packages/snap-rules` `StatePolicy` entry is untouched
by this pack; any relabeling of its `"Non-BBCE archetype"` label to reflect this pack's
confirmation finding is future, separately-gated `packages/snap-rules` work.

`packages/snap-rules` stays fully parked per the standing rule
(`feedback_dashboard_snap_rules_parked`) — this pack does not modify it and does not request an
unfreeze. A future Kansas `packages/snap-rules` relabeling (updating `label` and the top-of-file
"archetype" comment to reflect this pack's confirmation finding) is out of scope here and would
need its own separate, explicit go-ahead.

**Batch-tier merge conflict:** Kansas was built in parallel with Mississippi, New Mexico, and
Nebraska. All four states registered in the same four shared files (`states/index.ts`, `packs.ts`,
`apps/web/lib/guide-questions.ts`, `eval/answer-eval.ts`). See the top-level commit history for how
any resulting merge conflict was resolved — the rule followed was to always COMBINE every state's
additions (StateCode union members, REGISTRY entries, QUESTIONS entries, and `_GOLD` arrays spread
into the aggregate export), never to drop another state's entry to resolve a conflict.
