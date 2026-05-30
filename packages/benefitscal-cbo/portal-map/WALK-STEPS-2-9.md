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
- **APDMC** ("Step 7 of 8") — "Here are some suggested documents to upload. Based on your responses, we suggest…" + explainer **"Not sure what to upload? Let's look at some examples."** Buttons: `UPLOAD` (×1 per category), `ADD OTHER DOCUMENT`, `ADD A PERSON`, `Next`.
  - **`AP` URL prefix** (not `AB`) — first non-AB page code seen.
  - **Suggested-doc categories (CAPTURED, 2026-05-29)** — one `H3` + one `UPLOAD` button each, keyed to the applicant ("Test Applicant (36)"):
    1. **Identity Proof**
    2. **Release of Information (ABCDM228)** — the CBO/authorized-rep consent form
    3. **Income/Employment-Related Documents**
    4. **Rent/Lease/Mortgage**
    5. **Expenses**
    6. **Address Proof**
    (Categories are response-driven — they reflect what the applicant declared in steps 1–6; the chatbot can explain "why this doc" per category.)
  - **Extension skips file uploads by design** (content scripts can't fill `<input type=file>`); the assister uploads manually. Capture the page + suggested-doc list for the chatbot ("what to upload"), don't autofill.
  - **Clicking `Next` does NOT advance** — it raises the submit-confirmation modal (see STOP POINT below). APDMC is the last fillable page before the submit gate.

## STEP 8 — Review & Submit (GATED — production-safety boundary)
- **Sits behind the submit-confirmation gate** (`A#skip` "Continue to submit", below). NOT a freely-navigable page: the hub redirects to the active incomplete page (APDMC) until doc-upload is "done", and the only way to mark doc-upload done is to pass through the submit gate.
- **Ambiguous gate semantics (the load-bearing unknown):** the modal title "Are you sure you're ready to submit your application?" + button "Continue to submit" reads like a *final* submit, but the step counter ("Step 7 of 8") implies a distinct Step 8 ahead. So `A#skip` either → (a) a pre-submit **Review** page (read-only summary + a separate real Submit button — safe to capture), or → (b) a **direct submission** to CalSAWS (irreversible). Cannot be disambiguated without clicking.
- **Deliberately NOT clicked** on this production VoteNow CBO account — see STOP POINT. The confirmation-number selector + pre-submit trust-panel + final Submit control remain the one uncaptured node, and capturing them requires a **user decision** (test/staging context, or a deliberate dummy submit-then-withdraw). This is the documented edge of the safely-capturable tree.

## AUDIT TREE STATUS after this walk
**All 8 sections' main-path structure now captured** (gates, key questions, summaries, section-completes, + many inline explainers): Your Information(1) ✓, People(2) ✓ (+ member sub-form), Household Details(3) ✓, Income(4) ✓, Expenses(5) ✓, Other Situations(6) ✓, Document Upload(7) ✓, Review & Submit(8) ◑ (boundary captured — `A#skip` submit gate; post-gate content gated by production-safety, needs a user decision to capture).
**Still to capture:** Review/Submit page; the repeating DETAIL sub-forms (job/income amounts, expense amounts, household-detail per-category, member DOB/SSN); the step-1 "?" explainer popovers; verify ABCPA ids. Rough completion of the reframed tree now **~40%** (main-path + explainers across 7 of 8 sections; detail sub-forms + popovers + Review remain).

### STOP POINT — submit-confirmation gate (step 7→8) — FULLY CHARACTERIZED 2026-05-29
APDMC `Next` raises a blocking modal (no `X`/close control; dismiss only via the back-button):

- **Title:** "Are you sure you're ready to submit your application?"
- **Body:** "We recommend you upload as many documents as you can. It could help to process your application more quickly. If you don't have all your documents, you can still submit your application."
- **Buttons:**
  - **`UPLOAD MORE DOCUMENTS`** — `<button>`; **SAFE back-action** — closes the modal, returns to the APDMC doc list. (This is how to escape the gate without submitting.)
  - **`Continue to submit`** — **`A#skip.cursor-pointer`** (`href="javascript:;"`) — **THE SUBMIT GATE. Crossing this is the irreversible boundary.**

**Deliberately NOT clicked** — production VoteNow CBO account; crossing `A#skip` risks
a real junk submission to CalSAWS under VoteNow's CBO registration (a county-side
record). The gate's semantics are ambiguous (review-page vs. direct-submit — see
STEP 8) so "probably safe" is not good enough for an irreversible production action.

