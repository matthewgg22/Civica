# Mae training backlog — from the 2026-07-23 FOIA data

> **Source:** [`FOIA_DATA_AUDIT_2026-07-23.md`](../../FOIA_DATA_AUDIT_2026-07-23.md) (CDSS QC scorecards + 38 county ME reports + ABAWD/OBBBA policy + Texas comparator).
> **Goal:** turn the FOIA productions into concrete improvements to Mae's *answers* and *policies*.
> **How Mae "learns":** she is a citation-grounded RAG assistant, not a fine-tuned model — so every task below feeds one of her three real seams:
> 1. **Corpus / retrieval** — `apps/dashboard/lib/mae/corpus/`, `retrieval.ts`, `embeddings.ts`, `freshness.ts`
> 2. **System prompt / policy** — `apps/dashboard/lib/mae/system-prompt.ts` (byte-stable cached block)
> 3. **Eval set** — `apps/dashboard/lib/mae/eval/frontdoor-questions.ts` + `answer-eval.ts` + faithfulness (`citation-verifier.ts`)
>
> The single richest asset is the **ME denial/termination error taxonomy** (14 themes; audit §2b): it is a ranked list of the exact mistakes CA caseworkers make, so it converts directly into (a) knowledge Mae should hold, (b) guardrails that make Mae *warn* about them, and (c) eval questions that prove she does.
>
> ⚠️ **Not engine math** — Mae produces guidance text, never a determination (see the header of `system-prompt.ts`). These tasks do **not** touch `packages/snap-rules/` and are **not** subject to the engine-math "file an issue first" rule.

