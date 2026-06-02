# SNAP Rules — the audit pathway (how it all ties together)

**Status:** draft · **Date:** 2026-06-01 · **Companion to:** [snap-rules-matrix.md](snap-rules-matrix.md)

One determination, read two ways. **Forward** = how we *create* an auditable determination. **Backward** = how an auditor (federal QC reviewer, our own QC, or counsel) *reproduces and defends* it. The backward read is the pathway of audit, and it's the reason every earlier design choice exists.

> **The one invariant the whole pathway protects:** it proves we applied **our** rules identically and can cite each one (*rule-execution consistency*, target ~100%). It does **not** prove our rules match *actual policy* (*payment error rate*, can be nonzero). The gap between the two is owned elsewhere — see [§4](#4-the-boundary-what-audit-proves--what-it-doesnt).

---

## 1. Forward — creating the determination

```
                ┌──────────────────────────────────────────────────────┐
                │                A SINGLE DETERMINATION                  │
                └──────────────────────────────────────────────────────┘

  ① INPUT      profile = household facts
               (incl. special-circumstance facts: homeless · elderly/disabled · destitute)
                     │   facts are WHAT rules READ — they are not a selector
                     ▼
  ② RESOLVE    for each rule, answer the four questions to pin exactly ONE version:
                 WHERE  jurisdiction LAYERS    cascade federal→state→county, floor wins
                 WHEN   effective-date TIMELINE pin to the ACTION DATE   ◄── reproducibility
                 WHAT   rule-class CATEGORIES   substantive · procedural · channel
                 WHICH  program-rail SWITCH     standard · BBCE · CFAP
                     │
                     ▼
  ③ EXECUTE    run the resolved rules.  each rule = predicate(facts) → effect
                 effect_type:  EMIT · MODIFY · WAIVE · SET-DEADLINE · SHORT-CIRCUIT
                 (e.g. "homeless" fact → MODIFY shelter deduction + SET-DEADLINE expedite)
                     │
                     ▼
  ④ TRACE      every fired rule emits ONE trace row:
                 { rule_id, citation_id, predicate_inputs,
                   predicate_result, effect_applied, matrix_version, evaluated_at }
                     │
                     ▼
  ⑤ DETERMINE  Determination {
                   outcome, allotment_cents, trace[], matrix_version, action_date }
                     │
                     ▼
  ⑥ PERSIST    append-only:  eligibility_determinations  +  eligibility_rule_trace
               immutable — never updated. Supersede, don't edit.
```

---

## 2. Backward — the pathway of audit (replay & defend)

```
                ┌──────────────────────────────────────────────────────┐
                │     "Reproduce determination #D, and defend it."       │
                └──────────────────────────────────────────────────────┘

  Ⓐ PULL       read #D  →  { matrix_version, action_date, trace[] }
                     │
                     ▼
  Ⓑ REPLAY     re-resolve every rule with  WHEN = action_date
               (the timeline makes this deterministic — we get the rules as they
                were THEN, not as they are today), re-execute against the same facts
                     │
                     ▼
  Ⓒ CONSISTENCY   replayed outcome  ==  stored outcome ?
                 ✓ → rule-execution consistency held  (target ~100%)
                 ✗ → a BUG. This is the ONE thing this layer must never allow.
                     │
                     ▼
  Ⓓ DEFEND     for each trace row:  citation_id → L0 citation registry → primary regulation
               every step cites an authority — or the build never shipped (Phase 1 gate)
                     │
                     ▼
  Ⓔ EXAM-READY hand the auditor three things:
                 1. the rules in effect on the action date   (WHEN + matrix_version)
                 2. the decision trail                       (trace[])
                 3. the citation behind each step            (citation registry)
               ── this bundle IS the institutional value prop ──
```

The forward pathway makes determinations; the backward pathway is what a federal QC exam actually demands. Designing for the backward read is why `action_date` resolution (WHEN) and the citation registry (L0) are load-bearing rather than nice-to-have.

---

## 3. Worked example (one determination, both directions)

**Input ①:** CA household, 2 members, head age 72 (elderly), claims shelter cost, action_date `2026-03-15`.

**Resolve ② → Execute ③ → Trace ④** produces:

| rule_id | WHERE / WHEN / WHAT / WHICH | effect_type | result |
|---|---|---|---|
| `income.gross_test` | fed / FY26 / substantive / standard | `WAIVE` | elderly → **no gross-income test** |
| `shelter.excess_deduction` | state:CA / FY26 / substantive / standard | `MODIFY` | shelter cap **lifted** (elderly/disabled) |
| `deduction.standard` | fed / FY26 / substantive / standard | `EMIT` | applied |
| `processing.timeliness` | fed / current / procedural / standard | `SET-DEADLINE` | 30-day (not expedited — see flag) |

**Determination ⑤:** `eligible`, allotment computed with uncapped shelter, 4 trace rows, `matrix_version = CA-1.x`, `action_date = 2026-03-15`.

**Audit Ⓐ–Ⓔ:** pull #D → replay every rule as of `2026-03-15` → identical outcome (✓ consistency) → each trace row's `citation_id` resolves (`7CFR273.9(d)(6)` for the uncapped shelter, etc.) → exam bundle handed over.

> ⚠ **Inferred — validate before encoding:** the elderly gross-test waiver, the elderly/disabled uncapped shelter, and the 30-day vs expedited deadline are stated structurally here, not from primary regulation. Confirm vs 7 CFR 273.9 / 273.10 / 273.2(i). Each becomes an L0 entry; an unvalidated one is flagged `last_validated_at: null`.

---

## 4. The boundary — what audit proves & what it doesn't

```
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  PROVES  →  RULE-EXECUTION CONSISTENCY                                       │
 │            "we applied OUR codified rules identically + can cite each one."  │
 │            target ~100%.  any deviation is a bug, caught at step Ⓒ.          │
 │                                                                              │
 │  DOES NOT PROVE  →  PAYMENT-ERROR-RATE CORRECTNESS                           │
 │            "our codified rules match ACTUAL policy / what a caseworker       │
 │             would determine."  can be nonzero even at 100% consistency,      │
 │             because our rules may be incomplete or wrong vs real policy.     │
 │            measured ONLY by authoritative ground truth (qc_sample,           │
 │             county_authoritative) under the fidelity firewall —             │
 │             never inferred from the trace.                                   │
 └────────────────────────────────────────────────────────────────────────────┘
```

The audit pathway is the *floor*: if we can't even replay our own determination and cite it, nothing else matters. It deliberately stops short of judging whether our rules are *right* — that judgment needs ground truth, and that's a different component.

---

## 5. Where the other two components attach

```
   Component A  (this pathway)  ──────────────────────────────────────────────►
       │  produces persisted, cited, replayable determinations
       │
       ├── Component B — SIMULATION HARNESS
       │     runs the FORWARD pathway on ~50 tiered test profiles;
       │     the BACKWARD replay (step Ⓒ) is the regression check.
       │     → exercises rule-execution consistency at BUILD time, before any real packet.
       │
       └── Component C — ERROR PREDICTOR
             rides on the persisted trace[]; estimates P(our rule ≠ actual policy)
             and routes high-risk determinations to human review.
             → targets exactly the gap §4 says the audit pathway does NOT close.
             → improves only as authoritative ground truth feeds back (the firewall feed).
```

B proves we're *consistent*. C predicts where consistent-but-possibly-*wrong*. Neither can exist before A's trace + citation layers — which is why [snap-rules-matrix.md](snap-rules-matrix.md) builds Phase 1 (citations) and Phase 2 (trace) first.

---

## 6. Concept map — everything we discussed, on the pathway

| Concept | Where it lives on the pathway |
|---|---|
| The four questions (where/when/what/which) | step ② RESOLVE |
| Jurisdiction **layers** (cascade + floor) | the WHERE question |
| Effective-date **timeline** (action-date pin) | the WHEN question — makes Ⓑ deterministic |
| Rule-class **categories** | the WHAT question |
| Program-rail **switch** | the WHICH question |
| `effect_type` (EMIT/MODIFY/WAIVE/…) | step ③ EXECUTE |
| Special-circumstance facts (homeless, elderly) | step ① INPUT → trigger non-EMIT effects in ③ |
| Trace rows (L4) | step ④ TRACE |
| Persistence (L5) | step ⑥ PERSIST |
| Citation registry (L0) | step Ⓓ DEFEND |
| Rule source / compiler / runtime (L1–L3) | feed ② and ③ (build-time, off the runtime path) |
| Consistency vs PER distinction | §4 boundary |
| Components B & C | §5 |
