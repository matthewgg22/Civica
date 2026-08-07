# Mae State Corpus Framework — 15-State Build Plan

> **Status: APPROVED 2026-08-04 — Wave 0 in progress.** Roster expanded to **16**: VA added
> per approval (Wave 3, county-administered, the roster's only non-mandatory-SUA state).
> Scope: Mae chatbot only (corpus + retrieval + verification + eval). Engine dollar-math
> (`packages/snap-rules`) is out of scope except where noted.
> Evidence: 7-agent research run (wf_2d096ae4-bba) over USDA SOR 17th ed., the FNS BBCE
> table (June 2026), the FY26 ABAWD waiver file (as of 2026-03-01), and live probes of
> every state's manual host. Roster: **CA MA NY GA PA AZ OR WA NV FL TX MI WI MN IL**.

---

## 1. The problem with today's shape

Mae's corpus format already scales — `ecfr-snap.json` is provenance + chunks, source-agnostic.
But **five files hardcode California**: `retrieval.ts` (curated supplements), `citation-verifier.ts`
(ACL/MPP authority sets), `freshness.ts` (CA dates), `section-descriptors.ts`, and the eval set.
Adding a state by copying that pattern = editing 5 shared files × 15 states, with no per-state
provenance and no way to trace a wrong answer to its source.

## 2. The unit of work: a State Pack (data, not code)

```
apps/dashboard/lib/mae/states/<code>/
  pack.json          identity: program name, agency, admin model, portal, case system
  corpus.json        quotable state-policy chunks — SAME schema as ecfr-snap.json
  supplements.json   curated current-rule notes (what retrieval.ts hardcodes for CA today)
  authorities.json   citation patterns + known-authority sets for the verifier
  descriptors.json   state phrasing for the semantic index
  freshness.json     valid_from / valid_through per dated value
  eval.json          ≥12 state eval cases with expected authority
  PROVENANCE.md      source URL + retrieval date + fetch strategy + who verified, per source
```

Code becomes **state-parameterized, never state-branching**:
`retrieve(query, {state})` · `verifyCitations(answer, sources, {state})` · `assessFreshness(now, {state})`.
Adding a state = one directory + registration + green eval. Zero edits to retrieval logic.

## 3. The four layers (what we refuse to duplicate)

| Layer | Content | Copies |
|---|---|---|
| **0 — Federal** | 7 CFR corpus (exists, 415 chunks) + **one dated COLA object** (max allotments, standard deductions $209/$223/$261/$299, shelter cap $744, homeless $198.99, min benefit $24, resource limits $3,000/$4,500) + **one FPL×percentage matrix** | **1** |
| **1 — Federal-as-amended (OBBBA)** | Supersession overlay that OUTRANKS both CFR and state text: §10103 heat-and-eat now elderly/disabled-only (CFR still says otherwise), §10104 internet costs prohibited (CFR still permits), ABAWD age/exemptions | **1** |
| **2 — State policy** | The short list that's genuinely per-state: SUA values · SMD amount · BBCE pathways · asset/vehicle overrides · reporting system + IRT · cert-period menu · ABAWD clock window + waived areas · ESAP/CAP · child-support treatment · forms · portal · update channel | 15 |
| **3 — County** | Office/practice layer — ONLY for county-administered states: **CA, NY, MN, WI** (4 of our 15). Answer template: *"state policy says X — your county may differ, here's the pointer."* System is forbidden from asserting a county fact from state text. | 4 |

**Proof the COLA is federal:** CA (ACIN I-46-25), OR (OAR 461-160-0430), and PA (Handbook App. A)
independently publish identical FY26 values. Ingesting them per state = copying one federal
table 15 times and creating 15 chances to drift.

## 4. Schema decisions forced by the research (non-negotiable)

1. **`bbce` is never a boolean.** Four roster states break it: **GA at 130%** (BBCE = asset relief
   only, zero income relief), **TX BBCE *with* a $5,000 asset limit + vehicle rule** (1 vehicle
   ≤$22,000 excluded, excess counted), **NY runs TWO simultaneous pathways** (200% dependent-care
   AND 150% earned-income), NJ-style odd tiers exist. Schema:
   `income_pathways: [{limit_pct, condition}]` + `asset_rule: {asked, limit, vehicle}` as
   independent objects.
2. **Suppression is a feature.** When `asset_rule.asked = false` (11 of 15 states), the corpus
   must suppress the entire resource/vehicle branch — asking the asset question in a no-asset-test
   state is itself a documented access barrier.
3. **Every dated value carries `valid_from`/`valid_through`, and Mae REFUSES to answer from an
   expired value** rather than answering confidently. (WA's authoritative SUA is $515/$406/$58;
   Cornell LII serves $502/$396/$56; search caches serve $437 — three answers, two wrong, none labeled.)
4. **`fetch_strategy` is recorded per source URL** (plain / browser-headers / headless).
   Live probes: mass.gov **403**, hhs.texas.gov **403**, otda.ny.gov **connection reset**,
   policies.ncdhhs.gov 403-to-bots-but-200-to-browser-headers. The October refresh job fails
   loudly on 403 instead of silently keeping last year's numbers.
5. **ABAWD 36-month clocks are per-state and do not align** (WA 1/1/24–12/31/26 · OR 1/1/25–12/31/27 ·
   CA 1/1/26–12/31/28). Clock logic is never shared across states.
6. **Volatile facts never come from the State Options Report.** SOR (Oct 2024) is already wrong on
   ABAWD for 4+ roster states (says CA statewide → actually partial; says IL statewide → none;
   MA/PA partial → none). Structural options → SOR; waivers/SUA/SMD → the dated primary issuance only.

## 5. Minimum viable state corpus (~150–400 chunks, NOT the whole manual)

A state manual is 3,000+ pages; ~95% answers <5% of questions. Per state:

**Tier A — determines pass/fail or dollars (build these or don't build the state)**
income-pathway set · asset rule · current-FY SUA table w/ mandatory flag · SMD amount +
child-support treatment · lottery threshold + BBCE exclusions.

**Tier B — where denials actually come from**
reporting system by household category + IRT + periodic-report form/month · ABAWD clock +
waived areas + screening order · cert periods + interview rules (ESAP/CAP) · verification
policy + **state form numbers** (caseworker vocabulary = retrieval gold) · expedited criteria.

**Tier C — navigation + staying alive**
portal/channels/forms inventory · county directory (Layer-3 states) · **update-channel index**
(ACL/ACIN · MTL · ADM/INF/LCM/GIS · Ops Memos · handbook releases) with supersession pointers.

**Explicitly OUT of v1:** QC procedure, claims/overissuance, E&T contracting, D-SNAP, retailer/EBT,
hearing mechanics beyond the two federal deadlines. (~70% of manual pages, ~3% of question volume.)

## 6. The roster, tiered by ingestion cost × teaching value

| State | Admin | Manual format | Ingestion | BBCE limit | Notes |
|---|---|---|---|---|---|
| CA | **County** | MPP .docx + ACL/ACIN PDFs | MED | 200% | Wave 0 refactor target |
| WA | State | **EA-Z: whole manual in 1 request**, per-page revision stamps | **EASY** | 200% | No SMD; WASHCAP; 12-mo certs only |
| OR | State | OAR 461 HTML, 541 rules enumerable | **EASY** | 200% | SUA sits in a **temporary rule expiring 9/14/26** |
| MI | State | BEM/BAM/RFT numbered text-layer PDFs | **EASY** | 200% | RFT tables = value locus |
| PA | State | HTML handbook, **publishes prior-year tables inline** | EASY-MED | 200% | Free supersession corpus |
| IL | State | IDHS PM/WAG HTML | EASY-MED | **165%** | RMP in Cook & Franklin counties only |
| AZ | State | CNAP static HTML + archive tree | MED | 200% | Current-values page is directly fetchable |
| FL | State | Per-chapter PDFs (right host: ffic.myflfamilies.com) | MED | 200% | |
| GA | State | ODIS portal (JS app) | MED | **130%** | THE "BBCE ≠ income relief" case |
| NV | State | E&P Manual chapter PDFs w/ **MTL revision stamps** | MED | 200% | Unstable URLs (dates in filenames); agency renamed DWSS→DSS |
| TX | State | Texas Works Handbook HTML — **host 403s bots** | MED | **165% + $5k assets** | Kills the BBCE boolean; 4-mo certs |
| MA | State | DTA Online Guide (JS app) + 106 CMR — mass.gov 403s | MED-HARD | 200% | Launch state, but not cheap to corpus-ify |
| WI | **County** | **Best-versioned source in roster**: HTML w/ per-release snapshots + per-section version index | MED (+county) | 200% | 11 consortia + Milwaukee Enrollment Services |
| MN | **County** | Combined Manual on LEGACY dhs.state.mn.us CMS (agency moved to DCYF) | HARD | 200% | Manual interleaves 7 programs; rot risk high |
| NY | **County** | 1,000-pg Source Book PDF + ADM/INF/LCM/GIS; NYC HRA ≈ own agency | **HARD** | **200% AND 150%** (two pathways) | Most schema-breaking state in the country |

## 7. Build waves

**Wave 0 — Refactor CA into pack format. Zero new content.**
Exit criteria: all existing Mae tests green + `retrieval.ts` contains zero CA-specific strings.
The existing eval suite is the proof of faithful extraction. *(MA's engine constants stay; its
corpus pack is Wave 2.)*

**Wave 1 — the three schema-breakers: WA → TX → NY.**
- **WA** (days, not weeks): proves the pack end-to-end on the cheapest source; breaks
  West-Coast-alike assumptions (no SMD, WASHCAP, 12-mo-only certs); clean ABAWD control case.
- **TX**: forces the asset-rule object + vehicle module + browser-fetch strategy early;
  second-largest caseload.
- **NY**: two BBCE pathways kill any scalar income limit; NYC HRA is the hardest Layer-3 case.
  If the pack survives NY, it survives everything.

**Wave 2 — cheap volume (state-administered): OR, MI, PA, IL, AZ, GA, FL, MA, NV.**
Order within wave by cost; **GA ships early** so the 130%-BBCE case has live coverage.
OR teaches the expiring-temporary-rule freshness case for free.

**Wave 3 — remaining county-administered: WI, then MN.**
WI first — its versioned handbook is the best supersession-tracking teacher in the roster;
build the consortium sub-layer there, then apply it to MN (hardest source: legacy CMS,
mid-migration agency).

**Optional roster note:** research flags **Virginia** as the single highest-teaching state not on
your list — the only large agency with **non-mandatory SUAs** ("can I claim my actual $400 bill?"
is *yes* in VA, *no* in all 15 of ours) + county-administered + SMD + ESAP + RMP. Consider as a
16th or a swap; your call, no action assumed.

## 8. Per-state quality gates (every state, no exceptions)

1. Every chunk: source URL + retrieval date + `fetch_strategy`.
2. Verifier recognizes the state's authority formats (the #589 lesson: an unrecognizable
   authority means Mae's own trailer flags its correct answers).
3. **≥12 eval cases**, all green, ≥3 requiring STATE authority over federal.
4. Freshness entry for every dated value; refuse-on-expired wired.
5. **Adversarial source fact-check before merge** — the #585 pass found 6 real errors in 3
   CA supplements (including a federal requirement that didn't exist). Assume that error rate
   per state; verification IS the budget, ingestion is cheap.
6. PROVENANCE.md names who verified and when.
7. Layer-3 states only: county-fact gate tested (state text must never answer a county question
   unqualified).

## 9. Maintenance model (designed now, not discovered later)

- **October 1 rebuild** (annual COLA + SUA cycle): scheduled job re-fetches every `authorities`
  source per its `fetch_strategy`; 403/reset = loud failure; diffs land as a PR per state.
- **Update-channel watchers**: each pack's update channel (ACL/ACIN, MTL, ADM, Ops Memos,
  handbook releases) checked on a cadence; new issuances create triage issues, not silent edits.
- **SOR edition refresh**: structural fields re-checked per new edition only.
- **Layer-1 overlay** reviewed when FNS publishes OBBBA implementing rules (the CFR will
  eventually catch up; the overlay then shrinks).

## 10. What approval unlocks (execution order)

1. Wave 0 refactor PR (CA pack extraction; eval-green gate).
2. Pack schema PR (types + loader + state-parameterized retrieve/verify/freshness + registry).
3. WA pack (first new state, proves the whole pipeline).
4. TX, NY. Then Wave 2 in cost order. Then WI, MN.
5. Each state = its own PR with the §8 gates in the description.

**Not in scope until approved separately:** engine dollar-math for new states
(`packages/snap-rules` constants), county Layer-3 content beyond directories + gating,
applicant-facing (vs caseworker) tone variants.
