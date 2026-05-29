# BenefitsCal Portal Walk — Steps 2-9 (comprehensive)

Captured 2026-05-29 by driving a production CBO application (VoteNow account,
SNAP-only / CalFresh). Dummy data; draft abandoned before submit.

## Navigation model (confirmed)

- **ABNAV** is the section hub. After completing a section you land on a
  section-complete page (e.g. **ABYSD** "Great job! ... START THE NEXT SECTION")
  which returns you to ABNAV, where the next section's `Start` button is now
  enabled. The submitter/extension drives: hub → click `Start` (first enabled) →
  walk section pages → section-complete `START THE NEXT SECTION` → hub → repeat.
- **SNAP-only collapses 9 steps → 8** (Assets step omitted — BBCE bypass).
  Section order for CalFresh-only: Your Information → People → Household Details
  → Income → Expenses → Other Situations → Document Upload → Review & Submit.
- Section-transition button label: **`START THE NEXT SECTION`**.

## Step-1 pages discovered beyond the first walk (lower priority — mostly
demographics/optional, human-fills; extension already covers the data-bearing
step-1 fields name/address/DOB/program/eligibility)

Full step-1 sequence observed this walk:
ABLPR (lang) → ABNMI (name) → ABNHA (address + 2-modal validation) → ABMAD
(mailing diff) → ABCON (contact) → ABCOP (comm opt-in) → ABCPA (**email + mobile
phone REQUIRED** — valid email format enforced) → ABPRI (program select) →
ABCOS (college student) → ABCFA (auth rep) → ABCFS (spend rep) → ABRDT (DOB) →
ABSSN (SSN exists) → ABNSN (no-SSN reason) → ABMRS (marital) → ABCID (citizenship
intro) → ABDOC (citizen Y/N) → ABISS (immigration status?) → ABDSM / ABDSC
(disability detail?) → ABBID (background intro) → ABASX (sex) → ABGNR (gender) →
ABSXO (sexual orientation) → ABHSP (Hispanic origin) → ABRAE (race/ethnicity) →
ABYSD (section complete).

NB: **ABCPA** is a new REQUIRED contact page (valid email + mobile phone) that
blocks advancement — the extension must fill these (maps to packet email/phone).

---

## STEP 2 — People

### ABHSD — household-members gate
- Prompt: "You selected: Food (CalFresh). ... Do you have other people living in your household?"
- `radio[name=hshld_radiogrp]` → `#hshld_radiogrp_0` Yes / `#hshld_radiogrp_1` No
- Yes → branches into the household-member add sub-flow (below).
- Button: Next.

### Household-member sub-flow (per added person) — KEY INSIGHT

**Adding a member reuses the primary applicant's page sequence + the SAME field
ids**, plus member-specific pages. The "person" pages are not a row-form; they're
the same pages repeated per member. The extension must track *which person* it is
filling across repeated identical page codes. Per-member sequence observed:

- `ABNMI` — member name: `#text1` first*, `#text2` middle, `#text3` last*, `#suffix`, `#text4` other. ("Let's add a new person to your household.")
- `ABHHR` — "How is <name> related to you?" → `select#optiongroup` (relationship; UUID-id select → label-based). **Maps to `household_members[].relationship`.**
- `ABPSM` — "We included <name> in the Food (CalFresh) [household]" → `checkbox#snap`, `checkbox#notApply` (which programs this member is included in / applying for).
- `ABBPF` — "Do you buy and prepare food together?" → `radio[name=label]` `#label_0` Yes / `#label_1` No. **SNAP household-unit determination — eligibility-relevant.**
- `ABLNA` — "Does <name> live with you?" → `radio[name=living_radio]` `#living_radio_0/_1/_2` (with-you / sometimes / elsewhere).
- `ABHAD` — member address (only if not living with applicant): `#addressLine1 #addressLine2 #city select#county select#state #zip5` + the same USPS-validation flow as the primary (a `sr_only_entered_adr1` radio appears on the validation step). **Same address selectors as ABNHA.**
- Then presumably DOB / SSN / demographics for the member (same sub-pages as primary, not fully walked — driver hit a server-error loop on a bad dummy member address).
- After a member: an "add another person?" gate + a finish path returns to the section flow (not captured — see gaps).

