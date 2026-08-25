# Re-screening the 2022 vintage

**Date:** 2026-08-25 · **Data:** `bank-pe-mining/vintage2022_rescreen_2026.csv`,
`bank-pe-mining/corrupt_rows_resolved_2026.csv`

The corruption guard kept flagging rows from one exam vintage. This is the pass that
characterised the defect instead of working around it.

## The defect, measured

FDIC Large Bank evaluations must carry all three component ratings. Across the national
sweep:

| Publication year | Large Bank records | Missing components | Any "Substantial Noncompliance" |
|---|---|---|---|
| 2024–2026 | 237 | **0** | **0%** |
| **2023** | 93 | **29 (31%)** | **29%** |
| **2022** | 82 | **15 (18%)** | **21%** |
| 2016–2021 | 520 | **0** | **~0.1%** |

Substantial Noncompliance is genuinely rare — **0.1% across every other year, 25.1% in
2022–23.** A 250× inflation, with Needs-to-Improve simultaneously dropping to zero.

**This is a systematic field defect confined to publications in 2022 and 2023.** Component
ratings in that window were either dropped or overwritten with "Substantial Non Complianc".

## What it cost, and what it did not

**It did not cost accuracy where the values look normal.** Spot-checked the two largest
2022-vintage rows in our Harris pitch:

- **Prosperity Bank** — API says Service Low Satisfactory. PE confirms it.
- **Independent Bank** — API says Investment and Service Low Satisfactory. PE confirms both.

So the defect *drops or replaces* values; surviving values are trustworthy. The suspect
set is therefore identifiable: **2022–23 publications carrying an SN value or a missing
component.** Every one of those has now been read.

**It did cost us targets.** Across the guard-dropped rows and this re-screen, **six real
targets** were hidden by bad data:

| Bank | What the API said | What the PE says |
|---|---|---|
| **CTBC Bank Corp. (USA)** | Investment **and** Service Substantial Noncompliance | Investment Low Sat / Service Low Sat |
| Busey Bank | Lending + Service Substantial Noncompliance | Service Low Sat |
| Mechanics Bank | Lending + Service Substantial Noncompliance | Service Low Sat |
| River City Bank | Lending Substantial Noncompliance, Service missing | Investment Low Sat |
| FirstBank | Lending Substantial Noncompliance, Investment missing | Service Low Sat |
| Meridian Bank | Investment **and** Service Substantial Noncompliance | Investment Low Sat / Service Low Sat |

## CTBC Bank Corp. (USA) — the new target, $25,000

| | |
|---|---|
| Regulator | FDIC (cert 19416), $4.8B |
| PE | Feb 6, 2023 |
| **Investment / Service** | **Low Satisfactory / Low Satisfactory** |
| Los Angeles AA | *"comprised of Los Angeles and Orange Counties"* |
| Giving in that AA | **81 grants and donations totaling $490,000** (Community Services alone $339,000) |
| Ask | **$25,000** — formula returns $30,625, clamped to the ceiling |

**Los Angeles is the #1 SNAP enrollment gap in the country.** The PE adds that CD
investments and grants **decreased 20.3% on an annualised basis** since the prior
evaluation and that the bank *"does not lead peer institutions operating in the AA."*

It has four AAs across CA, NY and NJ — do not merge — and overlaps Hanmi, Mega and City
National on Los Angeles and Orange, so pro rata attribution applies.

**Meridian Bank** has the same real double gap but is in **Pennsylvania, which the state
registry refuses** on FNS-divergence grounds. No artifact can be generated for it today.

## The five "invisible" banks were clean

The missing-components population — Large Bank exams whose ratings simply weren't loaded,
and which therefore could never show a gap — yielded **zero new targets**. WesBanco,
Central Pacific, Mid Penn, Bryant and Fidelity Deposit & Discount all read clean. Three
others in that group (HomeStreet, HTLF, Citizens First) are closed institutions.

