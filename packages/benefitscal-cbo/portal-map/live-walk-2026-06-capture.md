# BenefitsCal Live Walk Capture — 2026-06

**Method:** Live authenticated CBO walk (VoteNow Advocacy Foundation account) via Claude-in-Chrome, driven page-by-page. CalFresh-only flow. Structure captured (page codes, urlPatterns, field ids/labels/types, option lists); **no applicant values recorded, application NOT submitted** (abandoned at Income/ABEIC).

This complements `form-tree.json` (steps 0-2) and `steps-3-9-draft-inventory.md` (public-research draft). Where this live capture and the draft disagree, **this file wins** — it's the real authenticated DOM.

---

## Headline findings

1. **BBCE bypass confirmed live.** Selecting only Food (CalFresh) on ABPRI flips the wizard from "Step 1 of **9**" to "Step 1 of **8**" — the Assets section disappears from the nav. Validates `section-sequence.ts` SNAP-only logic against the real portal.

2. **Step-2 ABHSD mapping confirmed correct.** The household-members gate is at `/ApplyForBenefits/ABHSD` with a Yes/No (`hshld_radiogrp_0`/`_1`) — exactly what PR #494 shipped. urlPattern + structure match.

3. **Address-validation 2-modal flow captured** (ABNHA):
   - Modal #1 "We can't validate your address": radio `#sr_only_entered_adr1` (Address You Entered), button `#button2` = "USE THIS ADDRESS", link `#hyperLink_correctedAddr` = "Correct my address".
   - Modal #2 county select: `#county` (58 CA counties, "-Select One-" + Alameda…Yuba), button "CONTINUE".

4. **🔴 Income frequency enum mismatch (schema gap).** Portal `ABEIC` pay-frequency select `#oftenPaid` =
   `[Weekly, Bi-Weekly, Semi-Monthly, Monthly, Daily, Quarterly, Semi Annually, Annually, One-Time Only, Hourly]`.
   Our `IncomeSourceSchema.income_frequency` = `[monthly, weekly, biweekly, annual, irregular]`.
   **6 portal values unmapped:** Semi-Monthly, Daily, Quarterly, Semi-Annually, One-Time-Only, Hourly. File an issue to extend the schema before wiring income fill.

5. **"Household Details" is the work-requirement/ABAWD section, not household composition.** The public-research draft assumed composition/relationships; the live portal puts those in step 2 (People), and step 3 (Household Details) is special-situations + ABAWD work gateways. Correct the draft.

---

## Section sequence (live ABNAV hub, CalFresh-only = 8 sections)

1. Your Information  2. People  3. Household Details  4. Income  5. Expenses  6. Other Situations  7. Document Upload  8. Review & Submit
*(Assets omitted — BBCE.) Sequential unlock: each section "Not Available" until the prior is Reviewed.*

---

## New/confirmed page codes (this walk)

### Step 0 / Step 1 (already mapped — confirmed live)
ABOVR (overview, BEGIN btn) → ABHLT (tips) → ABDEI → ABSNC (sentiment) → ABNAV (hub) → ABLPR (language) → ABNMI (name: `#text1` first, `#text3` last) → ABNHA (home addr + 2 modals) → ABMAD (mail-diff Y/N) → ABCON (contact, all optional) → ABCOP (contact prefs) → ABPRI (program select: `#snap` checkbox + "applying for self" Y/N) → **ABCSD** (submit-divider: "Skip and submit now" vs "CONTINUE APPLICATION") → ABDIS (disability + deaf/hoh) → ABCOS (college student Y/N) → ABCFA (auth rep Y/N) → ABCFS (spend-benefits rep Y/N) → ABRDT (DOB, `type=password`) → ABSSN (SSN: Yes/No/"I don't have it right now") → ABNSN (no-SSN reason select: ATIN/ITIN, Religious Exemption, Does not qualify, I have applied for an SSN, Other) → ABMRS (marital, optional, 8 opts) → **ABCID** (citizenship divider) → ABDOC (US citizen Y/N) → **ABBID** (background divider) → ABASX (sex/gender: Female/Male/prefer-not) → ABGNR (gender identity, optional) → **ABSXO** (sexual orientation, optional — NEW) → **ABHSP** (Hispanic origin, optional — NEW) → **ABRAE** (race/ethnicity, optional, `#Race` select — NEW) → ABYSD (section complete)

