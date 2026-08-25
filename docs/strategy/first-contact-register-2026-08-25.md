# First-contact register — the exhaustive push

**Date:** 2026-08-25 · **File:** `bank-pe-mining/first_contact_register_2026.csv` (308 rows)

One prioritised list across every institution we have evidence for: loaded targets,
the national pressure universe, and Massachusetts mortgage lenders under state CRA.

## What's in it

| Tier | Rows | What it is | Contact state |
|---|---|---|---|
| **1 — Loaded targets** | 19 | PE-read, AA-verified, ask computed | 6 named, 6 role channels, rest open |
| **2 — Pressure universe** | 190 | Live banks with an Investment or Service gap | **Domain verified** for every one; AA not read |
| **3 — MA mortgage lenders** | 99 | Under Massachusetts state CRA (MLCI) | PE URL for every one; contacts not researched |

**46 rows are priority 1.** Ten are loaded targets with a real ask; the rest are
Massachusetts lenders whose Service Test is rated **Needs to Improve**.

## The finding that reframes the push

**40 of 57 scanned Massachusetts mortgage lenders have a Service Test rated "Needs to
Improve."** Banks in our national screen carry a gap at roughly 6% (233 of ~3,700
institutions). Massachusetts non-depository lenders carry one at **70%**.

That is not a coincidence — MA examines mortgage lenders under a state CRA regime with a
service-delivery component many of them barely address, and the regulator says so in
writing. Every one of those PEs is public, linked in the register, and names what the
examiner wanted and did not get.

**This is the densest concentration of documented, addressable pressure we have found**,
and it is in the one state whose regime we have already researched. Rocket, loanDepot,
NewRez, Nationstar, PennyMac, Movement and CMG are all on it.

## Named contacts so far (6)

| Institution | Contact | Channel |
|---|---|---|
| Western Alliance | **Craig Robinson**, Head of Community Relations | (408) 689-8417 |
| Busey | **Matthew Sabatino** | **CRA@busey.com** |
| First American | **David J. Leeney**, CRA Officer | Elk Grove Village IL |
| FirstBank (TN) | **Samson Eberhart**, CRA Officer | **crafairlendingcompliance@firstbankonline.com** |
| CTBC | **Robert De Acevedo**, SVP & CRA Officer | verify first — search-sourced |
| City National | **Adey Tesfaye**, Head of CRA | verify first — search-sourced |

Prefer the role mailbox where one exists. `CRA@busey.com` and
`crafairlendingcompliance@firstbankonline.com` outlive whoever holds the seat.

## The bulk harvest mostly failed — and that is the finding

Fetching all 202 verified bank domains (plus their `/cra` paths) to extract contacts
returned **180 HTTP errors out of 202**. Bank websites block scripted clients the same way
mass.gov does. Scripted harvesting is not a viable route to bank contact data.

What it did yield:

- **3 CRA mailboxes** — `CRA@lakecitybank.com` (Lake City Bank, IN),
  `cra-cbom@communitybank.net` (Community Bank of Mississippi), and a named officer,
  `paul.crawford@yakimafed.com` (Yakima Federal Savings)
- **134 phone numbers**, all marked **UNVERIFIED — dial to confirm**

**The phone numbers contain false positives.** A spot check found `(793) 982-1793` and
`(842) 672-1226`; neither 793 nor 842 is an assigned NANP area code. A format check does
not catch these — real validation needs the assigned-code list, which we do not hold. Most
of the rest look plausible (Ocean Bank `(305) 569-5000`, Bank of Hope `(855) 325-2226`),
but **treat every harvested number as a lead to dial, not a fact**.

The reliable route for a specific bank is the in-app browser, which presents a real TLS
fingerprint and gets through — that is how the mass.gov block was beaten earlier. It is
accurate but manual, roughly a minute per bank.

## Why tier 2 has no names, and why that is fine

CRA rules require a bank to publish *where* to send comments, not *who* reads them. Most
publish a role and an address. Chasing 190 names by hand would take days and go stale.

What the register gives instead is the **FDIC-verified website for every live institution**,
pulled from BankFind by certificate number. That matters more than it sounds: it makes the
name-collision trap impossible. Searching "First American Bank" or "Texas First Bank" by
name returns the wrong institution's CRA officer — it did twice while compiling this. A
domain tied to a cert cannot.

Standard last mile per institution, about ten minutes: open `<domain>/cra`, take the
contact from the CRA notice itself, never from a directory or aggregator.

## Five banks with an apparently vacant CRA seat

Ocean, Hanmi, Third Coast and two others surfaced with **open CRA Officer job postings**. A
vacant seat means a slow response and sometimes an institution that knows it has a problem.
Do not read silence there as refusal.

## Deferred

Five Star Bank and Bank of Marin drop to priority 4. Both have real documented gaps, but
their PEs disclose no per-assessment-area donation figure, so there is no defensible ask —
contacting them would mean asking for a number we cannot justify.

## Before any of this is sent

Unchanged and unmoved by having contacts: **charitable-solicitation registration is unfiled
in every state we would pitch**, and there is **no 990 and no audited financial statement**
— a common hard gate at grant intake, before anyone reads the pitch. Massachusetts, the
state with the richest target list, requires registration plus Schedule A-2.