## Rules this establishes

1. **Any bank whose most recent PE published in 2022–23 and carries an SN or missing
   component rating must have its ratings read from the PE before use.** 32 of the 151
   FDIC pressured banks (21%) publish in that window; four carried SN/missing values and
   all four are now read.
2. **A guard-dropped row is a lead, not a discard.** Five of nine were real targets.
3. **Liveness must come from BankFind, never CRAPES** — six closed institutions surfaced
   across these two passes, two of them ($9.3B HomeStreet, $11.7B Berkshire) recent enough
   to have looked entirely plausible in a pitch list.

## The liveness check, now built — and it caught a live one

`tools/cra-artifact/src/liveness.py`. The network call queries FDIC BankFind
(`ACTIVE` / `ENDEFYMD`) and **records the answer on each bank**; enforcement is a set of
offline tests reading the stored answer, so CI never depends on a third-party API. A
`--send` gate refuses any bank not verified alive, and the checks go stale after 180 days.

One subtlety it has to get right: BankFind writes the sentinel **`12/31/9999`** rather
than null for an open institution. Read literally, that marks every live bank as closed.

**Run against the 151-bank FDIC pressure universe, 16 (11%) are closed institutions** —
including three above $6B. The one that mattered:

> **Independent Bank (TX, $18.3B) closed 2025-01-01 — and it was one of our four Harris
> candidates at $15,000.**

Its PE ratings had been spot-checked and confirmed accurate earlier the same day. That is
exactly the trap: a *correct* rating on an institution that no longer exists. **Ratings
verification and liveness verification are separate checks, and neither substitutes for
the other.** Harris drops to three candidates.

## Meridian Bank — read, and blocked on all eleven counties

Meridian's evidence is the strongest of any blocked bank in the roster:

| | |
|---|---|
| Regulator | FDIC (cert 57777), $2.5B |
| PE | Nov 29, 2022 |
| **Investment / Service** | **Low Satisfactory / Low Satisfactory** |
| Assessment area | **ONE** AA of *"11 contiguous counties"* spanning **four states** |
| Giving | **65 donations/EITCs totaling $511,526** — single AA, so this *is* the AA figure |
| Ask | **$25,000** (formula returns $31,970, clamped) |

The AA is the Philadelphia-Camden-Wilmington PA-NJ-DE-MD MSA in its entirety: Bucks,
Chester, Montgomery, Delaware and **Philadelphia** (PA); Burlington, Camden, Gloucester and
Salem (NJ); New Castle (DE); Cecil (MD).

**The block is worse than "PA is refused".** PA and NJ are refused on purpose — their fact
bases carry FNS-divergence CAUTION notes, and FNS rates Pennsylvania participation at
essentially 100%, a statistically-zero gap, so our headline metric cannot be stated there.
DE and MD were never built. **Nine of eleven counties sit in refused states and the other
two have no fact base, so not one county in this assessment area can be quantified.**

The AA contains **Philadelphia County — the 18th largest SNAP enrollment gap in the
country** — which is exactly the county our data cannot speak to.

Loaded with `artifact_status: blocked` and a stated reason. The generator now refuses it
with `ArtifactBlockedError` rather than an opaque "state not wired", and tests enforce that
a blocked bank still carries full evidence — verified, giving recorded, ask computed — so
nothing needs redoing when the fact base arrives.

One caveat on the anchor: the $511,526 is *"65 donations or educational improvement tax
credits (EITCs)"*. EITCs are a Pennsylvania tax-credit programme rather than straight
grants, so the donation-only figure is lower by an unstated amount and this ask sits at the
optimistic end.

## Open

- **Unblocking Meridian is a product decision, not a data chore.** It needs a template
  variant that leads with something other than absolute unmet need for FNS-divergent
  states. That changes the deliverable's core claim structure for a whole class of states
  and should be decided deliberately.