*New codes beyond the prior 21-page step-1 map: ABCSD, ABCID, ABBID, ABSXO, ABHSP, ABRAE.*

### Step 2 — People (confirmed)
ABHSD (household-members gate, Yes/No) → ABPLS (People Summary: member card "Applicant" + "ADD ANOTHER") → ABTCD (section complete divider)

### Step 3 — Household Details (NEW — work-requirement/special-situations)
- **ABHGW** "Let's see if any of the below apply to you" — 8 checkboxes:
  `govtaid`=Received public assistance any state, `disability`=person with a disability, `college`=enrolled college/trade, `food`=get food other than at home, `living`=facility/shelter/other arrangement, `breastfeeding`=breastfeeding a child, `military`=serving/served US military or dependent, `none`=None of these apply.
- **ABDEG** "Do any of the situations below apply to you?" — 12 checkboxes (work-exemption):
  physical/mental health issue hard to work; personal issue hard to work; caring for child <14; caring for child <6; caring for person who needs help; currently pregnant; school ≥half-time; getting/applied unemployment; getting/applied disability; Indian/Urban Indian/Californian Indian; ORR Training Program ≥half-time; None.  *(URL root `/SupportRequest/ABDEG`)*
- **ABDWR** "Are you doing any of these work, volunteering, or training activities?" — Working; Community service/volunteer; Work/education/training program; None.
- **ABDWS** "Below are the ABAWD details you added" (summary, no fields).
- **ABRGS** "Here is a summary of your household details" (summary).
- **ABSDE** (section complete divider).

### Step 4 — Income (NEW — partial; abandoned here)
- **ABEIQ** "Let's start with employment." Yes/No (`#mailadr_radio_0/1`).
- **ABEQH** "Are you self-employed?" Yes/No (`#select_group_0/1`).
- **ABEIC** "Can you share a little more about your job?" — the wage-detail page:
  - `#employerName` (text), `#employerAddr` (text), `#city` (text), `#state` (select, full US state list), `#zipCode` (text), `#employerPhone` (text)
  - `#oftenPaid` (select) = **[Weekly, Bi-Weekly, Semi-Monthly, Monthly, Daily, Quarterly, Semi Annually, Annually, One-Time Only, Hourly]** ← frequency enum
  - `#payAmount` (text, **required**) ← income amount → maps `income_sources[].income_amount`
  - `#avgHour` (text) Average Hours per Week
  - `#select_group_0/1` Yes/No (another job?)
- **ABEIS** "Below are the jobs that you added" (employment summary).
- **ABUIN** "Do you get money that doesn't come from work?" Yes/No (unearned-income gate).
- **ABUIA** "Do you get money from these government sources?" — 14 checkboxes:
  Social Security Disability; SSI/SSP; Social Security Retirement/Survivors; Public Assistance; Unemployment Insurance (UI); State Disability Insurance (SDI); Financial Aid; Work Study; Foster Care Payments; Veterans Income/Education; Government & Railroad Disability/Retirement; Tribal Payments; Other; None.
- **ABUIB** "money from any of the sources below" — 16 checkboxes:
  Child or Spousal Support; Worker's Compensation; Gifts of Money or Loans; Help paying for rent/food/clothing; Rental or Royalties; Lottery/Gambling Winnings; Pension; Private Disability/Retirement; Insurance/Legal Settlements; Net Farming/Fishing; Dividend & Interest Income; Sales of Notes/Contracts/Trust Deeds; Strike Benefits; Room and Board; Other; None.
- **ABCIA** "Are you on strike?" Yes/No.
- **ABCIB** "Did your employment change in the last two months?" Yes/No.
- **ABJIS** "Here's a summary of your income" (income summary). → ABISE (section complete divider).

