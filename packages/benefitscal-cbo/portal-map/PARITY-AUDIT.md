# iOS-survey ↔ BenefitsCal parity audit (SNAP / CalFresh)

**Date:** 2026-05-29 · **Branch:** `claude/benefitscal-form-tree`
**Question:** Does Civica's iOS SNAP intake survey ask what the California state portal (BenefitsCal) actually asks?

**Sources:**
- **State side:** the form-tree audit (`form-tree.json`, `WALK-STEPS-2-9.md`, `DETAIL-FORMS-AND-EXPLAINERS.md`, `DOC-VERIFICATION-REFERENCE.md`) — captured directly from the live BenefitsCal CalFresh flow.
- **Civica side:** `Civica/Features/SNAP/Application/` (the `SNAPApplicationDraft` flow, 23 intake questions across 8 screens). Citations below are file-level from that directory.

---

## TL;DR

Civica's iOS intake is **not** a 1:1 mirror of the state application, **by design**. It is a privacy-minimized **eligibility-screening + deduction-capture** tool: it collects what it needs to (a) estimate eligibility/expedited-service and (b) autofill the *deduction/expense* fields, while deliberately omitting identity/PII (SSN, citizenship, per-member detail) that the human fills directly on BenefitsCal.

So most "gaps" are intentional and fine. The ones that actually matter fall into two buckets:
1. **Eligibility-screening gaps** — where Civica's QC guidance could be *wrong* because it doesn't screen a state-recognized path. (CA student exemptions, IRWE.)
2. **Autofill-coverage gaps** — where the extension *can't reduce the human's manual work* because Civica didn't collect the data. (Per-member household detail, per-job income detail — the two biggest state sections.)

---

## Parity matrix (state question → does Civica ask? → implication)

| State (BenefitsCal) | Civica iOS asks? | Implication |
|---|---|---|
| Program selection (CalFresh/CalWORKs/Medi-Cal) | ~ (state = MA-first; CA program implicit) | Extension can default #snap |
| Preferred language (read/speak/complete) | ✗ | Human sets on portal (low stakes) |
| Primary applicant name | ✗ (no name field — privacy) | **Human fills** ABNMI |
| Date of birth | ✓ (`SNAPApplicantAgeFlow`) | **Autofillable** → ABRDT |
| Residential address | ~ (derived backend / zip→county) | Partial; human may confirm |
| Mailing address | ✗ | Human fills ABMAD |
| Homelessness | ✓ (housing status = Unhoused) | **Autofillable** → ABNHA |
| Contact (email/phone) | ✓ (optional) | **Autofillable** → ABCON |
| Authorized representative | ✗ | Human fills ABCFA (usually N/A) |
| EBT payee | ✗ | Human fills ABCFS (usually N/A) |
| **Citizenship / immigration status** | ✗ **(intentional, blocked)** | **Human fills ABDOC** |
| **SSN (+ "don't have it" distinction)** | ✗ **(explicitly blocked, SNAPModels guardrail)** | **Human fills ABSSN** |
| Marital status | ✗ | Human fills ABMRS |
| **Household members (per-person: name/DOB/relationship/SSN/citizenship)** | ✗ (only aggregate size + flags) | **Human fills the entire People section** |
| Household: minors / under-14 | ✓ | Eligibility + expedite signals captured |
| Household: elderly or disabled (yes/no) | ✓ | Gates medical deduction |
| Household: migrant/seasonal farmworker | ✓ (Civica asks; expedite path) | Civica value-add |
| **Disability detail (ADL, IRWE, duration, facility)** | ✗ (only household yes/no) | **IRWE deduction not screened; human fills portal detail** |
| **Student eligibility (CA paths)** | ~ (partial — see below) | **Eligibility-screening gap** |
| Income: anyone earning / gross monthly / variability | ✓ (aggregate) | Eligibility math OK |
| **Income: per-job detail (employer name/address/amount/frequency)** | ✗ (aggregate only, not per-employer) | **Extension can't autofill ABEIC; human enters each job** |
| Income: unearned (SSA/UI/VA/child support) | ✓ (yes/no + types enumerated) | Screened; portal detail human-filled |
| Income: liquid resources | ✓ | Expedite test captured |
| Expenses: rent/housing | ✓ | **Autofillable** → ABAPH |
| Expenses: shared-housing proration | ✓ | Civica value-add (accurate SUA) |
| Expenses: utilities (per-type → SUA tier) | ✓ | **Autofillable** |
| Expenses: childcare | ✓ | **Autofillable** |
| Expenses: medical (elderly/disabled) | ✓ | **Autofillable** |
| Child support paid / spousal support | ✗ | Human fills ABCOC/ABSSQ |
| **Felony / disqualification (ABPFG)** | ✗ | **Human fills** (eligibility-critical) |
| Public assistance history / other programs | ✗ | Human fills |
| **Military / veteran status** | ✗ | Human fills (state branch exists) |
| Documents | ✓ (availability checklist + capture) | Strong parity |

`✓` collected · `✗` not collected · `~` partial/derived

---

## The gaps that matter