**Extension implication:** household members = loop over `household_members[]`,
each walking { name(ABNMI) → relationship(ABHHR) → program(ABPSM) →
buy-prepare-food(ABBPF) → lives-with(ABLNA) → [address(ABHAD) if elsewhere] →
DOB/SSN/demographics }. Reuse the primary applicant's selectors per page; the
discriminator is sequence position, not field id.

### Walk state note
The driver's generic radio-picker chose `ABLNA` = "lives elsewhere", forcing the
member-address page (`ABHAD`), where dummy data triggered a repeating "We're
sorry, something went wrong" server error — the draft is now in a bad state.
People's completion path + the add-another-member gate, and sections 3-8, were
not reached on this walk. See "Remaining to capture" below.

---

## COMPREHENSIVE AUDIT — readiness assessment (2026-05-29)

### What is now mapped (extension can fill / submitter can drive)
1. **Full navigation model** — hub (ABNAV) → `Start` (first enabled) → section
   pages → `START THE NEXT SECTION` (section-complete page e.g. ABYSD) → hub.
   Plus the SNAP-only 8-step collapse (no Assets).
2. **Step 1 (Your Information) — complete page list**, incl. the previously
   unknown **ABCPA** (REQUIRED valid email + mobile phone — a hard advancement
   gate the extension MUST satisfy) and the demographic tail (ABISS/ABDSM/ABDSC/
   ABASX/ABGNR/ABSXO/ABHSP/ABRAE — mostly optional, human-fills).
3. **Step 2 (People)** — the household gate (ABHSD) + the **complete per-member
   sub-form template** (name/relationship/program/buy-prepare-food/lives-with/
   address), which reuses primary selectors. This is the hardest section and the
   one carrying `household_members[]`.

### Remaining to capture (clean follow-up walk needed — this draft corrupted)
- People: add-another-member gate + section-complete path.
- **Household Details** (step 3) — entire section.
- **Income** (step 4) — entire section. HIGH PRIORITY: carries `income_sources[]`
  (type/amount/frequency) — core data the extension fills; repeating-row like members.
- **Expenses** (step 5) — entire section. HIGH PRIORITY: carries the utility/SUA
  (`utility_allowance_type`) + shelter fields.
- **Other Situations** (step 6) — entire section.
- **Document Upload** (step 7) — file-input handling (extension skips file uploads
  by design; capture the page + the "what to upload" list).
- **Review & Submit** (step 8) — confirmation-number selector + the final submit
  control (the trust-panel + capture target).

### Readiness call
- **Extension can fill step 1 end-to-end** (name/address/DOB/program/eligibility
  + the new ABCPA contact gate once wired) and **the People member sub-form**.
- **NOT yet ready** for Income/Expenses/Other/Docs/Review — those selectors aren't
  captured. A single clean follow-up walk (fresh draft, answer ABHSD=No to skip
  members fast, careful capture of sections 3-8) closes the gap. Budget ~30-45 min.
- **Recommendation:** do the follow-up walk with `ABLNA`/address answers chosen to
  AVOID the member-address branch (answer "lives with you"), and avoid driving the
  member sub-flow with bad dummy data (it server-errors). Capture sections 3-8
  on the primary (no-members) path first — that's the 80% the extension needs.

### New schema/extension gaps surfaced this walk
- **ABCPA**: email + mobile phone are REQUIRED to pass step 1 (valid email format
  enforced). Extension must fill from packet contact; if absent → needs-review
  (hard gate, not skippable).
- **Member `buy & prepare food together` (ABBPF)** + **program-per-member (ABPSM)**
  + **lives-with (ABLNA)** are SNAP household-unit determinations not currently in
  `household_members[]` schema — add if the extension is to fill member pages.
- **Relationship (ABHHR)** is a UUID-id `select#optiongroup` → label-based fill.

---

## STEP 3 — Household Details

