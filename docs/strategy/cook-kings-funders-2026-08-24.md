# Cook and Kings: funders

**Date:** 2026-08-24
**Scan record:** `data-ops/analysis/bank-pe-mining/cook_kings_2026.csv`

Cook is the **3rd** and Kings the **5th** largest SNAP enrollment gap in the country. Both
already had candidates from the FDIC pass, but most carried the note *"read the AA before
send"* — the step that broke five of eight banks in the earlier adversarial pass.

Two things came out of this: the OCC/Fed route, which rescued Maricopa and Harris, produces
**nothing** in either county; and reading the PEs **changed the answer for Kings**.

## Cook: Busey Bank — the dispute is resolved, and it is the primary

Busey (cert 16450, **$12.45B**) had been flagged DISPUTED because the FDIC API and the PE
text disagreed on its Service rating. **The API record is corrupt.**

Its 2022 CRAPES row carries `LENDING_RATING` **and** `SERVICE_RATING` both as *"Substantial
Non Complianc"*, with `INVEST_RATING` and `RATING_POINTS` **missing entirely** — the only one
of Busey's eleven records missing those fields. Every other record from 1992 onward is
complete and internally consistent.

The row is also impossible on its face: **a bank cannot be rated Satisfactory overall with a
Lending Test at Substantial Noncompliance**, since the lending test is weighted most heavily.
That contradiction is the proof, independent of the PE.

The PE states plainly: **Lending Low Satisfactory / Investment High Satisfactory / Service Low
Satisfactory**, overall Satisfactory. So the disagreement was never only about Service — the
API is wrong on two fields and silent on two more.

Reading the PE also promotes Busey to the **primary Cook target**:

| | |
|---|---|
| Assets | **$12.45B** — largest verified Cook candidate |
| PE | Mar 25, 2022 (published Dec 2022) — **4 years old, next exam likely imminent** |
| Service Test | Low Satisfactory institution-wide |
| Chicago MD AA | *"Cook, DuPage, Grundy, and Will County"* — 15 branches, second-most weight of the Illinois AAs |
| Giving in that AA | 89 donations totaling **$398,000** (up from $41,000 at the prior exam) |
| Ask | **$15,000** |

The reason it is the best fit is not the size. In the Chicago MD AA the PE finds **"poor
performance under the Service Test"** — harsher than the institution-wide rating — and names
the cause: *"Busey Bank has no branches, limited service facilities, or ATMs within low- and
moderate-income areas."* A digital outreach campaign reaching LMI households across Cook
County is a service-delivery response to that specific finding, not a generic donation.

Busey also shows the per-AA rule at its most extreme: **$398,000 in Chicago against $2,000 in
Bloomington** — a 199× spread inside one bank.

## Cook secondary: Lakeside Bank

| | |
|---|---|
| Regulator | FDIC (cert 19573), $2.6B |
| PE | Dec 4, 2023 |
| Investment / Service | **Low Satisfactory / Low Satisfactory** |
| AA | *"the entirety of Cook County and DuPage County"* — **one assessment area** |
| Giving in that AA | 32 donations and grants totaling **$72,000** |
| Ask | **$10,000** |

The single assessment area is the whole argument. Every other bank in the roster raises the
question of *which* market a component rating describes; Lakeside has only one, so both
gaps describe Cook County directly. Both counties are whole-county, so county data does not
overstate the area either. Seven locations in Cook, six of them in Chicago.

**Cook third — First American Bank** (cert 3657, $7.1B): Investment and Service both Low
Satisfactory, and the PE says the Investment Test is Low Satisfactory *in the Multistate AA
specifically* — the gap is confirmed in the target market. 166 donations totaling **$440,000**
there. Ask **$15,000**. Kenosha County, Wisconsin is in its AA and is excluded from our
figures; its separate Florida (Miami-Dade) and Kankakee AAs must not be merged in.

## Kings: Habib American Bank — and a correction

**The prior record named Amalgamated Bank as the Kings target on a Low Satisfactory Service
Test. Reading the PE shows that is wrong.** Amalgamated's Service Test is rated **High
Satisfactory in the New York assessment area**; the institution-wide Low Satisfactory comes
from its California or DC assessment areas. Kings has no gap at Amalgamated. Its ask drops
to 0 and it is recorded as DOWNGRADED rather than deleted.

The real Kings target is **Habib American Bank**, and it is stronger than the record showed:

| | |
|---|---|
| Regulator | FDIC (cert 25093), $2.9B |
| PE | Jul 14, 2025 |
| Investment | **Low Satisfactory** |
| **Service** | **NEEDS TO IMPROVE** — the prior record said Low Satisfactory |
| AA | NY portion: *"Bronx, Kings, Nassau, New York, and Queens Counties"* |
| Giving in that AA | 22 donations totaling **~$205,000** in the NY-NJ rated area |
| Ask | **$15,000** (raised from $10,000) |

This is the **strongest documented gap in the roster** — a Needs to Improve, not merely a Low
Satisfactory — and the PE states the NY-NJ rated area *"received the most weight in the
overall ratings,"* so the rating describes this assessment area rather than being inherited
from California. Their giving in the area also **declined**, from $4.6M to $3.5M since the
prior evaluation.

Their separate California AA (Los Angeles-Long Beach-Anaheim) performs below NY-NJ on every
test and must not be merged. The New Jersey portion of the AA is excluded from our figures.

## The OCC/Fed route produces nothing here

This is worth stating plainly, because it is the opposite of Maricopa and Harris. Every large
OCC- or Fed-supervised bank in Cook and Kings is rated Outstanding or High Satisfactory on
the components our activity feeds: BMO ($252B), Wintrust NA, Beverly Bank, Ponce Bank,
Northfield, Flagstar. There is no pressure to work with. Cook and Kings are dense,
well-banked markets where the CRA money is already flowing — the FDIC-supervised mid-size
banks are the entire opportunity.

**One near miss worth recording.** Midland States Bank ($7.8B) has an Investment Test rated
Low Satisfactory and an assessment area it calls *"the Chicago assessment area."* That AA is
DeKalb, Kane, Kendall, Kankakee, Grundy and Will counties — **it does not include Cook.**
Cook County appears zero times in the PE. An AA named Chicago that does not contain Chicago
is exactly the assumption this method exists to catch.

Northfield Bank's clean High Satisfactory also **confirms the earlier retraction** of the
false "Investment Needs to Improve" flag that a 2007 FDIC-era record had produced.

## Illinois is now wired into the generator

Cook artifacts could not be produced before this — `IL` was missing from
`tools/cra-artifact/src/states.py` even though the fact base existed at
`data-ops/sample/il-snap-gap/`. Added: FIPS 17, 102 counties, no FNS-divergence caution.
Cook County alone carries **728,176 eligible people at a 46.2% non-enrollment rate.**

## Open

- ~~Busey Bank remains DISPUTED.~~ **Resolved 2026-08-24: the API row is corrupt, the PE
  governs, and Busey is now the primary Cook target.**
- **Busey's PE is 4 years old.** Confirm no newer evaluation has published before sending —
  and note the timing argument cuts our way if one is pending.
- Parkway Bank, Republic Bank of Chicago and Shinhan Bank America are still unverified
  FDIC-pass candidates. They are plausible, not confirmed.
- IL and NY charitable solicitation registration are send gates. **NY CHAR410 is known to be
  onerous** and gates the Kings pitch.
