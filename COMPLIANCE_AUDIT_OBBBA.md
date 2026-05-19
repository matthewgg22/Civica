# OBBBA Compliance Audit — Civica SNAP

> **Scope:** P.L. 119-21 (One Big Beautiful Budget Act) and 7 CFR 277.4.
> Last updated: 2026-05-18 — integrated from `civica_launch_answered.xlsx`.
> Sources: PR #62 commits, `SNAPComplianceCopyRegistry.swift`, `docs/SNAP-source-citation-signoff.md`, `docs/snap/launch-readiness.md §5`, PRs #106 #116 #117 #121 #125, `civica_launch_answered.xlsx` (2026-05-18).
> This document is an engineering audit record. It is not a legal opinion.

**Hard launch gate (Revision 2 §11):** No App Store review, external pilot, or estimator use until Q19 source-citation rows + FY26 number correction land.

> ✅ **Previously-live production bug, RESOLVED (2026-05-19):** Q19 row 16 (CA State Hearings address) was flagged with two errors (MS code `19-37` should be `21-37`, street address used instead of PO Box). Verified RESOLVED in current `codex/rebuild-feb18` source: `Civica/Features/SNAP/SNAPAgencyDirectory.swift:75-76` + `:113-114` use the correct **PO Box 944243, MS 21-37, Sacramento CA 94244-2430** in both English and Spanish.

---

## Summary table

