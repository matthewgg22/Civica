# Maricopa County: the OCC and Federal Reserve route

**Date:** 2026-08-22
**Scan record:** `data-ops/analysis/bank-pe-mining/maricopa_occ_fed_2026.csv` (7 institutions, all outcomes recorded including negatives)

## Why this pass existed

Maricopa County is the **4th largest SNAP enrollment gap in the country**. The FDIC pass
found essentially nothing there: a single pressured bank, Zenith Bank & Trust, at $110M in
assets — below the point where a grant can fund a campaign.

That was a **coverage limit of the instrument, not an absence of banks**. CRAPES is the
FDIC's system and returns only FDIC-supervised institutions. Most large Phoenix
institutions are supervised by the OCC or the Federal Reserve and are therefore invisible
to it. Maricopa looked empty because we were looking through the wrong window.

## Result

**One target, and it is the strongest institution in the roster: Western Alliance Bank.**

| | |
|---|---|
| Regulator | Federal Reserve (RSSD 3138146, FDIC cert 57512) |
| Assets | $98.8B |
| Exam | May 27, 2025 — published **Aug 10, 2026**, the most recent PE we hold |
| Method | **Strategic Plan** |
| Overall | Satisfactory |
| Phoenix AA | *"consists of Maricopa and Pinal counties in their entirety"* |
| CD donations in the Phoenix AA | **$1,775,328** over the 2021–2023 plan period |

### Why a Strategic Plan bank is a different — and better — pitch

Every other bank in the roster is pitched on **component-rating pressure**: an Investment
or Service Test rated Low Satisfactory that our activity feeds. Western Alliance has no
component ratings at all. Under a strategic plan the bank negotiates measurable goals with
the Federal Reserve and **publishes them for public comment**; performance is measured
against those numbers.

**Goal Four is literally "Dollar amount of donations made to qualified community
development organizations."** There is no interpretive step between a grant to us and the
bank's exam. It is a dollar target, and the grant is a dollar.

### The honest opening

The PE reads as praise — Phoenix donations cleared the *aggregate* outstanding goal. Read
the annual series instead:

| 2021 | 2022 | 2023 | Outstanding interim goal, 2023 |
|---|---|---|---|
| $606,127 | $702,789 | **$466,412** | $498,112 |

Donations fell **34% year over year** and 2023 was the only plan year that landed **below**
the outstanding interim goal. The aggregate hid it. That declining run-rate — carried into
a fresh plan period with new annual goals — is the opening, not a rating deficiency.

Separately, Goal One (small business lending by dollar volume) was **not met** at the
satisfactory threshold in Phoenix.

### Ask: $25,000

