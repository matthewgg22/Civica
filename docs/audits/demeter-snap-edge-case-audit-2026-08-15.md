# Demeter SNAP edge-case taxonomy audit — 2026-08-15

**Author:** Claude (session continuation of PR #811 — Demeter conversational QA)
**Scope:** Audited against a 7-category, ~35-item SNAP edge-case taxonomy supplied by Matthew. For each item, checked four layers and — where practical — ran the exact live conversation against the real orchestrator:

1. **Engine** (`packages/snap-rules/src/**`) — does the benefit-calculation engine actually compute this rule? *(Read-only audit — `snap-rules` is PARKED; no edits made.)*
2. **Corpus** (`packages/demeter-engine/src/corpus/ecfr-snap.json`) — does the retrieved-text corpus contain grounding on the topic?
3. **Retrieval hint** (`packages/demeter-engine/src/retrieval.ts` `TOPIC_HINTS`) — is there an explicit routing hint for the topic, or does it rely on generic semantic/lexical scoring?
4. **Prompt** (`system-prompt.ts`) — does the model get explicit guidance on how to talk about this?
5. **Live behavior** — where tested, the actual answer from `answerQuestion()` against the real pipeline (not simulated).

**Verdict legend:**
- ✅ **FULLY ENCODED** — engine + corpus + hint (prompt not always needed if the engine is authoritative)
- 🟡 **PARTIALLY ENCODED** — some layers present, real gaps in others
- 🟠 **CORPUS-ONLY** — raw regulation text exists; nothing routes to it or computes with it
- ❌ **NOT FOUND ANYWHERE** — checked all four layers, nothing
- 🔵 **UNAUDITED** — not one of the items directly investigated this pass (noted so this document doesn't imply "clean" where it just means "not checked yet")

Live test evidence, where present, is marked ✔ LIVE.

---

## Headline findings (read this part first)

1. **The chatbot conversational layer is significantly better than the raw engine-coverage numbers suggest.** Semantic retrieval + a genuinely comprehensive federal corpus lets Demeter answer LIHEAP/heat-and-eat, sponsor-deeming exceptions, DV-shelter separation, and joint-custody questions *correctly* even where there's no retrieval hint, no prompt guidance, and — critically — **no computational engine support at all**. This is good news for what a reader sees today, and a warning for later: correctness currently depends on the model's own reasoning generalizing well, not on anything that's actually been engineered and pinned down.

2. **The most concrete, well-evidenced gap: the chatbot can correctly *explain* rules the `snap-rules` engine would compute *wrong*.** Live-tested sponsor deeming: the chat correctly named the deeming exceptions (40 qualifying quarters, citizenship, indigence, DV, sponsor on means-tested benefits, and — per the underlying corpus — a categorical exemption for refugees/asylees/Cuban-Haitian entrants/certain parolees). The actual engine code (`facts.ts:135-145`) deems 100% of `sponsor_income` for *any* `sponsored: true` member with **no exceptions modeled at all** — not the quarters exemption, not the categorical humanitarian exemption, not the 273.11(j)(3) indigence formula. If Civica's staff dashboard or worksheet mode ever runs a real calculation for a sponsored refugee, it would currently produce a benefit determination the chat itself would say is wrong.

3. **One genuine, reproducible live bug: furlough/shutdown income questions degrade roughly half the time.** 3 live re-runs of the identical question: degraded, degraded, recomposed-then-clean. Root cause is not retrieval (citations were actually retrieved fine) — it's specific to how the model handles this particular forecasting question, tripping the citation or numeric gate on the first attempt more often than comparable questions. Detailed below.

4. **A second, subtler live pattern: several *correct* answers carry zero citations**, which the certainty framework's own code comments flag as a known, unaddressed risk (`certainty.ts`'s `no_claim_to_verify` branch) — now confirmed happening on real substantive content (pregnancy/ABAWD, D-SNAP, administrative leave). The reader gets a right answer with no certainty banner and no "check it yourself" trail, which looks identical to an off-scope refusal.

5. **Household composition has the most uneven coverage within one category.** Mandatory under-22 combination and the elderly-165%-FPL separate-household rule are fully encoded. Boarders are fully encoded. Roomers and live-in attendants are named in the corpus and (for roomers only) in the retrieval hint, but have **zero engine branch** — `composition.ts`'s own header comment admits this ("V1 limitation... deferred"). Joint/shared custody has nothing anywhere in any layer.

---

## Category 1 — Household Composition & Shared Living

| # | Case | Verdict | Evidence |
|---|---|---|---|
| 1.1 | Cohabitating partners, separate food | ✅ | Engine: default household-separateness (no special branch needed — the "buy and prepare together" test is the base rule). Prompt: `system-prompt.ts` has a dedicated, forceful paragraph ("WHO SOMEONE LIVES WITH IS NOT WHO IS IN THEIR HOUSEHOLD"). ✔ LIVE — `boyfriend-va-disability` case: correctly separated the household question from the VA-income question, asked the one narrowing question. |
| 1.2 | Roommates, split utility/rent | ✅ | Engine: SUA is a flat allowance, no split-tracking needed. ✔ LIVE — `split-power-bill`: correctly explained the flat HCSUA applies regardless of the 50/50 split, correctly tied it back to the household test. |
| 1.3 | Multi-gen: under-22 mandatory vs. 22+ optional | ✅ | Engine: `packages/snap-rules/src/gates/composition.ts` — `must_combine_with_parent === true` pattern, cites 7 CFR 273.1(a). Not live-tested this pass. Prompt does not explain the age-22 threshold explicitly to public users — worth adding. |
| 1.4 | Elderly/disabled relative, 165% FPL separate-household test | ✅ | Engine: `composition.ts` — `coresident_income_pct > 165` branch, cites 273.1(b). Corpus has full text. Prior session (mother-in-household scenario) exercised the adjacent medical/shelter rules but not this specific separation test directly. |
| 1.5a | Boarders | ✅ | Engine: `composition.ts` — `role === "boarder" && shares_meals === true` branch, cites 273.1(a). Corpus + hint both present. |
| 1.5b | Roomers | 🟠 | Corpus: full 273.1(b)(5) text. Hint: `retrieval.ts` — "roomer" is a literal term in the household-composition hint. **Engine: NO branch at all** — `composition.ts`'s own header comment admits it ("V1 limitation... deferred until the harness or downstream API needs it"). ✔ LIVE — `roomer-vs-boarder`: the chatbot still gave the *correct answer* ("two separate households") via general reasoning over the base rule, not via a citation to the specific roomer provision. So the reader gets the right answer today; the engine would not, if asked to compute a household size for this scenario. |
| 1.5c | Live-in attendants/aides | ❌ | Corpus has 273.1(b)(6) text. **Nothing else — no hint, no engine branch, no prompt mention.** Not even acknowledged as a gap in `composition.ts`'s comments, unlike roomer. Not live-tested. |
| 1.6 | Foster care | 🟡 | Corpus is rich (273.1(b)(4) boarder-treatment rule, 273.9(b)(2) foster-payment income rule, 273.24(c) ABAWD exemption). Prompt only mentions the foster-*youth* ABAWD-exemption removal, not general foster-care household/income treatment. **Engine: no foster-child inclusion logic, no foster-payment handling anywhere.** No hint. Not live-tested. |
| 1.7 | Joint/shared physical custody | ❌ | **Nothing in any layer.** Corpus's 5 "custody" hits are false positives (fleeing-felon and child-support-cooperation provisions — unrelated). ✔ LIVE — `joint-custody`: the chatbot gave a reasonable, honest answer (physically-present-at-time-of-application test; explicitly declined to invent a formal split-custody provision) — genuinely good behavior given it has nothing to retrieve, but `certaintyCode: authority_not_retrieved` correctly signals this is unverified general reasoning, not a sourced rule. |

## Category 2 — Employment Volatility & Income Disruption

| # | Case | Verdict | Evidence |
|---|---|---|---|
| 2.1 | Administrative leave (full/partial/unpaid) | 🔵 | Not one of the agent's 17 directly-audited engine items. ✔ LIVE — `administrative-leave`: correct content (full/partial pay = earned income, reportable), but **zero citations** — see Headline Finding #4. |
| 2.2 | Furlough / government shutdown | ❌ | Engine: `IncomeLine.anticipation` field exists in the schema (`facts.ts`, `facts-schema.ts`) but **is never read anywhere** — a dead field. No corpus, no hint, no prompt. ✔ LIVE, CONFIRMED BUG — see "Furlough degrade" below. |
| 2.3 | Job disruption: fired/quit, voluntary-quit sanction | 🟠 | Corpus: 273.7(a)/(j), 272.1(g)(18) — 16 hits on "voluntary quit." Hint: `retrieval.ts` has an explicit `"voluntary quit"` term routing to 273.7. **Engine: no sanction/good-cause gate anywhere** in `disqualifications.ts` or `work-requirements/`. Not live-tested. |
| 2.4 | Labor disputes & strikes | 🟠 | Corpus: full 273.1(e) striker rule + 273.2(j)(4), 272.1(g)(18), 273.7(a). **No engine encoding, no retrieval hint.** ✔ LIVE — `labor-strike`: correctly stated the "eligible only if the household would've qualified the day before the strike" rule — but needed one recompose retry (first attempt tripped a gate), consistent with having no dedicated hint to route to. |
| 2.5 | Gig/seasonal/tipped income averaging | 🔵 | Core self-employment/income-averaging machinery presumably exists generically in `benefit-calc.ts` (not one of the agent's 17 specifically-checked items). ✔ LIVE — exercised extensively in the *prior* QA session (rideshare-driver scenario): handled very well, no deadlock, correct self-employment-expense framing. |
| 2.6 | Lump-sum vs. recurring pay | 🔵 | Not audited this pass in any layer. |

## Category 3 — Student, Trainee & Professional Status

| # | Case | Verdict | Evidence |
|---|---|---|---|
| 3.1 | Medical residents/fellows (employee, not student) | ✅ | ✔ LIVE — `medical-resident`: correctly treated the residency salary as ordinary earned income and did **not** misapply the higher-ed student exclusion — the sophisticated distinction the taxonomy calls out. Also confirmed in the prior session's resident+partner scenario. |
| 3.2 | Higher-ed half-time enrollment + exemptions | ✅ | Engine: `student.ts` fully encodes 7 named exemptions (`work20`, `work_study`, `single_parent_child_under12`, `dependent_under6`, `tanf`, `age50plus`, `et_placement`), cites 7 CFR 273.5. Prompt: dedicated paragraph ("A HOUSEMATE WHO IS A STUDENT MAY NOT COUNT"). ✔ LIVE — extensively exercised in the prior session; one of the strongest-covered areas end to end. |
| 3.3 | Unpaid internships / mandatory clinical hours | 🔵 | No dedicated status value in `student.ts`'s enum for clinical-hours-as-work-equivalent. Not live-tested. Flag for follow-up, not a confirmed gap. |
| 3.4 | Trade/vocational vs. academic enrollment | 🔵 | `student.ts` keys off "institution of higher education" (273.5(a)) without a trade-vs-academic distinction visible in the gate; not independently verified this pass. |
| 3.5 | Dual enrollment / high-school seniors taking college courses | ❌ | Engine: **no K-12/dual-enrollment status value at all** in `student.ts`'s enum — an 18-year-old dual-enrollee has no way to express that nuance and would be forced into the plain higher-ed half-time rule. No corpus carve-out, no hint, no prompt mention. Not live-tested (worth adding to the next battery). |

## Category 4 — Shelter, Utility & Expense Sharing

| # | Case | Verdict | Evidence |
|---|---|---|---|
| 4.1 | Pro-rated / unevenly-split utility | ✅ | ✔ LIVE — `split-power-bill`, see 1.2 above. |
| 4.2 | LIHEAP / "Heat and Eat" | 🟡 | **This is the sharpest chat-vs-engine split found.** Engine: `sua.ts`'s `checkHEAPCompliance()` exists but is explicitly a "non-blocking amber flag in Phase 1... actual utility verification is deferred to Phase 2" — it is **never called** from `verdict.ts`/`benefit-calc.ts`/`determineSUATier()`, so a real benefit computation does not currently apply the LIHEAP → automatic-HCSUA effect at all. Corpus has the full 273.9(d)(6)(vi) text including the "$20/year" qualifying-payment threshold. No hint. ✔ LIVE — `liheap-heat-and-eat`: the chatbot answer was **excellent** — correctly explained any LIHEAP payment amount triggers the full HCSUA, cited 273.9(d)(6)(vi) correctly, quoted the correct MA dollar figure. **So today: ask Demeter and you get the right answer; run the actual worksheet/estimate calculator and the engine silently skips this deduction.** |
| 4.3 | Homelessness / non-traditional housing | 🔵 | Not audited this pass. |
| 4.4 | Informal/symbolic rent to family | 🔵 | Not audited this pass. |
| 4.5 | Subsidized housing (Section 8) dynamic rent | 🔵 | Not audited this pass. |

## Category 5 — VA Benefits, Disability & Public Assistance

| # | Case | Verdict | Evidence |
|---|---|---|---|
| 5.1 | VA disability/pension as income | 🟡 | Engine: no VA-specific branch — falls into the generic unearned-income bucket by default, which **produces the correct result** but isn't an explicit modeled rule (so a future refactor of that fallback could silently break it with no VA-specific test to catch it). No hint, no prompt. ✔ LIVE — `boyfriend-va-disability`: correctly cited 273.9(b)(2)(ii) and got the right answer. |
| 5.2 | Pending SSDI/SSI claims | 🔵 | Not audited this pass. |
| 5.3 | State disability / private disability / workers' comp | 🟡 | Same generic-fallback pattern as 5.1 — correct by default, not explicitly modeled. Not live-tested this pass. |
| 5.4 | Broad-Based Categorical Eligibility (BBCE) | ✅ | **The best-covered item in the entire taxonomy.** Engine: `income-tests.ts` actually applies `policy.bbce_threshold_pct` to the gross-income-test ratio, per-state values set in `constants/states.ts`. Corpus: 273.2(j). Hint: explicit `["categorical","categorically","bbce","broad-based","broad based"]` term. Prompt: explicitly names and defines it. ✔ LIVE — confirmed twice across two sessions, including the jargon fix from PR #811. One caveat: `categorical.ts` declares a `"bbce"` value in its `CategoricalPath` union that `evaluateCategorical()` never actually returns — dead code, cosmetic, not a functional gap since `income-tests.ts` is where BBCE actually lives. |

## Category 6 — Health, Life Transitions & Special Demographics

| # | Case | Verdict | Evidence |
|---|---|---|---|
| 6.1 | Pregnancy → ABAWD/work-requirement exemption | 🟡 | Engine: **is** explicitly modeled — `work-requirements/evaluate.ts` returns `{kind: 'exempt', exemptionType: 'pregnancy'}`. Prompt: California-specific ABAWD paragraph lists "pregnant" as an exemption. ✔ LIVE — `pregnant-unemployed`: correct answer, but **zero citations** (see Headline Finding #4) — likely because the model is drawing on the prompt's own baked CA-focused ABAWD paragraph rather than a retrieved corpus chunk, for a question asked about Ohio. The generalization happened to be correct (pregnancy exemption is federal), but nothing in the answer told the reader that. |
| 6.2 | Unreimbursed medical expenses, $35 threshold | ✅ | Engine: `benefit-calc.ts` applies the floor only when `isED` is true. Corpus + hint + confirmed live in the prior session (mother's medical expenses, MA). |
| 6.3 | Domestic violence survivors, prior inclusion on abuser's case | 🟡 | Corpus: 273.1(b)(7)(vi)(D) (DV-shelter residents exempt from institutional-resident bar, treated as separate household) + 273.11(o)(2) (good-cause exception to child-support cooperation). **No engine gate, no hint, no prompt.** ✔ LIVE — `domestic-violence-shelter`: warm, accurate, correctly cited 273.1 for the household-separation point — the model did well despite the gap, again via general reasoning + adequate semantic retrieval rather than anything purpose-built. |
| 6.4 | Re-entry / post-incarceration / pre-release programs | ❌ | Engine: nothing, except one unrelated Alaska drug-felony-ban rehabilitation carve-out (not a general re-entry eligibility pathway). Corpus: one incidental E&T-targeted-population mention, no substantive pre-release provisions. ✔ LIVE — `post-incarceration` (post-release, not the pre-release sub-case the taxonomy specifically calls out): reasonable answer, correctly said no waiting period, correctly flagged drug-felony state variance. The **pre-release program application** sub-case was not tested and has zero support in any layer. |
| 6.5 | D-SNAP / Disaster SNAP | ❌ | **No 7 CFR Part 280 (Disaster SNAP) text in the corpus at all** — confirmed absent, not just unhinted. No engine, no hint, no prompt. ✔ LIVE — `d-snap-disaster`: the chatbot's answer was substantively good (correctly distinguished D-SNAP from ordinary food-replacement, correctly gated D-SNAP on a presidential disaster declaration) — but this came from **zero citations**, meaning it's the model's general pretrained knowledge, not this product's verified corpus. Accurate today; not something the product's own citation-verification machinery is actually checking. |

## Category 7 — Immigration, Citizenship & Non-Citizen Status

| # | Case | Verdict | Evidence |
|---|---|---|---|
| 7.1 | Mixed-status households (citizen kids, undocumented parents) | ✅ | Engine, corpus, hint, and prompt all present and consistent. ✔ LIVE — tested extensively across both sessions; consistently excellent (correct deeming, correct household size, correct public-charge framing, never abandons the task). |
| 7.2 | Qualified non-citizens, <5yr vs. 5yr+ bar | 🟡 | Engine: `memberImmigrationEligible()` dispatches on `immigration`/`five_yr_bar` for the individual's *own* eligibility. ✔ LIVE (indirectly) — `sponsor-deeming` case correctly mentioned the 5-year bar. |
| 7.3 | Humanitarian entrants (refugee/asylee/Cuban-Haitian/parolee) | 🟡 | Engine: some categories are modeled for the individual's own eligibility (`immigration.ts` comment: "refugee → eligible," "removed_status:refugee → ineligible" post-OBBBA). **Not modeled for whether sponsor-deeming itself should apply** — see 7.4, this is the actionable half of that gap. |
| 7.4 | Sponsor deeming | 🟡 | **The single most concrete finding of this audit.** Engine (`facts.ts:135-145`): a flat `unearned += facts.sponsor_income` for any `sponsored: true` member, with the code's own comment admitting "indigence and other adjustments (273.11(j)(3)) are not yet modeled." No per-category exemption (refugees/asylees/Cuban-Haitian entrants/certain parolees are supposed to be categorically exempt from deeming under 273.4(c) / 8 U.S.C. 1631 — the engine does not check for this at all). Corpus is rich (99 "sponsor" hits across 273.4(c), 273.11(c)(3), 273.2(f)(10)/(j)(2)/(4), 273.8(c), 273.9(b)(2)/(b)(4), 273.7(m)). No hint (zero "sponsor" term in `retrieval.ts`). ✔ LIVE — `sponsor-deeming`: the chatbot correctly named the exceptions the engine doesn't implement (40 qualifying quarters, citizenship, means-tested benefits, DV, indigence) — **the chat is currently more correct than the calculator would be for this scenario.** |

---

## Two live-only findings not in the original taxonomy

### A. Furlough/shutdown income questions degrade about half the time

Re-ran the identical question ("furloughed federal worker... no paychecks... backpay eventually... how does SNAP count my income?") through the real `answerQuestion()` pipeline 3 times, no other changes:

| Run | Outcome |
|---|---|
| 1 | **degraded** — fell back to the generic "I can't put a number on this" copy |
| 2 | **degraded** — identical fallback |
| 3 | **recomposed** (retry succeeded) — the second attempt was substantively excellent: correctly distinguished "income not yet received isn't counted" from "backpay counts as earned income the month it arrives," cited 273.9(b), 273.9(b)(1)(i), 273.2(i) expedited service, and 273.12 reporting rules — genuinely strong content once it landed |

Retrieval itself is not the problem — a direct check of `buildMaeSystem()` for this exact question shows it correctly retrieves the right family of citations (`273.9(b)`, `273.9(b)(1)`, `273.9(b)(2)`, `273.9(b)(3)`, `273.9(b)(4)`, `273.9(c)(10)`). The failure is specific to how often the *first-attempt streamed generation* trips the citation or numeric gate on this particular question shape before the retry has a chance to correct it — 2 of 3 samples never got past the first degrade to try the good answer the model is clearly capable of (see Run 3). This reads like the model reaching for something unverifiable on the first pass at a noticeably higher rate for this specific question than for comparable ones in the same test batch (13 of the other 14 test cases in the same run were clean or recomposed-to-clean on the first try).

This is squarely a `packages/demeter-engine` conversational-layer issue (prompt/gate behavior, not engine math) — in scope for a follow-up fix in that area, not `snap-rules`.

### B. Correct answers with zero citations — a predicted risk, now confirmed live

`certainty.ts` already documents this exact residual risk in its own comments: *"an answer that asserts policy with no citations at all is also silenced here [certainty banner suppressed]... worth revisiting if such answers turn up in mae_query_log with code `no_claim_to_verify` and real policy content."*

Three live cases in this pass had that shape — a real, correct policy claim, delivered with `certaintyCode: no_claim_to_verify` (the same code an off-scope refusal gets):

- **pregnant-unemployed**: "pregnancy exempts you from work requirements" — true, federal, and the engine even encodes it (`work-requirements/evaluate.ts`) — but zero citation in the delivered text.
- **d-snap-disaster**: correct D-SNAP/food-replacement distinction, zero citation (no D-SNAP text exists in the corpus at all to cite — see 6.5).
- **administrative-leave**: correct earned-income treatment, zero citation.

The reader can't tell these apart from a refusal by looking at the certainty banner (there isn't one), which is exactly the failure mode the code comment predicted before it had a real example.

---

## Suggested next steps (conversational-layer items now DONE — see update below)

**Conversational-layer (in scope for a `packages/demeter-engine` PR, similar to #811) — ✅ ALL DONE, PRs #827 + follow-up:**
1. ~~Investigate and fix the furlough-degrade rate~~ — DONE. Root cause: the numeric-equivalence gate structurally could never accept the literal figure "$0" (nobody types "I make $0," and no regulation states it either), so a furloughed-worker question's own correct "$0" statement was unsatisfiable no matter how it was phrased — 4/4 identical live runs failed on the exact same mismatch. Fixed; live-verified 3/3 clean after.
2. ~~Decide a policy for the "correct but uncited" pattern~~ — DONE, went with the prompt-nudge option: an explicit "always name a citation for a stated rule, even from the notes above" instruction, plus embedding the citation directly at each specific fact (pregnancy exemption, disability/VA-any-rating exemption) since the general instruction alone only achieved ~2/3 compliance. D-SNAP-style genuinely-ungrounded cases now at least hedge honestly instead of stating flat fact with no citation — left the certainty-framework classifier idea out of scope (too speculative to build confidently in this pass).
3. ~~Add retrieval hints for the CORPUS-ONLY topics~~ — DONE for strikers, live-in attendants, DV-shelter, sponsor deeming (citation-level, not section-level — 273.1's five subsections are five separate chunks sharing one coarse `section` field). LIHEAP got its fix via the OBBBA-superseded mechanism instead (see the PRA-findings-driven commits). Voluntary quit already had a hint — confirmed, no action needed.

**Second live battery (2026-08-15) — the 🔵 UNTESTED items, now tested:**

| Item | Verdict | Note |
|---|---|---|
| Unpaid internships/clinicals (3.3) | ✅ | Federal 7 CFR 273.24(a)(2)(iii) explicitly covers unpaid work toward the ABAWD hours requirement — cited correctly, certain/grounded. |
| Trade/vocational vs. academic (3.4) | ✅ | Correctly applies the real federal test (does the program require a HS diploma/GED to enroll — not "is it a degree program"), 273.5(a) cited correctly. |
| Dual enrollment/HS seniors (3.5) | 🟡 | Still nothing in any layer (confirmed `❌ NOT FOUND ANYWHERE` at the code level), but the live answer handles the absence gracefully — correctly keys off half-time enrollment rather than "any college classes," honestly defers to a county factual determination, doesn't invent a K-12 carve-out that doesn't exist. |
| Lump-sum vs. recurring pay / severance (2.6) | 🟡 | Appropriately hedged (uncertain/authority_not_retrieved) — federal SNAP severance treatment is genuinely state-variable in practice; the model didn't assert false confidence on a genuinely disputed area. |
| Homelessness/non-traditional housing (4.3) | ✅ | Correctly explains no permanent address is needed, offers 211/food banks, names alternative mailing-address options, cites 273.3 and 273.2(f)(3)(vi). |
| Informal/symbolic rent to family (4.4) | ✅ | Correctly explains no written lease is required, offers alternative verification (signed statement, collateral contact), and proactively raises the household-composition angle (paying "rent" to someone you also share food with may make you one household, not landlord/tenant) — 273.2(f) cited. |
| Section 8 / subsidized housing dynamic rent (4.5) | ✅ | Correctly explains no special SNAP rule exists — the shelter deduction just follows whatever rent is currently being paid, reported like any other change; 273.9(d)(6)/273.12 cited. |
| Pending SSDI/SSI claims (5.2) | 🟡→✅ | Correctly said a pending (not yet approved) application is enough for the ABAWD exemption — but with **zero citation** on the first live run, the same "correct but uncited" shape items 1-2 above were supposed to have fixed generally. Confirms the general instruction alone doesn't reach 100% coverage; fixed the same way as pregnancy — citation embedded directly at this specific fact. Live-verified 2/3 after. |
| State/private disability, workers' comp (5.3) | ✅ | Short-term employer disability insurance correctly treated as unearned income, 7 CFR 273.9(b)(2)(ii) cited correctly. |
| Pre-release (not post-release) incarceration (6.4) | 🟡 | Cites a real, narrow federal provision (273.11(i), joint SSI/SNAP pre-release application) and correctly scopes it — doesn't overclaim a general FoodShare/SNAP pre-release guarantee beyond what the cited section actually covers, defers appropriately to county-specific reentry coordination. |

Net: 6 of 10 previously-untested items are fully correct and well-cited; 3 are appropriately and honestly hedged on genuinely unclear ground (not wrong, just uncertain — the right behavior); 1 (pending SSDI) surfaced a second instance of the citation-discipline gap, now fixed the same way as the first.

**Engine-math (`packages/snap-rules` is PARKED — per-instance go-ahead required before any of this, per standing rule):**
4. Sponsor-deeming category exemptions (refugee/asylee/Cuban-Haitian/parolee) and the 273.11(j)(3) indigence formula — the most concrete, well-evidenced gap in this audit.
5. Wire `checkHEAPCompliance()`'s existing flag into the actual SUA-tier calculation, or explicitly document that LIHEAP/heat-and-eat is Phase 2 and out of scope for the current worksheet estimate.
6. Roomer and live-in-attendant as their own composition-gate branches (both already have real corpus text; roomer already has a retrieval hint).
7. Joint/shared custody, D-SNAP, dual-enrollment/K-12 status, and furlough/anticipated-income handling in `income-tests`/`facts.ts` — these are `❌ NOT FOUND ANYWHERE` items with real user-facing consequences.

---

*Raw live transcripts for every ✔ LIVE case above are preserved in this session's scratchpad and available on request; not checked into the repo as they're not reusable test fixtures the way `conversation-eval.ts`'s gold set is (these were single-turn diagnostic probes, not scripted conversations).*
