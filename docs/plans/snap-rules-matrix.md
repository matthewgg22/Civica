# Eligibility and Integrity Engine — architecture & build phases

**Status:** draft · **Date:** 2026-06-01 · **Scope:** the **Eligibility and Integrity Engine** — the eligibility determination of record.
Its sibling, the **Payment Integrity Engine** (reconcile · measured PER · error-prediction), is a separate doc: [payment-integrity-engine.md](payment-integrity-engine.md). The simulation harness is downstream of this engine — see [§8](#8-future-phases). Build nothing downstream until this engine's trace + citation layers exist.

> **The one boundary this engine protects.** Two integrity questions, two engines:
>
> ```
>   ELIGIBILITY INTEGRITY  ── THIS ENGINE             PAYMENT INTEGRITY  ── the sibling
>   "did we run OUR rules right,                      "do our outcomes match ACTUAL policy /
>    consistently, and cite each step?"                a caseworker, in dollars?"
>   verified INTERNALLY (replay) · ~100%              verified EXTERNALLY (ground truth) · the
>   any miss is a bug                                  federally-audited metric; can be nonzero
>            │                                         even at 100% eligibility integrity
>            └──── cited, replayable determinations ─────────▶  (the only handoff)
> ```
>
> This engine owns the **left** and must never claim the **right**. Eligibility integrity we prove alone (replay); payment integrity needs the county's real answer.

---

## The engine in plain terms — a rules library

Before the formal layers below, here is the whole engine in one picture: it's a **library**. A determination is just *walking in, pulling the right rules, reading them against this applicant's facts, and logging what you did.*

```
   ┌──────────────────────────── THE RULES LIBRARY ────────────────────────────┐
   │                                                                            │
   │  WINGS  (WHICH rulebook)                                                    │
   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
   │  │ STANDARD    │  │ BBCE        │  │ CFAP        │   ← you walk into ONE,    │
   │  │ SNAP        │  │             │  │             │     based on WHO they are │
   │  └─────────────┘  └─────────────┘  └─────────────┘                          │
   │                                                                            │
   │  Every book comes in three EDITIONS  (WHEN)                                 │
   │      [ FY25 ]   [ FY26 ]   [ post-OBBBA ]   ← grab the one in force ON the   │
   │                                               filing date — NOT the newest   │
   │                                                                            │
   │  Stacked on three SHELVES  (WHERE)                                          │
   │      ┌──────────────────────────────────────────────┐                      │
   │      │ COUNTY  shelf   (stocked only in CA branches)  │  ← reach here FIRST  │
   │      ├──────────────────────────────────────────────┤                      │
   │      │ STATE   shelf   (CA / MA)                       │  ↓ if empty, go down │
   │      ├──────────────────────────────────────────────┤                      │
   │      │ FEDERAL shelf   (always full — the floor)       │  ↓ the floor        │
   │      └──────────────────────────────────────────────┘                      │
   │                                                                            │
   │  Sorted into SECTIONS  (WHAT)                                               │
   │      • "Are they eligible, and how much?"          ← substantive (the math) │
   │      • "Did they apply right? Can we even decide?" ← procedural (the process)│
   │                                                                            │
   └────────────────────────────────────────────────────────────────────────────┘
```

**What each filter does — as a move through the library.** To answer one question about an applicant, you make four moves to reach exactly **one page**:

| Move | Filter | What it physically does | If you get it wrong… |
|---|---|---|---|
| **1. Pick the wing** | WHICH | Narrows the whole library to the *one rulebook* for this kind of applicant | Wrong wing → every rule after is wrong |
| **2. Pick the edition** | WHEN | Grabs the printing *legally in force on the filing date* | Newest edition → you misjudge an old case |
| **3. Pick the shelf** | WHERE | Reaches **county → state → federal**, taking the most specific that has the rule | Skip a shelf → miss a state option, or breach the federal floor |
| **4. Pick the section** | WHAT | Chooses *which question* — eligibility math, or did-they-apply-right | Wrong section → you answer the wrong question |

You're now holding exactly one page. You read it against the applicant's facts, do what it says (apply a deduction, waive a test, set a deadline, skip a section), and write it on the slip.

**The applicant's folder — and why not every fact is trustworthy.** The applicant's facts arrive in an **intake folder**, and every slip carries a **stamp**:

```
   [ ✓ VERIFIED        ]  age 72          ← confirmed against a document
   [ ~ SELF-SAID       ]  rent $900        ← they told us; not checked yet
   [ 📷 PHOTO-READ 0.82 ]  income $1,500    ← a machine read it off a paystub photo
   [   BLANK           ]  income proof      ← missing
```

You can only finish reading a rule if the slips it needs are **stamped solid**. If a required slip is `BLANK` or only `SELF-SAID`, you do **not** stamp the file `DENIED` — you set it in the:

```
   ⧖  PENDING tray  —  "need document X before we can decide"
```

That tray *is* the third answer (eligible / ineligible / can't-tell-yet). Most "denials" in the real data are really files that belonged in this tray. And the `📷 PHOTO-READ 0.82` stamp is why a machine-misread paystub can produce a flawless-looking but wrong determination — the slip looked solid, but it wasn't.

**Colored tabs = special circumstances.** Some slips are tabs that send you for *more* books:

```
   🔵 "elderly" tab  → also pull:  skip-the-gross-test · uncapped-shelter · medical-deduction
   🟠 "homeless" tab → also pull:  homeless-shelter-deduction
```

One tab, several extra books.

**The checkout slip is the whole audit.** As you pull and read each page, you log it:

```
   CHECKOUT SLIP
   book (rule) · edition (date) · shelf (jurisdiction) · what it said · what you did · spine label (citation)
```

**Audit, months later** = someone takes your slip and re-pulls the *exact same editions from the exact same shelves*. Same answer? → ✓ **consistent** (if not, a bug). Each spine label points to a real law? → ✓ **defensible**. The audit isn't a different machine — it's re-walking your route with your slip in hand.

> The one boundary the library *can't* cross, in its own terms: re-pulling the same books always gives the same answer — that's **consistency**, and the library guarantees it. But the library **cannot tell you the books themselves are right** — an edition could be misprinted, or missing a chapter the real law has. You only learn that by comparing your conclusion to the **county's actual decision**, which happens *outside* the library — and is the only thing that measures real **payment error**.

Everything below formalizes this picture: the four moves are the engine's evaluation model (walked through in the companion [audit-pathway doc](snap-rules-audit-pathway.md)); the library's machinery — how books are stored, versioned, cited, and served — is the **L0–L5 layers in [§2](#2-the-layers-bottom-up)**.

> *Illustrative contents flagged for validation:* the editions (FY25/FY26/post-OBBBA) and the elderly-tab effects are examples — each is a primary-regulation question (see [§7](#7--inferred-policy--must-validate-against-primary-regulation-before-encoding)). The library *structure* is what's load-bearing here, not these specific contents.

---

## 1. What "the rules engine" is

A single canonical, versioned, citation-bearing representation of SNAP eligibility logic — federal baseline plus per-state deltas (CA/CalFresh, MA/DTA) — evaluated by **one engine of record** (the **FastAPI service**, where the eligibility + allotment math already lives). iOS and the dashboard render **advisory previews** from the same rule source but are explicitly *not* the audited determination.

Today that logic lives in **five** un-synchronized places (TS checklist DSL, TS QC scoring, Python `backend/civic_api/snap/rules/`, Swift `Civica/Features/SNAP/Rules/`, and uncommitted JSON profiles). This collapses them to **one rule source + one engine of record + advisory clients** — far less machinery than a tri-target compiler, and it removes the cross-engine-equivalence burden entirely (consistency now means *replay reproduces*, not *three runtimes agree*). The engine's deepest current gap: no determination can name *which rule and which regulation* produced it. Closing that gap is the spine of this plan.

---

## 2. The layers (bottom-up)

The engine is a stack. Each layer depends only on the ones below it. Build order follows this stack from L0 up.

```
 L5  Persistence        eligibility_determinations + eligibility_rule_trace (Supabase, append-only)
 L4  Trace / output     every evaluation emits Determination{ outcome, trace[], matrix_version }
 L3  Evaluation runtime ONE engine of record (FastAPI) evaluates the rules; consistency = replay reproduces
 L2  Load / validate    load canonical YAML into the engine of record (+ advisory client preview artifact)
 L1  Rule source        rules/snap/ — federal baseline + state deltas (CA, MA), inheritance
 L0  Citation registry  rules/snap/citations/index.yaml — every rule cites a known authority or build fails
```

### L0 — Citation registry
The ground truth of *what authority says what*. A flat registry; every rule in L1 must reference ≥1 entry by id, validated at build time.

```yaml
# rules/snap/citations/index.yaml
- id: 7CFR273.9(d)(6)
  kind: cfr                      # cfr | usc | fns_memo | state_handbook | finding
  title: "Excess shelter expense deduction"
  url: https://www.ecfr.gov/current/title-7/.../273.9
  last_validated_at: 2026-06-01
  validator: <who/what confirmed it against primary source>
- id: CDSS-MPP-63-502.353
  kind: state_handbook
  title: "CalFresh excess shelter deduction (MPP §63-502.353)"
  url: ...
  last_validated_at: null         # ⚠ unvalidated — see §7
  validator: null
```

A `kind: finding` entry links to our own ledger (`docs/findings/`) for claims grounded in our analysis rather than primary regulation — keeps the inference boundary explicit.

### L1 — Rule source (canonical)
YAML, not the current Zod JSON — because the current DSL has **no citation slot and emits no trace**. Federal baseline is inherited; state files override + add state-only rules.

```yaml
# rules/snap/states/ca.yaml  (inherits: federal/baseline)
- id: shelter.excess_deduction
  citation_ids: [7CFR273.9(d)(6), CDSS-MPP-63-502.353]
  statement: "Excess shelter expense above 50% of adjusted income, capped except for elderly/disabled."
  scope: state:ca
  predicate:                      # same Condition shape as the existing TS DSL
    all:
      - claims_shelter_deduction: true
      - shelter_costs_gt_half_adjusted_income: true
  effect:
    deduction: { kind: shelter, cap_applies: "not household.contains_elderly_or_disabled" }
  version: 1.0.0
  as_of_date: 2025-10-01
  superseded_by: null
```

Shelter gets first-class treatment (drives ~44% of dollar-weighted errors): keep the existing `SHELTER_EFFECT` arrangement→effect table from `packages/snap-rules/src/informal-housing/types.ts`, but move the **federal numeric constants** ($179 homeless std, 50%-AGI floor, the cap) out of Swift `SNAPBenefitCalculator` / Python `federal.py` and into `rules/snap/federal/shelter.yaml`. One number, one citation, one engine of record.

### L2 — Load / validate
The engine of record (FastAPI) loads L0+L1 directly — no multi-target compiler. A small loader validates and parses the YAML into the Python engine. Clients get a **lightweight advisory artifact** (the same source, reduced to a UX checklist/preview) — explicitly *not* the audited determination, so it needs no byte-for-byte equivalence.

Load-time gates: (a) every `citation_ids` entry exists in L0; (b) `matrix.lock` checksum matches; (c) the engine of record parses the source without schema error.

### L3 — Evaluation runtime
**One** engine of record (FastAPI) evaluates a profile against the loaded rules and produces the determination. Consistency is asserted by **replay**: re-running a determination as-of its `action_date` must reproduce the same outcome + the same set of fired rule ids. A replay mismatch is a P0 bug — that *is* a rule-execution-consistency failure, the one thing this layer exists to prevent. (Advisory clients may differ from the engine of record; that's expected and never an audit failure — only the engine of record is authoritative.)

### L4 — Trace / output (the highest-leverage single change)
`evaluateChecklist` currently returns required docs but can't answer "which rule + which CFR required the lease." Every evaluation now returns:

```ts
type Determination = {
  packet_id: string
  matrix_version: string                 // "CA-1.2.0"
  outcome: 'eligible' | 'ineligible' | 'pending'    // tri-state — full type + fact status in §3
  allotment_cents?: number
  trace: Array<{
    rule_id: string
    citation_id: string
    predicate_inputs: Record<string, unknown>
    predicate_result: boolean
    effect_applied: string | null
    evaluated_at: string
  }>
}
```

### L5 — Persistence
Append-only, never mutated. Migration `20260602` (proposed — **placeholder number**; `20260599`–`601` already exist, so take the next free number at build time):
- `eligibility_determinations` — one row per determination event, PK `(packet_id, determined_at)`
- `eligibility_rule_trace` — one row per fired rule, joined by `trace_id`

RLS: applicants read own determinations only; navigators org-scoped; writes via service_role.

---

## 3. The fact model & determination outcome

The L0–L5 layers above are about *rules*. This section is about the *facts* rules read and the *outcome* they produce — the data contract for evaluation. It formalizes the library preamble's **intake folder** and **PENDING tray**.

### Two tiers of input
Facts arrive in two tiers — only one is state-invariant:
- **Raw observed facts** — age, dollar amounts, housing description, which documents exist. Entered or extracted. State-invariant (72 is 72 in every state).
- **Derived classifications** — `is_elderly`, `is_homeless`, `expedited_eligible`. *Computed* by classification rules (which may vary by state via the WHERE shelf), never entered. Each derived fact is itself a traced, cited rule output — so the audit shows *why* someone was classified, not an unexplained boolean.

### Every fact carries a status, not just a value
The piece the engine was missing. A value alone is a lie when it's unverified or machine-read.

```ts
type Fact = {
  key: string                  // "income.monthly", "household.age_max"
  value: unknown
  status: 'verified'           // confirmed against an acceptable document/source
        | 'self_reported'      // applicant-stated, not yet verified
        | 'extracted'          // read by vision-LLM / OCR — carries confidence
        | 'missing'            // required but absent
  confidence?: number          // for 'extracted' (e.g. 0.82)
  source_ref?: string          // document id, payroll-connect pull, etc. — provenance
}
```

`status` + `confidence` + `source_ref` are the difference between a flawless-*looking* and a *defensible* determination — and they are the highest-value signal the Payment Integrity Engine consumes.

### The third outcome: `pending`
Because facts can be `missing` / `self_reported`, a determination has **three** outcomes, not two:

```ts
outcome: 'eligible' | 'ineligible' | 'pending'   // pending → { needs: string[] }
```

`pending` is **not** a denial. It derives mechanically: if a rule needed to reach a decision requires a fact whose `status` is `missing` (or below the bar the rule demands — e.g. `self_reported` where `verified` is required), the outcome is `pending: needs [those facts]`. Most "denials" in the real data ([#420](../findings/2026-05-31-ca-procedural-denial-panel.md), 1-in-4 procedural) are determinations that belonged in `pending`.

The rule that sets the verification bar is itself a **procedural rule** — federal/state, county-invariant — citing **7 CFR 273.2(f)**. It lives *in the engine* and produces `pending`; it is distinct from county-level *execution* variance (does this county actually request the right docs, on time), which is the Payment Integrity Engine's risk model, not the determination. (This is the half of "procedural" a county-only model drops — see [§7](#7--inferred-policy--must-validate-against-primary-regulation-before-encoding) item 8.)

### The determination snapshots its facts
For audit replay to reproduce — the "re-pull gives the same answer" guarantee — a determination must **freeze the fact folder (values *and* statuses) at decision time.** Facts get verified later; re-reading them live would flip a past `pending` to `eligible` and look like an inconsistency when the inputs simply changed. The snapshot is part of the persisted determination, alongside the rule trace.

### Determination request context: `action_type`
`as_of_date` pins *when*; `action_type` pins *what event* is being decided — they travel together:

```ts
action_type: 'initial' | 'recertification' | 'periodic_report' | 'change_report'
```

The same household is re-determined many times, under different rules and deadlines each. Churn ([CF-18](../findings/2026-05-29-cdss-cf18-churn.md), ~5.2% of recerts end in loss for eligible households) lives entirely at `recertification` / `periodic_report` — an engine that models only `initial` cannot see the largest retention surface. Every determination, trace row, and simulation profile carries `action_type`.

### Revised `Determination` (supersedes the L4 sketch)
```ts
type Determination = {
  packet_id: string
  matrix_version: string
  action_type: 'initial' | 'recertification' | 'periodic_report' | 'change_report'
  as_of_date: string                 // the WHEN pin
  outcome: 'eligible' | 'ineligible' | 'pending'
  needs?: string[]                   // populated when outcome = 'pending'
  allotment_cents?: number
  facts_snapshot: Fact[]             // frozen at decision time — makes replay reproducible
  trace: RuleTrace[]                 // every fired rule + citation (as in L4)
}
```

---

## 4. Build phases

Each phase = one PR (per your plan-then-commit-per-step workflow). Phases 1–3 are the critical path; nothing downstream is trustworthy without them.

### ✅ Built so far (2026-06-01) — read-only shadow sweep
A read-only **shadow sweep** wires the existing FastAPI engine over the live packets — a first vertical slice across Phases 1, 2, and 2.5. It changes nothing in the applicant/navigator flow (reads packets, writes determinations).
- **Code:** `backend/civic_api/snap/shadow/` — `rest.py` (schema-aware PostgREST client), `adapter.py` (`packet_answers` → `Household`, provenance-stamped, missing inputs → `needs[]`), `sweep.py` (batch; dry-run default, `--write`, `--demo`).
- **L0 citations:** `backend/civic_api/snap/rules/citations.py` — every trace row gets a `citation_id` (273.4 / 273.5 / 273.9 / 273.2(j) …), lifted from the engine docstrings. ⚠ subsections unverified vs eCFR (see §7).
- **L5 persistence:** migration `20260602_eligibility_determinations.sql` (`eligibility_determinations` + `eligibility_rule_trace`, service-role-only). **Written, not applied.**
- **Fact model (§3):** `Fact.status`/provenance + `pending` + `needs[]` + `action_type` + `facts_snapshot` are implemented in the adapter/sweep. (The federal/state §273.2(f) verification-bar *rules* are still unencoded — the Phase 2.5 remainder.)
- **Tests:** `tests/snap/shadow/test_shadow_sweep.py` — 8 passing (run via system python3; the committed `.venv` shebang is stale, so `.venv/bin/pytest` won't launch on this checkout).
- **Verified:** `--demo` → synthetic complete household resolves `eligible`, $222, 5 cited trace rows; adapter unit-verified on synthetic answers.
- **Two blockers to real determinations** (both surfaced by the build): (1) intake collects no per-member ages/citizenship/assets, so every live packet → `pending` (the sweep's `needs` histogram quantifies it); (2) FY2026 reference tables unloaded (`poverty_guidelines.py` has FY2025 only) → 2026-dated packets raise `NoTableForDateError`, caught + counted. See §7 and [intake-collection-gap.md](intake-collection-gap.md).
- **To activate:** apply `20260602` (SQL-Editor paste) → `python -m civic_api.snap.shadow.sweep` (dry-run) for the gap histogram → `--write` to persist.

### Phase 1 — Citation registry (L0)  · ~1–2 days · zero new runtime code
- **Goal:** every rule already in the five engine homes maps to a named authority.
- **Do:** inventory all cited/implied rules across TS, Python, Swift, JSON. Build `rules/snap/citations/index.yaml`. Write a validator script that fails CI if any current rule references an unknown citation.
- **Exit:** registry covers 100% of currently-encoded rules; validator green; every entry has `last_validated_at` **or** is flagged `null` (→ §7 list).
- **Why first:** nothing has audit integrity without it, and it requires touching no engine.

### Phase 2 — Trace mechanism in the engine of record (L4 + L5)  · ~3 days
- **Goal:** every determination from the engine of record (FastAPI) is auditable end-to-end, *before* the full matrix migration.
- **Do:** add `citation_ids` to the rule definitions; emit `trace[]` (rule_id + citation_id per fired rule) from the FastAPI engine; write migration `<next-free>` (`eligibility_determinations` + `eligibility_rule_trace`); persist on evaluation.
- **Exit:** a determination row + its trace rows are queryable; each trace row carries a `citation_id` resolvable in L0.
- **Note:** the §3 fact contract (status/provenance, `pending`, `action_type`, snapshot) is **Phase 2.5**, not here — it extends the same `Determination` type but is gated on validating the §273.2(f) verification rules first.
- **Note:** works against the *existing* JSON — does not wait on the matrix migration. This is the single highest-leverage change; sequence it as early as Phase 1 allows.

### Phase 2.5 — Fact model & verification bar (§3)  · ~3–4 days
- **Goal:** the engine can answer `pending`, not just eligible/ineligible.
- **Do:** add `Fact.status` / `confidence` / `source_ref`; add the `pending` outcome + `needs[]`; snapshot facts into the determination; add `action_type`; encode the §273.2(f) verification-bar rules that derive `pending`.
- **Blocked on:** §7 item 8 — the verification standards must be validated first; these rules don't exist in code yet.
- **Exit:** a determination with a `missing` / `self_reported` required fact returns `pending: needs [...]`, not `ineligible`; replay reproduces from the fact snapshot.

### Phase 3 — Matrix v0 + loader (L0→L3)  · ~1 week
- **Goal:** one rule source, loaded by the one engine of record.
- **Do:** move uncommitted JSON profiles into `rules/snap/` YAML; add `federal/baseline.yaml` + `federal/shelter.yaml`; add CA/MA inheritance; build the loader/validator into the FastAPI engine; (optional) generate the advisory client preview artifact from the same source.
- **Exit:** the engine of record evaluates profiles from the YAML source; `matrix.lock` gate active; a replay smoke set reproduces.
- **⚠ Note on the uncommitted Swift work:** `JsonDrivenStateRules.swift` + `snap_eligibility_{ca,ma}.json` are now an **advisory client preview**, not the determination of record — fine to land, but label them advisory in code so no one mistakes the iOS preview for the audited artifact.

### Phase 4 — Shelter consolidation  · ~2–3 days
- **Goal:** the ~44%-of-errors path has exactly one home.
- **Do:** move homeless $179 / 50%-AGI floor / cap into `federal/shelter.yaml`; repoint Swift `SNAPBenefitCalculator` and Python to the compiled constant; keep `SHELTER_EFFECT` as the arrangement table but cite each row.
- **Exit:** no shelter constant appears in more than one engine's source; each carries a citation; equivalence test covers elderly/disabled cap branch + homeless branch + motel/weekly discretionary branch.

---

## 5. Stack placement (engine only)

| Layer | Lives in |
|---|---|
| L0 citation registry | `rules/snap/citations/index.yaml` (+ `kind: finding` cross-ref to `docs/findings/`) |
| L1 rule source | `rules/snap/{federal,states}/` (new top-level) |
| L2 loader / validator | into the FastAPI engine of record (reads `rules/snap/` directly — no multi-target compiler) |
| L3 engine of record | `backend/civic_api/snap/rules/` (FastAPI) — evaluates the rules, emits the cited `Determination` + trace |
| L3 advisory clients | `packages/snap-rules` (TS) + `Civica/Features/SNAP/Rules/` (Swift) — previews only, not audited |
| L5 persistence | Supabase migration `20260602` |

---

## 6. What this engine deliberately does NOT do

- It does **not** estimate whether a determination is *correct relative to actual policy*. That is the [Payment Integrity Engine](payment-integrity-engine.md). Conflating the two is the failure mode this whole design exists to prevent.
- It does **not** reuse `packet_error_risk` semantics. That table scores *defensibility* of QC flows; the matrix scores *rule application*. They coexist as distinct objects.
- It does **not** touch `measured_per` / the fidelity firewall (`packet_outcomes` CHECK constraint). The engine produces determinations; only authoritative outcomes (`qc_sample`, `county_authoritative`) move PER. Keep that boundary intact.

---

## 7. ⚠ Inferred policy — must validate against primary regulation before encoding

Pulled from current repo state, **not** from primary regulation. Each becomes an L0 entry with `last_validated_at: null` until confirmed. Do not let an unvalidated rule reach Phase 3 without an explicit decision.

1. **Federal shelter cap, homeless $179, 50%-AGI floor** — scattered in Swift/Python; validate vs 7 CFR 273.9(d) + FY2026 FNS COLA memo. Homeless deduction has annual COLA — confirm the FY26 figure specifically.
2. **CA BBCE 200% FPL threshold** — in `snap_eligibility_ca.json`; confirm vs CDSS MPP-63 / FY26 ACL bulletin.
3. **MA BBCE basis (calendar vs FFY)** — `snap_eligibility_ma.json` shows calendar-basis w/ 2026-02-01 start; unusual — get a primary cite (DTA Online Guide).
4. **SUA values** (CA $663/$170/$20; MA $914/$556/$64) — annual; need state bulletin cites (CalFresh Handbook §63-502.36; MA DTA Online Guide).
5. **20% earned-income deduction** — federal; confirm OBBBA didn't move it (per `2026-05-30-obbba-10105-grounding`, OBBBA touches cost-share, not deduction math — verify).
6. **ABAWD post-OBBBA exemption/waiver methodology** — `JsonDrivenStateRules.abawdWaiverActive` reads `waivers[]`; underlying federal methodology changed under OBBBA — get a current FNS reading.
7. **CA LPIE student exemption** — `CAStateRules.swift`'s only logic override; CDSS interpretation has churned — pin a current ACL/FAQ.
8. **Verification standards per element (7 CFR 273.2(f))** — what each fact must show to count as `verified` (vs `self_reported`), and which elements are mandatory-verify. This is the rule that produces the `pending` outcome (§3), and it is **absent from current code** — the engine has no verification-bar rules yet. Validate the federal floor + any CA/MA additions.
9. **Recert / periodic-report rule deltas** — whether `recertification` / `periodic_report` carry different determination rules, deadlines, or verification bars than `initial` (§3 `action_type`). Confirm vs 7 CFR 273.10 / 273.14 + state recert procedure.

---

## 8. Future phases (out of scope here — pointers only)

- **Component B — Simulation harness:** `tools/snap-sim/` + tiered profile fixtures (clear-approve / clear-reject / edge-case), batch-run through the matrix, golden-file regression in CI. **Depends on L4 trace** (asserts `citation_must_appear`). Edge cases seed from findings #417 (elderly×shelter 3.6×), #420 (CA procedural denial 1-in-4), LPIE/BBCE/ABAWD boundaries.
- **Payment Integrity Engine** (was "Component C") — reconcile · measured PER · error-prediction. Now its own doc: [payment-integrity-engine.md](payment-integrity-engine.md). **Depends on this engine's L4+L5** (its inputs = the cited determination + fact snapshot).

Each gets its own plan doc when we reach it.