### 1. Eligibility-screening gaps (could make Civica's QC guidance wrong)

**1a. CA student exemptions — partial coverage.** The state's ABHGW student checklist ("Select all that apply") surfaces **five** CA-recognized paths:
- Approved for Work Study → Civica asks ✓ (`SNAPStudentStatusFlow` work-study)
- Participating in a student employment training program (LPIE/WIOA/Campus Employment/E&T) → Civica asks **only LPIE** (CCC/CSU/UC), ✗ the broader WIOA/E&T/campus-employment set
- **Getting a TANF-funded Cal Grant A or B → Civica ✗ (not asked)**
- **Taking non-credit or Adult Education courses → Civica ✗ (not asked)**
- Aren't planning to enroll next term → Civica ~ (`recently_left_school` enum exists but isn't this exemption)

Civica's **intake survey** (`SNAPStudentStatusFlow` / `SNAPModels.swift:137-139`) screens only: half-time, 20hr, work-study, LPIE (CCC/CSU/UC), dependent child. It **misses** TANF Cal Grant / CalWORKs, adult-education / non-credit, the broader employment-training set (WIOA / E&T / campus employment), and "not enrolled next term" — all of which the state's ABHGW checklist explicitly lists. A half-time student on a TANF Cal Grant is state-exempt but Civica would screen them as *not* exempt → **false "you may not qualify" guidance.** Highest-value gap.

**Sharper still — it's an internal inconsistency, not just a state gap:** Civica's own **InterviewCoach** already documents the missing paths. `Civica/Features/SNAP/InterviewCoach/InterviewQuestions_CA.json:45` guidance reads: *"…unless they meet an exemption: working 20+ hours per week, caring for a dependent under 12, in an EOPS/CARE/CalWORKs program, in a Local Program That Increases Employability (LPTIE)… or receiving certain disability benefits."* So Civica *knows* about EOPS/CARE/CalWORKs but its **intake survey never asks**. Closing this is partly porting content Civica already wrote into the survey — low effort, high accuracy gain.

**1b. IRWE (Impairment-Related Work Expenses) not screened.** The state asks working disabled applicants about medical expenses needed to keep working (wheelchair, leg braces). Civica captures only household-level `monthlyMedical` for elderly/disabled, gated on the yes/no flag — it doesn't isolate IRWE, which is a distinct deduction. Minor, but it can under-count deductions for working disabled applicants.

### 2. Autofill-coverage gaps (extension can't cut the human's manual work)

The extension autofills BenefitsCal from Civica data. Two of the **largest** state sections get **zero** autofill because Civica collects only aggregates:
- **People (per-member):** Civica has household *size + flags*, not per-person name/DOB/relationship/SSN/citizenship. The assister hand-enters every household member on the portal. (Partly intentional — PII — but name/DOB/relationship are not sensitive and could be collected to cut this work.)
- **Income (per-job):** Civica has *gross monthly aggregate*, not per-employer rows. The assister hand-enters each job (ABEIC: employer name/address/amount/frequency). Civica's paystub capture already extracts some of this on-device — wiring it to per-job rows would close the gap.

### 3. Intentional omissions (by design — leave them)

SSN, citizenship/immigration, per-member PII, marital status, felony, auth-rep — Civica deliberately doesn't collect these (privacy guardrail, `SNAPModels` blocks SSN/immigration). The human-in-loop model expects the assister to fill these directly on BenefitsCal. **Correct as-is** — closing them would break the privacy posture for marginal autofill gain. The extension should *flag* these as "human must fill" rather than try to autofill.

### 4. Civica's value-add (asks what the state doesn't surface as a question)

Civica screens several expedited-service / accuracy signals the state form doesn't ask as discrete questions: **migrant/seasonal farmworker**, **recent job loss (30d)**, **income variability**, **utility shutoff notice**, **shared-housing proration**. These power the QC/eligibility product and are a genuine differentiator, not a gap.

---

## Recommendations (priority order)

1. **Close 1a (CA student exemptions).** Add Cal-Grant and adult-education paths to `SNAPStudentStatusFlow`, and broaden the training-program question beyond LPIE to the state's WIOA/E&T/campus-employment set. Highest eligibility-accuracy value; small UI change. *(test: `test(qa):` student-exemption parity regression.)*
2. **Wire paystub extraction → per-job income rows** to close the Income autofill gap (the on-device extraction already exists; it's a plumbing connect).
3. **Consider collecting non-sensitive per-member basics** (name/DOB/relationship — NOT SSN/citizenship) to cut the People-section manual work, *if* it survives a privacy review.
4. **Leave the intentional omissions**; have the extension surface them as "human must fill on portal: SSN, citizenship, felony, auth-rep" in its UI so the assister knows what's left.
5. **Add IRWE** as an optional working-disabled follow-up (low priority).

---

## Honest caveat

State-side coverage is ~80% (the form-tree is at ~75–80%; ABHSD/ABPFG and a few demographics popovers uncaptured, Step 8 gated). None of those uncaptured items change the conclusions above — they're explainer text and the review page, not new question categories. This audit is solid on the question-category parity; revisit if the remaining captures surface a new category.
