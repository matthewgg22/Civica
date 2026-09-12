# Is the outreach board exhaustive? No.

**Date:** 2026-08-25

Short answer: it covers **traditional banks whose component ratings are searchable**, plus
**Massachusetts mortgage lenders**. Everything else in the CRA-covered universe is missing,
and some of it is missing for structural reasons that no amount of sweeping fixes.

## What the board covers

| | Count | How found |
|---|---|---|
| Banks and thrifts with an Investment or Service gap | **229** | FDIC CRAPES + Fed BankRatingResult, all 51 jurisdictions |
| Massachusetts non-depository mortgage lenders | **99** | HMDA 2024 + MA Division of Banks register |

Industrial loan companies and branch-light online banks are in there **incidentally** —
WEX Bank (Utah, 1 office, $7.6B) and NexBank (Texas, 2 offices, $13.9B) both appear — but
they were never sought as a category.

## What is missing

### 1. New York mortgage lenders — 70 identified, never worked

New York DFS supervises licensed non-depository mortgage bankers under its own CRA regime.
A 70-lender list was built on 2024 HMDA originations and has sat untouched at
`state-cra-mortgage/ny_nondepository_200plus_2024.csv`. **No PE has been read, no service
test scanned, no contact gathered.**

### 2. Illinois mortgage lenders — 162 identified, never worked

Same story under 205 ILCS 735, and it is the **largest single unworked list in the
project** — `il_nondepository_50plus_2024.csv`. Illinois also has Cook County, the third
largest enrollment gap in the country.

### 3. The tri-state overlap is the real prize, and it is untouched

**77 lenders operate in two or more of Massachusetts, New York and Illinois.** One
relationship there spans multiple state CRA regimes at once:

| Lender | States | MA | NY | IL | Total 2024 originations |
|---|---|---|---|---|---|
| **Rocket Mortgage** | 3 | 5,027 | 11,366 | 9,338 | **25,731** |
| **United Shore (UWM)** | 3 | 3,842 | 10,994 | 8,956 | **23,792** |
| Guaranteed Rate | 3 | 4,444 | 1,044 | 9,021 | 14,509 |
| CrossCountry Mortgage | 3 | 3,233 | 4,716 | 5,020 | 12,969 |
| Fairway Independent | 3 | 2,100 | 814 | 3,963 | 6,877 |
| loanDepot | 3 | 1,206 | 1,626 | 3,521 | 6,353 |

The board shows only the Massachusetts column of this table.

### 4. Credit unions — zero in the pipeline

Federal credit unions are not subject to CRA, but **Massachusetts examines
state-chartered credit unions** under its state regime, and Connecticut and Rhode Island
cover those with a geographic field of membership. None has ever been screened. This was
raised early in the project and never actioned.

### 5. OCC-supervised banks — structurally invisible

The OCC publishes **no searchable component ratings**. Its "CRA Search" is a Google Custom
Search over PDFs and its only structured listing is by *overall* rating. Every national
bank — including the largest — can only be found by charter probing one at a time, as was
done for Maricopa and Harris. **This is a permanent limit of the method, not a backlog.**

### 6. Strategic-plan banks — also structurally invisible

A bank evaluated under an approved strategic plan has **no component ratings at all**;
performance is measured against negotiated goals. Western Alliance — now a $25,000 target
covering Maricopa, Los Angeles, Clark and Pima — was found by hand and could never have
surfaced in the sweep. There is no list of strategic-plan banks in this project.

### 7. Wholesale and limited-purpose banks — excluded by construction

These are evaluated on a **Community Development Test** rather than Lending/Investment/
Service, so a screen keyed on Investment and Service ratings cannot see them. Helm and Mega
were rejected on exactly this basis. The category is not searched.

## Rough scale of what is missing

| Gap | Approximate size |
|---|---|
| Illinois lenders | 162 |
| New York lenders | 70 |
| Credit unions (MA/CT/RI) | unknown, never counted |
| OCC banks | ~1,000 national banks, unscreenable in bulk |
| Strategic-plan banks | unknown, invisible by construction |
| Wholesale / limited-purpose | unknown, excluded by construction |

**At minimum 232 more non-depository lenders exist on lists already built.** That is larger
than the entire bank pipeline the board currently shows.

## Recommended order

1. **Illinois lenders (162)** — largest list, already built, and Illinois state CRA is a
   real regime. Cook County sits behind it.
2. **New York lenders (70)** — NYDFS regime; the tri-state overlap means the biggest names
   recur here.
3. **The 77 tri-state lenders as a single cohort** — Rocket, UWM, Guaranteed Rate,
   CrossCountry and loanDepot appear in all three states. One conversation, three regimes.
4. **Credit unions** under MA/CT/RI.
5. Strategic-plan and wholesale banks only if a targeted list can be built; neither is
   sweepable.

## One caution carried over

The Massachusetts lender work established that **the bank ask method does not transfer to
lenders** — they have no assessment area in the bank sense and no Investment Test, only a
Service Test on whether they reach LMI borrowers. Pricing any of the above needs its own
rule before an ask is anchored on anything.