| Q# | Title | Track | Status | PR(s) / Commit(s) |
|---|---|---|---|---|
| Q1 | ABAWD tribal exemption copy (EN + ES) | 2 — counsel | ⏳ Strings drafted; pending counsel signoff | — |
| Q2 | WIC cross-program teaser — dollar inducement | 1 — engineering | ✅ Shipped | [PR #62](https://github.com/matthewgg22/civica/pull/62) `92a82cd7` |
| Q3 | §6 persuasive/boundary copy revisions (9 strings) | 2 — counsel | ⏳ Copy drafted EN+ES; pending counsel signoff | [PR #62](https://github.com/matthewgg22/civica/pull/62) (registry); signoffs pending |
| Q4 | §10108 noncitizen disclosure | 2 — counsel | ⏳ Referral-only approach proposed; 3 items pending counsel | — |
| Q5 | LLM data retention + ABAWD age-band + distress gate | 1 + 2 | ✅ Age-band + distress gate shipped; retention policy drafted pending counsel | `80e55440`, `8b67ac29`, [PR #106](https://github.com/matthewgg22/civica/pull/106) |
| Q6 | Pricing rule — non-federal funding | 2 — counsel | ⏳ Scenario analysis complete; **Matthew must confirm funding structure** | — |
| Q7 | State coverage scope + estimator reachability report | 1 + 3 | ✅ Coverage policy shipped; 7 entry points pending engineering confirmation | [PR #62](https://github.com/matthewgg22/civica/pull/62) `dc7f721b` |
| Q8 | Backend LLM persistence matrix | 3 — engineering | ⏳ Matrix drafted; pending engineering confirmation | — |
| Q9 | Edge Function PII map | 3 — engineering | ⏳ PII map drafted; pending engineering confirmation | — |
| Q10 | §10104 utilities sweep | 3 — engineering | ✅ Fix shipped; written sweep confirmation pending | [PR #116](https://github.com/matthewgg22/civica/pull/116) `c43b3c34` |
| Q11 | At-rest data protection — eligibility result | 1 — engineering | ✅ Shipped | [PR #62](https://github.com/matthewgg22/civica/pull/62) `fb36ea2d` |
| Q12 | Stale rules — engine + UI banner + user copy | 1 + 2 | ✅ Engine + banner shipped; copy drafted pending counsel | [PR #62](https://github.com/matthewgg22/civica/pull/62), [PR #117](https://github.com/matthewgg22/civica/pull/117) |
| Q13 | Source-citation signoff test | 1 — engineering | ✅ Shipped | [PR #62](https://github.com/matthewgg22/civica/pull/62) `8cf7e478` |
| Q14 | Submit-to-portal copy + written agency authorization | 1 + 3 | ✅ Copy fixed; **Matthew must check for written authorization** | [PR #62](https://github.com/matthewgg22/civica/pull/62) `e7c175fc` |
| Q15 | SOC 2 status | 3 — external | ⏳ **Matthew must determine current status** | — |
| Q16 | App Store listing copy | 3 — external | ⏳ Compliant draft written; pending counsel review | — |
| Q17 | Marketing site copy | 3 — external | ⏳ Compliant draft written; pending counsel review | — |
| Q18 | October rules-refresh owner (FY27 deadline 2026-07-31) | 3 — external | ✅ Automation shipped; **Matthew must name owner** | [PR #121](https://github.com/matthewgg22/civica/pull/121) |
| Q19 | Source-citation reviewer signoffs + FY26 corrections | 3 — external | ⚠️ 18 rows verified; row 16 **RESOLVED** (2026-05-19); reviewer signoffs pending | [`docs/SNAP-source-citation-signoff.md`](docs/SNAP-source-citation-signoff.md) |

---

## Execution tracks

- **Track 1 — Engineering, no counsel input needed.** Core batch: [PR #62](https://github.com/matthewgg22/civica/pull/62) merged 2026-05-12. Post-PR-62: §10104 fix [PR #116](https://github.com/matthewgg22/civica/pull/116), stale-rules UI banner [PR #117](https://github.com/matthewgg22/civica/pull/117), ABAWD age-band commits `80e55440` + `8b67ac29`, FY-refresh reminder [PR #121](https://github.com/matthewgg22/civica/pull/121).
- **Track 2 — Blocked on counsel / legal-policy signoff.** Q1, Q3 strings, Q4, Q5-D, Q6 (pending Matthew's funding answer), Q12 user copy.
- **Track 3 — Blocked on external facts / third-party inputs.** Q7-B (engineering), Q8+Q9 (engineering), Q10 sweep (engineering), Q14-B (Matthew), Q15 (Matthew), Q16+Q17 (counsel review), Q18 (owner name), Q19 (reviewer signoffs).

---

## Q1 — ABAWD tribal exemption copy (EN + ES)

**OBBBA requirement:** §10102(a) (eff. 2025-07-04) added Native American / ANCSA exemptions to ABAWD rules; removed homeless, veteran, and foster-youth exemptions. Surfaces must not display removed exemptions.

**Civica impact:** SNAP application flow and voice-extraction pipeline explain ABAWD requirements. Native American exemption data model pre-staged but not merged pending string signoff.

**Resolution — Track 2 ⏳ Strings drafted, pending counsel signoff:**

Code home: `Civica/Features/SNAP/Application/SNAPHouseholdQuestionFlow.swift`, `SNAPVoicePrompts.swift`, `FederalDefaultRules.abawdStatus()`.

| String ID | Location | Approved English | Approved Spanish | Compliance note |
|---|---|---|---|---|
| `abawd_tribal_question` | `.abawdExemptionCheck` step | Are you a member of a federally recognized tribe or an Alaska Native Claims Settlement Act (ANCSA) corporation — or do you share meals with a household member who is? | ¿Es usted miembro de una tribu reconocida federalmente o de una corporación de la Ley de Acuerdo de Reclamaciones Nativas de Alaska (ANCSA), o comparte comidas con un miembro del hogar que lo sea? | **Counsel: confirm 'shares meals' criterion mirrors FNS guidance on §10102(a) household definition.** |
| `abawd_tribal_explanation` | `explanationText` on above step | Federal law provides certain exemptions from SNAP work requirements for tribal members. Your answer helps us determine whether this applies to your household. | La ley federal establece ciertas exenciones de los requisitos de trabajo de SNAP para miembros de tribus. Su respuesta nos ayuda a determinar si esto aplica a su hogar. | Must not say 'you may be exempt' (outcome) or 'you are required to work' (coercive). |
| `abawd_tribal_voice_prompt` | `SNAPVoicePrompts.swift` — `abawdTribalExemption` | Are you, or is anyone in your household, a member of a federally recognized tribe or Alaska Native corporation? | ¿Es usted, o algún miembro de su hogar, miembro de una tribu reconocida federalmente o de una corporación nativa de Alaska? | **Counsel: confirm 'Alaska Native corporation' (without ANCSA full name) is not under-inclusive.** |
| `abawd_tribal_confirmed_label` | Confirmation chip on review screen | Tribal exemption noted | Exención tribal registrada | Must not say 'approved', 'eligible', or 'exempt' as final determination. |
| `abawd_removal_note` (dev-only) | Code comment in `abawdStatus()` — non-user-facing | `// §10102(a) OBBBA (eff. 07/04/2025): ABAWD age ceiling raised 54→64. Native American / ANCSA exemptions ADDED. Homeless, veteran, and foster-youth exemptions REMOVED. Do not surface removed exemptions in any user-facing flow.` | N/A | Engineering must ensure removed exemptions are not displayed in any state. |

**Signoff required:** Counsel (all EN+ES strings before merge).

---

## Q2 — WIC cross-program teaser — dollar inducement

**OBBBA requirement:** 7 CFR 277.4(b)(5)(i) prohibits dollar-amount-as-headline incentive in SNAP outreach. 7 CFR 246.4 / 246.26 parallel constraints for WIC.

**Resolution — Track 1 ✅ Shipped (PR #62, 2026-05-12):**
- Dropped `wicEstimate` constant and dollar pill; rewrote to factual copy covering the WIC-eligible population.
- Regression test `wicTeaserDoesNotForegroundDollarAmount`: strings must not contain `$48`, `~$`, `/mo`, `/mes`.
- Code: `Civica/Features/SNAP/SNAPCrossProgramTeaserView.swift`. Commits: `92a82cd7`, `be8ba3f3`.

**Signoff:** Engineering ✅ (PR #62, 2026-05-12).

---

## Q3 — §6 persuasive/boundary copy revisions (9 strings)

**OBBBA requirement:** 7 CFR 277.4 — no incentive, urgency, loss-aversion, or agency-attribution framing. All 9 strings must be approved EN+ES.

**Resolution — infra Track 1 ✅; strings Track 2 ⏳ EN+ES drafts complete, pending counsel signoff:**

Registry: [`Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift`](Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift). When counsel signs a row: PR fills `approvedEnglish` + `approvedSpanish`, flips `status` to `.approved`. CI guard `approvedRevisionsHaveCompleteBilingualPair` prevents EN-only signoff.

| Row ID | Surface file | Current English | Approved English | Approved Spanish | Key compliance note |
|---|---|---|---|---|---|
| `approval_email_subject` | `CivicaNotificationTemplates.swift` | `"Approved. $X/mo, starting this month."` | Your SNAP application has been approved | Su solicitud de SNAP ha sido aprobada | Dollar amount may appear in email body attributed to state agency — not in subject line. |
| `decision_approved_headline` | `SNAPDecisionApprovedView.swift` | `"You're approved."` | Based on your answers, your household appears to be eligible for SNAP benefits | Según sus respuestas, su hogar parece ser elegible para los beneficios de SNAP | **Counsel: confirm 'appears to be eligible' qualifier is sufficient or suggest alternate phrasing.** |
| `expedited_banner_almost` | `SNAPExpeditedBanner.swift` | `"Almost — one more answer could speed this up"` | Your answers suggest you may qualify for emergency SNAP benefits | Sus respuestas sugieren que podría calificar para beneficios de SNAP de emergencia | CA uses 'emergency' (CalFresh); MA uses 'expedited' (DTA). If single string, use federal term 'expedited'. **Counsel: choose one term; engineering will state-parameterize if needed.** |
| `estimator_entry_subtitle` | `SNAPBenefitEstimatorStrings.swift` | `"Five questions. See your monthly dollar amount before you apply."` | Answer a few questions to check your household's potential SNAP eligibility | Responda algunas preguntas para verificar la posible elegibilidad de su hogar para SNAP | Removes step count and dollar preview. 'Potential eligibility' frames Civica's output correctly. |
| `estimator_apply_cta` | `SNAPBenefitEstimatorStrings.swift` | `"Apply for SNAP"` | CA: Start your application on BenefitsCal / MA: Start your application on DTA Connect | CA: Inicie su solicitud en BenefitsCal / MA: Inicie su solicitud en DTA Connect | **Must be state-parameterized.** CA → benefitscal.com; MA → dtaconnect.eohhs.mass.gov. **Counsel: confirm state-branded CTA satisfies portal-attribution requirement.** |
| `doc_requested_sms_body` | `CivicaNotificationTemplates.swift` | `"...By {deadline} keeps your application moving."` | Please submit your {doc} by {deadline} to continue processing your application. | Por favor envíe su {doc} antes de {deadline} para continuar el procesamiento de su solicitud. | **Counsel: confirm 'processing' does not imply Civica processes the application (state agency does).** |
| `recert_one_day_sms` | `CivicaNotificationTemplates.swift` | `"4 minutes if you start now. If you miss it, benefits pause..."` | CA: Your SNAP recertification is due tomorrow. Log in to BenefitsCal to complete it by {deadline}. / MA: Your SNAP recertification is due tomorrow. Log in to DTA Connect to complete it by {deadline}. | CA: Su recertificación de SNAP vence mañana. Inicie sesión en BenefitsCal para completarla antes de {deadline}. / MA: Su recertificación de SNAP vence mañana. Inicie sesión en DTA Connect para completarla antes de {deadline}. | 'Benefits pause' removed. If factual consequence permissible: 'A missed deadline may interrupt your benefits'. **Must be state-parameterized.** |
| `recert_heads_up_email_subject` | `CivicaNotificationTemplates.swift` | `"Recertify in 60 days. Usually 4 minutes."` | Your SNAP recertification is due in 60 days | Su recertificación de SNAP vence en 60 días | Plain factual deadline. No timing/ease cue in subject. |
| `ebt_pin_cta` | `CivicaNotificationTemplates.swift` | `"Set the EBT PIN"` | CA: Set your PIN at ebt.ca.gov / MA: Set your PIN at ebtedge.com | CA: Configure su PIN en ebt.ca.gov / MA: Configure su PIN en ebtedge.com | **Must be state-parameterized.** CA → ebt.ca.gov; MA → ebtedge.com. Opens external portal. **Counsel: confirm linking policy is permissible.** |

**Signoff required:** Counsel (all 9 rows EN+ES). See also launch-readiness §6.

---

## Q4 — §10108 noncitizen disclosure

**OBBBA requirement:** §10108 strengthened SAVE verification and adjusted eligibility for certain noncitizen categories (parolees, qualified aliens). The screener must not attempt to determine noncitizen eligibility — legal complexity exceeds safe screener logic.

**Proposed approach — referral-only (Track 2, pending counsel):**

| Surface | Trigger | Proposed English | Proposed Spanish |
|---|---|---|---|
| Immigration status question (screener entry) | User answers 'No' / 'Not a U.S. citizen' | SNAP eligibility rules for non-U.S. citizens depend on your specific immigration status and household circumstances. This tool cannot determine your eligibility. Please contact your state SNAP office or a local legal aid organization for guidance specific to your situation. CA: Call the CalFresh Info Line at 877-847-3663 / Apply at benefitscal.com. MA: Call DTA at 877-382-2363 / Apply at dtaconnect.eohhs.mass.gov | Las reglas de elegibilidad de SNAP para personas que no son ciudadanos estadounidenses dependen de su estatus migratorio específico y las circunstancias de su hogar. Esta herramienta no puede determinar su elegibilidad. Por favor comuníquese con su oficina estatal de SNAP o con una organización de asistencia legal local. CA: Llame al 877-847-3663 / Solicite en benefitscal.com. MA: Llame a DTA al 877-382-2363 / Solicite en dtaconnect.eohhs.mass.gov |
| Results screen — noncitizen flagged | User completes screener with noncitizen flag | Based on your answers, your eligibility may depend on additional factors related to immigration status. Please contact your state SNAP office directly. CA: benefitscal.com or 877-847-3663. MA: dtaconnect.eohhs.mass.gov or 877-382-2363 | Según sus respuestas, su elegibilidad puede depender de factores adicionales relacionados con su estatus migratorio. Por favor comuníquese directamente con su oficina estatal de SNAP. CA/MA portals as above. |
| Privacy policy / disclosure page | Static — all screens | This tool does not collect or store your immigration status. Your responses are used only to estimate SNAP eligibility based on the information you provide. | Esta herramienta no recopila ni almacena su estatus migratorio. Sus respuestas se usan únicamente para estimar la elegibilidad de SNAP según la información que usted proporciona. |

**Regulatory basis:** 7 USC 2014(a); 8 USC 1641; OBBBA §10108 (SAVE verification; parolee eligibility adjustments).

**Data minimization:** Citizenship as a boolean routing field is permissible; specific immigration category must not be collected or stored.

**Counsel: 3 open items:**
1. Verify §10108 provisions against current FNS guidance; confirm referral-only approach is compliant or advise alternative.
2. Confirm suppressing the dollar estimate for noncitizen-flagged cases is required and sufficient.
3. Confirm data minimization posture on the immigration status field is compliant with CCPA + §10108 SAVE.

---

## Q5 — LLM data retention + ABAWD age-band + navigator distress gate

### Q5-A — ABAWD age-band fix (§10102(a)) — Track 1 ✅ Shipped

**Resolution (commit `80e55440`, 2026-05-17):** `FederalDefaultRules.abawdStatus()` ceiling raised 54→64. Cross-state fixtures: [PR #125](https://github.com/matthewgg22/civica/pull/125).
Code: [`Civica/Features/SNAP/Rules/FederalDefaultRules.swift`](Civica/Features/SNAP/Rules/FederalDefaultRules.swift).

### Q5-B — ABAWD dependent-child exception (§10102(a)) — Track 1 ✅ Shipped

**Resolution (commit `8b67ac29`, 2026-05-17):** `hasChildUnder14InHousehold` added; question flow, voice pipeline, rules updated; 5 boundary tests.
Code: [`Civica/Features/SNAP/Application/SNAPHouseholdQuestionFlow.swift`](Civica/Features/SNAP/Application/SNAPHouseholdQuestionFlow.swift).

### Q5-C — Navigator distress-review gate — Track 1 ✅ Shipped

**Resolution ([PR #106](https://github.com/matthewgg22/civica/pull/106), 2026-05-17):** `ExpeditedReviewGate.tsx` amber banner + two-button CTA when unemployed + gross income < $150 + `is_expedited IS NULL`. Supabase migration adds `is_expedited boolean` to `snap_packets`.
Code: [`apps/dashboard/app/packets/[packetId]/ExpeditedReviewGate.tsx`](apps/dashboard/app/packets/[packetId]/ExpeditedReviewGate.tsx).

### Q5-D — LLM data retention policy — Track 2 ⏳ Policy drafted, pending counsel approval

Full policy document: [`docs/snap/llm-retention-policy.md`](docs/snap/llm-retention-policy.md) (CIVICA-POL-001 v0.1).

> ⚠️ **Conflict with `docs/snap/retention_policy.md`:** The existing DB retention policy stores document image blobs for 7 years. The LLM policy specifies 0 days for document image content — must never be stored. Counsel must harmonize before either policy is finalized.

**Retention table:**

| Data category | Primary TTL | Backup TTL | Status |
|---|---|---|---|
| LLM input/output logs (structured, de-identified) | 90 days from last user interaction | 30 days after primary expiry | ⏳ Counsel: approve / specify different TTL |
| **Raw voice transcripts** | **0 days — must not be stored** | N/A | ⏳ Counsel: approve |
| **Document image content** | **0 days — must not be stored** | N/A | ⏳ Counsel: resolve conflict with `retention_policy.md` |
| Eligibility estimates (structured JSON) | 90 days | 30 days | ⏳ Counsel: approve |
| Enrollment routing decisions | 90 days | 30 days | ⏳ Counsel: approve |

**Other policy elements:**

| Element | Value | Status |
|---|---|---|
| User-requested deletion SLA | 45 days (CCPA minimum — cannot extend) | ⏳ Counsel: approve |
| Right to Know SLA | 45 days | ⏳ Counsel: approve |
| RBAC | Admin: read-only audit. User: own data only. No engineer direct-DB access to raw PII. | ⏳ Counsel: approve / add named roles. Engineering: implement RLS on Supabase tables. |
| LLM provider ZDR | Required for all third-party LLM API calls processing PII | ⚠️ **Engineering: verify ZDR is active before beta.** OpenAI: platform.openai.com → Settings → Data Usage & Privacy. |
| Sentry `beforeSend` | All PII scrubbed before leaving device/service | ⏳ Counsel: approve. Fields: `name, ssn, ssn_last4, dob, income, gross_income, net_income, address, street, zip, voice_transcript, document_text, case_id` |
| Sentry `beforeBreadcrumb` | **Separate hook — must be configured independently** to prevent transcript fragments in breadcrumbs | ⚠️ **Engineering: confirm `beforeBreadcrumb` is configured on `civica-snap-engine`.** |
| Audit logging | Timestamp + actor ID + table + query type; destination: Supabase audit table | ⏳ Counsel: approve |
| Incident response | Assess scope: 24h. Notify counsel: 24h. CCPA user notification: **72h** from discovery. | ⏳ Counsel: confirm timelines. Runbook: [`docs/snap/incident_response.md`](docs/snap/incident_response.md). |
| DPAs | Supabase, Cloudflare, Fly.io, OpenAI, Sentry — **all pending** | ⚠️ All 5 must be signed before PII enters production. |
| Annual policy review | Aug 15 trigger (Q18 workflow); owner = see Q18 | ⏳ Counsel: approve. |

---

## Q6 — Pricing rule — non-federal funding

**OBBBA requirement:** §10106 restricts non-federal fund use to expand SNAP beyond federal parameters and governs vendor relationships. 7 CFR 277.4 governs state-funded SNAP outreach materials.

**Scenario analysis — Matthew must confirm which scenario applies:**

| Scenario | §10106 trigger? | Required action |
|---|---|---|
| Entirely privately funded; no state contract; no SNAP administrative funds | **Likely NO** direct obligation. 7 CFR 277.4 does not directly apply if no state/federal outreach funds. | **Counsel must confirm Civica receives zero state/federal SNAP administrative or outreach funds.** |
| Has state contract or receives state SNAP administrative funds | **YES** — §10106 + full 7 CFR 277.4 posture apply. | Disclosure required on all user-facing surfaces: *"This tool is provided in partnership with [State Agency] to help households check SNAP eligibility. It does not represent an official determination by [State Agency]."* + ES equivalent. |
| Charges subscription / per-user fee | **Likely YES** — 7 CFR 273.2(c)(1) prohibits requiring payment for SNAP applications. | Disclosure: *"SNAP eligibility screening is always free. Your subscription covers [other features]."* Counsel must advise. |

**⚠️ Action required from Matthew:** Which scenario applies? This determines whether the full 7 CFR 277.4 posture is legally required or voluntarily adopted.

---

## Q7 — State coverage scope + estimator reachability

### Q7-A — State coverage scope — Track 1 ✅ Shipped

**Resolution (PR #62, commit `dc7f721b`, 2026-05-12):** `SNAPCoveragePolicy` with `supportedStateCodes = {"CA", "MA"}`, gate on `CivicaEntryView` and orchestrator, launch-time purge of out-of-scope verdicts.
Code: [`Civica/Features/SNAP/SNAPCoveragePolicy.swift`](Civica/Features/SNAP/SNAPCoveragePolicy.swift).

### Q7-B — Estimator reachability report — Track 3 ⏳ Engineering must confirm all 7 entry points

| Entry point | Code path | SNAPCoveragePolicy checked? | Priority | Eng: confirm |
|---|---|---|---|---|
| CivicaEntryView — SNAP tile tap | `CivicaEntryView` → `SNAPEstimatorView` | Must call `isInScope()` before rendering estimator | P1 — Highest | `[ Eng: confirm ]` |
| Deep link `civica://snap/estimator` | External deep link (push, SMS, web) | Deep link handler must call `isInScope()` before render | P1 — Highest | `[ Eng: confirm ]` |
| Bookmarked / resumed session on relaunch | State restoration with saved estimator session | Must re-check `isInScope()` — state may change between sessions | P1 — Highest | `[ Eng: confirm ]` |
| Onboarding shortcut — 'Check eligibility now' | First-launch fast-path | Must gate on `isInScope()` — new users may be in unsupported states | P2 | `[ Eng: confirm ]` |
| Push notification — 'Check your estimate' CTA | Scheduled notification CTA → estimator | Must route through deep-link handler; must not bypass coverage gate | P2 | `[ Eng: confirm ]` |
| iOS home-screen widget (if implemented) | Widget CTA | Must use same deep-link scheme | P3 | `[ Eng: confirm or N/A ]` |
| Siri / Shortcuts (if implemented) | 'Check my SNAP eligibility' shortcut | Must route through coverage-gated path | P3 | `[ Eng: confirm or N/A ]` |

---

## Q8 — Backend LLM persistence matrix

**Required for counsel to sign Q5-D. Engineering: confirm all rows.**

| LLM call | Service | PII in inputs? | Outputs stored | Storage | TTL | RBAC | Eng: confirmed |
|---|---|---|---|---|---|---|---|
| Voice extraction (transcript → structured fields) | `civica-snap-engine` | YES — name, income, HH size, address | Structured JSON only (no raw transcript stored) | `snap_intake_events` (Supabase) | 90 days | User-scoped (RLS: `user_id`) | `[ Eng: confirm ]` |
| Document quality check (uploaded doc OCR) | `SNAPDocumentQualityCheck` (iOS) | YES — doc may contain SSN, income, name | Quality score (0–1) + flagged fields (no raw doc text) | `snap_doc_checks` (Supabase) | 90 days | User-scoped (RLS: `user_id`) | `[ Eng: confirm ]` |
| Enrollment routing (household → routing decision) | `civica-enrollment-api` (Edge Function) | PARTIAL — income band, HH size (PII-adjacent, not identifiers) | Routing decision enum + program codes | `snap_enrollments` (Supabase) | 90 days | User-scoped read; Admin audit | `[ Eng: confirm ]` |
| Rule evaluation (household → eligibility estimate) | `civica-snap-engine` (local rule engine — **no external LLM call**) | N/A — deterministic | Eligibility estimate + breakdown | `snap_estimates` (Supabase) | 90 days | User-scoped | `[ Eng: confirm no LLM call in rule path ]` |

---

## Q9 — Edge Function PII map

**Required for counsel to sign Q5-D. Engineering: confirm all rows.**

| Edge Function | PII fields ingested | Sentry risk (pre-scrub) | `beforeSend` / `beforeBreadcrumb` scrubs | Log drain exposure | Supabase table / RLS | Eng: confirmed |
|---|---|---|---|---|---|---|
| `civica-enrollment-api` | name (optional), income_band, hh_size, state, citizenship_flag, expedited_flag | RISK: raw request body in Sentry if unhandled exception fires before scrubber | Must scrub: name, raw income, address. `beforeSend` must run even on init errors. | Structured JSON; income_band permissible; name must NOT appear | `snap_enrollments` (RLS: `user_id`); `snap_audit` (admin-only) | `[ Eng: confirm ]` — **verify exception handler wraps entire request** |
| `civica-snap-engine` | hh_size, income (gross + net), deductions, state, categorical_flags, voice_transcript (optional) | RISK: voice transcript fragments in Sentry breadcrumbs | Must scrub: voice_transcript, raw income, name, DOB. **`beforeBreadcrumb` hook is a separate configuration from `beforeSend` — both must be set.** | Estimate JSON only; no raw transcript or income | `snap_estimates` + `snap_intake_events` (both RLS: `user_id`) | `[ Eng: confirm ]` |

---

## Q10 — §10104 utilities sweep

**Resolution — fix ✅ Shipped ([PR #116](https://github.com/matthewgg22/civica/pull/116)):** "Do not include internet" added to utilities helpers and voice guide in EN+ES. CA ACL 25-50 confirms §10104-compliant.

**Remaining (Track 3 — engineering):** Written sweep confirmation to counsel:

```
Run: grep -ri "internet\|broadband\|wifi\|wi-fi" Civica/Features/SNAP/
     grep for any utility-list rendering in FederalDefaultRules.swift

If no references found, produce one-paragraph written confirmation:
"Sweep completed [date]. No references to internet, broadband, or wi-fi as qualifying
utility expenses found in Civica/Features/SNAP/**/*.swift or FederalDefaultRules.swift
after PR #116. §10104 internet exclusion is fully implemented."
Send to counsel.
```

---

## Q11 — At-rest data protection — eligibility result

**OBBBA requirement:** SNAP verdict + monthly benefit + contributing factors are a record of recipient assistance under 7 USC 2020(e)(8) / 7 CFR 272.1(c). UserDefaults storage is insufficient.

**Resolution — Track 1 ✅ Shipped (PR #62, commit `fb36ea2d`, 2026-05-12):**
- `SNAPEligibilityResultKeychainStore`: `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, `kSecAttrSynchronizable=false`, `kSecUseDataProtectionKeychain=true`.
- One-shot migration from UserDefaults; `deleteEverything` adds belt-and-suspenders Keychain wipe.
- CI fix (commit `39d8b627`): `keychainAvailableForTests` runtime probe + `@Suite(.enabled(if:))`.
- Code: [`Civica/Features/SNAP/Application/SNAPApplicationStatusStore.swift`](Civica/Features/SNAP/Application/SNAPApplicationStatusStore.swift).

**Signoff:** Engineering ✅.

---

## Q12 — Stale rules — engine, UI banner, and user copy

### Q12-A — Rules-engine stale-status protocol — Track 1 ✅ Shipped

**Resolution (PR #62, commit `0ef7a5e7`):** `RuleSnapshotStatus` enum + `snapshotStatus(asOf:)`. CI tripwire fails post-Oct-2026 if no FY27 snapshot.
Code: [`Civica/Features/SNAP/Rules/FederalDefaultRules.swift`](Civica/Features/SNAP/Rules/FederalDefaultRules.swift).

### Q12-B — Stale-rules UI banner — Track 1 ✅ Shipped

**Resolution ([PR #117](https://github.com/matthewgg22/civica/pull/117)):** `SNAPBenefitEstimatorView` banner when `snapshotStatus(asOf: Date())` returns `.expired`.
Code: [`Civica/Features/SNAP/SNAPBenefitEstimatorView.swift`](Civica/Features/SNAP/SNAPBenefitEstimatorView.swift).

### Q12-C — Stale-rules user copy — Track 2 ⏳ Copy drafted, pending counsel signoff

| Surface | Trigger | Approved English | Approved Spanish | Key requirement |
|---|---|---|---|---|
| In-app banner (PR #117 UI exists; copy needs signoff) | `RuleSnapshotStatus.expired` | Benefit estimates here may be based on outdated guidelines. For current SNAP information, visit [State Portal]. | Los estimados de beneficios aquí pueden estar basados en guías desactualizadas. Para información actual sobre SNAP, visite [Portal estatal]. | 'May be based on' — do not say wrong. Include state portal link. |
| Email | `RuleSnapshotStatus.expired` + active session | Subject: An update about your SNAP benefit estimate. Body: We're writing to let you know that the federal guidelines we use to estimate your household's potential SNAP benefit are currently being updated. This does not affect your eligibility. To check current SNAP information or start an application, please visit [State Portal] or call [State Helpline]. We'll send an updated estimate once the new guidelines are in effect. — The Civica Team | Asunto: Una actualización sobre su estimado de beneficios de SNAP. Cuerpo: Le escribimos para informarle que las guías federales que usamos para estimar los beneficios potenciales de SNAP de su hogar están siendo actualizadas. Esto no afecta su elegibilidad. Para verificar información actual de SNAP o iniciar una solicitud, visite [Portal estatal] o llame a [Línea de ayuda]. Le enviaremos un estimado actualizado una vez que las nuevas guías estén en vigencia. — El equipo de Civica | **Must include 'does not affect your eligibility.'** No dollar figures. State-parameterized. |
| SMS | `RuleSnapshotStatus.expired` + phone on file | Civica: The SNAP benefit estimate in your account is temporarily paused while federal guidelines update. Your eligibility is not affected. Visit [State Portal] for current info. | Civica: El estimado de beneficios de SNAP en su cuenta está temporalmente en pausa mientras se actualizan las guías federales. Su elegibilidad no se ve afectada. Visite [Portal estatal] para información actual. | **Counsel: confirm 'temporarily paused' accurately characterizes the UI state.** |
| Blocked estimator screen | `RuleSnapshotStatus.expired` + user reaches result step | We're updating our benefit guidelines. We can't show a benefit estimate right now — but this doesn't affect your eligibility. To apply or check current information, visit [State Portal]. | Estamos actualizando nuestras guías de beneficios. No podemos mostrar un estimado de beneficios en este momento, pero esto no afecta su elegibilidad. Para solicitar o verificar información actual, visite [Portal estatal]. | **'Doesn't affect your eligibility' is mandatory here.** No dollar amount. Portal CTA required. |

**Signoff required:** Counsel + Policy Reviewer (all 4 surfaces EN+ES).

---

## Q13 — Source-citation signoff test

**Resolution — Track 1 ✅ Shipped (PR #62, commit `8cf7e478`):**
- `sourceCitationSignoffDocumentExistsWithSemanticAnchors` loads `docs/SNAP-source-citation-signoff.md` and asserts structural columns are present (`Reviewer`, `Signoff date`, `Effective date`, `Last checked`, `Renewal cadence`, `USDA FNS`, `DTA Helpful Charts`).
- Code: `CivicaTests/SNAPComplianceCopyTests.swift`.

**Signoff:** Engineering ✅.

---

## Q14 — Submit-to-portal copy + written agency authorization

### Q14-A — Copy fix — Track 1 ✅ Shipped

**Resolution (PR #62, commit `e7c175fc`):** `"Submit to DTA Connect"` → `"Open MA DTA Connect to submit"`. CA parallel banned via registry. CI-enforced.
Code: `Civica/Features/SNAP/Application/SNAPStatusHomeStrings.swift`.

### Q14-B — Written agency authorization — Track 3 ⏳ Matthew must check records

**What to look for in email / contract records:**
- Signed MOU, data-sharing agreement, or authorization letter from MA DTA or CA CDSS
- Email from DTA/CDSS program officer explicitly authorizing Civica to submit on behalf of applicants
- API access credentials issued by the state (implies some level of authorization)

**If no written authorization exists:** Banned-phrase gate stays. Civica may not submit applications on behalf of users. To obtain: MA DTA at 617-348-8400 or CA CDSS.

**Action:** Matthew — check records. If authorization exists, share with counsel. If not, do NOT enable submission features.

---

## Q15 — SOC 2 status

**Matthew must determine current status:**

| Status | Implication |
|---|---|
| A) SOC 2 Type II in progress or complete | Provide report date to counsel and state partners. |
| B) Type I complete, Type II not started | Disclose Type I to partners; initiate Type II immediately if targeting state contracts. |
| C) No SOC 2 audit | For pre-beta with limited PII and no state contract: documented security policies + signed DPAs + CCPA compliance are minimum bar. Cannot sign state agency data agreements without SOC 2 or equivalent. Begin readiness assessment immediately if state contracts on roadmap. |

**Recommended minimum for CA pilot (regardless of SOC 2 status):** Documented security policies + all DPAs signed + penetration test report + CCPA compliance documentation.

**Action:** Matthew — determine status; report to counsel + state agency partners.

---

## Q16 — App Store listing copy

**OBBBA requirement:** App Store listing is a SNAP outreach surface under 7 CFR 277.4 (if state/federal funded — see Q6). No dollar amounts, no approval language, no ease/urgency stack.

**Compliant drafts (pending counsel review):**

| Field | Compliant draft | Char count / limit | Compliance note |
|---|---|---|---|
| App Name | Civica — SNAP Eligibility | 25 / 30 | No dollar framing. |
| Subtitle | Check SNAP eligibility | 22 / 30 | **⚠️ Trim required** from 34-char draft. Alt: 'See if you qualify for SNAP' (27 chars). **Counsel: confirm neutral enough.** |
| Description | Civica helps your household check whether you may qualify for SNAP (food benefits). Answer a few questions about your household size and income, and we'll show you whether your household may be eligible and how to start an application through your state's official portal. Civica is a screening tool — it does not submit applications or make eligibility determinations. All eligibility decisions are made by your state SNAP agency. Currently available in California and Massachusetts. Free to use. No account required. Privacy: Civica does not sell your data. Your answers are used only to estimate SNAP eligibility. | ~530 / 4,000 | No dollar amounts. 'May be eligible' throughout. **Counsel: confirm qualifier sufficient.** |
| Keywords | SNAP,food stamps,EBT,food benefits,CalFresh,DTA,eligibility,benefits checker | 76 / 100 | No dollar figures; no 'approved'. |
| Screenshot caption 1 | Check if your household may qualify for SNAP food benefits | 58 | No dollar amount. |
| Screenshot caption 2 | A few questions about your household size and income | 52 | Neutral screener description. |
| Screenshot caption 3 | See your results and how to apply through your state's portal | 61 | If screenshot shows a dollar estimate, include 'This is an estimate' disclaimer. |

**Signoff required:** Counsel before App Store submission.

---

## Q17 — Marketing site copy

**Compliant drafts (pending counsel review):**

| Field | Compliant draft | Compliance note |
|---|---|---|
| Hero headline | Find out if your household qualifies for SNAP food benefits | No dollar framing. |
| Hero subheadline | Civica is a free screening tool. Answer a few questions and we'll show you whether you may be eligible and how to apply through your state's official SNAP portal. | 'May be eligible' qualifier. States official portal routing. |
| Feature callout 1 | Check eligibility in minutes — no account required | ⚠️ 'In minutes' is mild ease framing. Alt if triggered: 'Check eligibility anytime, from any device'. **Counsel: advise.** |
| Feature callout 2 | Available in California and Massachusetts | Manages unsupported-state expectations. |
| Feature callout 3 | Your answers are private and never sold | CCPA Do Not Sell posture. |
| CTA button | Check your eligibility | No dollar framing. No 'apply' in CTA. |
| Footer disclosure (required if site refers to SNAP screener) | Civica is an independent screening tool and is not affiliated with or endorsed by any government agency. SNAP eligibility determinations are made solely by your state SNAP agency. | Required if 7 CFR 277.4 applies. **Counsel: confirm placement and prominence requirements.** |

**Signoff required:** Counsel before site goes live.

---

## Q18 — October rules-refresh owner (FY27 deadline 2026-07-31)

**Automation ✅ Shipped ([PR #121](https://github.com/matthewgg22/civica/pull/121)):** GitHub Actions cron fires Aug 15 annually. Playbook: [`docs/snap/fy-rules-refresh-checklist.md`](docs/snap/fy-rules-refresh-checklist.md).

**⚠️ Owner designation pending — deadline 2026-07-31.** Matthew must name the FY27 owner. Once provided, the 2026-08-15 scheduled reminder can be wired immediately.

**GitHub issue template (replace `[OWNER NAME]`):**

```markdown
## FY27 SNAP COLA Rules Refresh

**Owner:** [OWNER NAME]
**Trigger date:** 2026-08-15 (FNS typically publishes FY27 memo late August)
**Effective date:** 2027-10-01

### Checklist
- [ ] Fetch new FNS maximum allotments + deductions PDF (fns-prod.azureedge.us)
- [ ] Fetch new FNS COLA memo for income eligibility tables
- [ ] Fetch updated MA DTA BBCE limits (HHS FPL update, typically February)
- [ ] Fetch updated CA CDSS ACIN for MCE limits + SUAs
- [ ] Update FederalDefaultRules.swift with new federal values
- [ ] Update MA state rules with new BBCE limits
- [ ] Update CA state rules with new MCE + SUA values
- [ ] Run Vitest source-citation suite — must pass
- [ ] Re-run Q19 signoff workflow for rows 5–11 (federal) + rows 13–18 (CA) + rows 3–4 (MA)
- [ ] Update civica_snap_signoff.xlsx with new verified values
- [ ] Counsel + policy reviewer re-sign updated rows
- [ ] Merge FederalDefaultRules.swift PR — parity tests in Worktree B validate automatically

### Source URLs
- Federal allotments: https://fns-prod.azureedge.us/sites/default/files/resource-files/snap-fy{YEAR}maximumAllotments-deductions.pdf
- Federal income limits: https://www.usda.gov/sites/default/files/guidance-documents/fns.snap-cola-fy{YEAR}memo.pdf
- MA BBCE: mass.gov DTA BBCE standards PDF
- CA ACIN: cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACINs/{YEAR}/
```

---

## Q19 — Source-citation reviewer signoffs + FY26 number corrections

**Hard launch gate:** No estimator use until all 18 rows signed by a policy reviewer.

Working document: [`docs/SNAP-source-citation-signoff.md`](docs/SNAP-source-citation-signoff.md).

> ✅ **Row 16 — RESOLVED (2026-05-19):** Earlier audits flagged a live production bug at `SNAPAgencyDirectory.swift` row 16 (CA State Hearings address) with MS code `19-37` (should be `21-37`) and a street address instead of PO Box. Verified in current `codex/rebuild-feb18` source — `SNAPAgencyDirectory.swift:75-76` + `:113-114` use the correct **PO Box 944243, MS 21-37, Sacramento CA 94244-2430** in both English and Spanish. No further action required.

**All 18 rows are verified with source URLs. Policy reviewer must fill: Reviewer + Signoff Date.**

| # | Jur | Item | Verified value | Source | Effective | Renewal | Notes |
|---|---|---|---|---|---|---|---|
| 1 | MA | Apply URL | `https://dtaconnect.eohhs.mass.gov` | mass.gov/orgs/DTA | Current | Annually Oct | |
| 2 | MA | Helpline | DTA Assistance Line: 877-382-2363 (Mon–Fri 8:30am–4:30pm) | mass.gov/orgs/DTA | Current | Annually | |
| 3 | MA | BBCE income limits | HH1–8: $2,660/$3,607/$4,553/$5,500/$6,447/$7,393/$8,340/$9,287 + $947/add | mass.gov DTA BBCE PDF | 2026-02-01 | Annually Feb (HHS FPL) | DIFFERS from CA MCE. |
| 4 | MA | Standard Utility Allowances | SUA $914 · Non-heating $556 · Phone $64 | mass.gov DTA SUA PDF | 2025-10-01 | Annually Oct | |
| 5 | Federal | Max monthly allotments | HH1–8: $298/$546/$785/$994/$1,183/$1,421/$1,571/$1,789 + $218/add | FNS FY26 allotments PDF | 2025-10-01 | Annually Oct | Parity tests validate on merge. |
| 6 | Federal | Standard deductions | HH1-3: $209 · HH4: $223 · HH5: $261 · HH6+: $299 | FNS FY26 allotments PDF | 2025-10-01 | Annually Oct | |
| 7 | Federal | Excess shelter cap | $744/month | FNS FY26 allotments PDF | 2025-10-01 | Annually Oct | |
| 8 | Federal | Minimum benefit | $24/month | FNS FY26 allotments PDF | 2025-10-01 | Annually Oct | |
| 9 | Federal | Asset limits | Standard: $3,000 · Elderly/disabled: $4,500 (unchanged FY26) | fns.usda.gov/snap/eligibility/resource-tests | Unchanged | Annually | No FY26 change. |
| 10 | Federal | Gross income limits (130% FPL) | HH1–8: $1,696/$2,292/$2,888/$3,483/$4,079/$4,675/$5,271/$5,867 + $596/add | FNS COLA FY26 memo | 2025-10-01 | Annually Oct | |
| 11 | Federal | Net income limits (100% FPL) | HH1–8: $1,305/$1,763/$2,221/$2,680/$3,138/$3,596/$4,055/$4,513 + $459/add | FNS COLA FY26 memo | 2025-10-01 | Annually Oct | |
| 12 | CA | BenefitsCal apply URL | `https://www.benefitscal.com` | cdss.ca.gov/benefitscal | Current | Annually | |
| 13 | CA | CalFresh Info Line | 877-847-3663 (877-USCFOOD) | cdss.ca.gov/calfresh | Current | Annually | |
| 14 | CA | MCE income limits | HH1–8: $2,610/$3,526/$4,442/$5,360/$6,276/$7,192/$8,110/$9,026 + $918/add | CDSS ACIN I-46-25, Attachment I (Becky Silva 09/03/2025) | 2025-10-01 | Annually Oct | FFY2026 FPL basis. Do NOT reuse for MA BBCE. |
| 15 | CA | Standard Utility Allowances | SUA $663 · LUA $170 · TUA $20 | CDSS ACIN I-46-25 | 2025-10-01 | Annually Oct | §10104-compliant; ACL 25-50 'No CWD action required'. |
| 16 | CA | State Hearings address | **PO Box 944243, MS 21-37, Sacramento CA 94244-2430** | cdss.ca.gov/inforesources/state-hearings | Current | Annually | ✅ **RESOLVED (2026-05-19)**: verified at `SNAPAgencyDirectory.swift:75-76` + `:113-114`. |
| 17 | CA | CA agency name | California Department of Social Services (CDSS) / CalFresh | cdss.ca.gov/calfresh | Current | Stable | Full legal name + program name both needed. |
| 18 | CA | CA expedited SNAP threshold | $150 gross monthly income OR liquid resources ≤ $100 AND combined income + resources < rent/mortgage + utilities | CDSS ACIN I-46-25 | 2025-10-01 | Annually Oct | |

**FY26 corrections to land in `FederalDefaultRules.swift` once rows 5–11 are signed.** Worktree B parity tests validate automatically on merge.

---

## Appendix — Key files

| File | Role |
|---|---|
| [`Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift`](Civica/Features/SNAP/SNAPComplianceCopyRegistry.swift) | Banned phrases + 9 pending §6 copy revisions |
| [`docs/SNAP-source-citation-signoff.md`](docs/SNAP-source-citation-signoff.md) | 18-row policy-accuracy signoff table |
| [`docs/snap/launch-readiness.md`](docs/snap/launch-readiness.md) | Go/no-go gate; §5 = OBBBA status |
| [`docs/snap/fy-rules-refresh-checklist.md`](docs/snap/fy-rules-refresh-checklist.md) | Annual FY rules-refresh playbook (Q18) |
| [`Civica/Features/SNAP/Rules/FederalDefaultRules.swift`](Civica/Features/SNAP/Rules/FederalDefaultRules.swift) | Federal thresholds, ABAWD logic, RuleSnapshotStatus |
| [`Civica/Features/SNAP/SNAPCoveragePolicy.swift`](Civica/Features/SNAP/SNAPCoveragePolicy.swift) | State scope rule (Q7) |
| [`Civica/Features/SNAP/Application/SNAPApplicationStatusStore.swift`](Civica/Features/SNAP/Application/SNAPApplicationStatusStore.swift) | Keychain eligibility-result store (Q11) |
| [`apps/dashboard/app/packets/[packetId]/ExpeditedReviewGate.tsx`](apps/dashboard/app/packets/[packetId]/ExpeditedReviewGate.tsx) | Navigator distress gate (Q5-C) |
| [`.github/workflows/fy-rules-refresh-reminder.yml`](.github/workflows/fy-rules-refresh-reminder.yml) | Annual FY-refresh cron trigger (Q18) |