$25K is ~4% of one year's Phoenix CD donations. **This is the first bank in the roster
where the ask is not constrained by the bank's grant budget** — every prior ask was capped
by demonstrated giving (Helm's entire program was $25,161 over 3.2 years). The constraint
here is our own absence of a service record, which is an argument for term and a year-two
step-up, not for a larger first ask.

## The negatives, recorded

Six institutions were scanned and rejected. They are in the CSV so a later pass does not
redo the work:

- **USAA Federal Savings Bank** (OCC, $109.7B, Phoenix HQ) — **0 mentions of Maricopa** in
  its PE. A Phoenix headquarters is not an assessment area. Outstanding overall.
- **BNC National, Southwest Heritage** — Satisfactory, small-bank/ISB evaluations with a
  Lending or CD test only. No Investment or Service component exists to be pressured.
- **Goldwater Bank, West Valley National** — Maricopa *is* in their assessment areas, but
  both are Satisfactory with no component gap, and West Valley at $80M is below the
  minimum-viable-grant floor.
- **Zenith Bank & Trust** (FDIC) — Needs to Improve and Maricopa-only, but $110M in assets
  caps the ask near $2,500.

## Method notes for the next pass

1. **The Federal Reserve CRA search is a better instrument than CRAPES** and was not being
   used. It POSTs to `/apps/CRAPubWeb/CRA/BankRatingResult` and filters *directly on
   Investment and Service test ratings* — the exact screen this channel needs. Send the
   form's own defaults (`"0"` for All, except `ExamMethod:"All"`); wrong values return 500.
   PEs download from `/apps/CRAPubWeb/CRA/DownloadPDF/{RSSD}_{YYYYMMDD}`.
2. **Do not brute-force the PE date.** 320 date candidates for Western Alliance returned
   nothing; the search result hands you the exact path.
3. **OCC HEAD requests are unreliable** — they reported "no evaluation" for 6 of 7 charters
   including one already downloaded. Use `GET` with `Range: bytes=0-199` and accept 206.
4. **The FDIC BankFind API has moved** to `https://api.fdic.gov/banks/institutions`;
   `banks.data.fdic.gov` now 301s. Follow redirects.
5. **A state-level search returns dead institutions unmarked.** The AZ result set was mostly
   defunct state member banks (Arizona Bank 1999, Gold Canyon 2008, M&I Thunderbird 1999).
   Search by name or RSSD when you know the institution.

## The 2024–2026 plan — found

**Source:** the Federal Reserve hosts it directly —
`federalreserve.gov/consumerscommunities/files/western-alliance-bank-strategic-plan.pdf`
(covers Jan 1 2024 – Dec 31 2026). Full goal table extracted to
`data-ops/analysis/bank-pe-mining/western_alliance_plan_2024_2026.csv`.

**Donations were renumbered Goal Three** in this plan (they were Goal Four in the
2021–2023 plan the PE evaluated). Cite the right one.

### The Phoenix number

| Phoenix AA (Maricopa + Pinal) | 3-year goal | Interim annual |
|---|---|---|
| Satisfactory | $1,733,875 | **$465,000 – $695,000** |
| Outstanding | $2,167,344 | **$580,000 – $865,000** |

Set their 2023 actual of **$466,412** against that:

- **$1,412 above the satisfactory floor.** Not comfortably satisfactory — *barely*.
- **$113,588/yr short** of the bottom of the outstanding band.
- The goal **escalates 5% in each of years two and three**, so standing still loses ground.

**A $25,000 grant closes 22% of the gap between where they are and outstanding.** That is a
far sharper ask than "4% of annual giving," and it is the bank's own published number rather
than our inference. The $25,000 ask is unchanged — what changed is that it can now be
justified arithmetically.

### The finding that is bigger than Maricopa

Western Alliance delineates **nine full-service assessment areas plus three limited-service
areas**, and between them they cover **five of the seven counties on our ranked target list**:

| County | National gap rank | Western Alliance AA | Usable? |
|---|---|---|---|
| Los Angeles | 1 | Greater Los Angeles (full-service) | **yes** — $125–190K/yr donation goal |
| Harris | 2 | — | **no** — the Houston AA never took effect (below) |
| Cook | 3 | Chicago (limited-service) | weak — no standalone donation goal |
| Maricopa | 4 | Phoenix (full-service) | **yes** — the anchor |
| Kings | 5 | New York (limited-service) | weak — no standalone donation goal |
| Clark | — | Las Vegas (full-service) | **yes** — $250–380K/yr donation goal |

One relationship reaches Maricopa, Los Angeles and Clark on full-service terms. That is a
different shape of channel than one-bank-per-county, and it argues for pitching Western
Alliance as a **multi-AA funder** rather than as the Maricopa bank.

### Houston and Atlanta never opened — verified

The plan lists Atlanta and Houston as assessment areas **proposed** contingent on
limited-service branches opening, unconfirmed as of Sept 29 2023. They did not open.

FDIC structure data pulled **2026-08-24** (`api.fdic.gov/banks/locations`, `RUNDATE
08/24/2026`) returns **38 offices: NV 15, CA 11, AZ 9, CO 1, IL 1, NY 1**. There is no Texas
office and no Georgia office; the newest office anywhere is San Francisco, opened Jan 2026.

**Harris County — the 2nd largest SNAP enrollment gap in the country — is NOT in a Western
Alliance assessment area.** Any claim otherwise is wrong. Harris still needs its own funder.

**Two further limits.** Greater Los Angeles carries a *smaller* donation goal than Phoenix
($472,875 vs $1,733,875 over three years) despite being the larger need — Phoenix is the
headquarters. And the limited-service areas (Chicago, New York, Denver) have **no standalone
donation goal at all**: LSB Goal 1 is combined CD loans/investments/donations at 1.0%
(satisfactory) or 1.5% (outstanding) of prior-year deposits, a figure lending dominates, so
a grant barely moves it.

### A dated opportunity

CRA regulations require a strategic-plan bank to publish notice and **solicit written public
comment for at least 30 days** before submitting a plan. For the current plan, comments were
due **October 30, 2023** — that window is closed.

The plan expires **December 31, 2026**. The successor 2027–2029 plan must therefore go
through its own public-comment period, and on the last cycle's timing that notice runs in
**roughly September–October 2026 — i.e. now**. That is a real regulatory mechanism for
putting SNAP enrollment on the record as an assessment-area community need *before* the
bank's donation goals are set for three years. Watch for the notice; the contact of record
is Craig Robinson, Head of Community Relations, 1 East Washington Street, Suite 1400,
Phoenix AZ 85004, (408) 689-8417.

## Open

- ~~Verify whether the Houston and Atlanta branches opened.~~ **Closed 2026-08-24: they did
  not.** Harris County remains uncovered and needs its own funder.
- **Watch for the 2027–2029 plan notice** (expected ~Sept–Oct 2026) and comment.
- AZ charitable solicitation registration is a send gate and has not been researched.