**This `A#skip` selector IS the extension's hard-stop boundary.** The autofill
extension must drive *up to* this modal and then **hand off to the human** — it must
NEVER auto-click `A#skip`. A human reviews and clicks submit (the whole human-in-loop
premise). Record `A#skip` in the selector-map as `submitGate` with an explicit
`neverAutoClick: true` so no future change wires it into a driver loop.

**To capture Step 8 (the only remaining node):** needs a user decision — a non-prod /
staging context, or a deliberate dummy submit-then-withdraw on a throwaway draft.
Until then, the tree is **complete up to the production-safe boundary.**

## STEP 1 demographic tail — verbatim options + explainers (captured)
- **ABGNR — gender identity.** Explainer "Why are we asking about your gender identity? If you do not want to answer this question, click Next to continue." Options: Another Gender Identity / Female / Transgender: Female to Male / Male / Transgender: Male to Female / Non Binary (Neither Male Nor Female) / I prefer not to answer.
- **ABSXO — sexual orientation.** Explainer "Why are we asking about your sexual orientation? If you do not want to answer, click Next." Options: Straight or Heterosexual / Gay or Lesbian / Bisexual / Queer / Another Sexual Orientation / Unknown / I prefer not to answer.
- **ABHSP — Hispanic/Latino/Spanish origin.** Explainer (inline): "It's optional, but it helps to assure that benefits are given without regard to race, color, or national origin. Your answers will not affect your eligibility or benefit amount." + "Why are we asking?" link. Options: Yes / No / I prefer not to answer.
- **ABRAE — race & ethnic origin.** Same optional-disclaimer inline + "What is this used for?" link. `select#Race`: American Indian or Alaskan Native / Asian / Black or African American / Native Hawaiian or Other Pacific Islander / Other or Mixed (+ likely more).

These were `discovered` stubs — now have options + explainer text. All optional (skippable via Next), human-fill / chatbot-explainable, not extension-autofilled.

## STEP 4 Income — affirmative detail sub-forms (CAPTURED — extension core data)

### ABEQH — "Are you self-employed?" `radio[name=select_group]` Yes/No
Explainer (verbatim, gig-work — chatbot gold): "This is anything you do to earn money, like freelance or independent contractor work. This might include: Owning a business / Running an online store/sales / Driving for Uber/Lyft/DoorDash/Postmates / Babysitting / Walking dogs / Hairdressing (such as a barber) / Recycling / Repairing houses / Selling cultural items / …"
- Yes → self-employment income detail (not yet walked).
- No → W-2 employer detail (ABEIC, below).

### ABEIC — W-2 job detail = `income_sources[]` TEMPLATE (the autofill prize)
Prompt: "Can you share a little more about your job?" Fields:
- `#employerName` — Employer's Name
- `#employerAddr` — Employer's Address
- `#city` — City
- `select#state` — State (full state list, default California)
- `#zipCode` — Zip Code
- `#employerPhone` — Employer's Phone
- **`select#oftenPaid` (REQUIRED)** — pay frequency: Weekly / Bi-Weekly / Semi-Monthly / Monthly / Daily / Quarterly / Semi Annually / Annually / One-Time Only → **maps `income_sources[].income_frequency`** (extension transform: monthly→Monthly, biweekly→Bi-Weekly, weekly→Weekly, annual→Annually; "irregular"→? maybe One-Time/Daily — needs decision)
- **`#payAmount` (REQUIRED)** → **`income_sources[].income_amount`**
- `#avgHour` — Average Hours per Week
- `radio[name=select_group]` Yes/No (likely "still employed?" or "more jobs?")
- repeating: one ABEIC per job; reached again per `income_sources[]` entry. Field ids stable (employerName/payAmount/oftenPaid) — extension can fill by id here (unlike the UUID-button pages).

