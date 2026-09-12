# Goal 2 fixed at the root, and contacts extended to all 2,085

**2026-08-26.**

## Goal 2 — the metric was measuring the wrong thing

The board printed unenrolled figures from a file that mixed **MODELED** and **survey-weighted**
counties, sitting on top of an ACS metric that compared SNAP households against households under
**100% of the federal poverty line**.

**SNAP reaches 130% FPL, and up to 200% under broad-based categorical eligibility.** With the
wrong denominator, **1,010 of 3,222 counties came out at coverage ≥ 1** and their gap floored to
zero. Los Angeles read 1.032 — apparently over-served, actually an artifact. Fresno and Kern
showed "no measured gap" for the same reason.

The file's own provenance already said so — *"SCREENING INDEX ONLY … this is not an eligibility
model"* — and the board was printing it as though it were one.

**One method now, everywhere:**

1. **ACS C17002** gives the ratio-of-income-to-poverty distribution per county, in persons.
   Eligible-population proxy is everyone under 1.30 of poverty: bracket 1.00–1.24 whole, plus
   5/24 of the 1.25–1.49 bracket.
2. **USDA FNS / Mathematica** publishes eligible-unenrolled by **state** for FY2022 — the
   authoritative total.
3. Each state's total is allocated across its counties by share of the under-130% population.

| County | Was | Now |
|---|---:|---:|
| Los Angeles, CA | 796,577 *(modeled)* | **251,440** |
| Harris, TX | 497,207 | **186,781** |
| Maricopa, AZ | 333,882 | **103,029** |
| Dallas, TX | 248,444 | **90,365** |
| Fresno, CA | "no measured gap" | **34,092** |
| Kern, CA | "no measured gap" | **32,290** |

**874 counties across 10 states** carry a figure. Counties in states without a published FNS
total — including **Cook, IL and Philadelphia, PA** — show an em dash, not a zero: we do not know
the number there rather than knowing it is nil.

It is still an **allocation, not a county measurement**, and the card says so.

## Contacts — extended to all 2,085, with the limit stated

Every addressable institution across all three federal regulators now has a route, in three tiers
that do not overclaim:

| Route | Count | What it is |
|---|---:|---|
| Named officer | **5** | A person, with a channel |
| CRA channel | **5** | A mailbox, switchboard or public-file page — the role, no name |
| Role route | **2,075** | "CRA Officer" at the FDIC-verified main office |
| No route | **0** | — |

The role route is a real destination rather than a placeholder: every CRA-covered bank must
designate someone responsible for its public file under **12 CFR §__.43**.

**The honest limit: ten of 2,085 have a name or a CRA-specific channel.** The rest are a verified
address and a designated role — a genuine starting place, and not the same thing as knowing who
to call. Naming officers is manual work per bank and no public source does it at scale:
performance evaluations do not name them, and BankFind carries no phone field.

## Where the four goals stand

| Goal | Status |
|---|---|
| 1. Exhaustive institutions + best contact | **2,085 institutions, 100% with a route** — 10 with a name or channel |
| 2. Effective unenrolled by district | **One method, 874 counties**; gaps shown as gaps |
| 3. CRA incentive and context per bank | Done |
| 4. Generatable one-pager | **Pro-rata impact, week-by-week schedule, closing report** |

## Data

- `data-ops/analysis/national-snap-coverage/county_eligible_unenrolled_2026.csv` (3,222 counties)
- `data-ops/analysis/national-snap-coverage/build_county_gap.py`
- `data-ops/analysis/cra-universe-2026/universe_first_contact_2026.csv` (2,085 institutions)
- `tools/cra-artifact/src/contacts.py`, `src/prorata.py`