**P0 tasks filed as GitHub issues (2026-07-23):** A1 → [#576](https://github.com/matthewgg22/Civica/issues/576) · A2 → [#577](https://github.com/matthewgg22/Civica/issues/577) · B1 → [#578](https://github.com/matthewgg22/Civica/issues/578) · B2 → [#579](https://github.com/matthewgg22/Civica/issues/579) · C1 → [#580](https://github.com/matthewgg22/Civica/issues/580). P1/P2 remain in this doc until scheduled.

---

## Workstream A — Corpus / knowledge (what Mae retrieves & knows)

| # | Task | FOIA source | Mae file(s) | Pri |
|---|---|---|---|---|
| **A1** | **ABAWD / OBBBA §10102 policy pack.** Add a curated corpus doc: age band **18→64**, dependent-child exemption **<18→<14**, the 7 current exemptions (incl. new **Indian/Urban/California Indian**) *with per-exemption verification*, the 3 **removed** (homeless/veteran/former-foster), 3-in-36 time limit + 80 hrs/mo, workfare-hours math (allotment ÷ county min wage), and the **CA effective date 2026-06-01** (gated on statewide waiver expiring 2026-01-31 + forthcoming CDSS ACL). Flag exemptions marked **"pending FNS guidance"** as not-yet-final. | R012680 ABAWD Fact Sheet + CF 886 + ABAWD deck; LA ABAWD Newsletters (audit §5, §7) | `corpus/` + `freshness.ts` | **P0** |
| **A2** | **Anti-over-verification knowledge.** Add the verification-*limits* rules the ME reports show being violated: the "questionable" standard (**7 CFR 273.2(f)(4)** — don't request verification unless the case record documents why it's questionable; **CDSS ACL 21-58**), use **The Work Number before** requesting income docs, ES 3-day / 30-day deadlines, and "don't re-request what's already on file." This is the knowledge behind guardrail B1. | ME taxonomy themes #1,#3,#5,#7,#8,#9 (audit §2b) | `corpus/` | **P0** |
| **A3** | **Multi-state ABAWD (generalist path).** Add Texas's implementation for the "what about Texas?" path: **Nov 1 2025** hard cutover, **Form H1805**, MEPD/TW **Bulletin 25-16**, 60–64 subject-to-time-limit-but-E&T-exempt. | TX corpus (audit §4c/§5) | `corpus/` | P2 |
| **A4** | **Freshness / citation registry entries** for every FOIA-sourced fact with an effective date or form number (CA ABAWD 2026-06-01, CF 886 rev 8/25, CF 377.11E, ACL 21-58) so `freshness.ts` can flag staleness and the citation layer can verify them. | audit §5, §7 | `freshness.ts`, `engine-citations.ts` | P1 |

## Workstream B — System prompt / policy (how Mae behaves)

| # | Task | FOIA source | Mae file | Pri |
|---|---|---|---|---|
| **B1** | **Procedural-error guardrail.** Add a short block instructing Mae, when a caseworker's question touches verification/denial/notices, to proactively surface the top *documented* CA error modes and steer away from them — over-verification (#1, 37/38 counties), NOMI-after-interview, ES-entitlement misses, denial-after-day-30, unexplored student exemptions, CalSAWS reason-code/NOA mismatch. Frame as "the most common documented CA error here is X — confirm you're not doing it." Keep it byte-stable & short (cache invariant). | ME taxonomy (audit §2b) | `system-prompt.ts` | **P0** |
| **B2** | **Sharpen the ABAWD block.** The prompt already has age-64 + removed exemptions; add the **CA effective date (2026-06-01, not the 2025-07-04 federal signing)**, the **CF 886 / CF 377.11E** forms, and the **"pending FNS guidance"** caveat so Mae doesn't state unfinalized CA specifics as settled. | audit §5, §7 | `system-prompt.ts` | **P0** |
| **B3** | **"Correctness, not burden" ethos.** When asked "should I request/verify X?", default Mae to: is it actually *questionable* per the record? If it's on file or not questionable, **don't** request it. Encodes the Guarino finding + the over-verification data into behavior. | ME theme #1/#3 + finding `2026-05-29-guarino-error-rate-metric` | `system-prompt.ts` | P1 |

## Workstream C — Eval set (measure Mae's answers)

| # | Task | FOIA source | Mae file | Pri |
|---|---|---|---|---|
| **C1** | **Real denial-scenario eval questions (~15).** Turn ME case narratives into `FrontDoorCase`s with expected authority: "Household already submitted pay stubs — do I request them again?" (expect: over-verification guardrail + 273.2(f)); "NOMI — when is it valid?"; "Applicant is ES-eligible — what's my deadline?"; "Denied on day 32 — valid?"; "Did we explore student exemptions?"; "CalSAWS reason code ≠ action — problem?". | ME taxonomy (audit §2b) | `eval/frontdoor-questions.ts` | **P0** |
| **C2** | **ABAWD-2026 CA eval questions.** "Does the time limit apply to me at 60?" (E&T-exempt but time-limited), "When does CA start screening?" (2026-06-01), "Am I exempt as a veteran?" (no longer), "child under 14 vs 18?". Some already exist as `superseded`; add the CA-effective-date + forms cases. | audit §5 | `eval/frontdoor-questions.ts` | P1 |
| **C3** | **Over-verification adversarial eval.** A few cases that *tempt* Mae to tell a caseworker to over-verify; the answer-eval should FAIL if Mae recommends requesting docs already on file / not questionable. | ME theme #1 | `eval/frontdoor-questions.ts` + `answer-eval.ts` | P1 |

## Workstream D — Guardrail / faithfulness tests

| # | Task | Mae file | Pri |
|---|---|---|---|
| **D1** | Ensure `citation-verifier.ts` accepts the new primary-source cites (ACL 21-58, CF 886, CF 377.11E) so faithful answers aren't flagged. | `citation-verifier.ts` + `__tests__/` | P1 |
| **D2** | Regression test: Mae never recommends over-verification / requesting docs already on file (guards B1/B3). | `lib/mae/__tests__/` | P1 |

## Workstream E — Evidence provenance

| # | Task | Pri |
|---|---|---|
| **E1** | Write `docs/findings/2026-07-23-procedural-over-verification-dominant.md` (CDSS ME reviews, 37/38 counties) so Mae's answers can cite a Civica finding, not just chat. Add to `INDEX.md`, `make findings`. | P1 |
| **E2** | *(optional, P2)* County-specific coaching from the ME/QC panel (e.g., surface a county's known error pattern). Risk: overfitting to tiny samples — gate on sample size. | P2 |

---

## Suggested sequence (P0 first)
1. **A1 + A2** (corpus: ABAWD pack + anti-over-verification) → gives Mae the facts.
2. **B1 + B2** (prompt: procedural guardrail + CA ABAWD sharpening) → changes behavior.
3. **C1** (eval: real denial scenarios) → proves 1–2 worked; run `run-live-answer-eval`.
4. Then P1 (B3, A4, C2/C3, D1/D2, E1).

**Watch-outs:** (a) `system-prompt.ts` MUST stay byte-stable per request (prompt-cache invariant) — B-tasks add static text, never per-request values. (b) Several ABAWD specifics are "pending FNS guidance" — encode them as *pending*, not settled. (c) County-level QC/ME numbers are small-sample (audit §9) — do NOT let Mae quote a single county's PER as fact.
