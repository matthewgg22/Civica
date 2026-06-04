# BenefitsCal Steps 3–9 — DRAFT Field Inventory (public-source scaffold)

**Status: DRAFT — public sources only. NOT a live portal capture.**
**Author:** agent scaffold for T7a (the human BenefitsCal walk).
**Date:** 2026-06-04.
**Purpose:** Pre-stage the question/field inventory for BenefitsCal steps 3–9 from PUBLIC California CalFresh application sources, so the human walker (V1-4 runbook, `docs/runbooks/benefitscal-v1-4-walk-2026-06.md`) has a checklist of what to expect and what to capture, and so T7b has a head-start on `PortalPage` conversion.

## How to read this document (read before trusting any line)

- The authenticated BenefitsCal `/ApplyForBenefits/*` flow for steps 3–9 is **behind login and WAF-blocked to automation.** Nothing here was captured from the live portal. Every record is **inferred from the paper SAWS 2 PLUS application and CDSS/LSNC program docs**, which the online flow mirrors but does NOT reproduce verbatim.
- **No real selectors, element ids, `fallbackSelector` values, option ids, or `urlPattern` regexes appear here.** Those require the human walk. They are all `TODO: capture in live walk`.
- **pageCodes are MINTED** in the existing `AB____` 5-letter convention as placeholders. The real codes come from the walk URL. Every minted code is flagged `(minted — confirm against portal)`.
- For each field, `source=` cites a real dot-path in `BenefitsCalPayload` (`src/core/schemas.ts`) **only** where one exists. Where no schema field exists, it says `NO SCHEMA FIELD — gap` and is collected in the Schema-gaps section at the end.
- Options are marked **(documented in <source>)** when transcribed from a cited public form, or **(unverified — confirm in walk)** when inferred.
- This covers the **multi-program superset path** (the runbook's P1 instruction: walk SNAP + Medi-Cal + TANF so the captured sequence is the full set). The SNAP-only flow is a subset: **Step 6 Assets is OMITTED for SNAP-only** (CA BBCE bypass, already encoded in `selector-map.ts` and `form-tree.json`).

## Source-to-step mapping (which paper section maps to which online step)

The online BenefitsCal steps are sectioned differently from the paper form, but the *questions* map closely. The paper SAWS 2 PLUS (CF: use CF 285 for CalFresh-only; SAWS 2 PLUS for the joint app) groups them as:

| BenefitsCal online step | Paper SAWS 2 PLUS section(s) | Already mapped? |
|---|---|---|
| 1 Your Information | Q1 Applicant Info, Q3 Race/Ethnicity, Q4 Interview, Q6 (demographics) | YES (form-tree.json §1, selector-map step 1) |
| 2 People | Q6 Household Adults/Children, Q6a contact | YES (form-tree.json §2, selector-map step 2 — partial) |
| **3 Household Details** | Q5 Other Programs, Q6d Military, Q6g–6k relationships/caretaker/disability, Q6q–6r residency | **THIS DOC** |
| **4 Income** | Q7 Unearned, Q8 Earned, Q8a Self-Employment, Q9 Other Income (in-kind), Q10 Yearly Income | **THIS DOC** |
| **5 Expenses** | Q11 Child/Adult Care, Q12 Child Support Paid, Q13 Spousal Support, Q14 Special Needs, Q15 Household (shelter/utility) | **THIS DOC** |
| **6 Assets** | (resources / bank accounts — NOT on the CalFresh-symbol questions; appears only multi-program) | **THIS DOC — SNAP-only skips** |
| **7 Other Situations** | Q6l Students, Q6m Pregnancy/Teen Parent, Q6n Cal-Learn, Q6o–6p Foster Care, the page-1 emergency/expedite block | **THIS DOC** |
| **8 Document Upload** | (paper = "what to bring to interview"; online = file upload UI) | **THIS DOC** |
| **9 Review & Submit** | page-1 signature/penalty-of-perjury attestation | **THIS DOC** |

---

# Step 3 — Household Details   [status: draft-public]

Composition / relationship / residency / disability / military questions that the paper form carries in Q5, Q6d, Q6g–6k, Q6q–6r. Online, several of these are asked **per household member** (repeating), mirroring the step-2 People sub-flow. Whether BenefitsCal places them under "Household Details" vs. folds some into "People" is **unverified** — the walker should note which step each actually appears in and re-home the record if needed.

### ABHDI — Household Details intro (likely info-only)   [status: draft-public]
- repeating: false
- urlPattern: TODO: capture in live walk
- Fields: (none expected — info/intro page like ABCID/ABBID in step 1)
- advanceButton: Next (assumed; confirm)
- Notes / source citations: Inferred from the step-1 intro-page pattern (ABCID, ABBID). May not exist. SAWS 2 PLUS has no explicit "household details intro."

### ABOPG — Prior / other public assistance (SAWS 2 PLUS Q5)   [status: draft-public]
- repeating: false (the Yes branch repeats over people/programs — pattern unverified)
- urlPattern: TODO: capture in live walk
- Fields:
  - ever_received_assistance | "Has anyone in your household ever received public assistance (TANF, Tribal TANF, Medicaid, SNAP/food stamps, GA/GR, etc.)?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q5) | selector=TODO
  - who_received | "If yes, who?" | type=text | source=NO SCHEMA FIELD — gap | options=n/a (free text) | selector=TODO
  - where_received | "Where (county/state)?" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q5 "OTHER PROGRAMS" (CDSS SAWS2_PLUS.pdf p.2). Online may render the who/where as a repeating row set — unverified.

### ABMIL — Military service (SAWS 2 PLUS Q6d)   [status: draft-public]
- repeating: true? (paper has a 2-row table keyed per person — unverified whether online repeats per member)
- urlPattern: TODO: capture in live walk
- Fields:
  - anyone_military | "Has anyone been in the U.S. Military service or are they the spouse, parent, or child of a person who was?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q6d) | selector=TODO
  - military_member_name | "Name" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - military_us_citizen | "U.S. Citizen?" | type=radio | source=NO SCHEMA FIELD — gap (per-member citizenship not modeled) | options=Yes/No (documented) | selector=TODO
  - military_status | "Status" | type=checkbox/radio | source=NO SCHEMA FIELD — gap | options=Active duty / Veteran / Spouse, parent, or child of person in active duty or a veteran (documented in SAWS 2 PLUS Q6d) | selector=TODO
  - honorable_discharge | "Honorable Discharge?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - dates_of_service | "Dates of Service" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q6d (CDSS p.5). Likely human-filled regardless (no Civica intake field).

### ABHDR — Household relationships & caretaking (SAWS 2 PLUS Q6g, 6h, 6k)   [status: draft-public]
- repeating: false (sub-questions may each be their own page — unverified)
- urlPattern: TODO: capture in live walk
- Fields:
  - child_under_21_parent_absent | "Does anyone under age 21 have a parent who does not live in the home?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q6g) | selector=TODO
  - absent_parent_detail | "If yes, name the child(ren) and the parent(s) not in the home" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - cares_for_child_under_19 | "Does anyone live with at least one child under 19 and is the main person taking care of the child?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q6h) | selector=TODO
  - child_or_disabled_needs_care | "Is there a child or disabled person in the household who needs care from another household member?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q6k) | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q6g/6h/6k (CDSS p.6). Note: NB the existing step-2 ABHHR already captures per-member *relationship* (`household_members[].relationship`); these Q6g/6h questions are ADDITIONAL household-structure questions, not the same field.

### ABDST — Disability detail (SAWS 2 PLUS Q6i, 6j)   [status: draft-public]
- repeating: true? (Q6j repeats per disabled person — unverified online)
- urlPattern: TODO: capture in live walk
- Fields:
  - anyone_disabled | "Does anyone have a physical, mental, emotional, or developmental disability that causes limitations in activities (bathing, dressing, daily chores)?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q6i) | selector=TODO
  - disabled_person_name | "Name of person" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - needs_daily_living_help | "Does this person need help with activities of daily living through personal assistance or a medical facility?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q6j) | selector=TODO
  - disability_duration | "Disability is expected to last:" | type=radio | source=NO SCHEMA FIELD — gap | options=30 days or more / 12 months or more (documented in SAWS 2 PLUS Q6j) | selector=TODO
  - works_with_medical_expenses | "Does this person work and have medical expenses needed to keep working (wheelchair, leg braces, etc.)?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - in_medical_facility | "Is this person in a medical facility or nursing home?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q6i/6j (CDSS p.6). Disability status is eligibility-relevant for SNAP (uncapped medical/shelter deductions for elderly/disabled) — walker should flag for needs-review treatment. NB step-1 already has ABDSM/ABDSC ("disability detail (TBD)") discovered but unmapped — confirm whether THIS is the same flow re-encountered or a distinct household-level one.

### ABRES — Residency / out-of-state plans (SAWS 2 PLUS Q6q, 6r)   [status: draft-public]
- repeating: false
- urlPattern: TODO: capture in live walk
- Fields:
  - lives_in_ca | "Does everyone listed live in California and expect to keep living here?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q6q) | selector=TODO
  - leaving_ca_30_days | "Does anyone plan to leave California for more than 30 days?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q6r) | selector=TODO
  - leaving_detail | "Name / when do they plan to leave / plan to return / when" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q6q/6r (CDSS p.8). `address.state` exists in schema but is the residential state, not a "plan to leave" answer — no source for these.

---

# Step 4 — Income   [status: draft-public]

This is the HIGH-PRIORITY data-bearing section. Schema source: `income_sources[]` — an array of `{income_type, income_amount, income_frequency}` (frequency enum: `monthly|weekly|biweekly|annual|irregular`). The paper form splits income into FOUR sub-sections, each its own repeating table; the online flow likely renders an "add income source" repeat per the runbook's Income note. **Critical schema limitation:** `IncomeSource` has ONLY type/amount/frequency — it carries NO per-employer name, no per-person attribution, no self-employment-expense breakdown, no "expect to continue" flag. Everything beyond type/amount/frequency on these pages is a schema gap.

### ABINI — Income intro / gate (likely info or first-question)   [status: draft-public]
- repeating: false
- urlPattern: TODO: capture in live walk
- Fields:
  - has_unearned_income | "Does anyone get income that does not come from work (unearned)?" | type=radio | source=NO SCHEMA FIELD — gap (gate, derived from whether income_sources[] has unearned rows) | options=Yes/No (documented in SAWS 2 PLUS Q7) | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q7 gate (CDSS p.8). Online flow may use one combined income gate rather than per-subtype gates — unverified.

### ABUEI — Unearned income (SAWS 2 PLUS Q7) — REPEATING   [status: draft-public]
- repeating: true — repeats over income_sources[] entries of unearned type
- urlPattern: TODO: capture in live walk
- Fields (per row):
  - income_type | "Type of unearned income" | type=checkbox/select | source=income_sources[].income_type | options=(documented in SAWS 2 PLUS Q7) Social Security Disability; SSI/SSP; Cash aid; CalWORKs/TANF/GA/GR/CAPI/RCA; Room and board (from a renter); Pension; Child/Spousal support; Rental/Royalties; Social Security retirement or survivors benefits; Per capita payments; Work study/welfare to work or other program; Sales of notes, contracts, trust deeds, promissory notes; Veterans education benefits/income; Government/railroad disability or retirement; Veteran benefits or Military pension; Financial aid (school grants/loans/scholarships); Gifts of money or other loans; Unemployment Insurance; State Disability Insurance (SDI); Worker's Compensation; Net Farming/Fishing; Lottery/gambling winnings; Help with rent/food/clothing; Insurance or legal settlements; Private disability or retirement; Dividend and interest income; Strike benefits; Other ____ | selector=TODO
  - person_getting | "Person Getting the Money?" | type=text | source=NO SCHEMA FIELD — gap (income_sources has no per-person attribution) | options=n/a | selector=TODO
  - from_where | "From Where?" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - income_amount | "How Much?" | type=text | source=income_sources[].income_amount | options=n/a (currency) | selector=TODO
  - income_frequency | "How Often Received? (once, weekly, monthly, or other)" | type=select/radio | source=income_sources[].income_frequency | options=(documented "once/weekly/monthly/other"; schema enum is monthly/weekly/biweekly/annual/irregular — needs a transform; "once"→irregular, "monthly"→monthly, etc. — MAPPING UNVERIFIED) | selector=TODO
  - expect_to_continue | "Expect to Continue?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
- advanceButton: Next (assumed; confirm) + an "add another income source" control (selector=TODO)
- Notes / source citations: SAWS 2 PLUS Q7 (CDSS p.8 — full checkbox list transcribed above verbatim). The income_type→portal-option mapping and the frequency-enum→portal-option mapping BOTH require the walk to confirm exact option ids and label strings.

### ABEAI — Earned income (SAWS 2 PLUS Q8) — REPEATING   [status: draft-public]
- repeating: true — repeats over income_sources[] entries of earned type (wages/salary/tips/commissions/work study)
- urlPattern: TODO: capture in live walk
- Fields (per row):
  - has_earned_income | "Does anyone get income from a job (earned income)?" | type=radio | source=NO SCHEMA FIELD — gap (gate) | options=Yes/No (documented in SAWS 2 PLUS Q8) | selector=TODO
  - person_working | "Person Working" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - employer_name_address | "Employer's Name and Address" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - employer_phone | "Employer's Phone Number" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - hourly_rate | "Hourly Rate" | type=text | source=NO SCHEMA FIELD — gap (schema has amount, not rate) | options=n/a | selector=TODO
  - avg_hours_per_week | "Average hours per week" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - how_often_paid | "How Often Paid? (once, weekly, monthly, other)" | type=select | source=income_sources[].income_frequency | options=(see frequency mapping note in ABUEI) | selector=TODO
  - gross_income_this_month | "Total Gross Earned Income Received This Month" | type=text | source=income_sources[].income_amount | options=n/a | selector=TODO
  - expect_to_continue | "Expect to Continue?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
- advanceButton: Next (assumed; confirm) + "add another job" control (selector=TODO)
- Notes / source citations: SAWS 2 PLUS Q8 (CDSS p.9). Income type for these rows is implicitly "wages/earned" — examples documented: Wages, Commissions, Tips, Salaries, Work study (students). The schema's `income_type` is a free string, so a value like "wages" can fill it; the portal almost certainly does NOT have an income_type picker on the earned page (it's contextually earned) — confirm in walk.

