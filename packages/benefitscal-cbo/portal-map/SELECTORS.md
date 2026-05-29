# BenefitsCal CBO Portal — Live Selector Map

Captured 2026-05-28 by walking the production CBO portal as an approved CBO
(Matthew Greer-Gentis account). Work-in-progress — sections filled as the
walk progresses.

## Architectural findings (apply globally)

- **Framework:** React app on top of CalSAWS "lift-ux" component library.
- **Button selectors:** all `<button>`s carry random UUID `id`s
  (`lift-ux-id-<uuid>`). Do **not** select buttons by `id`. Select by visible
  text or ARIA label: Playwright `getByRole('button', { name: '...' })`.
- **Input selectors are inconsistent:**
  - Some inputs have descriptive `id`/`name` (`#primarylang`, `#addressLine1`,
    `#city`, `#state`, `#zip5`).
  - Others use **positional** names (`#text1`, `#text2`, `#text3`, `#text4`
    on ABNMI — first/middle/last/other-name). These will silently break if
    the portal reorders fields.
  - **Recommended strategy:** `getByLabel('First Name')` for every input.
    Stable across portal layout changes; fail loudly if the label disappears.
- **React-controlled inputs:** plain `el.value = "x"` is ignored by React's
  state. Must use the native setter from
  `HTMLInputElement.prototype` + dispatch `input` and `change` events.
  Playwright's built-in `page.fill()` handles this natively; only matters if
  you write a custom driver.
- **Step structure** is 9 portal steps (does NOT match our submitter.ts's 9
  abstract steps a–i). Portal: Your Information → People → Household Details
  → Income → Expenses → Assets → Other Situations → Document Upload →
  Review & Submit. Step labels in nav use "Review & Submit" with `&`; the
  ABNAV summary row's aria-label uses "Review and Submit" with `and`.
- **Address-validation modal**: when USPS can't validate the address, a
  modal pops with "USE THIS ADDRESS" vs "Correct my address". Submitter
  must click "USE THIS ADDRESS" then click Next again.
- **15-minute inactivity TTL** on draft data per ABHLT page copy. Submitter
  must complete one application end-to-end without pauses.
- All page URLs use 5-letter codes: `/ApplyForBenefits/XXXXX`.
- **Page-to-page advance**: each form sub-page has a single `Next` button
  that triggers in-page validation, then navigates. Use
  `getByRole('button', { name: 'Next' })`.

## URL map (entry → flow)

| URL | Purpose | Has form? |
|---|---|---|
| `/CBO/CBDAS` | Post-login CBO dashboard | no |
| `/ApplyForBenefits/begin/ABOVR` | Overview ("What to expect") | no — `BEGIN` button |
| `/ApplyForBenefits/ABHLT` | Helpful Tips info page | no — `Next` |
| `/ApplyForBenefits/ABDEI` | Diversity-Equity-Inclusion statement | no — `Next` |
| `/ApplyForBenefits/ABSNC` | ? (passed through) | no |
| `/ApplyForBenefits/ABNAV` | **Application Summary hub** — 9 `Start` buttons | no |
| `/ApplyForBenefits/ABLPR` | Step 1.1 — Language preferences | YES (3 selects) |
| _(more to come)_ | | |

## Step 0 — Login

- Login URL: `https://benefitscal.com/cbo/login` (UNVERIFIED — Matt
  navigated himself; verify by signing out and back in)
- **Post-login URL: `/CBO/CBDAS`** (not `/cbo/dashboard` as our code assumes
  at `submitter.ts:142`)

## Step (a) — Start new application

From `/CBO/CBDAS`:
- **New Application button:** `getByRole('button', { name: 'New Application' })`
  (visible text " New Application", random UUID `id`, class
  `ux-btn ux-btn-primary`)
- After click → `/ApplyForBenefits/begin/ABOVR?lang=en`

From `ABOVR`:
- **BEGIN button:** `getByRole('button', { name: 'BEGIN' })`
  (class `ux-btn ux-btn-primary float-right`)
- After click → `/ApplyForBenefits/ABHLT`

From `ABHLT` (Helpful Tips) and `ABDEI` (DEI):
- **Next button:** `getByRole('button', { name: 'Next' })`
- Chain: ABHLT → ABDEI → ABSNC → ABNAV

## ABNAV — Application Summary hub (sticky)

ARIA labels disambiguate the 9 Start buttons:
- `getByRole('button', { name: 'Start Your Information' })`
- `getByRole('button', { name: 'Start People Not Available' })` (disabled until §1 done)
- `getByRole('button', { name: 'Start Household Not Available' })` (note: aria says "Household", not "Household Details")
- `getByRole('button', { name: 'Start Income Not Available' })`
- `getByRole('button', { name: 'Start Expenses Not Available' })`
- `getByRole('button', { name: 'Start Assets Not Available' })`
- `getByRole('button', { name: 'Start Other Situations Not Available' })`
- `getByRole('button', { name: 'Start Document Upload Not Available' })`
- `getByRole('button', { name: 'Start Review and Submit Not Available' })`