**Extension wiring:** for each `income_sources[]` of type employment → fill ABEIC (employerName?, payAmount=amount, oftenPaid=freq-transform, avgHour?). Self-employment → ABEQH Yes branch (TODO capture). Non-work income → ABUIN Yes branch (TODO capture).

NB: `#city`/`#state`/`#zipCode` ids collide with the address pages (ABNHA/ABHAD) — same ids, different page → reinforces key-on-page+label.

## STEP 5 Expenses — amount sub-page TEMPLATE (CAPTURED — extension core data)

### ABAPH — per-expense amount page (one per checked expense on ABHEG)
Prompt e.g. "What are your Rent or Mortgage Payments? If this bill is split with someone else, only enter the amount <applicant> pays." Fields:
- `#text1` — Amount (the expense $)
- `select#dropdownoptiongroup` — How often? Weekly / Bi-Weekly / Semi-Monthly / Monthly / Quarterly / Semi Annually / Annually / One-Time Only (frequency)
- `radio[name=AmountPaidHousingExpenses_radio_dropdown]` Yes/No — "Does anyone outside your household help pay?"
- **Repeating: one ABAPH-style page per checked ABHEG expense** (Rent/Mortgage, then Gas/Electric, Water, Telephone, etc.). Maps shelter + `utility_allowance_type` $ amounts.
- positional id `#text1` reused (same as the name page) → key on page+label.

### Income flow tail (no-affirmative): ABEIS (jobs summary) → ABUIN (non-work income gate) → ABCIA (strike) → ABCIB (employment change) → ABJIS (income summary) → ABISE (complete).

## AUDIT STATUS — core extension data now CAPTURED
Both repeating detail templates the extension most needs are mapped:
- **income_sources[]** → ABEIC (employer/payAmount/oftenPaid/avgHour)
- **expense amounts** → ABAPH (amount/frequency per expense)
Plus all 8 sections' main paths, gates, branch map (17 edges), and step-1 + demographic explainers.

### Remaining for 100%
- Per-expense amount pages beyond rent (utility/water/phone/dependent-care/support — same ABAPH pattern).
- Self-employment income detail (ABEQH=Yes branch); non-work income detail (ABUIN=Yes).
- Household-Details per-category detail branches (disability/college/military/etc.).
- Member DOB/SSN/demographics; non-citizen immigration (ABDOC=No); has-SSN input (ABSSN=Yes); married→spouse.
- Review & Submit (step 8) — MANUAL capture.
- Click-to-open step-1 "?" popovers (the few non-inline ones).
Estimated reframed-tree completion now ~55-60%.

