# Working the queue head

**2026-08-26.** Five PEs pulled and read from the top of the rebuilt universe.

## Result

| Bank | Regulator | Outcome |
|---|---|---|
| **Truist** | FDIC | ✅ **loaded — peer, $25,000** |
| **Prosperity** | FDIC | ⛔ loaded but **blocked**: no Houston-scoped giving figure exists |
| Frost | FED | ⏸ needs a per-AA read |
| First-Citizens | FDIC | ⏸ needs a per-AA read |
| Glacier | FDIC | ⏸ its disclosed figures are Montana and Utah, not Maricopa |

## Truist — the case for the whole thesis revision

Texas rated area: **Lending High Satisfactory / Investment Outstanding / Service Outstanding**,
Texas overall **OUTSTANDING**. Clean on both tests our activity feeds, which is precisely why
a gap-filtered universe could never return it.

Houston MSA assessment area, delineation verbatim: *"Austin, Brazoria, Chambers, Fort Bend,
Galveston, Harris, Liberty, Montgomery, and Waller Counties"* — 1,072 census tracts, 21
branches. Giving, verbatim and AA-scoped in its own sentence:

> "The bank has an excellent level of qualified investments and grants **in the Houston MSA
> assessment area**. Qualified investments total $38.6 million… and **49 grants totaling
> $1.9 million**."

Two figures in that same document were *not* used and are recorded as such: **$274.3 million**
is bank-wide donations and grants, and **$22.9 million** belongs to Raleigh. Lifting either
would have been the City National error again.

Loaded as **peer**, ask **$25,000** (capacity anchor hits the ceiling).

## Prosperity — a real target the guard refuses to send

Texas rated area: **Investment High Satisfactory / Service LOW SATISFACTORY** — a genuine
Service gap, and 169 branches in top-need counties.

**A trap caught in passing:** the first ratings block in the document is **Oklahoma's**
(Investment Low Satisfactory / Service Low Satisfactory), not Texas's. Reading the first
match would have attributed the wrong ratings to the wrong rated area.

It is also plainly **instrument-heavy**: **$557.4M** of qualified investments in Texas against
**$3.489M** of donations — a **160×** ratio. Archetype 4.

**But the PE discloses no Houston-scoped donations figure at all.** Investments are broken out
by assessment area; donations are not. So the record carries a state-level figure and an
`ask_scope_caveat`, and the generator **refuses to build the artifact** — which is the correct
outcome, not a failure. The ask itself ($10,000, the service-partnership floor) does not depend
on the giving figure, so it is sound; only the claim of AA scope is missing.

**Second flag:** the PE is dated 2022-07-18, **four years old**. After Busey, a
remediation-flavoured pitch off a four-year-old finding is a real risk.

## The Busey lesson, generalised into a guard

A PE can be *current* — no successor published — and still be old enough that its finding no
longer describes the bank. `test_staleness.py` now fails any **remediation** pitch quoting a
finding older than **four years** unless the record carries an explicit `pe_age_caution`.

Today all ten remediation targets sit under that line. **Meridian (3.7y) and CTBC (3.6y) are
the next to cross it.**

## What the deferred three need

Frost, First-Citizens and Glacier are all multi-assessment-area institutions whose disclosed
figures must be attributed to a specific AA before use. Glacier is the clearest illustration:
its large disclosed donations belong to **Montana and Utah**, while its exposure in our ranking
comes from **Maricopa**. Using the headline number would overstate its Phoenix capacity by
orders of magnitude. Each needs a dedicated read, not a regex.

## Roster

**21 sendable, $362,000.** Truist is the second-largest capacity figure on the roster after
Woodforest, and both entered only after the screen changed.