### ABJOB — Recent job change (SAWS 2 PLUS Q8, sub-block)   [status: draft-public]
- repeating: false
- urlPattern: TODO: capture in live walk
- Fields:
  - lost_changed_job_60_days | "Has anyone lost a job, changed jobs, quit a job, or reduced work hours within the last 60 days?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q8) | selector=TODO
  - anyone_on_strike | "Is anyone on strike?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - job_change_detail | "Who / date of job loss/change / date of last pay / reason" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q8 job-change sub-block (CDSS p.9). Eligibility-relevant (voluntary quit / strike rules). Likely human-filled.

### ABSEI — Self-employment income (SAWS 2 PLUS Q8a) — REPEATING   [status: draft-public]
- repeating: true — repeats over self-employment income sources
- urlPattern: TODO: capture in live walk
- Fields (per row):
  - person_self_employed | "Person Self-Employed" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - business_name | "Business Name" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - business_type | "Type of Business" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - date_business_started | "Date Business Started" | type=date | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - gross_monthly_income | "Gross Monthly Income" | type=text | source=income_sources[].income_amount (partial — but self-employment has gross vs net; schema can't represent the deduction) | options=n/a | selector=TODO
  - self_employment_expense_method | "Self-Employment Expenses (check one)" | type=radio | source=NO SCHEMA FIELD — gap | options=40% flat Rate (CalFresh/cash aid) / Actual Expenses $___ / Monthly Average $___ (documented in SAWS 2 PLUS Q8a) | selector=TODO
  - net_monthly_income | "Net Monthly Income" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
- advanceButton: Next (assumed; confirm) + "add another business" control (selector=TODO)
- Notes / source citations: SAWS 2 PLUS Q8a (CDSS p.9). income_type for these would be "self_employment" (free string fills `income_type`), but the gross/net/expense-method structure has no schema home — major gap if Civica wants to auto-fill self-employment.

### ABOII — Other (in-kind) income (SAWS 2 PLUS Q9)   [status: draft-public]
- repeating: false (4 fixed item rows)
- urlPattern: TODO: capture in live walk
- Fields:
  - has_inkind_income | "Does anyone get housing or rent, utilities, food or clothing free or in exchange for work?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q9) | selector=TODO
  - item_received | "Item Received" | type=checkbox rows | source=NO SCHEMA FIELD — gap | options=Housing or Rent / Utilities / Food / Clothing (documented) each with Free / For Work flags + Value + Who gets / Who gives | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q9 (CDSS p.10). In-kind income — not in `income_sources[]` semantics. Human-filled.

### ABYRI — Yearly / fluctuating income (SAWS 2 PLUS Q10)   [status: draft-public]
- repeating: false
- urlPattern: TODO: capture in live walk
- Fields:
  - income_fluctuates | "Does anyone's total income (unearned, earned, self-employment) change from month to month?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q10) | selector=TODO
  - total_income_this_year | "What will be their total income this year?" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - total_income_next_year | "What will be their total income next year (if different)?" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q10 (CDSS p.10). Relates loosely to schema `income_frequency: irregular` but no amount fields — human-filled.

---

# Step 5 — Expenses   [status: draft-public]

The ONLY expense data in `BenefitsCalPayload` is `utility_allowance_type` (enum: `standard | limited | telephone_only | none`). **Every other expense field below is a schema gap** — no rent/mortgage amount, no dependent-care, no medical-expense, no child-support-paid field exists. The paper form splits expenses across Q11–Q15. Online ordering unverified.

### ABDCC — Dependent (child/adult) care expenses (SAWS 2 PLUS Q11) — REPEATING   [status: draft-public]
- repeating: true — paper has a 4-row table (repeats per care arrangement)
- urlPattern: TODO: capture in live walk
- Fields (per row):
  - has_dependent_care | "Does anyone pay for care of a child, disabled adult, or other dependent so you or the other person can go to work, school, or look for a job?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q11) | selector=TODO
  - who_gets_care | "Who gets care?" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - who_gives_care | "Who gives care? (name and address of provider)" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - amount_paid | "Amount paid?" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - how_often_paid | "How Often Paid? (weekly/monthly/other)" | type=select | source=NO SCHEMA FIELD — gap | options=weekly/monthly/other (documented) | selector=TODO
  - help_paying_care | "Does anyone help your household pay all or part of your child/adult care costs?" | type=radio + detail rows | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
- advanceButton: Next (assumed; confirm) + "add another" control (selector=TODO)
- Notes / source citations: SAWS 2 PLUS Q11 (CDSS p.10). Dependent-care is an uncapped CalFresh deduction — eligibility-impactful, fully unsourced. SCHEMA GAP.

### ABCSP — Child support paid (SAWS 2 PLUS Q12) — REPEATING   [status: draft-public]
- repeating: true — paper has a 2-row table
- urlPattern: TODO: capture in live walk
- Fields (per row):
  - pays_child_support | "Is anyone listed in question 6 legally obligated to pay child support, including back child support?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q12) | selector=TODO
  - who_pays | "Who pays child support?" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - child_name | "Name of child(ren) for whom child support is paid" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - amount_paid | "Amount paid?" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - how_often | "How Often? (weekly/monthly/other)" | type=select | source=NO SCHEMA FIELD — gap | options=weekly/monthly/other (documented) | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q12 (CDSS p.10). Child-support-paid is a CalFresh income deduction (CA exercised the federal option) — eligibility-impactful, unsourced. SCHEMA GAP.

### ABSSA — Spousal support / alimony paid (SAWS 2 PLUS Q13)   [status: draft-public]
- repeating: true — paper has a 2-row table
- urlPattern: TODO: capture in live walk
- Fields (per row):
  - pays_spousal_support | "Is anyone listed in question 6 legally obligated to pay spousal support/alimony?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q13) | selector=TODO
  - who_pays | "Who pays spousal support/alimony?" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - amount_paid | "Amount paid?" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - how_often | "How often? (weekly/bi-weekly/monthly/other)" | type=select | source=NO SCHEMA FIELD — gap | options=weekly/bi-weekly/monthly/other (documented) | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q13 (CDSS p.11). SCHEMA GAP.

### ABSNE — Special-needs expenses (SAWS 2 PLUS Q14)   [status: draft-public]
- repeating: false
- urlPattern: TODO: capture in live walk
- Fields:
  - special_diet | "Special diet prescribed by a doctor?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q14) | selector=TODO
  - special_phone_equipment | "Special phone or other equipment?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - housework_help | "Housework (no one in the home can do it)?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - very_high_utilities | "Very high use of utilities?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - special_laundry | "Special laundry service?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - other_special_need | "Other special need? (specify)" | type=radio+text | source=NO SCHEMA FIELD — gap | options=Yes/No + free text (documented) | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q14 (CDSS p.11). These feed the special medical/shelter deduction worksheet for elderly/disabled. SCHEMA GAP. Likely human-filled.

### ABHEX — Household shelter & utility expenses (SAWS 2 PLUS Q15) — partly sourced   [status: draft-public]
- repeating: false (fixed expense-type rows)
- urlPattern: TODO: capture in live walk
- Fields:
  - has_household_expenses | "Does anyone you purchase and prepare food with get billed for any household expenses?" | type=radio | source=NO SCHEMA FIELD — gap (gate) | options=Yes/No (documented in SAWS 2 PLUS Q15) | selector=TODO
  - rent_or_house_payment | "Rent or house payment" (Have Expense? / Who Pays? / Amount Owed / How Often Billed) | type=radio + text | source=NO SCHEMA FIELD — gap (no rent/shelter amount in schema) | options=Yes/No + currency + weekly/monthly (documented) | selector=TODO
  - property_taxes_insurance | "Property taxes and insurance (if billed separate from rent or mortgage)" | type=radio + text | source=NO SCHEMA FIELD — gap | options=Yes/No + currency (documented) | selector=TODO
  - heating_cooling_utility | "Gas, electric, or other fuel used for heating or cooling, such as firewood or propane (if separate from rent or mortgage)" | type=radio | source=utility_allowance_type (INDIRECT — presence of a heating/cooling utility drives SUA-vs-LUA; mapping UNVERIFIED) | options=Yes/No (documented). NB the SUA is a set allowance, not the actual amount — paper says "do not fill the actual amount owed" for heating/cooling, telephone, other utilities, homeless shelter | selector=TODO
  - telephone_cell | "Telephone/cell phone" | type=radio | source=utility_allowance_type (INDIRECT — drives telephone_only when no SUA/LUA; UNVERIFIED) | options=Yes/No (documented) | selector=TODO
  - homeless_shelter_expense | "Homeless Shelter Expense" | type=radio | source=NO SCHEMA FIELD — gap (related to is_homeless on ABNHA but distinct) | options=Yes/No (documented) | selector=TODO
  - water_sewage_garbage | "Water, sewage, garbage" | type=radio | source=utility_allowance_type (INDIRECT; UNVERIFIED) | options=Yes/No (documented) | selector=TODO
  - help_paying_expenses | "Does anyone not in your household help you pay for the expenses listed above?" | type=radio + detail | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - liheap | "Does your household get, or expect to get, any payments from LIHEAP?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q15 (CDSS p.11). **IMPORTANT for the utility_allowance_type mapping:** BenefitsCal almost certainly does NOT present a single "standard/limited/telephone_only/none" picker; instead it derives the allowance from these individual utility-type Yes/No answers (heating-cooling ⇒ SUA $663; ≥2 non-heat utilities ⇒ LUA $158; telephone-only ⇒ TUA $19; none ⇒ none — per LSNC CalFresh guide). So `utility_allowance_type` may NOT map to a single portal field. The walk MUST determine how the portal collects utilities and how (or whether) the schema enum can be filled. Flag as a **mapping uncertainty**, not a clean source.

---

# Step 6 — Assets / Resources   [status: draft-public — SNAP-only SKIPS this entire step]

**SNAP-only applications OMIT this step (CA BBCE bypass)** — already encoded in `selector-map.ts` (`shouldSkipPageForFlow`, PR #477) and `form-tree.json` meta. The runbook P1 instruction is to walk the MULTI-PROGRAM superset so this section is captured anyway (it appears when Cash Aid or Medi-Cal is also selected on ABPRI). For Civica's CalFresh-only v1, these pages will never be reached, so there is no fill obligation — but the walker should capture structure for completeness and so the SNAP-only skip can be verified against the real sequence.

### ABAST — Assets / resources (multi-program only)   [status: draft-public]
- repeating: true? (per account/vehicle — unverified)
- urlPattern: TODO: capture in live walk
- Fields:
  - has_resources | "Do you have cash, checking, savings, or other resources?" (paraphrased — exact online wording UNVERIFIED) | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (unverified — confirm in walk) | selector=TODO
  - resource_type | resource type picker | type=select | source=NO SCHEMA FIELD — gap | options=(unverified — confirm in walk; paper SAWS 2 PLUS proper has no single asset checkbox list on the CalFresh-symbol questions; vehicles appear in the "proof needed for cash aid" notes) | selector=TODO
  - resource_amount | amount/value | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: The SAWS 2 PLUS body (4/15) does NOT contain a dedicated asset/resource statement-of-facts section on the CalFresh path — resources appear only as page-1 expedite questions ("cash on hand or in checking/savings not more than $100") and as cash-aid proof items. Asset detail likely lives in a separate CalWORKs property statement (e.g., the CW/QR property forms), NOT verified here. **This entire section is the LEAST documented — treat as fully unverified; capture from scratch in the walk.** Civica CalFresh-only never reaches it.

---

# Step 7 — Other Situations   [status: draft-public]

Special-circumstance questions: students, pregnancy/teen parent, Cal-Learn, foster care, and the page-1 emergency/expedite block. Several are eligibility-relevant for SNAP (student ABAWD rules, expedited service). Online placement under "Other Situations" vs. folded into earlier steps is UNVERIFIED.

### ABSTU — Student status (SAWS 2 PLUS Q6l)   [status: draft-public]
- repeating: true? (per student — paper has a 2-row table)
- urlPattern: TODO: capture in live walk
- Fields (per row):
  - anyone_in_college | "Is anyone applying for benefits attending a college or vocational school?" | type=radio | source=is_college_student (PARTIAL — schema is a single applicant boolean; this is per-person) | options=Yes/No (documented in SAWS 2 PLUS Q6l) | selector=TODO
  - school_name | "Name of School/Training" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - enrolled_status | "Enrolled Status (check one)" | type=radio | source=NO SCHEMA FIELD — gap | options=Half-time or more / Less than half-time (documented) | selector=TODO
  - number_of_units | "Number of Units" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - avg_work_hours | "Average work hours per week" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q6l (CDSS p.7). NB step-1 ABCOS already asks the applicant "Are you a college student?" (source=is_college_student). This Q6l is the DETAIL follow-up (school/units/hours drive the SNAP student-exemption test — see issue #373 student-exemption work). The per-person nature exceeds the single-boolean schema. SCHEMA GAP for the detail fields.

### ABPRG — Pregnancy / teen parent (SAWS 2 PLUS Q6m)   [status: draft-public]
- repeating: true? (per person — paper has a 2-row table)
- urlPattern: TODO: capture in live walk
- Fields (per row):
  - pregnant_or_teen_parent | "Is anyone listed in question 6 or 6b pregnant or a teen parent?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q6m) | selector=TODO
  - under_20 | "Is this person under the age of 20?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - teen_parent | "Is this person a teen parent?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - school_status_under_20 | "School status if under the age of 20" | type=checkbox | source=NO SCHEMA FIELD — gap | options=Has a high school diploma / Has a GED / Is attending school regularly / Is not attending school regularly (explain why) (documented) | selector=TODO
  - due_date | "Due date (if known)" | type=date | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
  - babies_expected | "How many babies are expected with this pregnancy?" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q6m (CDSS p.7). Also the page-1 "Is anyone pregnant? Yes/No" gate (SAWS 2 PLUS p.1). SCHEMA GAP.

### ABCLR — Cal-Learn program (SAWS 2 PLUS Q6n)   [status: draft-public]
- repeating: false
- urlPattern: TODO: capture in live walk
- Fields:
  - cal_learn | "Has anyone ever gotten a cash bonus or penalty, or help with child care, transportation or other service from the Cal-Learn Program?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q6n) | selector=TODO
  - cal_learn_detail | "Name / Where (county) / Date(s) Received" | type=text | source=NO SCHEMA FIELD — gap | options=n/a | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q6n (CDSS p.7). CalWORKs-flavored (dollar-sign symbol); may not appear on a CalFresh-only flow. SCHEMA GAP.

### ABFOS — Foster care (SAWS 2 PLUS Q6o, 6p)   [status: draft-public]
- repeating: true? (per person)
- urlPattern: TODO: capture in live walk
- Fields:
  - anyone_in_foster_care | "Was anyone listed in question 6 ever in foster care?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q6o) | selector=TODO
  - foster_detail | "Name / When / State / Is this person 26 or younger and were they in foster care on their 18th birthday?" | type=text+radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - foster_child_in_home | "Is there a foster child currently living in your home who is receiving foster care services?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented in SAWS 2 PLUS Q6p) | selector=TODO
  - count_foster_income | "Do you want the foster care child(ren) counted in your CalFresh case?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS Q6o/6p (CDSS p.7–8). SCHEMA GAP.

### ABEMR — Emergency / expedited service (SAWS 2 PLUS page 1 block)   [status: draft-public]
- repeating: false
- urlPattern: TODO: capture in live walk
- Fields:
  - gross_income_under_150_cash_under_100 | "Is your household's gross income less than $150 and cash/checking/savings $100 or less?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented SAWS 2 PLUS p.1) | selector=TODO
  - housing_exceeds_income | "Is your household's combined gross income and liquid resources less than the combined rent/mortgage and utilities?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - migrant_farmworker | "Is your household a migrant/seasonal farm worker household with liquid resources not exceeding $100?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - utilities_shutoff | "Have your utilities been shut off or do you have a shut-off notice?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
  - food_runs_out_3_days | "Will your food run out in 3 days or less?" | type=radio | source=NO SCHEMA FIELD — gap | options=Yes/No (documented) | selector=TODO
- advanceButton: Next (assumed; confirm)
- Notes / source citations: SAWS 2 PLUS p.1 expedite block (CDSS p.1). These drive 3-day expedited CalFresh — eligibility-critical, all unsourced. NB partial overlap with `is_homeless` (ABNHA) already in schema. The online flow may place these early (alongside homelessness) rather than in "Other Situations" — walker confirm. SCHEMA GAP.

---

# Step 8 — Document Upload   [status: draft-public]

File-input UI. **The extension SKIPS all file inputs by design** (the `fillElement` file guard, per the runbook). Civica does NOT auto-upload — documents are handled out-of-band via `document_urls[]` (Supabase Storage URLs, Phase 2 Playwright per schema comment), not pushed through this portal page. So there is no fill obligation here; capture structure + the "what to upload" list only.

### ABDOU — Document upload (online)   [status: draft-public]
- repeating: true? (per document)
- urlPattern: TODO: capture in live walk
- Fields:
  - document_file_input | "Upload a document" file picker(s) | type=file | source=NO FILL — SKIPPED by extension file guard (document_urls[] is the schema home but is not pushed through this page) | options=n/a | selector=TODO
  - document_type_picker | "Type of document" | type=select | source=document_urls[].type (POSSIBLE — only if the portal asks the user to label each upload; UNVERIFIED) | options=(unverified — confirm in walk; the SAWS 2 PLUS "what to bring" list is the public proxy, see below) | selector=TODO
- advanceButton: Next / Skip / "Upload later" (UNVERIFIED — confirm which advance controls exist)
- Notes / source citations: The paper proxy for "what to upload" is the SAWS 2 PLUS "What do I need for my interview?" list (CDSS p.2 coversheet): Identification (Driver's License, State ID, passport); Proof of where you live (rental agreement, current bill with address); Social Security numbers; Money in the bank (recent bank statements); Earned income (recent pay stubs / employer statement; if self-employed, income & expenses or tax records); Unearned income (UI, SSI, Social Security, child support, worker's comp, school grants/loans, rental income); Lawful immigration status (Alien Registration Card, visa) for legal noncitizens; Housing costs (rent receipts, mortgage bills, property tax, insurance); Phone and utility costs; Medical expenses for elderly/disabled; Child/adult care costs; Child support paid. **The online doc-type picker option list is UNVERIFIED — capture verbatim in the walk.**

---

# Step 9 — Review & Submit   [status: draft-public]

Summary of all entered answers + final submit. **Walk safety (runbook): capture the submit button selector + page structure, then CLOSE THE TAB. Do NOT submit** (it files a real application). Post-submit success-screen selectors are UNVERIFIED in `selector-map.ts` (`CONFIRMATION_PAGE.verified = false`) — this walk is what confirms them.

### ABREV — Review & Submit   [status: draft-public]
- repeating: false
- urlPattern: TODO: capture in live walk (side-nav labels it "Review & Submit" with "&"; ABNAV summary aria-label uses "Review and Submit" with "and" — both already noted in form-tree.json)
- Fields:
  - signature_attestation | penalty-of-perjury attestation / e-signature (SAWS 2 PLUS p.1 signature block) | type=checkbox/text/signature | source=client_signature_type (INDIRECT — schema has `client_signature_type: in_person|telephonic|async_portal`; how that maps to the portal's signature control is UNVERIFIED) | options=(unverified) | selector=TODO
  - submit_button | "Submit" final control | type=button | source=NO FILL — NEVER auto-clicked (human-in-loop submits) | options=n/a | selector=TODO (CAPTURE without clicking) | accessible-name=TODO
- advanceButton: Submit (terminal — DO NOT CLICK during walk)
- Notes / source citations: SAWS 2 PLUS signature/penalty block (CDSS p.1). Capturing this URL unblocks V1-6a auto-trigger detection (#316). Confirmation/case-number selectors (`benefitscal_confirmation_number` in `SubmissionResult`) must be captured from the post-submit screen on the DELIBERATE end-to-end demo run (T13a), NOT this abort-before-submit walk.

---

# Schema gaps (fields with NO `BenefitsCalPayload` source path)

These would need additions to `src/core/schemas.ts` before the extension could auto-fill them. **Do NOT edit the schema directly — file a GitHub issue first** (per CLAUDE.md engine/schema policy; schema edits go through `/packages` review). Grouped by step:

**Step 3 (Household Details) — all gaps:**
- Prior public assistance (ever-received + who + where)
- Military service (member name, citizenship, status, discharge, dates)
- Household relationships beyond `household_members[].relationship`: child-with-absent-parent, primary-caretaker-of-child-under-19, child/disabled-needs-care
- Disability detail (per-person disability, daily-living help, duration, work-related medical expenses, in-facility)
- Residency / out-of-state-plans

**Step 4 (Income) — gaps beyond `income_sources[]` {type, amount, frequency}:**
- Per-person income attribution ("Person Getting the Money" / "Person Working")
- Income source ("From Where") / employer name+address / employer phone
- Hourly rate + average hours/week (schema has amount only)
- "Expect to continue" flag
- Self-employment structure: business name/type/start-date, gross-vs-net, expense method (40% flat / actual / monthly average)
- In-kind income (Q9)
- Yearly/fluctuating income amounts (Q10)
- Recent job change / strike (Q8 sub-block)
- **Frequency-enum mapping uncertainty:** schema enum `monthly|weekly|biweekly|annual|irregular` vs portal's "once/weekly/monthly/other" — needs a transform; mapping unverified.

**Step 5 (Expenses) — only `utility_allowance_type` is sourced; everything else is a gap:**
- Rent / mortgage / house payment amount
- Property taxes & insurance
- Dependent (child/adult) care expenses (uncapped CalFresh deduction)
- Child support PAID (CalFresh deduction)
- Spousal support / alimony paid
- Special-needs expenses (special diet, equipment, housework, high utilities, laundry, other)
- Homeless shelter expense, water/sewage/garbage, LIHEAP, help-paying-expenses
- **`utility_allowance_type` mapping uncertainty:** the portal likely derives the allowance from individual utility-type Yes/No answers, not a single standard/limited/telephone_only/none picker — the clean enum may not have a single portal target.

**Step 6 (Assets) — entire section is a gap, but SNAP-only never reaches it** (no fill obligation for CalFresh-only v1).

**Step 7 (Other Situations) — all gaps:**
- Student DETAIL (school name, enrolled status, units, work hours) — `is_college_student` is only the applicant-level boolean from ABCOS; the Q6l detail and per-person nature exceed it
- Pregnancy / teen parent (under-20, teen-parent, school status, due date, babies expected)
- Cal-Learn program
- Foster care (history + foster child in home + count-income choice)
- Emergency / expedited-service block (gross-income/cash thresholds, housing-exceeds-income, migrant farmworker, utilities shut-off, food-runs-out-3-days) — overlaps partially with `is_homeless`

**Step 8 (Document Upload):** file inputs are skipped by design (no fill); `document_urls[].type` *might* map to a doc-type picker if one exists — unverified. No new schema field needed for the skip path.

**Step 9 (Review & Submit):** `client_signature_type` → portal signature control mapping is unverified; submit + confirmation-number capture deferred to the live walk / T13a demo.

---

# What still requires the human walk (nothing below can be produced from public sources)

1. **Real pageCodes.** Every `AB____` code here is minted. The actual 5-letter codes come from the live URL/hidden fields. Re-home and rename every record.
2. **`urlPattern` regexes.** Copy `window.location.pathname`, regex-ify the volatile UUID/app-id segments.
3. **Selectors / `fallbackSelector` / element ids.** BenefitsCal uses random-UUID ids (`lift-ux-id-<uuid>`); resolve by label. None can be guessed.
4. **Exact option ids/values AND verbatim option label strings.** Even where the option LIST is documented (income types, expense rows, enrolled status), the portal's option *ids/values* and exact label text are unknown. Do not invent.
5. **Repeat-render behavior.** Whether each repeating section (income rows, dependent-care rows, per-member step-3 questions, students, foster, pregnancy) appends a row, re-navigates a page, or changes the URL — and the "add another" control's accessible name.
6. **Step placement.** Which paper question actually lands under which online step (Household Details vs People vs Other Situations vs early-flow). Re-home records to match the real sequence.
7. **The frequency-enum mapping** (`income_frequency`) and the **`utility_allowance_type` derivation** — confirm whether a single portal field exists or whether they're composed from multiple Yes/No answers.
8. **The signature control + submit button + confirmation-number selectors** (the latter on T13a, not this abort-before-submit walk).
9. **PII judgment.** Which captured field VALUES are PII to scrub (per runbook P0 scrub script). An agent cannot make this call.
10. **Required-vs-optional and validation/error strings** per field (the walk captures hard advancement gates like ABCPA's email-format gate in step 1).

---

# Confidence & sources

**Public sources used (cross-checked):**
- **SAWS 2 PLUS** "Application for CalFresh, Cash Aid, and/or Medi-Cal/Health Care Programs" (4/15), CDSS — primary structural source for ALL step 3–9 question inventories. https://www.cdss.ca.gov/cdssweb/entres/forms/English/SAWS2_PLUS.pdf (17-page statement of facts; Q1–Q15 + appendices). Pages cited inline.
- **LSNC Guide to CalFresh Benefits — Income deductions** — for the deduction/expense category names + utility allowance options (SUA $663 / LUA $158 / TUA $19 / none), cross-checked against CDSS. https://calfresh.guide/income-deductions-for-calfresh-households/
- **CDSS CalFresh Outreach + SHD Paraphrased Regs (270 Deductions, 260 Income)** — corroborating income/deduction categories. https://www.cdss.ca.gov/shd/res/pdf/ParaRegs-Food-Stamps-Deductions.pdf ; https://www.cdss.ca.gov/shd/res/pdf/ParaRegs-Food-Stamps-Income.pdf
- **Santa Clara County DEBS CalFresh Handbook (Application Forms / Shelter Costs)** — confirmed SAWS 2 PLUS vs CF 285 usage (CF 285 = CalFresh-only; SAWS 2 PLUS = joint). https://stgenssa.sccgov.org/debs/program_handbooks/calfresh/assets/CalFresh/Application/AppForms.htm
- **Existing Civica capture** — `portal-map/form-tree.json` (steps 0–2), `src/core/selector-map.ts`, `src/core/schemas.ts` for conventions + the SNAP-only/BBCE/Assets-skip behavior.

**Confidence per section:**
- **Step 3 Household Details — MEDIUM.** Question text well-documented in SAWS 2 PLUS Q5/6d/6g–6k/6q–6r, but online step *grouping* (Household vs People) and repeat behavior are inferred. Step-1 already has ABDSM/ABDSC/ABISS discovered-but-unmapped — possible overlap.
- **Step 4 Income — MEDIUM-HIGH on question/option content** (the unearned-income checkbox list and earned/self-employment tables are transcribed verbatim from SAWS 2 PLUS Q7/8/8a), **LOW on online structure** (repeat pattern, single-vs-multiple gates, frequency mapping).
- **Step 5 Expenses — HIGH on category inventory** (Q11–Q15 transcribed verbatim, including the exact Q15 expense-type rows), **but the `utility_allowance_type` → portal mapping is a known UNCERTAINTY** (likely derived, not a single picker).
- **Step 6 Assets — LOW.** Least documented; the SAWS 2 PLUS CalFresh path has no dedicated asset statement-of-facts section. Capture from scratch. Moot for SNAP-only (skipped).
- **Step 7 Other Situations — MEDIUM-HIGH on content** (Q6l/6m/6n/6o/6p + page-1 expedite block transcribed verbatim), **LOW on placement** (which land under "Other Situations" online).
- **Step 8 Document Upload — MEDIUM.** The "what to upload" list is well-documented (SAWS 2 PLUS coversheet), but the online file-input UI + doc-type picker options are unverified. Low fill stakes (skipped by design).
- **Step 9 Review & Submit — MEDIUM on the attestation content** (signature/penalty block documented), **LOW on selectors** (confirmation page unverified; submit captured-not-clicked).

**Overall:** This is a *checklist scaffold*, not a capture. It tells the walker what questions to expect and what to map; it does not and cannot substitute for the live walk. Treat every `selector=TODO`, `urlPattern: TODO`, minted pageCode, and "(unverified)" as a hard blocker on auto-fill until the walk fills it.
