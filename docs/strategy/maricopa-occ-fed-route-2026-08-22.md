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

## Open

- Western Alliance's next strategic plan (the 2024+ period) sets new annual Goal Four
  targets and is **published for public comment**. Find it — it states the dollar figure the
  bank must hit in Maricopa, which is the single most useful number in this pitch.
- AZ charitable solicitation registration is a send gate and has not been researched.