### ABHGW — situations checklist (branching multi-select)
Prompt: "Let's see if any of the below apply to you. Select if you..."
Checkboxes (id → label → state's inline explainer — chatbot grounding):
- `#govtaid` — "Received public assistance in any state" — *"This includes Temporary Assistance for Needy Families (TANF)/CalWORKs, Tribal TANF, Medicaid/Medi-Cal, Supplemental Nutrition Assistance Program (CalFresh/SNAP), General Assistance/General Relief (GA/GR)."*
- `#disability` — "Are a person with a disability" — *"Are a person with a physical, mental, emotional, or developmental disability."*
- `#college` — "Are enrolled in college or trade school" — (no inline explainer)
- `#food` — "Get food from somewhere other than at home" — *"This could be a dining facility for elderly or disabled people, or another food program."*
- `#living` — "Live in a facility, shelter or other living arrangement" — *"This could be a hospital, long-term care facility, rehabilitation center, shelter for battered women, homeless shelter, or Reservation for Native Americans."*
- `#breastfeeding` — "Are breastfeeding a child" — (no inline explainer)
- `#military` — "Are currently serving or have served in the U.S Military, or are a dependent of someone who is" — *"A dependent can include a spouse, parent, or child of person in active duty or a veteran."*
- `#none` — "None of these apply"

Each checked box branches into follow-up detail pages (not yet walked). Maps to
eligibility flags the extension/QC engine cares about: disability, student,
military/veteran, public-assistance history, group-living. Button: Next.

### Confirmed sequences this walk
- **Step 1 full sequence (re-verified):** ABLPR → ABNMI → ABNHA (2-modal addr) →
  ABMAD → ABCON → ABCOP → **ABCPA** → ABPRI → (ABCSD upsell) → ABDIS → ABCOS →
  ABCFA → ABCFS → ABRDT → ABSSN → ABNSN → ABMRS → ABCID → ABDOC → ABISS → ABDSM →
  ABDSC → ABBID → ABASX → ABGNR → ABSXO → ABHSP → ABRAE → ABYSD (complete).
- **Step 2 People — No-members path:** ABHSD (No) → ABPLS → ABTCD (complete).
  (Members path = the sub-form template captured earlier.)
- **Step 3 Household Details** starts at **ABHGW** (above).

_Remaining: ABHGW branch follow-ups; Income (step 4); Expenses (step 5); Other
Situations (step 6); Document Upload (step 7); Review & Submit (step 8). Plus
the explainer popovers on step-1 pages (mostly "?" links) + verifying ABCPA ids._

### Step 3 Household Details (full path, no-detail)
- ABHGW (situations checklist, above) → **ABRGS** "summary of your household details" (cards: Public Assistance, Pregnancy, Person With A Disability, College/Trade School, Food Programs, Facility/Shelter, Breastfeeding, U.S. Military — each "add" to enter detail) → **ABSDE** section-complete ("Next, let's review your job and income information"). Each checklist item branches to its own detail sub-pages (not walked — checked "None" to pass).

## STEP 4 — Income (extension core data: income_sources[])
- **ABEIQ** — "Do you have a job?" `radio[name=mailadr_radio]` Yes/No. Inline explainer: "anything you do to earn money: full/part-time, seasonal, **self-employment, freelance, independent contractor (Uber/Lyft/DoorDash/Postmates)**". Yes → job-detail sub-form (employer/amount/frequency — repeating per job, NOT walked; same pattern as members).
- **ABUIN** — "Do you get money that doesn't come from work?" `radio[name=select_group]` Yes/No. Explainer: "Work Study, child/spousal support, gifts/loans, unemployment, worker's comp, government aid, disability, retirement/pension, foster care."
- **ABCIA** — "Are you on strike?" Yes/No (`mailadr_radio`).
- **ABCIB** — "Did your employment change in the last two months?" Yes/No. Explainer: "lost a job, changed jobs, reduction in hours, laid off, quit."
- **ABJIS** — income summary (cards: Jobs and Self-Employment / Government Support and School Aid / Other Income / In-kind Income / Yearly Income Change — click card to edit).
- **ABISE** — section-complete.
- NB: radio `name` reuse is rampant (`mailadr_radio`, `select_group` appear on many unrelated pages) → **must key on page + label, never name alone.**

## STEP 5 — Expenses (extension core data: utility_allowance_type / shelter)
- **ABHEG** — "Tell us more about your housing and utilities expenses. Select all that apply." Checkboxes (UUID-id group `lift-ux-id-…_0.._6` → label-based):
  - Rent or Mortgage Payments
  - Property Taxes or Insurance (if billed separate)
  - **Gas, Electric, or Other Fuel Used for Heating or Cooling** (the SUA heating/cooling trigger)
  - Telephone/Mobile Phone
  - Water, Sewage and Garbage
  - Homeless Shelter
  - None of These Apply
  **→ maps to `utility_allowance_type` (SUA tier) + shelter.** Each checked → amount sub-page.
- **ABCST** — "Do you pay for adult care or childcare so you can go to work, school, or look for a job?" `radio[name=select_group]` Yes/No (dependent-care deduction).
- **ABCOD** — (next; capture continues).

### Remaining repeating sub-forms (NOT yet walked — high value for extension)
- Income job-detail (employer, gross amount, pay frequency) — per `income_sources[]`.
- Income non-work-source detail (type, amount, frequency).
- Expense amount pages (rent $, utility $, dependent-care $).
- Household Details per-category detail pages.
These mirror the member sub-form pattern: a gate → repeating detail pages → summary card.

### Step 5 Expenses (remainder)
- **ABCOC** — "Do you pay court-ordered child support?" `radio[name=label]` Yes/No.
- **ABSSQ** — "court-ordered spousal support or alimony?" `radio[name=label_spf]` Yes/No.
- **ABESU** — expenses summary (Housing / Adult Care-Childcare / Medical / Court-Ordered / Tax-Deductible, Total per month).
- **ABESC** — section-complete ("You're halfway done… next is 'other'").

## STEP 6 — Other Situations
- **ABOSS** — "You may be able to get even more help. Select the services that interest you" — optional services checkboxes (e.g. `#immunity` Vaccine Services). Opt-in referrals, non-eligibility.
- **ABPFG** — "Please answer the statements below." + explainer link **"Why do we ask these questions?"** — the felony/disqualification gate (eligibility-CRITICAL). Yes/No radios:
  - `duplicatefood_radio` — duplicate food assistance in any state after 09/22/1996
  - `sellingEBT_radio` — trafficking EBT cards worth $500+
  - `probation_violation_radio` — probation/parole violation
  - `foodAssistanceDrug_radio` — drug felony
  - `foodAssistanceGun_radio` — firearm felony
  - `avoidJail_radio` — fleeing to avoid jail
- **ABSND** — section-complete ("next you'll upload your papers").

## STEP 7 — Document Upload
- **APDMC** — "Here are some suggested documents to upload. Based on your responses, we suggest…" + explainer **"Not sure what to upload? Let's look at some examples."** Buttons: `UPLOAD`, `ADD OTHER DOCUMENT`, `ADD A PERSON`, `UPLOAD MORE DOCUMENTS`, Next.
  - **`AP` URL prefix** (not `AB`) — first non-AB page code seen.
  - **Extension skips file uploads by design** (content scripts can't fill `<input type=file>`); the assister uploads manually. Capture the page + suggested-doc list for the chatbot ("what to upload"), don't autofill.

## STEP 8 — Review & Submit
- Not reached this walk (driver stuck on APDMC doc-upload Next). The confirmation-number selector + final submit control still need capture (the extension's confirmation scrape target + the pre-submit trust-panel target). Reach via APDMC → Next (may require acknowledging no-docs).

## AUDIT TREE STATUS after this walk
**All 8 sections' main-path structure now captured** (gates, key questions, summaries, section-completes, + many inline explainers): Your Information(1) ✓, People(2) ✓ (+ member sub-form), Household Details(3) ✓, Income(4) ✓, Expenses(5) ✓, Other Situations(6) ✓, Document Upload(7) ✓, Review & Submit(8) ✗ (not reached).
**Still to capture:** Review/Submit page; the repeating DETAIL sub-forms (job/income amounts, expense amounts, household-detail per-category, member DOB/SSN); the step-1 "?" explainer popovers; verify ABCPA ids. Rough completion of the reframed tree now **~40%** (main-path + explainers across 7 of 8 sections; detail sub-forms + popovers + Review remain).

### STOP POINT — pre-submit confirmation (step 7→8 gateway)
APDMC Next triggers a modal: "Are you sure you're ready to submit your application?
We recommend you upload as many documents as you can... If you don't have all your
documents [you can submit anyway]." This is the gateway to Review & Submit (step 8).

**Deliberately NOT driven past** — this is a production CBO account; proceeding
risks a real junk submission to CalSAWS under VoteNow credentials. Review/Submit
(step 8) + the confirmation-number selector + final submit control must be
captured MANUALLY (human navigates, agent snapshots) — never by an automated
driver near a live submit button. This is the one remaining section + the
repeating detail sub-forms + step-1 explainer popovers.
