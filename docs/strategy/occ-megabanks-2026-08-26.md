# The OCC megabanks — the first three read

**2026-08-26.** Twenty OCC-supervised banks hold over $100B, nineteen of them rated
Outstanding. None was reachable by any query we ran before today. Three are now read.

| Bank | Assessment area | Disclosed AA giving | Status |
|---|---|---|---|
| **JPMorgan Chase** | Los Angeles CSA | **$22,800,000** | ✅ loaded, peer, $25,000 |
| **Bank of America** | Los Angeles CSA | **$17,600,000** | ✅ loaded, peer, $25,000 |
| **Wells Fargo** | Los Angeles CSA | **$80,000,000** | ⛔ blocked on its county delineation |

**Chase's $22.8M is now the largest disclosed assessment-area giving on the roster**,
displacing Woodforest's $17.8M. Bank of America sits third.

## The figure that matters is never the big one

Every one of these evaluations reports **qualified investments** by assessment area in a
table and the **grants-and-donations subset** in prose inside the same section. The two differ
by two orders of magnitude:

| Bank | AA investments | AA grants and donations |
|---|---:|---:|
| Chase, LA CSA | $1,917,505,000 | **$22,800,000** |
| Bank of America, LA CSA | $1,200,000,000 | **$17,600,000** |
| Wells Fargo, LA CSA | $1,400,000,000 | **$80,000,000** |

Taking the table figure would have overstated capacity roughly eightyfold and produced an ask
built on a number that has nothing to do with grantmaking.

## The wrong-AA trap fired for a sixth time

A first pass on Wells found *"106 grants and donations totaling $5.5 million"* shortly after a
mention of Los Angeles and nearly recorded it. **That figure belongs to the Fresno CSA.** The
mention it followed was a summary line naming several full-scope areas at once; the section
that actually opens with the assessment area's own name gives Los Angeles **$80 million**.

Re-reading anchored on the section heading rather than the nearest mention also produced
something better than one figure: Wells discloses giving for roughly **75 assessment areas** —
Washington CSA $164.2M, New York CSA $95.7M, San Jose $88.5M, Philadelphia $51M, Phoenix
$19.9M, Dallas $14.5M — a ready-made pipeline across most of the counties on the depth table.

## Wells is blocked on one fact

Its **giving figure is confirmed AA-scoped** and its California ratings are read verbatim
(Investment Outstanding, Service High Satisfactory). What is missing is the **county
delineation**: Wells does not state its Los Angeles CSA counties in a form this pass could
extract, and the counties on the record are borrowed from Chase and Bank of America.

A peer artifact names the assessment area's counties, so it must not be built on borrowed
ones — Frost's Houston area excludes four counties that three other banks include. Blocked
until Wells' own delineation is read.

## A guard whose premise changed

`test_occ_banks_carry_a_hand_verification_note` required the string "OCC archive probed",
because until today the only way to check an OCC bank was a month-by-month probe of the PDF
archive. **The API exists**, so it now accepts either route. What remains forbidden is
unchanged: absence from the FDIC/Fed exam index is never evidence that a PE is current.

## Roster

**32 sendable, $589,500** — 16 peer, 8 remediation, 6 service partnership, 2 pooled.

Seventeen megabanks remain unread, and Wells' own delineation is one lookup away.
