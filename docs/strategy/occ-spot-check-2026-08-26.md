# OCC spot check — the banks no index can cover

**2026-08-26.** The staleness guard runs off `current_exams.json`, built from FDIC CRAPES and
the Federal Reserve CRA search. **Neither contains OCC banks.** The OCC publishes no
searchable component ratings — its "CRA Search" is a Google Custom Search over PDFs — so an
OCC bank can only be checked once its charter number is already known. These records are
therefore checked by hand.

## First correction: only three of the five are OCC

| Bank | Recorded | Actually |
|---|---|---|
| Woodforest | OCC | ✅ OCC, charter 16892 |
| Northfield | OCC | ✅ OCC, charter 718063 |
| City National | OCC | ✅ OCC, charter 14695 |
| **Bank Irvine** | OCC (assumed) | ❌ **FDIC** |
| **Mega Bank** | OCC (assumed) | ❌ **FDIC** |

Irvine and Mega were absent from the addressable universe because **Small Bank and ISB
evaluations were filtered out**, not because they are OCC. Calling them OCC was my inference
from their absence — the wrong conclusion from the right observation.

## Method

URL form: `www.occ.gov/static/cra/craeval/{Mon}{yy}/{charter}.pdf` — capitalised month, and
the `www.` matters. A ranged `GET` (`Range: bytes=0-199` → 206) is the signal; **HEAD is
unreliable against this host.**

**109 month/charter combinations probed**, each bank from its recorded PE month through
August 2026.

## Results

| Bank | Charter | Only PE published | Document opens | Verdict |
|---|---|---|---|---|
| Woodforest | 16892 | `Oct23/16892.pdf` | "PUBLIC DISCLOSURE **May 22, 2023**" | ✅ current |
| Northfield | 718063 | `Oct23/718063.pdf` | "PUBLIC DISCLOSURE **May 15, 2023**" | ✅ current |
| City National | 14695 | `Apr24/14695.pdf` | "PUBLIC DISCLOSURE **March 27, 2023**" | ⚠️ **date wrong** |

**No newer evaluation exists for any of the three.** Note the folder month is the
*publication* month, not the exam month — the same public-versus-exam distinction that
produced 18 false staleness alarms in the Fed pull.

## Second correction: a publication month stored as an exam date

**City National's record held `2024-04-01`** — the OCC publication folder (`Apr24`) written
down as though it were the exam date. The evaluation is dated **March 27, 2023**. The artifact
was telling the bank *"your April 2024 CRA Performance Evaluation"* about a March 2023
document — wrong on a fact the reader can verify in one click, in the first sentence
addressed to them.

**Mega Bank had the same defect from the other source**: `2025-05-01` was the CRAPES *public*
date; the PE opens "PUBLIC DISCLOSURE January 21, 2025".

Both corrected, with the prior value and the reason recorded on the record.

## A near-miss worth keeping

**Hanmi** looked wrong too — roster `2023-06-05` against a CRAPES file id encoding `230606`.
The PE itself opens "PUBLIC DISCLOSURE June 5", so **the roster was right and the file id is
off by one day**. File-id dates are close but not exact, and the document text wins. Had I
"corrected" the roster to match the file id, I would have introduced an error while cleaning
up errors.

## Guards added

- OCC banks on the roster must carry an explicit `pe_verified_current_against` note naming
  the archive probe. Absence from the exam index can never satisfy the check.
- `city_national` and `mega_bank` are pinned to their true exam dates, and any record whose
  date was changed must carry a `CORRECTED` note explaining why.

## Standing limitation

There is no way to be notified of a new OCC evaluation. The check is a month-by-month probe
per charter and must be re-run periodically. **Woodforest and Northfield are both on May 2023
exams and are the likeliest of the roster to turn over next.**
