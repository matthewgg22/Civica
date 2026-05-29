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
