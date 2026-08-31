# The Federal Reserve pull — and the superseded evaluation it caught

**2026-08-26.** Data: `data-ops/analysis/cra-universe-2026/fed_universe_2026.csv` (434) and
`fed_universe_ranked_2026.csv`. Exam index: `tools/cra-artifact/inputs/current_exams.json`.

## How it works

The Fed's CRA search (`POST /apps/CRAPubWeb/CRA/BankRatingResult`) needed two corrections to
what we had on file: `SearchClick` is **`F`**, not `1`, and every unset select must carry its
default (`0`, or `All` for `ExamMethod`) rather than being blank — an empty select returns a
500.

Two properties made a full pull cheap:

- **`ExamMethod` is a filter**, so Large Bank and Intermediate Small Bank partition directly.
- **Component ratings are not shown in results, but *are* filterable.** Querying once per
  rating value and tagging what comes back recovers Investment and Service per bank — 134 of
  135 Large banks resolved this way, and all 281 ISBs on the Community Development Test.

Results page at 30 over a session cookie (`?page=N`), so each query gets its own jar and is
drained to exhaustion.

## What is there

| Exam method | Count |
|---|---:|
| Intermediate Small Bank | 281 |
| Large Bank | 135 |
| Strategic Plan | 10 |
| Wholesale | 6 |
| Limited Purpose | 2 |
| **Total addressable** | **434** |

**140 have branches in a top-60 unserved county** — 65 Large (37 service gap, 28 clean) and
62 ISB.

**Head of the queue.** Service gap: **Regions Bank** (255 branches, Harris, exposure 344,778)
· Simmons · Centennial · NBH · PlainsCapital. Clean service, i.e. peer candidates:
**First Horizon** (100 branches, High Satisfactory) · **Frost Bank** (143) · **Commerce Bank**
(Outstanding, 78).

**The Fed exposes the ISB Community Development Test rating**, which the FDIC does not — 807
of 931 FDIC ISBs carry no component rating at all. It is a coarse signal (Outstanding /
Satisfactory / Needs to Improve, with no High–Low split), but it is more than we had.

## What it caught: Busey

**Busey Bank was about to be sent a letter quoting a finding it had already fixed.**

Its artifact was built on the March 25, 2022 evaluation, which found the bank had *"no
branches, limited service facilities, or ATMs within low- and moderate-income areas"* in the
Chicago MD. The **October 14, 2025** evaluation, read directly from the PDF, states:

> "The Investment Test is rated: **Outstanding** The Service Test is rated: **High Satisfactory**"

The deficiency is resolved. Busey moves from a **remediation** pitch to a **peer** pitch,
anchored on its own disclosed Chicago figure — *"the bank made 398 donations totaling $1.4
million to organizations within the assessment area"* — and the 2022 quote is deleted from
the record.

**It hid for two reasons, both now guarded:**

1. **Busey is a state member bank supervised by the Federal Reserve.** The roster said FDIC.
   The FDIC pull could never have surfaced the 2025 exam, and the CRAPES row for cert 16450
   still shows the 2022-vintage-defect value "Substantial Non Complianc".
2. **CRAPES publishes the *public* date, not the exam date.** Comparing a roster exam date
   against `EXM_CRA_PUB_DTE` flags almost everything as stale — my first pass raised **18**
   false alarms. The true exam date is encoded in the file id (`…_YYMMDD.PDF`). Corrected,
   the roster had exactly **one** genuinely superseded record.

## A false alarm worth recording

`firstbank_tn` also appeared superseded — because a normalised-name match sent FirstBank of
Nashville to **First Bank of Waverly, Iowa** (RSSD 376442). Checked by identifier, FirstBank's
RSSD 436159 is absent from the Fed pull and cert 8663's newest CRAPES exam is the 2022-06-06
one already on file. **The staleness guard matches on cert and RSSD only, never on name.**

## The guard

`inputs/current_exams.json` holds 1,345 exam dates by cert and 434 by RSSD. `test_staleness.py`
fails the build if any sendable bank's artifact rests on an evaluation older than the newest
known exam, if Busey regains its resolved quote, or if a record names a regulator that the
Fed index contradicts.

**One limit stated in the file itself:** OCC banks appear in neither source, so **absence from
this index is not evidence that a PE is current.** Woodforest, Northfield, City National,
Bank Irvine and Mega are all OCC and cannot be staleness-checked at all.

## Coverage now

| Regulator | Active | Addressable found | Status |
|---|---:|---:|---|
| FDIC | 2,662 | 1,347 | ✅ complete |
| **FED** | **699** | **434** | ✅ **complete** |
| OCC | 878 | — | ⚠️ permanent blind spot |

**1,781 addressable institutions, against 151 at the start of the day.** The only remaining
gap is the OCC, which publishes no searchable component ratings — 200 large-bank-sized
institutions reachable only one name at a time.
