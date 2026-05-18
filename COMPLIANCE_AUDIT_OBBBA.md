# OBBBA Compliance Audit — Civica SNAP

> **Scope:** P.L. 119-21 (One Big Beautiful Budget Act) and 7 CFR 277.4.
> Last updated: 2026-05-18. Reconstructed from PR #62, commit history, `SNAPComplianceCopyRegistry.swift`, `docs/SNAP-source-citation-signoff.md`, and `docs/snap/launch-readiness.md §5`.
> This document is an engineering audit record. It is not a legal opinion.

**Hard launch gate (Revision 2 §11):** No App Store review, external pilot, or estimator use until Q19 source-citation rows + FY26 number correction land.

---

## Summary table

| Q# | Title | Track | Status | PR(s) / Commit(s) |
|---|---|---|---|---|
| Q1 | ABAWD tribal exemption copy (EN + ES) | 2 — counsel | ⏳ Pending counsel signoff | — |
| Q2 | WIC cross-program teaser — dollar inducement | 1 — engineering | ✅ Shipped | [PR #62](https://github.com/matthewgg22/civica/pull/62), commit `92a82cd7` |
| Q3 | §6 persuasive/boundary copy revisions (9 strings) | 2 — counsel | ⏳ Infra shipped; strings pending counsel | [PR #62](https://github.com/matthewgg22/civica/pull/62) (registry), signoffs pending |
| Q4 | §10108 noncitizen disclosure | 2 — counsel | ⏳ Pending counsel | — |
| Q5 | LLM data retention + ABAWD age-band + distress gate | 1 + 2 | ✅ Age-band + distress gate shipped; retention policy pending counsel | commits `80e55440`, `8b67ac29`; [PR #106](https://github.com/matthewgg22/civica/pull/106) |
| Q6 | Pricing rule — non-federal funding disclosure | 2 — counsel | ⏳ Pending counsel | — |
| Q7 | State coverage scope + estimator reachability report | 1 + 3 | ✅ Coverage policy shipped; engineering report pending | [PR #62](https://github.com/matthewgg22/civica/pull/62), commit `dc7f721b` |
| Q8 | Backend LLM persistence matrix (engineering report) | 3 — external | ⏳ Pending engineering report | — |
| Q9 | Edge Function PII map (engineering report) | 3 — external | ⏳ Pending engineering report | — |
| Q10 | Utilities prompt text compliance report | 3 — external | ✅ §10104 internet-exclusion fix shipped; report pending | [PR #116](https://github.com/matthewgg22/civica/pull/116), commit `c43b3c34` |
| Q11 | At-rest data protection — eligibility result | 1 — engineering | ✅ Shipped | [PR #62](https://github.com/matthewgg22/civica/pull/62), commit `fb36ea2d` |
| Q12 | Stale rules — engine + UI banner + user copy | 1 + 2 | ✅ Engine + banner shipped; user copy pending counsel | [PR #62](https://github.com/matthewgg22/civica/pull/62) (engine), [PR #117](https://github.com/matthewgg22/civica/pull/117) (banner); copy pending |
| Q13 | Source-citation signoff test | 1 — engineering | ✅ Shipped | [PR #62](https://github.com/matthewgg22/civica/pull/62), commit `8cf7e478` |
| Q14 | Submit-to-DTA-Connect copy + written DTA authorization | 1 + 3 | ✅ Copy fixed; written authorization pending | [PR #62](https://github.com/matthewgg22/civica/pull/62), commit `e7c175fc` |
| Q15 | SOC 2 status | 3 — external | ⏳ Pending external | — |
| Q16 | App Store listing copy | 3 — external | ⏳ Pending external | — |
| Q17 | Marketing site location and copy | 3 — external | ⏳ Pending external | — |
| Q18 | October rules-refresh owner (FY27 deadline 2026-07-31) | 3 — external | ✅ Automation shipped; owner assignment pending | [PR #121](https://github.com/matthewgg22/civica/pull/121), commit `7aff718b` |
| Q19 | Source-citation reviewer signoffs + FY26 number corrections | 3 — external | ⏳ **Hard launch gate** — pending policy reviewers | `docs/SNAP-source-citation-signoff.md` |

---

## Execution tracks

- **Track 1 — Engineering, no counsel input needed.** Merged [PR #62](https://github.com/matthewgg22/civica/pull/62) on 2026-05-12. Supplemented by post-PR-62 commits on `codex/rebuild-feb18` (§10104 internet exclusion PR #116, stale-rules UI banner PR #117, FY-refresh reminder PR #121, ABAWD age-band fixes).
- **Track 2 — Blocked on counsel / legal-policy signoff.** Q1, Q3 strings, Q4, Q5 (LLM retention), Q6, Q12 user copy.
- **Track 3 — Blocked on external facts / third-party inputs.** Q7–Q10 engineering reports, Q14 DTA authorization, Q15 SOC 2, Q16 App Store copy, Q17 marketing site, Q18 owner assignment, Q19 reviewer signoffs.

---

## Q1 — ABAWD tribal exemption copy (EN + ES)

**OBBBA requirement:** OBBBA §10102(a) preserves the existing tribal-area exemption for ABAWDs living on or near a federally recognized Indian reservation (7 USC 2015(o)(6)). Any surface that explains ABAWD rules to users must accurately represent this exemption in both English and Spanish.

**Civica impact:** The SNAP application flow and voice-extraction pipeline explain ABAWD work requirements. If the tribal exemption is not surfaced or is misdescribed, an exempt user may believe they are subject and disengage from the application.

**Resolution:**
- Track 2 — blocked on counsel.
- The Native American exemption data model (`hasNativeAmericanExemption` field) and associated question are pre-staged but not yet merged. Strings require counsel approval before the question can ship.
- Code home: `Civica/Features/SNAP/Application/SNAPHouseholdQuestionFlow.swift`, `FederalDefaultRules.abawdStatus()`.
- Pre-staged item 1.3 in `project_obbba_audit.md`.

**Signoff required:** Counsel (strings EN + ES), then engineering merge.

---

## Q2 — WIC cross-program teaser — dollar inducement

**OBBBA requirement:** 7 CFR 277.4(b)(5)(i) prohibits SNAP outreach materials from using incentive framing (dollar amounts as headlines) to recruit applicants. 7 CFR 246.4 / 246.26 apply parallel constraints to WIC outreach.

**Civica impact:** The WIC cross-program teaser card displayed `+ ~$48/mo` as a headline value-prop, with the dollar amount foregrounded as a recruitment cue. WIC benefit amounts are not guaranteed and vary by household.

**Resolution — Track 1 ✅ Shipped (PR #62, 2026-05-12):**
- Dropped `wicEstimate` constant and the inline dollar pill.
- Rewrote `wicTitle` and `wicBody` to factual, non-guaranteed copy covering the WIC-eligible population (pregnant/postpartum people + children under 5, not just children).
- Regression test in `SNAPComplianceCopyTests`: `wicTeaserDoesNotForegroundDollarAmount` asserts strings do not contain `$48`, `~$`, `/mo`, or `/mes`.
- Code: `SNAPCrossProgramTeaserView.swift`, `SNAPComplianceCopyTests.swift`.
- Commit: `92a82cd7`, regression test `be8ba3f3`.

**Signoff:**
- Engineering: ✅ Matthew (PR #62 merged 2026-05-12)
- Counsel: _(not required — engineering-posture fix)_

---

## Q3 — §6 persuasive/boundary copy revisions (9 strings)

**OBBBA requirement:** 7 CFR 277.4 prohibits SNAP outreach from using incentive, urgency, loss-aversion, or attribution-to-Civica framing. The Revision 2 §6 copy-revision table identified 9 strings in production that require rewriting. Each must be approved in both English and Spanish before it ships.

**Civica impact:** 9 strings across notification templates, decision views, estimator entry, and action CTAs. Current production strings use persuasive patterns: dollar-amount-first subjects, approval attribution to Civica, gamification of expedited criteria, ease/incentive pairing, loss-aversion, and action-attribution.

**Resolution — Track 1 infra ✅ (PR #62); strings Track 2 ⏳ pending counsel:**

Registry: [`Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift`](Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift)

When counsel signs a row: the PR fills `approvedEnglish` + `approvedSpanish`, flips `status` to `.approved`, and wires the production view to read via `SNAPComplianceCopyRegistry.approvedEnglish(for:)` with the in-tree string as fallback.

CI guard: `noSNAPSwiftFileContainsRegistryBannedPhrase` scans every Swift file under `Civica/Features/SNAP/` for banned-phrase regressions; `approvedRevisionsHaveCompleteBilingualPair` ensures English-only signoffs cannot ship without Spanish parity.

| Row ID | Surface file | String ID | Current English (production) | Issue |
|---|---|---|---|---|
| `approval_email_subject` | `CivicaNotificationTemplates.swift` | `approvedEmail.subject` | `"Approved. ${monthlyBenefit}/mo, starting this month."` | Dollar-amount-first subject reads as incentive |
| `decision_approved_headline` | `SNAPDecisionApprovedView.swift` | `SNAPDecisionApprovedStrings.headline` | `"You're approved."` | Attributes state-agency determination to Civica |
| `expedited_banner_almost` | `SNAPExpeditedBanner.swift` | `almostHeadline` | `"Almost — one more answer could speed this up"` | Gamification of a regulatory eligibility category (7 CFR 273.2(i)) |
| `estimator_entry_subtitle` | `SNAPBenefitEstimatorStrings.swift` | `entryCardSubtitle` | `"Five questions. See your monthly dollar amount before you apply."` | Ease cue + incentive cue connected to applying |
| `estimator_apply_cta` | `SNAPBenefitEstimatorStrings.swift` | `applyCTA` | `"Apply for SNAP"` | No official-link attribution; CA-portal naming requires counsel sign-off |
| `doc_requested_sms_body` | `CivicaNotificationTemplates.swift` | `documentRequestedSMS.body` | `"DTA needs one more thing: a recent paystub. Send a photo here or upload in the app. By {deadline} keeps your application moving."` | Loss-aversion framing |
| `recert_one_day_sms` | `CivicaNotificationTemplates.swift` | `recertOneDayBeforeSMS.body` | `"Tomorrow is your recert deadline ({recertDate}). 4 minutes if you start now. If you miss it, benefits pause until you submit — text RECERT for a fast link any time."` | Urgency + ease + loss-aversion stacked |
| `recert_heads_up_email_subject` | `CivicaNotificationTemplates.swift` | `recertHeadsUpEmail.subject` | `"Recertify in 60 days. Usually 4 minutes."` | Ease framing tied to recertification |
| `ebt_pin_cta` | `CivicaNotificationTemplates.swift` | `approvedEmail.buttonLabel` | `"Set the EBT PIN"` | Implies Civica performs the PIN action |

**Signoff required:** Counsel (all 9 rows, EN + ES parity). Also see launch-readiness §6.

Also see: **banned phrases** in registry — `submit_to_dta` (Q14) and `submit_to_benefitscal` (Q14 CA parallel) are CI-enforced zero-tolerance substrings.

---

## Q4 — §10108 noncitizen disclosure

**OBBBA requirement:** OBBBA §10108 amended the noncitizen SNAP eligibility provisions of 7 USC 2014(c). Any surface explaining noncitizen eligibility rules must reflect the current statutory language and avoid overstating or understating eligibility for qualified aliens and other noncitizen categories.

**Civica impact:** _(needs reviewer input — original audit doc lost)_ The SNAP eligibility screener includes citizenship/immigration questions. The specific strings and screens affected by §10108 are not recoverable from available sources without the original audit document.

**Resolution:** Track 2 — blocked on counsel. Counsel must review current noncitizen-eligibility copy and provide approved replacement strings before this can ship.

**Signoff required:** Counsel.

---

## Q5 — LLM data retention + ABAWD age-band + navigator distress gate

This question covers three distinct compliance items that were grouped because they all touch LLM-assisted features or the ABAWD determination logic.

### Q5 — Part A: ABAWD age-band fix (§10102(a)) — Track 1 ✅ Shipped

**OBBBA requirement:** §10102(a) (eff. 2025-07-04) changed the ABAWD age band from 18–49 to 18–64, removing the prior 55–64 exemption. The prior Civica code used an upper bound of 54.

**Resolution — Track 1 ✅ Shipped (commit `80e55440`, merged 2026-05-17):**
- `FederalDefaultRules.abawdStatus()`: raised ceiling from 54 to 64.
- Tests: renamed `abawdOver54IsNotSubject` → tests for 55 and 64 as `subjectActive`; added `abawdOver64IsNotSubject` (age 65).
- Cross-state fixtures: PR [#125](https://github.com/matthewgg22/civica/pull/125), commit `9e7aa5f4`.
- Code: [`Civica/Features/SNAP/Rules/FederalDefaultRules.swift`](Civica/Features/SNAP/Rules/FederalDefaultRules.swift).

### Q5 — Part B: ABAWD dependent-child exception (§10102(a)) — Track 1 ✅ Shipped

**OBBBA requirement:** Per FNS implementation memo Oct 3 2025, the ABAWD dependent-child exception was narrowed: a child under 18 no longer exempts — only a child under 14 does. Households with a child aged 14–17 are no longer automatically exempt.

**Resolution — Track 1 ✅ Shipped (commit `8b67ac29`, merged 2026-05-17):**
- `SNAPHouseholdAnswers`: added `hasChildUnder14InHousehold: Bool?`.
- Question flow: inserted `.childrenUnder14` step with conditional advance/goBack that skips when no minors present.
- `FederalDefaultRules.abawdStatus()`: gates on `hasChildUnder14InHousehold` instead of `hasMinorInHousehold`.
- Voice extraction pipeline updated: `SNAPFieldKey`, `HouseholdBasicsExtraction`, `SNAPVoicePrompts`.
- Tests: 5 boundary cases (under-14 exempt, exactly-14 subject, 17-year-old now subject, nil-under14 conservative path).
- Code: [`Civica/Features/SNAP/Application/SNAPHouseholdQuestionFlow.swift`](Civica/Features/SNAP/Application/SNAPHouseholdQuestionFlow.swift), `FederalDefaultRules.swift`.

### Q5 — Part C: Navigator distress-review gate (Q5) — Track 1 ✅ Shipped

**OBBBA requirement / rationale:** When LLM-assisted income extraction surfaces distress signals (unemployed + very low income), the system should route to a human navigator review gate rather than making an expedited-eligibility recommendation automatically.

**Resolution — Track 1 ✅ Shipped (commit `80e55440`, merged 2026-05-17 via PR #106):**
- Supabase migration: adds `is_expedited boolean` (nullable) to `snap_packets`. `null` = gate not acted on; `true` = expedited elected; `false` = standard review.
- `ExpeditedReviewGate.tsx` (dashboard): amber banner when `employment_status = "unemployed"` AND `gross_income < $150` AND `is_expedited IS NULL` AND status is "Submitted for Review" or "In Navigator Review". Two CTA buttons route to expedited or standard review.
- `enrollment-api PATCH /packets/:id`: accepts `is_expedited` boolean.
- Code: [`apps/dashboard/app/packets/[packetId]/ExpeditedReviewGate.tsx`](apps/dashboard/app/packets/[packetId]/ExpeditedReviewGate.tsx).

### Q5 — Part D: LLM input/output retention policy — Track 2 ⏳ Pending counsel

**OBBBA requirement:** Raw LLM inputs and outputs may contain PII submitted during SNAP screening. A documented retention policy with TTL and access controls is required.

**Resolution:** Track 2 — blocked on counsel. Interim default: 90-day TTL + RBAC (per memory). Policy must be documented and approved before beta.

**Signoff required:** Counsel.

---

## Q6 — Pricing rule — non-federal funding disclosure

**OBBBA requirement:** OBBBA §10106 _(needs reviewer input — original audit doc lost; exact provision not recoverable from available sources)_. The concern relates to disclosure when non-federal funds are used in conjunction with SNAP-related services.

**Civica impact:** _(needs reviewer input — original audit doc lost)_

**Resolution:** Track 2 — blocked on counsel. Counsel must advise whether Civica's funding structure triggers a disclosure obligation and what disclosure language is required.

**Signoff required:** Counsel.

---

## Q7 — State coverage scope + estimator reachability

### Part A: State coverage scope — Track 1 ✅ Shipped

**OBBBA requirement / rationale:** The SNAP screener must only provide eligibility determinations for states where Civica has validated state-specific rules. Out-of-scope states should be gated, and out-of-scope verdicts should not persist across sessions.

**Resolution — Track 1 ✅ Shipped (PR #62, commit `dc7f721b`, 2026-05-12):**
- `SNAPCoveragePolicy`: `supportedStateCodes` set (currently `{"CA", "MA"}`); `isStateInScope(_:)` (case-insensitive, trim-tolerant); `shouldShowUnsupportedStateGate(_:)` (nil = pre-question, not out-of-scope).
- `SNAPApplicationFlowOrchestrator.shouldShowUnsupportedStateGate` delegates to `SNAPCoveragePolicy`.
- `CivicaEntryView.estimatorTile` routes to `SNAPUnsupportedStateView` when out-of-scope.
- Launch-time invalidation: `CivicaUserData.runLaunchTimeMigrations` calls `purgeOutOfScopeEligibilityData` — deletes Keychain verdict if the persisted state is out-of-scope; draft preserved for the "Change my state" CTA.
- Code: [`Civica/Features/SNAP/SNAPCoveragePolicy.swift`](Civica/Features/SNAP/SNAPCoveragePolicy.swift).

### Part B: Estimator reachability report — Track 3 ⏳ Pending

**External question:** Can a user in an out-of-scope state reach the estimator directly (e.g., via deep link, URL, or bookmarked state)? Engineering must produce a reachability report demonstrating all entry points consult `SNAPCoveragePolicy`.

**Signoff required:** Engineering report (Track 3).

---

## Q8 — Backend LLM persistence matrix (engineering report)

**OBBBA requirement / rationale:** The backend uses LLM calls (voice extraction, document quality checks) that may log or persist raw user inputs. A matrix documenting what is persisted, where, and for how long is required for counsel review.

**Civica impact:** `civica-snap-engine` (FastAPI), `civica-enrollment-api` (Cloudflare Workers), and the voice pipeline all invoke LLM endpoints. Some calls may log request/response payloads.

**Resolution:** Track 3 — pending engineering report. Engineering must produce a persistence matrix documenting: service name, LLM provider, what inputs are sent, what outputs are retained, storage location, and TTL.

**Signoff required:** Engineering report → counsel review.

---

## Q9 — Edge Function PII map (engineering report)

**OBBBA requirement / rationale:** Cloudflare Workers (enrollment-api) and Fly.io services process and may log PII fields (income, household composition, SSN-adjacent fields). A PII map documenting data flows through Edge Functions is required.

**Civica impact:** `civica-enrollment-api` handles enrollment packets containing household income, composition, and document metadata. `civica-snap-engine` processes eligibility inputs. PII-scrubbing in Sentry `beforeSend` is in place (PR #88) but a full data-flow map has not been produced.

**Resolution:** Track 3 — pending engineering report. Engineering must produce a PII map covering all Edge Function services: data fields ingested, transformations applied, fields logged, Sentry scrub coverage, and storage destinations.

**Signoff required:** Engineering report → counsel review.

---

## Q10 — Utilities prompt text + §10104 internet exclusion

**OBBBA requirement:** OBBBA §10104 (eff. 2025-07-04) removed internet from the SNAP excess shelter deduction. User-facing utilities prompts must explicitly exclude internet so users do not inflate their shelter deduction.

**Civica impact:** `SNAPExpensesFlow.swift` utilities helper and `paysUtilitiesSeparately` helper; `SNAPVoiceExtractionModels.swift` `monthlyUtilities @Guide`. A diligent user who pays for internet might include it in their utilities total, inflating the excess shelter deduction and producing non-compliant eligibility math.

**Resolution — §10104 fix ✅ Shipped ([PR #116](https://github.com/matthewgg22/civica/pull/116), commit `c43b3c34`, 2026-05-18):**
- `SNAPExpensesFlow.swift`: utilities helper and `paysUtilitiesSeparately` helper both add explicit "Do not include internet (SNAP does not count internet as a utility)" in English and Spanish.
- `SNAPVoiceExtractionModels.swift`: `monthlyUtilities @Guide` instructs the LLM to exclude internet.
- CA confirmation: ACL 25-68 confirms CDSS methodology updated accordingly.

**Remaining (Track 3):** Engineering current-state report confirming utilities prompt text across all surfaces is now compliant.

**Signoff required:** Engineering report.

---

## Q11 — At-rest data protection — eligibility result

**OBBBA requirement:** The user's last-known SNAP verdict, monthly benefit amount, and contributing factors constitute a partial record of recipient assistance under 7 USC 2020(e)(8) and 7 CFR 272.1(c). Storing this in UserDefaults (no per-item protection class, visible to forensic and backup paths) is insufficient.

**Civica impact:** `SNAPApplicationStatusStore` previously persisted the eligibility result as a plist in UserDefaults at key `co.civica.eligibilityResult`.

**Resolution — Track 1 ✅ Shipped (PR #62, commit `fb36ea2d`, 2026-05-12):**
- New `SNAPEligibilityResultKeychainStore`: item attributes `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, `kSecAttrSynchronizable=false`, service `co.civica.SNAP`, account `eligibilityResult`. Save deletes-before-add to re-apply protection attributes on every write.
- `SNAPApplicationStatusStore`: reads/writes from Keychain. One-shot migration: if Keychain is empty but legacy plist exists, decode, write to Keychain, remove plist entry. Idempotent.
- `CivicaUserData`: `co.civica.eligibilityResult` moved to `legacyUserDefaultsKeys`; `deleteEverything` adds belt-and-suspenders Keychain wipe.
- `kSecUseDataProtectionKeychain=true` on all queries.
- CI: Keychain tests use `keychainAvailableForTests` runtime probe + `@Suite(.enabled(if:))` to skip on unsigned CI bundles (CI fix in commit `39d8b627`).
- Code: [`Civica/Features/SNAP/Application/SNAPApplicationStatusStore.swift`](Civica/Features/SNAP/Application/SNAPApplicationStatusStore.swift), [`Civica/Features/SNAP/SNAPEligibilityResultKeychainStore.swift`](Civica/Features/SNAP/SNAPEligibilityResultKeychainStore.swift).

**Signoff:**
- Engineering: ✅ Matthew (PR #62 merged 2026-05-12)
- Counsel: _(not required — engineering-posture fix)_

---

## Q12 — Stale rules — engine, UI banner, and user copy

This question covers three layers: the rules-engine protocol, the UI disclosure, and the user-facing copy explaining what "stale" means.

### Part A: Rules-engine stale-status protocol — Track 1 ✅ Shipped

**OBBBA requirement / rationale:** When `PolicySnapshot` selectors fall through to the most-recent snapshot silently, a calculator call after Oct 1 renders prior-FY numbers without disclosure. The engine must be able to report its own freshness state.

**Resolution — Track 1 ✅ Shipped (PR #62, commit `0ef7a5e7`, 2026-05-12):**
- `RuleSnapshotStatus` enum: `.current(latestExpiry:)` | `.expired(latestExpiry:)`.
- `SNAPStateRuleEngine.snapshotStatus(asOf:)` — `FederalDefaultRules` takes the earliest expiry across FPL, standard deduction, shelter cap, max allotment, minimum benefit, and asset limits; `MAStateRules` intersects federal expiry with MA's BBCE + SUA windows.
- CI tripwire: test fails post-Oct-2026 if no FY27 snapshot is loaded.
- Code: [`Civica/Features/SNAP/Rules/FederalDefaultRules.swift`](Civica/Features/SNAP/Rules/FederalDefaultRules.swift).

### Part B: Stale-rules UI banner — shipped after PR #62

**Resolution ✅ Shipped ([PR #117](https://github.com/matthewgg22/civica/pull/117)):**
- `SNAPBenefitEstimatorView`: warning banner above result card when `snapshotStatus(asOf: Date())` returns `.expired`. Banner uses `brickSurface` + destructive treatment.
- `staleRulesHeadline` + `staleRulesBody` strings in `SNAPBenefitEstimatorStrings.swift` (English + Spanish).
- Rationale: showing the estimate with disclosed staleness is better compliance posture than suppressing it — a screenshot will show Civica disclosed the data freshness state at time of estimation.
- Code: [`Civica/Features/SNAP/SNAPBenefitEstimatorView.swift`](Civica/Features/SNAP/SNAPBenefitEstimatorView.swift).

### Part C: Stale-rules user copy — Track 2 ⏳ Pending counsel

**Track 2:** The copy explaining stale rules to users (error state language, email/SMS) must be approved by counsel before shipping.

**Signoff required:** Counsel (user-facing copy).

---

## Q13 — Source-citation signoff test

**OBBBA requirement / rationale:** The source-citation signoff document (`docs/SNAP-source-citation-signoff.md`) is the policy-accuracy gate for all dollar values, URLs, and agency references in the estimator. Engineering must maintain a test that verifies the document exists and contains the structural columns that reviewers are expected to fill.

**Resolution — Track 1 ✅ Shipped (PR #62, commit `8cf7e478`, 2026-05-12):**
- `sourceCitationSignoffDocumentExistsWithSemanticAnchors` test: loads `docs/SNAP-source-citation-signoff.md` from disk and asserts the structural columns are present (`Reviewer`, `Signoff date`, `Effective date`, `Last checked`, `Renewal cadence`, `USDA FNS`, `DTA Helpful Charts`). Anchored to durable semantic strings, not line numbers.
- Prior test only asserted reachability of references in code — would pass even if the doc were deleted or emptied.
- Code: `CivicaTests/SNAPComplianceCopyTests.swift`.

**Signoff:**
- Engineering: ✅ Matthew (PR #62 merged 2026-05-12)

---

## Q14 — Submit-to-DTA-Connect copy + written DTA authorization

### Part A: Copy fix — Track 1 ✅ Shipped

**OBBBA requirement / rationale:** "Submit to DTA Connect" implies a Civica→DTA write integration that does not exist without written authorization from MA DTA. Under 7 CFR 273.2, submission to the state agency is the applicant's act; Civica cannot represent itself as performing that act.

**Resolution — Track 1 ✅ Shipped (PR #62, commit `e7c175fc`, 2026-05-12):**
- `SNAPStatusHomeStrings.actionSubmitToState` → `"Open MA DTA Connect to submit"`.
- `stepSubmit` → `"Open MA DTA Connect to submit"` / `"Abrir MA DTA Connect para enviar"` (ES).
- CA parallel: `"Submit to BenefitsCal"` also banned (`submit_to_benefitscal` in registry, added 2026-05-13 when CA became launch state).
- Banned phrases in `SNAPComplianceCopyRegistry.bannedPhrases`: `submit_to_dta`, `submit_to_benefitscal`. CI-enforced via `noSNAPSwiftFileContainsRegistryBannedPhrase`.
- Regression test: `be8ba3f3`.
- Code: `Civica/Features/SNAP/Application/SNAPStatusHomeStrings.swift`, registry.

### Part B: Written DTA / CDSS authorization — Track 3 ⏳ Pending

**External question:** Does a written authorization from MA DTA (and/or CA CDSS) for a Civica→agency submission integration currently exist? If yes, the copy gate can be revisited; if no, the link-out posture stands until one is obtained.

**Signoff required:** Business/ops (Track 3 — confirm authorization status).

---

## Q15 — SOC 2 status

**OBBBA requirement / rationale:** _(needs reviewer input — original audit doc lost; exact provision tying SOC 2 to OBBBA not recoverable from available sources)_ SOC 2 Type II certification (or equivalent) may be required before handling applicant PII in a production environment or as a condition of any state agency data agreement.

**Civica impact:** All four production services handle applicant PII.

**Resolution:** Track 3 — external. Current SOC 2 status unknown. Must be confirmed before launch.

**Signoff required:** External / leadership (Track 3).

---

## Q16 — App Store listing copy

**OBBBA requirement / rationale:** The App Store listing is a public-facing marketing surface. Under 7 CFR 277.4, SNAP outreach materials — including app store listings — must not use incentive, recruitment, or dollar-amount framing.

**Civica impact:** App Store title, subtitle, description, and screenshots may require review for compliance with the same copy rules applied to in-app surfaces (Q2, Q3).

**Resolution:** Track 3 — external. App Store listing copy has not been reviewed against the Q2/Q3 posture. Must be reviewed and approved before App Store submission.

**Signoff required:** Counsel review of App Store listing (Track 3).

---

## Q17 — Marketing site location and copy

**OBBBA requirement / rationale:** Same 7 CFR 277.4 concerns as Q16. The Civica marketing site is a SNAP outreach surface if it refers users to the SNAP screener.

**Civica impact:** The marketing site location (`web/` or external) and its copy have not been reviewed against Q2/Q3 posture.

> Note: Vercel `civica-app` previously pointed to `web/` but that directory no longer exists; the stale config was cleared 2026-05-18. See `reference_vercel_civica_app.md`.

**Resolution:** Track 3 — external. Marketing site URL and copy must be confirmed and reviewed before launch.

**Signoff required:** Business/ops + counsel (Track 3).

---

## Q18 — October rules-refresh owner (FY27 deadline 2026-07-31)

**OBBBA requirement / rationale:** The USDA FNS COLA takes effect Oct 1 each year. Without a named owner, Civica ships FY-1 values on Oct 1 — a concrete compliance gap (wrong eligibility math for every user after that date). The audit requires a named engineering owner assigned before each FY rolls over.

**Resolution:**
- **Automation ✅ Shipped ([PR #121](https://github.com/matthewgg22/civica/pull/121), commit `7aff718b`, 2026-05-18):**
  - `.github/workflows/fy-rules-refresh-reminder.yml`: cron `0 12 15 8 *` (Aug 15, 12:00 UTC annually). Opens a GitHub issue pre-populated with checklist link and hard-deadline reminder. Computes target FY automatically. Idempotent via title-match dedup.
  - `docs/snap/fy-rules-refresh-checklist.md`: six-step playbook (federal rows 5–11, CA rows 13–18, MA rows 1–4, agency list spot-check, signoff re-run, PRs + tag + close).
- **Owner assignment ⏳ Pending (Track 3):** A named owner for the FY27 refresh must be identified by **2026-07-31**.

**Signoff required:** Leadership / engineering (name an owner by 2026-07-31).

---

## Q19 — Source-citation reviewer signoffs + FY26 number corrections

**OBBBA requirement / rationale:** All dollar values, URLs, and agency references that ship in the estimator must be sourced to a citable, dated authority and signed by a policy reviewer. This is the hard gate before any external use of the estimator.

**Civica impact:** 18 rows in `docs/SNAP-source-citation-signoff.md` (10 federal + MA, 8 CA launch batch). Engineering has populated Current code value, Current code location, Proposed verified value, and Last checked. Policy reviewers must fill: Source URL, Effective date, Reviewer, Signoff date, Renewal cadence.

**Resolution:** Track 3 — pending policy reviewers.

Key rows:
- **Rows 5–11** (federal): FY26 max allotments, standard deductions, shelter cap, minimum benefit, asset limits, gross/net income limits. Engineering proposed-verified values are in the doc; FY26 updates cannot land in `FederalDefaultRules.swift` until these rows are signed (per Worktree B parity tests — see Q7 estimator + Q12 stale-rules CI tripwire).
- **Rows 1–4** (MA): apply URL, helpline, BBCE limits, SUAs.
- **Rows 13–18** (CA launch batch, added 2026-05-13): BenefitsCal URL, CalFresh Info Line, CA BBCE limits, CA SUAs, State Hearings address, CA agency name.

**Hard launch gate:** Per Revision 2 §11, no MA beta, App Store review, or external pilot using the estimator until Q19 signoffs land.

Working document: [`docs/SNAP-source-citation-signoff.md`](docs/SNAP-source-citation-signoff.md)

**Signoff required:** Policy reviewer (all 18 rows), then engineering lands FY26 number corrections.

---

## Appendix — Key files

| File | Role |
|---|---|
| [`Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift`](Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift) | Banned phrases + 9 pending §6 copy revisions |
| [`docs/SNAP-source-citation-signoff.md`](docs/SNAP-source-citation-signoff.md) | 18-row policy-accuracy signoff table |
| [`docs/snap/launch-readiness.md`](docs/snap/launch-readiness.md) | Go/no-go gate; §5 = OBBBA status |
| [`docs/snap/fy-rules-refresh-checklist.md`](docs/snap/fy-rules-refresh-checklist.md) | Annual FY rules-refresh playbook (Q18) |
| [`Civica/Features/SNAP/Rules/FederalDefaultRules.swift`](Civica/Features/SNAP/Rules/FederalDefaultRules.swift) | Federal thresholds, ABAWD logic, RuleSnapshotStatus |
| [`Civica/Features/SNAP/SNAPCoveragePolicy.swift`](Civica/Features/SNAP/SNAPCoveragePolicy.swift) | State scope rule |
| [`Civica/Features/SNAP/Application/SNAPApplicationStatusStore.swift`](Civica/Features/SNAP/Application/SNAPApplicationStatusStore.swift) | Keychain eligibility-result store (Q11) |
| [`apps/dashboard/app/packets/[packetId]/ExpeditedReviewGate.tsx`](apps/dashboard/app/packets/[packetId]/ExpeditedReviewGate.tsx) | Navigator distress gate (Q5-C) |
| [`.github/workflows/fy-rules-refresh-reminder.yml`](.github/workflows/fy-rules-refresh-reminder.yml) | Annual FY-refresh cron trigger (Q18) |