Sections unlock sequentially. After completing each section, portal
returns to ABNAV (TBC — assumption).

## Step 1 — Your Information

### 1.1 ABLPR — Language preferences (all OPTIONAL — can skip with Next)

- `select#primarylang` — "What language do you prefer to read?"
- `select#spokenlang` — "What language do you prefer to speak?"
- `select#applang` — "In what language would you like to complete this application?"

Each select has ~45 language options. Not in `BenefitsCalPayload` schema —
default to skip (leave blank) unless we add language preferences to intake.

### 1.2 ABNMI — Applicant name

- `getByLabel('First Name (required)')` → input `#text1` (positional!)
- `getByLabel('Middle Name')` → `#text2`
- `getByLabel('Last Name (required)')` → `#text3`
- `getByLabel('Suffix')` → `select#suffix`
- `getByLabel('Other Names')` → `#text4`

### 1.3 ABNHA — Home address

- `getByLabel('Yes')` / `getByLabel('No')` for "Are you experiencing homelessness?"
  (radios `#radioCard_0` / `#radioCard_1`, name=`radioCard`)
- `getByLabel('Address Line 1 (required)')` → `#addressLine1`
- `getByLabel('Address Line 2')` → `#addressLine2`
- `getByLabel('City (required)')` → `#city`
- `getByLabel('State')` → `select#state` (option values appear to be 2-letter codes, e.g. `CA`)
- `getByLabel('Zip Code (required)')` → `#zip5`
- **Modal handling**: if USPS can't validate, click
  `getByRole('button', { name: 'USE THIS ADDRESS' })`, then click Next again.

### 1.3 ABNHA — **2-modal address-validation flow** (RESOLVED)

When USPS can't validate the address, BenefitsCal pops **two consecutive modals**:

1. **Modal #1 — "Can't validate"**: click `getByRole('button', { name: 'USE THIS ADDRESS' })`. Modal closes.
2. **Modal #2 — "What county?"** (the gotcha we missed first walk): select county
   via `select#county` (name=`county`). Option values are 2-digit ordinal codes
   (Alameda=`01`, Sacramento=`34`, etc. — alphabetical CA county index). Then
   click `getByRole('button', { name: 'CONTINUE' })` (uppercase). Modal closes.
3. Then click `Next` to advance to ABMAD.

**Schema gap:** `PostalAddress` has no `county` field. Required by portal
when USPS validation fails (which is common). Either:
- Add `county` to `PostalAddress` (FIPS code or full name → mapped to ordinal at fill time), OR
- Compute county from ZIP via lookup table (USPS has ZIP→county), OR
- Always supply (Civica intake already needs county for SNAPAgencyDirectory routing).

### 1.4 ABMAD — Mailing address differs?

- `radio[name=mailadr1_radio]` → `#mailadr1_radio_0`=Yes / `#mailadr1_radio_1`=No
- If Yes: presumably reveals a second address form (not walked — picked No).

### 1.5 ABCON — Contact info (all OPTIONAL)

- `#homePhone` / `#mobilePhone` / `#altPhone` / `#mail` (text inputs, descriptive names)

### 1.6 ABCOP — Communication opt-in (all OPTIONAL)

