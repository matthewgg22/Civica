# Coverage mode: pitching a state where we cannot claim a gap

**Date:** 2026-08-25 · **Code:** `tools/cra-artifact/src/coverage.py`, `src/states.py`

Pennsylvania and New Jersey were refused by the generator on purpose. Their fact bases
carry FNS-divergence CAUTIONs: **USDA FNS rates Pennsylvania participation at 100%** (a
capped estimate) under federal eligibility rules, i.e. no measurable enrollment gap, while
our gross-income proxy shows ~803,000 people in non-receipt households. Both cannot be
true, and in PA the proxy's known upward biases — ACS SNAP under-reporting, a 130% screen
against a 200% BBCE state — dominate.

The refusal was correct. But **refusing a state is not the same as having nothing true to
say about it**, and the refusal was blocking Meridian Bank, whose evidence is otherwise the
strongest in the roster.

## What the variant does

It **ranks counties instead of counting people.** That is precisely, and only, what the
fact base permits: *"use these figures ONLY as geographic ranking, never as an absolute-gap
claim."*

Page 1 in coverage mode:

- **Leads with the least-covered county** — the place an outreach dollar goes furthest
- **States no population gap and no dollar figure**, and says so explicitly rather than
  simply omitting them
- **Discloses the FNS divergence in the bank's own document**, naming the participation rate
- **Explains that coverage above 1.0 is expected** — the denominator stops at the poverty
  line while eligibility does not, so an unexplained ratio above 1.0 would read as "more
  enrolled than qualify", which is false
- Stat tiles become counties-ranked / lowest coverage / highest coverage

Page 3's funnel gains a caveat: conversion rates were observed in states with a measured
gap, so in a high-participation state a larger share of people reached are already enrolled
and the application and approval rows are an upper bound.

## The data

`coverage = SNAP households ÷ households below 100% FPL`, from the national coverage index
(ACS 2024 5-year, B22003 and B17017). Both terms are ACS. It is a **screening index, not an
eligibility model** — it orders geographies and counts nothing.

Its one great advantage: **it covers all 3,221 counties**, including states with no PUMS
fact base at all. That is what makes Meridian buildable.

## Meridian, unblocked — and the ranking inverts the intuition

Meridian's single assessment area spans eleven counties in four states. Ranked:

| Least covered | | Best covered |
|---|---|---|
| **Burlington, NJ — 0.70** | Gloucester NJ 0.79 · Chester PA 0.96 · Montgomery PA 0.97 · New Castle DE 0.98 | Salem NJ 1.01 · Camden NJ 1.05 · Bucks PA 1.17 · Delaware PA 1.20 · **Philadelphia PA 1.25** · Cecil MD 1.33 |

**Philadelphia — the 18th largest gap in the country on our national ranking — is among the
best-covered counties in this assessment area.** The money should go to Burlington and
Gloucester in New Jersey. Had the absolute template been forced through, it would have
pointed at Philadelphia and been wrong.

Meridian's ask is unchanged at **$25,000** and its record needed no rework, because it kept
full evidence while blocked.

## What this does not do

It does not make PA a good enrollment-outreach state. FNS says there is essentially no
enrollment gap there, and no template changes that. What coverage mode does is let us work
in a divergent state **honestly** — directing money by relative need, with the divergence
disclosed on the page — instead of either fabricating a gap or walking away.

If a PA-only bank comes up whose entire assessment area scores above 1.0, the right answer
is still to decline the enrollment pitch. The retention thesis would be the honest one
there, and we have no PA churn data.

## Open

- The coverage index has a known artifact: **college counties** (student poverty) inflate
  apparent under-coverage. None of Meridian's eleven is one, but a future coverage-mode
  bank should be checked.
- Coverage mode is wired for PA and NJ only. Any other state with an FNS-divergence CAUTION
  should be added the same way rather than refused.
