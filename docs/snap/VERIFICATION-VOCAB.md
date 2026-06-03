# SNAP engine verification vocabulary

A controlled vocabulary. **Use these terms only.** Synonyms drift; audits get lost in translation.

When you write a commit message, finding doc, audit row, or conversation about engine correctness, every term below has exactly one meaning. If you mean a different thing, the right move is "this concept is not in the vocab — let's add it."

## The four sides of any disagreement

When the engine and the test oracle disagree on a case, the disagreement has exactly one of these labels:

| Term | Meaning |
|---|---|
| **ENGINE_BUG** | The engine produces a result that the cited regulation says is wrong, verified against verbatim primary-source text. |
| **ORACLE_BUG** | The test oracle's expected value is wrong per the cited regulation, verified against verbatim primary-source text. |
| **BOTH_DEFENSIBLE** | The regulation is genuinely ambiguous or the cited subsection authorizes more than one outcome. Both engine and oracle are within the rule. |
| **NEEDS_FACTS** | Cannot decide without seeing the actual fact data (`facts_patch` JSON, dollar amounts, dates, member statuses). |

Do not use: "engine wrong," "test wrong," "code defect," "test author error," "expected-value mismatch," "fixture bug." Use the four labels above.

## The four levels of evidence

When you make any claim about a regulation, citation, or rule, the claim is at one of these levels:

| Term | Meaning |
|---|---|
| **VERIFIED** | The verbatim text of the controlling regulation, statute, or FNS memo was fetched in this session and quoted. Cite the URL + the quote. |
| **INHERITED** | A prior session, agent, or reviewer who fetched the verbatim text reached this conclusion. You did not re-fetch. Trust at your own risk; flag for re-VERIFY before high-stakes use. |
| **RECALLED** | The claim comes from agent memory or general training knowledge. No fetch. Treat as a hunch. |
| **NOT_RESOLVED** | Attempted to fetch but could not reach the primary source (blocked, 403, redirect, expired URL). Honest unknown. |

Do not use: "confirmed," "checked," "high confidence," "I'm pretty sure." Use the four labels above. The only thing that should ever say "confirmed" is something at the **VERIFIED** level with the URL and the quote alongside.

## The components of a SNAP determination

When you talk about what the engine produces or what a caseworker needs, use these terms exactly:

| Term | Meaning |
|---|---|
| **verdict** | The high-level outcome: APPROVE / DENY / PEND. Three values, no others. |
| **benefit** | The monthly dollar amount. Only meaningful when `verdict = APPROVE`. |
| **worksheet** | The full set of intermediate values that produced the verdict: gross income, each deduction by name, adjusted income, shelter calc, net income, threshold tested against, final benefit formula. |
| **citation** | A regulatory pointer at the precision a caseworker would write in a case file: `7 CFR 273.4(a)(6)(ii)(A) — refugee, no 5-year bar`. Not `7 CFR 273.4` alone. |
| **deficiency** | A specific missing or contradictory piece of information that would cause a PEND. Each deficiency has a citation, a description, and a cure-by deadline. |
| **expedited determination** | A separate decision (not the same as verdict) about whether the household qualifies for 7-day processing per `7 CFR 273.2(i)`. |
| **recertification cycle** | The certification period the verdict is good for: 12-month default, 24-month for elderly/disabled, shorter for transitional. |

Do not use: "decision" (use verdict), "outcome" (use verdict), "amount" (use benefit), "math" (use worksheet), "rule" (use citation), "missing doc" (use deficiency), "expedited" alone (use expedited determination).

## The components of the verification framework

When you talk about the layers of the verification machinery itself, use these:

| Term | Meaning |
|---|---|
| **harness** | The system that runs the engine against the v0.6 oracle and reports verdict-level agreement. Output: PASS/FAIL/SKIP counts. |
| **oracle** | The v0.6 test profile fixture. 129 hand-authored profiles, each with `expected_by_state` per-state expected verdicts. |
| **lint** (Layer 3) | The registry staleness check. Catches expired or unowned constants. Does not check correctness. |
| **metamorphic** (Layer 1a) | The engine self-consistency check. Tests properties that should always hold (monotonicity, determinism). Does not check correctness. |
| **mutation score** | The independence test: deliberately break the engine, see if the harness notices. |
| **PolicyEngine pairing** | The third-source benefit corroboration: independently-authored AGPL SNAP model. |
| **registry** | The single source of truth for engine constants + citations. Lives at `packages/snap-rules/src/registry/fy26.yaml`. |
| **finding** | A dated, evidence-backed claim. Lives at `docs/findings/YYYY-MM-DD-slug.md`. Cite findings by id in commits + conversation. |

Do not use: "the test" (be specific: harness, lint, or metamorphic), "the engine's tests" (use harness or vitest depending on context), "the data" (use oracle or registry).

## The agents

Several voices have weighed in across sessions. Each has one role:

| Term | Role |
|---|---|
| **harness operator** | The person running `/profile-simulation`. Usually you. |
| **engine author** | Whoever wrote the engine code. Usually Claude. |
| **oracle author** | Whoever wrote the v0.6 test profile fixture. Usually Claude in a prior session. |
| **caseworker reviewer** | A character lens (Marlene Voss). Brings 28 years of real-world SNAP eligibility reasoning. Not an oracle for regulatory text — still has to fetch. |
| **fresh-eyes reviewer** | A general-purpose subagent dispatched to audit without prior session context. Independent perspective. Still subject to the four levels of evidence. |
| **outside reviewer** | A human reviewer outside the agent session who has fetched primary sources independently. Highest-trust verification when their citations are VERIFIED. |

Do not use: "the agent," "another reviewer," "a previous pass," "I checked." Be specific about role + evidence level.

## Reversal protocol

When a later review reverses a prior call:

1. Name the previous call and its evidence level.
2. Name the new call and its evidence level.
3. The reversal sticks only if the new call is at a STRICTLY HIGHER evidence level. (NOT_RESOLVED < RECALLED < INHERITED < VERIFIED.)
4. If the new call is at the same or lower level as the prior call, it is a **dispute**, not a **reversal**. Disputes wait for a VERIFIED check.

Example (from this session):
- P63 (VISTA): RECALLED → INHERITED → VERIFIED (outside reviewer quoted §273.9(b)(1)(iv) + (c)(10)(iii) verbatim). Reversal sticks. Engine is wrong.
- D07 (refugee): VERIFIED-via-triple-check → NOT_RESOLVED (fresh eyes blocked from primary) → VERIFIED-via-FNS-memo. Two VERIFIED calls agree; the NOT_RESOLVED middle pass did not unsettle them. Engine is wrong.

## Bottom line

If a sentence in a commit message, conversation, or audit doesn't use these terms — or uses them with a different meaning — flag it and rewrite. The friction is the point: it forces the speaker to be precise about whether they fetched, what they fetched, and which side they're claiming is wrong.