### Step 5 — Expenses (NEW — walked fully)
- **ABHEG** "Tell us more about your housing and utilities expenses." — 7 checkboxes:
  Rent or Mortgage Payments; Property Taxes or Insurance; Gas/Electric/Other Fuel for Heating or Cooling; Telephone/Mobile Phone; Water/Sewage/Garbage; Homeless Shelter; None.
- **ABAPH** "What are your Rent or Mortgage Payments?" — the shelter-expense detail:
  - `#text1` Amount (text)
  - `#dropdownoptiongroup` (select) = **[Weekly, Bi-Weekly, Semi-Monthly, Monthly, Quarterly, Semi Annually, Annually, One-Time Only]** (NB: no Daily/Hourly, unlike income `oftenPaid`)
  - Yes/No radio
- **ABHEX** "Below are the Rent or Mortgage Payments that you added" (expense summary).
- **ABCST** "Do you pay for adult care or childcare so you can go to work, school, or look for a job?" Yes/No (dependent-care expense).
- **ABCOD** "Next, let's go over court-ordered costs" (divider).
- **ABCOC** "Do you pay court-ordered child support?" Yes/No.
- **ABSSQ** "Do you have court-ordered spousal support or alimony expenses?" Yes/No.
- **ABEVC** "Let's make sure we got this right!" (expenses verification) → **ABESU** (expenses summary) → **ABESC** (section complete).

### Step 6 — Other Situations (NEW — walked fully)
- **ABOSS** "You may be able to get even more help." (Support Services) — checkbox: Vaccine Services.
- **ABPFG** "Please answer the statements below." (Penalties & Fraud Gateway) — 9 Yes/No disqualification attestations:
  Receiving duplicate food assistance in any state after 09/22/1996; Trafficking EBT cards worth $500+ after 09/22/1996; Parole or probation violation; Trading food assistance for drugs; Trading food assistance for guns/ammo/explosives; Hiding/running from the law for a felony; … (eligibility-critical IPV/fraud screen). → **ABSND** (section complete).

### Step 7 — Document Upload (NEW)
- **APDMC** "Here are some suggested documents to upload." — per-document `UPLOAD` buttons (file inputs hidden behind them; consistent with the extension's file-skip guard). Marked "Reviewed" without uploading.

### Step 8 — Review & Submit / SUBMIT GATE (reached, NOT submitted)
- Advancing past Document Upload triggered the **submit-confirmation modal**: "Are you sure you're ready to submit your application?" with **"UPLOAD MORE DOCUMENTS"** (button) and **"Continue to submit"** (link). **WALK ABORTED HERE — "Continue to submit" NOT clicked.** This link is the V1-6a / #316 auto-trigger target: the extension's pre-submit trust panel should fire on this modal. Capture the exact `Continue to submit` selector in a follow-up (it sits inside the dialog; a browser beforeunload "Leave site?" guard also fires on navigation away — useful signal that the draft has unsaved state).

---

## NOT captured
- Income: self-employment detail page (answered "not self-employed"); per-type unearned-income amount pages (answered "None").
- Expenses: utility/property-tax/phone/water detail pages (only walked Rent); medical-expense pages (only show for elderly/disabled HH — applicant was 36).
- Household Details: the per-checkbox sub-flows on ABHGW/ABDEG/ABDWR (answered "None").
- Exact `Continue to submit` selector inside the submit modal.
These are all "answer Yes instead of None/No" branches — same capture pattern, a short follow-up walk reaches them.

## Follow-ups to file
- **Issue: extend `IncomeSourceSchema.income_frequency`** to cover Semi-Monthly, Daily, Quarterly, Semi-Annually, One-Time-Only, Hourly (or add a portal→schema frequency mapping table in transforms).
- **Correct `steps-3-9-draft-inventory.md`**: Household Details (step 3) is ABAWD/work-requirement gateways, not composition.
- Convert these ABHGW/ABDEG/ABDWR/ABEIC captures into `selector-map.ts` PortalPage entries (label-first; UUID ids on ABDEG/ABDWR are unstable — resolve by label).