### Expenses amount flow — CONFIRMED full pattern
Per checked expense on ABHEG: **ABAPH** (amount #text1 + frequency select#dropdownoptiongroup + outside-help radio) → **ABHEX** (per-expense summary list: "Below are the X you added" — shows entry + Edit/Remove + Next). Repeats per expense type (Rent, Gas/Electric, …). Then gates: **ABCST** dependent/childcare → **ABCOC** child support → **ABSSQ** spousal support → **ABESU** expenses summary → **ABESC** complete. Maps shelter + utility (SUA) + dependent-care + support deductions.

### Income summary ABJIS — card model (how income detail is reached)
ABJIS is the income hub: cards "Jobs and Self-Employment" / "Government Support and School Aid" / "Other Income" / "In-kind Income (free or in exchange of work)" / "Yearly Income Change". Each card expands → **Add Another** → a detail sub-form (amount + frequency, same pattern as ABEIC). Re-entering Income via the hub **Update** lands here (ABJIS), not ABEIQ. Extension fills income_sources[] by: card per type → Add Another → detail. Employment detail = ABEIC (captured); gov-support/other/in-kind detail forms follow the same amount+frequency shape (not individually walked).

## SESSION-2 capture summary (2026-05-29)
Added this session: step-1 demographics (options+explainers), income job-detail ABEIC (income_sources template), self-employed gate ABEQH, full Expenses flow (ABHEG checklist → ABAPH amount → ABHEX per-expense summary → ABCST/ABCOC/ABSSQ gates → ABESU/ABESC), income card model ABJIS, 17-edge branch map. Reframed-tree completion now **~65%**. Core extension data (program, eligibility, income_sources, expense amounts) fully mapped.
Remaining for 100%: gov/other/in-kind income detail forms; household-category detail branches; member DOB/SSN; non-citizen(ABDOC=No)/has-SSN(ABSSN=Yes)/married(ABMRS) branches; **Review & Submit (step 8) — careful MANUAL capture**; click-to-open step-1 popovers.

## SESSION-3 capture summary (2026-05-29 eve) — Step 7 + the submit gate
Walked to **Step 7 Document Upload (APDMC)** and **fully characterized the step 7→8 submit-confirmation gate** — the last *structural* gap:
- **APDMC** = "Step 7 of 8", 6 response-driven suggested-doc categories (Identity / Release-of-Info ABCDM228 / Income-Employment / Rent-Lease-Mortgage / Expenses / Address), each with an UPLOAD button + ADD OTHER DOCUMENT + ADD A PERSON. Extension skips file inputs by design.
- **Submit gate modal** (raised by APDMC `Next`): title "Are you sure you're ready to submit your application?"; buttons `UPLOAD MORE DOCUMENTS` (SAFE back) and **`Continue to submit` = `A#skip.cursor-pointer`** = the irreversible submit boundary.
- **`A#skip` is the extension's hard-stop / human-handoff point** — drive up to it, never auto-click. Recorded in form-tree.json (`document-upload` now `captured` with 2 pages; `review-submit` now `gated-uncaptured`).

**The tree is now structurally complete up to the production-safe boundary.** The single remaining node — Step 8's post-gate Review/Submit page (confirmation-number + final Submit selectors) — cannot be captured on the production VoteNow CBO account without an irreversible county submission. Capturing it is a **user decision**: (a) a non-prod/staging BenefitsCal context, or (b) a deliberate dummy submit-then-withdraw on a throwaway draft. Everything else that remains (income gov/other/in-kind detail forms, household-category branches, member DOB/SSN, non-citizen/has-SSN/married branches, step-1 "?" popovers) is safely capturable in follow-up affirmative-path walks.

**Reframed-tree completion: ~70%** of the full tree; **~95% of the safely-capturable-on-production tree** (only the gated Step 8 post-submit page is out of reach without a user decision).

## EXPLAINER-CAPTURE PASS (2026-05-29 eve) — verbatim popover/accordion text
Dedicated pass to open every `?`/`i` explainer and record its text verbatim (use-case (c): chatbot dropdown explainers). Run on a fresh guest CBO application (all pre-submit, no extra credentials). **Interrupted partway when the GStack browser daemon hung** (PID stuck, needs `/open-gstack-browser` restart + BenefitsCal re-login). Captured so far + the inventory + method below so the next run resumes fast.

### Begin-flow page sequence (pre-program-selection, newly mapped)
`begin/ABOVR` (overview, advance = **`BEGIN`** button) → `ABHLT` (Helpful Tips, no inputs, Next) → `ABDEI` (Diversity, Equity & Inclusion Statement, Next) → `ABSNC` → `ABNAV` (the Application Summary hub — click **`Start`** to enter the first section). All show "Step 1 of 9" until SNAP-only collapses it to 8 at ABPRI.

### CAPTURED this pass — ABOVR begin/overview, 3 inline accordions (verbatim)
- **"What to expect?"** → "Give yourself 30 - 60 minutes to apply. Fill out as much as you can as that can speed up your application process. Be ready to share about the money you earn and the things you pay for/own. Remember, if you create an account you can save and come back later to finish."
- **"Type of documents you may need to provide"** → "You do not have to upload documents to apply. We'll let you know what you need to provide. You can come back to this website to upload them later. — Proof of identity (Driver's License, State ID card, Student ID) / Proof of income (like recent pay stubs, or unemployment benefits) / Proof of expenses (like medical costs, or child care)"
- **"Interview tips"** → "When you're done and you submit, your county will set up an interview. For food (CalFresh), you can choose between an in-person or phone interview. For cash aid (CalWORKs), you may be able to choose between an in-person or phone interview. For health coverage (Medi-Cal) you won't need to do an interview. Plan for about an hour."
- (NB: "Learn more about BenefitsCal" is a nav-link to info.benefitscal.com — NOT an explainer; skip. It has `href="Javascript:;"` but still navigates via handler, derailing the walk — capture triggers ONE AT A TIME, never batch.)

### STILL TO CAPTURE — the high-value per-question popovers (inventory)
These are the survey-question explainers the chatbot most needs; triggers known, text NOT yet opened:
- **ABPRI** — "Not sure what to choose?" (program selection)
- **ABNHA** — "What is homelessness?"
- **ABCFA** — "What is a CalFresh Authorized Representative?"
- **ABDOC** — "What do we mean by U.S. citizen?" + "What do we mean by U.S. national?"
- **ABHSD** — "How does each program define household?"
- **ABPFG** — "Why do we ask these questions?" (felony/disqualification gate)
- **APDMC** — "Not sure what to upload? Let's look at some examples."
- **ABHSP** — "Why are we asking?" (Hispanic origin) · **ABRAE** — "What is this used for?" (race) — confirm whether separate popovers vs the inline disclaimer already captured.

### METHOD (reusable) — `/tmp/pop.sh` + `/tmp/{detect,capclick,dialog}.js`
`detect` lists explainer triggers (text matches `?$`/"why are we asking"/"what is"/"not sure"/"how does"/… OR info/help/tooltip class) with `{NAV:href}` flagged. `cap N` clicks trigger #N (stable index) via full pointer-event sequence, then captures the result: a `[role=dialog]`/tooltip overlay **or** an expanded accordion (`[aria-expanded=true]`/`.mat-expansion-panel-body`). One trigger at a time; skip `{NAV}` links. To collapse an accordion before the next, re-click the same index. `adv` advances (Next/Continue/BEGIN/Start). The browse `js` tool wraps input as a single parenthesized expression — every snippet must be ONE IIFE expression (no `def; call`).

### CAPTURED — step-1 question popovers, verbatim (2026-05-29, guest walk, SNAP-only)
Walked a fresh CBO application (guest-accessible; login only gates save/submit). Begin-flow → section pages, answering minimal dummy data (name "Test Applicant", DOB 01/15/1985, Sacramento address, all gates "No", SNAP-only). 14 explainers captured verbatim:

**Begin / overview (ABOVR)** — see the 3 intro accordions above.

**ABLPR — "What's your preferred language?"**
- **"Need Language Help?"** → "Your county office can provide an interpreter for you at no cost."

**ABNMI — "Who should fill out this application?"** (Primary Applicant)
- **"Who should fill out this application?"** → "The person entered here will likely be the Primary Applicant for their household. The Primary Applicant has to submit renewals and more for their household. A person can be a Primary Applicant even if they don't apply for or get benefits. To fill out this application, you don't have to apply for benefits for yourself. You can apply for other people in your household. You'll add their details later in this application."

**ABNHA — homelessness ("Tell us more about where you currently live")**
- **"What is homelessness?"** → "This could include: Staying in a supervised shelter, halfway house, or similar place / Staying with another person or family for no more than 90 days in a row / Sleeping in a place not designed for, or normally used as, a place to sleep (a hallway, a bus station, a lobby, or similar)."

**ABPRI — program selection** (HIGH VALUE)
- **"Not sure what to choose?"** → "That's ok. Take your best guess and when you talk to your caseworker, they can help you decide. Here, you should select the programs that anybody in the household is applying for. Later, you'll add your household members and select the programs they're applying for. You can find more information about each program in the Help Center."
- Instruction line: "Select at least one. For Cash Aid, select the one that best applies to your situation."
- **Per-program inline descriptions:**
  - CalFresh (#snap): "The CalFresh Program can add to your food budget to help you put healthy food on the table."
  - CalWORKs (#tanf): "The California Work Opportunity and Responsibility for Kids (CalWORKs) gives temporary cash assistance to families who have a pregnancy or a child in the home."
  - TCVAP: "The Trafficking and Crime Victim Assistance Program (TCVAP) is a cash aid program for non-citizen victims of crime who need urgent support."
  - RCA: "The Refugee Cash Assistance (RCA) program is for non-citizens who don't qualify for other cash aid."
  - Medi-Cal (#medicaid): "Medi-Cal is free or low-cost health care for individuals (adults and children) and families. Based on your income and other criteria, you may qualify for Medi-Cal. Or, you may qualify to get help paying for private health care."

**ABCFA — CalFresh Authorized Representative**
- **"What is a CalFresh Authorized Representative?"** → "This person can: Speak for you at the interview / Help you complete forms / Report changes for you. This person should be 18 years or older."

**ABCFS — "Do you want to name someone to get and spend your CalFresh benefits for you?"** (EBT payee)
- **"What does this mean?"** → "This person can use your Electronic Benefits Transfer (EBT) card to buy food for you."

**ABCID — citizenship/immigration intro**
- **"Need more information?"** → "For more information, visit the CalFresh guide for immigrants. For more information about the California Food Assistance Program (CFAP) for non-citizens, visit CDSS."

**ABDOC — citizenship question** (HIGH VALUE, 3 explainers)
- **"What do we mean by U.S. citizen?"** → "U.S. citizens include: Those born in the U.S. / Those born outside of the U.S. to at least one U.S. citizen parent who lived in the U.S. for a certain period of time. / Those who have been naturalized. This means they became a citizen after meeting certain requirements."
- **"What do we mean by U.S. national?"** → "[U.S. nationals include:] Those living in the Northern Mariana Islands who choose not to become U.S. citizens / Those with at least one parent who is a U.S. national."
- **"Why are we asking?"** → "The county needs to know the immigration status of the people in your household to see: Who is eligible for benefits / How much benefits your household may qualify for. Your information won't be shared with immigration enforcement. You can apply for and get benefits for people who are eligible, even if your household includes those who aren't eligible. For example, parents with ineligible immigration statuses may apply for benefits for their U.S. citizen or eligible immigrant children. For more information, visit the CalFresh guide for immigrants."

### Method gotcha learned
Collapsing an accordion **shifts trigger indices** — `cap N` after a collapse can hit a different element (twice landed on the "Learn more about BenefitsCal" nav-link → info.benefitscal.com, derailing the walk). Fix: re-`detect` before every `cap`, or never collapse mid-page (just leave accordions open and read the newest block).

### STILL TO CAPTURE (after this pass)
- **ABHSD** "How does each program define household?" (step 2 / People gate — needs a draft walked to step 2)
- **ABPFG** "Why do we ask these questions?" (step 6 / Other Situations felony gate — deepest; needs steps 1-5 completed incl. income/expense required amounts)
- ✅ **APDMC** "Not sure what to upload?" — DONE (→ DOC-VERIFICATION-REFERENCE.md, the 14-category Help page)
- Demographic popover-vs-inline confirm (ABGNR/ABSXO/ABHSP "Why are we asking?" / ABRAE "What is this used for?") — inline disclaimer text already captured; confirm whether a separate popover exists.

**Pass result: 15 explainers verbatim + the full doc-verification reference; 6 of 7 form-tree helpLink stubs filled.** Only ABHSD + ABPFG remain (both behind deep walks). Every explainer on the early application (the part most applicants see, plus the eligibility-critical program + citizenship questions) is now captured.
- New page codes seen this walk (not yet in form-tree): ABLPR, ABNMI(primary), ABMAD, ABCON, ABCOP, ABCSD (skip-and-submit upsell), ABDIS, ABCOS, ABCFA, ABCFS, ABRDT (DOB = `birthDate_primary_input`), ABMRS, ABCID, ABDOC. Address modal v2: radios `sugg_adr`/`ent_adr` + `USE SELECTED ADDRESS`.