- `input[type=checkbox]#mail` — Email alerts (note: id collides with ABCON's email input but on different page)
- `input[type=checkbox]#phone` — Text alerts
- `input[type=checkbox]#acceptance_agreement` — TCPA acknowledgment

### 1.7 ABPRI — **Program selection** (REQUIRED, critical)

- `input[type=checkbox]#snap` — CalFresh (Civica always checks this)
- `input[type=checkbox]#tanf` — Cash Aid (CalWORKs/TCVAP/RCA)
- `input[type=checkbox]#medicaid` — Medi-Cal
- Plus required radio `name="label"` → `#label_0`=Yes, `#label_1`=No, asking
  "Are you applying for benefits for yourself?" (CBO usage: typically Yes —
  the applicant is the beneficiary; CBO is just helping submit).

**Big finding:** when only `#snap` is checked, **portal omits the Assets
step entirely** (CA BBCE bypass). Task #12 (Assets selectors) is moot
for SNAP-only flows — only confirm if `#tanf` or `#medicaid` is added later.

### 1.8 ABCSD — "Skip and submit now" upsell (no inputs)

- Two buttons: `getByRole('button', { name: 'CONTINUE APPLICATION' })`
  (continue normal flow) vs link "Skip and submit now (not recommended)".
- Submitter always picks CONTINUE APPLICATION.

### 1.9 ABDIS — Disability accommodation

- `radio[name=disability]` → `#disability0`=Yes / `#disability1`=No
  ("Need help to apply?")
- `radio[name=deaf]` → `#deaf0`=Yes / `#deaf1`=No
  ("Deaf or hard of hearing?")
- Both optional. **Schema gap if Civica wants to flag accessibility needs.**

### 1.10 ABCOS — College student status (REQUIRED for SNAP eligibility)

- `radio[name=CollegeStudentE_radio_button]` → `_0`=Yes / `_1`=No
- **Schema gap.** College students have restrictive SNAP rules — Civica
  intake should already know this; needs to flow through to payload.

### 1.11 ABCFA — CalFresh authorized representative (case rep)

- `radio[name=filingTax]` (id name is misleading — portal bug?) →
  `#filingTax_0`=Yes / `#filingTax_1`=No
- **CBO usage relevant** — CBO might want to register themselves as auth rep
  to receive case correspondence. Default: No.

### 1.12 ABCFS — Benefits-spend authorized representative

- `radio[name=select_group]` → `#select_group_0`=Yes / `#select_group_1`=No
- Different from ABCFA: this is for who can USE the EBT card, not who
  manages the case. Default: No.

### 1.13 ABRDT — Date of birth

- Input id `#birthDate_primary_input` — **`type="password"`** (intentional;
  prevents browser autofill).
- Format: `MM/DD/YYYY` (US-style with slashes — confirmed).
- No `name` attribute → use id or `getByLabel('Date of Birth (required)')`.
- Required.

### 1.14 ABSSN — SSN existence question

- `radio[name=SSN_IND]` →
  - `#ssn_group0` = Yes (SSN exists; next page would ask for it — not walked)
  - `#ssn_group1` = No (no SSN)
  - `#ssn_group2` = "I don't have it right now"
- Civica payload has `ssn_last4` — if present, pick `ssn_group0`; otherwise
  `ssn_group2`. Walking ssn_group0 branch needed to capture the SSN input page.

### 1.15 ABNSN — Why no SSN (only if ABSSN ≠ Yes)

- **Single `<select>` with `id="lift-ux-id-<uuid>"`** — first UUID-id select
  encountered. MUST use label-based locator. The label text is
  "Reason for not having a Social Security Number".
- Options (value → text):
  - `01` Adoption Taxpayer ID / ITIN
  - `02` Religious Exemption
  - `03` Does not qualify, or only issuable for non-work reason
  - `05` I have applied for an SSN
  - others (Other = ?)

### 1.16 ABMRS — Marital status (optional)

- `radio[name=maritalStatus]` indexed 0-7:
  - `_0` Common Law, `_1` Divorced, `_2` Married, `_3` Never Married,
  - `_4` Registered Domestic Partner, `_5` Separated, `_6` Single, `_7` Widowed
- **Schema gap** if Civica wants to capture this.

### 1.17 ABCID — Citizenship intro (no inputs, just Next)

### 1.18 ABDOC — Citizenship Yes/No (REQUIRED for SNAP eligibility)

- `radio[name=citizen_radio]` → `#citizen_radio_0`=Yes / `_1`=No
- Note URL is ABDOC — not the step-8 Document Upload (different code).
- **Schema gap.** Non-citizen branch (not walked) likely asks for immigration
  status, alien #, sponsor info — eligibility-critical.

### 1.19 ABBID — "Background questions" intro (no inputs)

### 1.20 ABASX — Sex assigned at birth (optional)

- `radio[name=assignedSex]` → `_0` Female / `_1` Male / `_2` I prefer not to answer

### 1.21 ABGNR — Gender identity (optional)

- `radio[name=gender]` indexed 0-6 (7 options, not enumerated).

### 1.22+ — TBD

Walk paused after 17 sub-pages of step 1 alone. Side-nav still shows step 1
("People" through "Review and Submit" still Not Available/Not Reviewed) —
so step 1 isn't even complete. Likely remaining step 1 sub-pages: ethnicity,
race, primary language follow-ups, voter registration, military service,
maybe more. Then step 2 (People) starts adding household members.

---

## Pace data

17 sub-pages walked in step 1 — and section nav still shows step 1 incomplete.
Realistic estimate: 50-80 more sub-pages across all 8 remaining sections.
Each sub-page is ~30-60 seconds of automated walk including round-trips.
Total: 30-60 more minutes if walked end-to-end with automation.

---

## Schema-coverage gaps surfaced so far

Portal asks for things our `BenefitsCalPayload` doesn't have:

1. **Preferred read/speak/application language** (3 fields on ABLPR)
2. Anything in **Household Details** (TBD)
3. Anything in **Assets** (TBD)
4. Anything in **Other Situations** (TBD)

Decisions needed once walk is complete:
- Extend `BenefitsCalPayload` to cover these, or
- Hard-code sensible defaults in the submitter, or
- Surface as packet-level questions during intake.
